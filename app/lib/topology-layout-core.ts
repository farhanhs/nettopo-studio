import type { ElkNode } from "elkjs/lib/elk-api";
import { z } from "zod";
import type { Device, DeviceType, Project } from "./topology-types";
import {
  LayoutContractError, LayoutRequestSchema, assertSmartLimits, canonicalJson, canonicalProject,
  immutable, ordinal, parseLayout, sha256Canonical, validateIntent, validateLayoutPositions,
  validateLayoutProject, validatePins,
} from "./topology-layout-contract.ts";
import type { GeometryVersion, LayoutIntent, LayoutPosition, LayoutRequest, ProviderRefMap } from "./topology-layout-contract.ts";
import { BASE_LAYOUT_GEOMETRY, assertBaseGeometry, layoutNodeRect } from "./topology-geometry.ts";
import { buildLayoutMetrics, orderLayersByConnectivity, resolveLayoutMode } from "./topology-layout.ts";
import type { ResolvedLayoutMode } from "./topology-layout.ts";

export type LayoutSnapshot = {
  topologyId: string; customerId?: string; baseRevision: string; graphHash: string;
  geometryVersion: GeometryVersion; project: Project;
  nodeRects: ReturnType<typeof layoutNodeRect>[]; capturedAt: string;
};
export type IntentInput = { intent: LayoutIntent; refMap: ProviderRefMap };
export type LayoutPlan = {
  request: LayoutRequest; mode: ResolvedLayoutMode;
  direction: "left-to-right" | "top-to-bottom";
  layers?: string[][]; compact: boolean;
};
/** Unscored coordinates, NEVER an apply authorization or a safe LayoutCandidate. */
export type LayoutDraft = {
  status: "unscored"; requestId: string; topologyId: string; baseRevision: string;
  graphHash: string; geometryVersion: GeometryVersion;
  resolvedMode: ResolvedLayoutMode; positions: LayoutPosition[]; pinnedDeviceIds: string[];
};
export type LayoutEngine = (graph: ElkNode) => Promise<ElkNode>;
const contextSchema = z.object({
  topologyId: z.string().min(1).max(128), customerId: z.string().min(1).max(128).optional(),
  capturedAt: z.iso.datetime().optional(),
}).strict();

/** Caller must drain queued writes before capture; this helper does not implement store locking. */
export async function captureLayoutSnapshot(
  value: unknown, context: z.input<typeof contextSchema>, geometry: GeometryVersion = BASE_LAYOUT_GEOMETRY,
): Promise<LayoutSnapshot> {
  const parsed = parseLayout(contextSchema, context);
  const project = validateLayoutProject(value);
  const geometryVersion = assertBaseGeometry(geometry);
  const nodeRects = [...project.devices].sort((a, b) => ordinal(a.id, b.id)).map((d) => layoutNodeRect(d, geometryVersion));
  const [baseRevision, graphHash] = await Promise.all([
    sha256Canonical(canonicalProject(project)),
    sha256Canonical(canonicalJson({ geometryVersion, nodeRects,
      links: [...project.links].sort((a, b) => ordinal(a.id, b.id)).map(({ id, from, to, kind }) => ({ id, from, to, kind })),
    })),
  ]);
  return immutable({ ...parsed, project, nodeRects, geometryVersion, baseRevision, graphHash,
    capturedAt: parsed.capturedAt ?? new Date().toISOString() });
}

const DEVICE_ORDER: DeviceType[] = ["modem", "router", "firewall", "switch", "access-point", "mesh-node", "ssid", "server", "nas", "erp", "pos", "printer", "camera", "iot", "client"];
function endpoint(device: Device) { return !["modem", "router", "firewall", "switch"].includes(device.type); }
function keyword(device: Device, words: string[]) {
  const text = `${device.name} ${device.model ?? ""} ${device.location ?? ""}`.toLowerCase();
  return words.some((word) => text.includes(word));
}
function sorted(devices: Device[], graph: ReturnType<typeof buildLayoutMetrics>) {
  return [...devices].sort((a, b) => (graph.degree.get(b.id) ?? 0) - (graph.degree.get(a.id) ?? 0) ||
    DEVICE_ORDER.indexOf(a.type) - DEVICE_ORDER.indexOf(b.type) || ordinal(a.name, b.name) || ordinal(a.id, b.id));
}
/** Retain the legacy last-assignment precedence for devices matching multiple semantic layers. */
function distinctLayers(layers: Device[][]) {
  const lastLayer = new Map<string, number>();
  layers.forEach((layer, index) => layer.forEach((d) => lastLayer.set(d.id, index)));
  return layers.map((layer, index) => layer.filter((d) => lastLayer.get(d.id) === index)).filter((layer) => layer.length > 0);
}
export function classifyThreeTier(project: Project): Device[][] {
  const graph = buildLayoutMetrics(project);
  const { devices } = project;
  const source = sorted(devices.filter((d) => d.type === "modem" || keyword(d, ["wan", "internet", "isp", "電信", "數據機"])), graph);
  const edge = sorted(devices.filter((d) => d.type === "firewall" || d.type === "router"), graph);
  const switches = devices.filter((d) => d.type === "switch");
  const namedCore = switches.filter((d) => keyword(d, ["core", "backbone", "核心", "主幹"]));
  const core = namedCore.length ? sorted(namedCore, graph) : sorted(switches, graph).slice(0, Math.max(1, Math.min(2, Math.ceil(switches.length / 4))));
  const coreIds = new Set(core.map((d) => d.id));
  const distribution = sorted(switches.filter((d) => !coreIds.has(d.id) &&
    (keyword(d, ["distribution", "dist", "aggregation", "匯聚", "彙聚"]) || (graph.degree.get(d.id) ?? 0) >= 3)), graph);
  const distributionIds = new Set(distribution.map((d) => d.id));
  const access = sorted(devices.filter((d) => (d.type === "switch" && !coreIds.has(d.id) && !distributionIds.has(d.id)) ||
    ["access-point", "mesh-node", "ssid"].includes(d.type)), graph);
  const endpoints = sorted(devices.filter((d) => ["server", "nas", "erp", "client", "printer", "camera", "pos", "iot"].includes(d.type)), graph);
  const used = new Set([...source, ...edge, ...core, ...distribution, ...access, ...endpoints].map((d) => d.id));
  return distinctLayers([source, edge, core, distribution, access, endpoints, sorted(devices.filter((d) => !used.has(d.id)), graph)]);
}
export function classifySpineLeaf(project: Project): Device[][] {
  const graph = buildLayoutMetrics(project);
  const switches = project.devices.filter((d) => d.type === "switch");
  const namedSpines = switches.filter((d) => keyword(d, ["spine", "core", "backbone", "核心", "主幹"]));
  const spines = namedSpines.length ? sorted(namedSpines, graph) : sorted(switches.filter((d) =>
    (graph.switchDegree.get(d.id) ?? 0) >= 2 && (graph.endpointDegree.get(d.id) ?? 0) === 0), graph);
  const spineIds = new Set(spines.map((d) => d.id));
  const leaves = sorted(switches.filter((d) => !spineIds.has(d.id) &&
    (keyword(d, ["leaf", "access", "tor", "接入"]) || (graph.endpointDegree.get(d.id) ?? 0) > 0 || (graph.switchDegree.get(d.id) ?? 0) > 0)), graph);
  const edge = sorted(project.devices.filter((d) => ["modem", "router", "firewall"].includes(d.type)), graph);
  const endpoints = sorted(project.devices.filter(endpoint), graph);
  const used = new Set([...edge, ...spines, ...leaves, ...endpoints].map((d) => d.id));
  const rows = Array.from({ length: Math.ceil(endpoints.length / 6) }, (_, i) => endpoints.slice(i * 6, i * 6 + 6));
  return [edge, spines, leaves, ...rows, sorted(project.devices.filter((d) => !used.has(d.id)), graph)].filter((row) => row.length);
}

export function resolveLayoutPlan(snapshot: LayoutSnapshot, value: unknown, provider?: IntentInput): LayoutPlan {
  const request = parseLayout(LayoutRequestSchema, value);
  assertBaseGeometry(snapshot.geometryVersion);
  assertBaseGeometry(request.geometryVersion);
  if (request.topologyId !== snapshot.topologyId || request.baseRevision !== snapshot.baseRevision || request.graphHash !== snapshot.graphHash) throw new LayoutContractError("STALE_LAYOUT");
  const project = validateLayoutProject(snapshot.project);
  request.pinnedDeviceIds = validatePins(project, request.pinnedDeviceIds, request.track === "smart");
  if (request.track === "smart") assertSmartLimits(project);
  if ((request.track === "smart") !== Boolean(provider)) throw new LayoutContractError("INVALID_LAYOUT_PROPOSAL");
  const input = provider ? validateIntent(provider.intent, provider.refMap, project) : undefined;
  const intent = input?.intent;
  const mode = intent?.strategy === "layered" || intent?.strategy === "compact"
    ? "layered" : resolveLayoutMode(project, request.requestedMode);
  const direction = intent?.direction ?? (mode === "spine-leaf" ? "top-to-bottom" : "left-to-right");
  let layers: Device[][] | undefined;
  if (intent?.layers && input) {
    const byId = new Map(project.devices.map((d) => [d.id, d]));
    layers = intent.layers.map((l) => l.nodeRefs.map((r) => byId.get(input.refMap.nodeByRef[r])!));
  } else if (intent?.strategy === "grouped" || intent?.groupOrder?.length || (request.objective === "group-by-function" && !intent)) {
    const priority = (intent?.groupOrder ?? []).map((r) => input!.refMap.groupByRef[r]);
    const buckets = new Map<string, Device[]>();
    for (const d of project.devices) {
      const key = intent ? (d.groupId ?? "") : d.type;
      buckets.set(key, [...(buckets.get(key) ?? []), d]);
    }
    layers = [...buckets.keys()].sort((a, b) => {
      const ai = priority.indexOf(a), bi = priority.indexOf(b);
      return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi) || ordinal(a, b);
    }).map((key) => buckets.get(key)!);
  } else if (intent?.strategy === "backbone-centered" || (request.objective === "keep-backbone-centered" && !intent)) {
    layers = classifyThreeTier(project);
  } else if (intent?.strategy !== "layered" && intent?.strategy !== "compact") {
    if (mode === "three-tier") layers = classifyThreeTier(project);
    if (mode === "spine-leaf") layers = classifySpineLeaf(project);
  }
  if (!layers && intent?.emphasisRefs?.length) layers = classifyThreeTier(project);
  // Ordering inside a layer is a set. Layer/group order itself is intentional, not canonicalized away.
  const ordered = layers && orderLayersByConnectivity(layers.map((l) => [...l].sort((a, b) => ordinal(a.id, b.id))), project);
  if (ordered && intent?.groupOrder?.length && input) {
    const priority = intent.groupOrder.map((r) => input.refMap.groupByRef[r]);
    for (const layer of ordered) layer.sort((a, b) => {
      const ai = priority.indexOf(a.groupId ?? ""), bi = priority.indexOf(b.groupId ?? "");
      return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi) || 0;
    });
  }
  if (ordered && intent?.emphasisRefs?.length && input) {
    const emphasized = new Set(intent.emphasisRefs.map((r) => input.refMap.nodeByRef[r]));
    for (const layer of ordered) {
      const preferred = layer.filter((d) => emphasized.has(d.id));
      const others = layer.filter((d) => !emphasized.has(d.id));
      layer.splice(0, layer.length, ...others.slice(0, Math.ceil(others.length / 2)), ...preferred, ...others.slice(Math.ceil(others.length / 2)));
    }
  }
  return immutable({ request, mode, direction, layers: ordered?.map((l) => l.map((d) => d.id)),
    compact: intent?.strategy === "compact" || request.objective === "compact" });
}

function gridPositions(plan: LayoutPlan, geometry: GeometryVersion): LayoutPosition[] {
  const columns = plan.direction === "left-to-right";
  const columnGap = geometry.nodeWidth + (plan.compact ? 38 : columns ? 82 : 62);
  const rowGap = geometry.nodeHeight + (plan.compact ? 28 : columns ? 38 : 58);
  return plan.layers!.flatMap((layer, layerIndex) => layer.map((deviceId, index) => ({
    deviceId,
    x: columns ? 80 + layerIndex * columnGap : 480 + index * columnGap - (layer.length - 1) * columnGap / 2,
    y: columns ? 310 + index * rowGap - (layer.length - 1) * rowGap / 2 : 90 + layerIndex * rowGap,
  })));
}
/** Pure computational default. Must be hosted by the cancellable worker before any UI integration. */
async function defaultEngine(graph: ElkNode): Promise<ElkNode> {
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  const engine = new ELK();
  // Bundled ELK uses an in-process worker shim with no terminate(). The future
  // outer browser Worker owns cancellation of the whole layout/router/scorer job.
  return engine.layout(graph);
}
function elkGraph(project: Project, plan: LayoutPlan, geometry: GeometryVersion): ElkNode {
  return {
    id: "root", layoutOptions: {
      "elk.algorithm": "layered", "elk.direction": plan.direction === "left-to-right" ? "RIGHT" : "DOWN",
      "elk.spacing.nodeNode": plan.compact ? "38" : "70",
      "elk.layered.spacing.nodeNodeBetweenLayers": plan.compact ? "48" : "90",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP", "elk.randomSeed": "1",
    },
    children: [...project.devices].sort((a, b) => DEVICE_ORDER.indexOf(a.type) - DEVICE_ORDER.indexOf(b.type) || ordinal(a.id, b.id))
      .map((d) => ({ id: d.id, width: geometry.nodeWidth, height: geometry.nodeHeight })),
    edges: [...project.links].sort((a, b) => ordinal(a.id, b.id)).map((l) => ({ id: l.id, sources: [l.from], targets: [l.to] })),
  };
}
function fixed(value: number) { return Math.round(value * 100) / 100 || 0; }

export async function buildLayoutDraft(snapshot: LayoutSnapshot, request: unknown, provider?: IntentInput, engine: LayoutEngine = defaultEngine): Promise<LayoutDraft> {
  // Copy before the first await, preventing caller/engine mutations from changing this operation.
  const requestCopy = structuredClone(request);
  const providerCopy = provider ? structuredClone(provider) : undefined;
  const expectedRevision = snapshot.baseRevision;
  const expectedGraphHash = snapshot.graphHash;
  const captured = await captureLayoutSnapshot(snapshot.project, {
    topologyId: snapshot.topologyId, customerId: snapshot.customerId, capturedAt: snapshot.capturedAt,
  }, snapshot.geometryVersion);
  if (captured.baseRevision !== expectedRevision || captured.graphHash !== expectedGraphHash) throw new LayoutContractError("STALE_LAYOUT");
  const plan = resolveLayoutPlan(captured, requestCopy, providerCopy);
  let positions: LayoutPosition[];
  if (plan.layers) positions = gridPositions(plan, captured.geometryVersion);
  else if (captured.project.devices.length === 0) positions = [];
  else {
    let result: ElkNode;
    try { result = await engine(elkGraph(captured.project, plan, captured.geometryVersion)); }
    catch { throw new LayoutContractError("NO_SAFE_LAYOUT"); }
    // Do not silently default missing coordinates or last-wins duplicate IDs.
    if (!Array.isArray(result?.children) || result.children.some((n) => !Number.isFinite(n.x) || !Number.isFinite(n.y))) throw new LayoutContractError("NO_SAFE_LAYOUT");
    positions = result.children.map((n) => ({ deviceId: n.id, x: n.x! + 80, y: n.y! + 90 }));
  }
  // Validate BEFORE rounding and pin restoration, so invalid engine output cannot be laundered.
  positions = validateLayoutPositions(captured.project, positions);
  const pins = new Set(plan.request.pinnedDeviceIds);
  const originals = new Map(captured.project.devices.map((d) => [d.id, d]));
  positions = positions.map((p) => pins.has(p.deviceId)
    ? { deviceId: p.deviceId, x: originals.get(p.deviceId)!.x, y: originals.get(p.deviceId)!.y }
    : { deviceId: p.deviceId, x: fixed(p.x), y: fixed(p.y) });
  return immutable({ status: "unscored", requestId: plan.request.requestId, topologyId: captured.topologyId,
    baseRevision: captured.baseRevision, graphHash: captured.graphHash, geometryVersion: captured.geometryVersion,
    resolvedMode: plan.mode, pinnedDeviceIds: plan.request.pinnedDeviceIds,
    positions: validateLayoutPositions(captured.project, positions, plan.request.pinnedDeviceIds) });
}

/** Detached projection for the future scorer only. Not a store/API apply operation. */
export function projectWithLayoutPositions(value: unknown, positions: unknown, pins: string[] = []): Project {
  const project = validateLayoutProject(value);
  const byId = new Map(validateLayoutPositions(project, positions, pins).map((p) => [p.deviceId, p]));
  return { ...project, devices: project.devices.map((d) => ({ ...d, x: byId.get(d.id)!.x, y: byId.get(d.id)!.y })) };
}
