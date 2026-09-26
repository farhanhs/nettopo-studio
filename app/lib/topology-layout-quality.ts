import type { Project } from "./topology-types";
import { routeTopologyLinks, segmentIntersectsRect, type Point, type TopologyRoute } from "./topology-routing.ts";
import { AIL_LIMITS, canonicalJson, immutable, ordinal, validateLayoutPositions, validatePins } from "./topology-layout-contract.ts";
import type { GeometryVersion, LayoutPosition } from "./topology-layout-contract.ts";
import { assertBaseGeometry, layoutNodeRect } from "./topology-geometry.ts";
import { projectWithLayoutPositions, type LayoutDraft, type LayoutSnapshot } from "./topology-layout-core.ts";

export type LayoutCandidateSource = "original" | "quick" | "smart";
export type LayoutQualityMetrics = {
  unresolvedRoutes: number;
  estimatedCrossings: number;
  sharedSegmentLength: number;
  nodeOcclusions: number;
  totalBends: number;
  totalRouteLength: number;
  totalMoveDistance: number;
  boundsArea: number;
};
export type LayoutCandidate = {
  status: "scored";
  source: LayoutCandidateSource;
  requestId: string;
  topologyId: string;
  baseRevision: string;
  graphHash: string;
  geometryVersion: GeometryVersion;
  positions: LayoutPosition[];
  metrics: LayoutQualityMetrics;
  hardGatePassed: boolean;
  hardGateReasons: string[];
  canonicalPositionsKey: string;
};
export type LayoutCandidateSelection = {
  candidates: LayoutCandidate[];
  recommended?: LayoutCandidate;
};

const SOURCE_RANK: Record<LayoutCandidateSource, number> = { original: 0, quick: 1, smart: 2 };
const fixed = (value: number) => Math.round(value * 100) / 100 || 0;

type Segment = { linkId: string; endpointIds: Set<string>; a: Point; b: Point };
function segments(route: TopologyRoute, project: Project): Segment[] {
  const link = project.links.find((item) => item.id === route.linkId);
  if (!link) return [];
  return route.points.slice(0, -1).map((a, index) => ({ linkId: route.linkId, endpointIds: new Set([link.from, link.to]), a, b: route.points[index + 1] }));
}
function horizontal(s: Segment) { return s.a.y === s.b.y; }
function vertical(s: Segment) { return s.a.x === s.b.x; }
function between(value: number, a: number, b: number) { return value > Math.min(a, b) && value < Math.max(a, b); }
function crossing(a: Segment, b: Segment) {
  if ([...a.endpointIds].some((id) => b.endpointIds.has(id))) return false;
  if (horizontal(a) && vertical(b)) return between(b.a.x, a.a.x, a.b.x) && between(a.a.y, b.a.y, b.b.y);
  if (vertical(a) && horizontal(b)) return between(a.a.x, b.a.x, b.b.x) && between(b.a.y, a.a.y, a.b.y);
  return false;
}
function overlapLength(a: Segment, b: Segment) {
  if (horizontal(a) && horizontal(b) && a.a.y === b.a.y) {
    return Math.max(0, Math.min(Math.max(a.a.x, a.b.x), Math.max(b.a.x, b.b.x)) - Math.max(Math.min(a.a.x, a.b.x), Math.min(b.a.x, b.b.x)));
  }
  if (vertical(a) && vertical(b) && a.a.x === b.a.x) {
    return Math.max(0, Math.min(Math.max(a.a.y, a.b.y), Math.max(b.a.y, b.b.y)) - Math.max(Math.min(a.a.y, a.b.y), Math.min(b.a.y, b.b.y)));
  }
  return 0;
}
function positionsKey(positions: LayoutPosition[]) {
  return canonicalJson([...positions].sort((a, b) => ordinal(a.deviceId, b.deviceId)).map((p) => ({ deviceId: p.deviceId, x: fixed(p.x), y: fixed(p.y) })));
}
function compareNumbers(a: number[], b: number[]) {
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}
export function candidateTuple(candidate: LayoutCandidate): Array<number | string> {
  const m = candidate.metrics;
  return [m.unresolvedRoutes, m.estimatedCrossings, m.sharedSegmentLength, m.nodeOcclusions, m.totalBends,
    m.totalRouteLength, m.totalMoveDistance, m.boundsArea, SOURCE_RANK[candidate.source], candidate.canonicalPositionsKey];
}
export function compareLayoutCandidates(a: LayoutCandidate, b: LayoutCandidate) {
  const left = candidateTuple(a), right = candidateTuple(b);
  const numeric = compareNumbers(left.slice(0, 9) as number[], right.slice(0, 9) as number[]);
  return numeric || ordinal(left[9] as string, right[9] as string);
}

export function scoreLayoutCandidate(snapshot: LayoutSnapshot, positionsValue: unknown, source: LayoutCandidateSource, requestId = "original"): LayoutCandidate {
  const geometry = assertBaseGeometry(snapshot.geometryVersion);
  const pins = source === "original" ? [] : validatePins(snapshot.project, (positionsValue as LayoutDraft).pinnedDeviceIds ?? []);
  const positions = source === "original"
    ? snapshot.project.devices.map(({ id: deviceId, x, y }) => ({ deviceId, x, y })).sort((a, b) => ordinal(a.deviceId, b.deviceId))
    : validateLayoutPositions(snapshot.project, (positionsValue as LayoutDraft).positions ?? positionsValue, pins);
  const project = projectWithLayoutPositions(snapshot.project, positions, pins);
  const routes = [...routeTopologyLinks(project).values()].sort((a, b) => ordinal(a.linkId, b.linkId));
  const wired = routes.filter((route) => route.kind === "orthogonal");
  const routeSegments = routes.flatMap((route) => segments(route, project));
  const rects = project.devices.map((device) => ({ id: device.id, ...layoutNodeRect(device, geometry) }));
  const hardGateReasons: string[] = [];
  let nodeOverlaps = 0;
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) nodeOverlaps++;
  }
  const unresolvedRoutes = wired.filter((route) => route.status !== "resolved").length;
  let nodeOcclusions = 0;
  for (const segment of routeSegments) for (const rect of rects) {
    if (!segment.endpointIds.has(rect.id) && segmentIntersectsRect(segment.a, segment.b, { left: rect.x, right: rect.x + rect.width, top: rect.y, bottom: rect.y + rect.height })) nodeOcclusions++;
  }
  if (nodeOverlaps) hardGateReasons.push("node-overlap");
  if (unresolvedRoutes) hardGateReasons.push("unresolved-wired-route");
  if (nodeOcclusions) hardGateReasons.push("route-node-occlusion");
  let estimatedCrossings = 0, sharedSegmentLength = 0;
  for (let i = 0; i < routeSegments.length; i++) for (let j = i + 1; j < routeSegments.length; j++) {
    if (routeSegments[i].linkId === routeSegments[j].linkId) continue;
    if (crossing(routeSegments[i], routeSegments[j])) estimatedCrossings++;
    sharedSegmentLength += overlapLength(routeSegments[i], routeSegments[j]);
  }
  const original = new Map(snapshot.project.devices.map((device) => [device.id, device]));
  const xs = project.devices.map((d) => d.x), ys = project.devices.map((d) => d.y);
  const metrics: LayoutQualityMetrics = {
    unresolvedRoutes,
    estimatedCrossings,
    sharedSegmentLength: fixed(sharedSegmentLength),
    nodeOcclusions,
    totalBends: wired.reduce((sum, route) => sum + Math.max(0, route.points.length - 2), 0),
    totalRouteLength: fixed(routes.reduce((sum, route) => sum + route.points.slice(0, -1).reduce((routeSum, point, i) => routeSum + Math.abs(route.points[i + 1].x - point.x) + Math.abs(route.points[i + 1].y - point.y), 0), 0)),
    totalMoveDistance: fixed(project.devices.reduce((sum, device) => sum + Math.hypot(device.x - original.get(device.id)!.x, device.y - original.get(device.id)!.y), 0)),
    boundsArea: project.devices.length ? fixed((Math.max(...xs) - Math.min(...xs) + geometry.nodeWidth) * (Math.max(...ys) - Math.min(...ys) + geometry.nodeHeight)) : 0,
  };
  return immutable({ status: "scored", source, requestId, topologyId: snapshot.topologyId, baseRevision: snapshot.baseRevision,
    graphHash: snapshot.graphHash, geometryVersion: geometry, positions, metrics,
    hardGatePassed: hardGateReasons.length === 0, hardGateReasons, canonicalPositionsKey: positionsKey(positions) });
}

export function selectLayoutCandidate(snapshot: LayoutSnapshot, values: Array<{ source: LayoutCandidateSource; value: unknown; requestId?: string }>): LayoutCandidateSelection {
  if (values.length > AIL_LIMITS.maxCandidates) throw new Error("Too many layout candidates");
  const candidates = values.map((entry) => scoreLayoutCandidate(snapshot, entry.value, entry.source, entry.requestId)).sort(compareLayoutCandidates);
  const original = candidates.find((candidate) => candidate.source === "original") ?? scoreLayoutCandidate(snapshot, [], "original");
  const recommended = candidates.find((candidate) => candidate.source !== "original" && candidate.hardGatePassed &&
    candidate.canonicalPositionsKey !== original.canonicalPositionsKey && compareLayoutCandidates(candidate, original) < 0);
  return immutable({ candidates, recommended });
}
