import { z } from "zod";
import type { Project } from "./topology-types";
import { validateProject } from "./topology-validation.ts";

export const AIL_CONTRACT_VERSION = 1 as const;
export const AIL_LIMITS = Object.freeze({
  maxDevicesForSmart: 60, maxLinksForSmart: 120, maxGroupsForSmart: 80,
  maxProviderWarnings: 12, proposalTimeoutMs: 20_000, candidateTimeoutMs: 5_000,
  maxCandidates: 3, applyUndoTtlMs: 300_000,
  proposalBodyBytes: 16 * 1024, applyBodyBytes: 4 * 1024 * 1024,
});

export function ordinal(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0; }
const id = z.string().min(1).max(128).refine((s) => s.trim() === s);
const requestId = z.string().min(1).max(80);
const revision = z.string().regex(/^[a-f0-9]{64}$/);
const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const nodeRef = z.string().max(128).regex(/^n[0-9]{3,}$/);
const linkRef = z.string().max(128).regex(/^l[0-9]{3,}$/);
const groupRef = z.string().max(128).regex(/^g[0-9]{3,}$/);
function unique(values: string[]) { return new Set(values).size === values.length; }
function ids(max: number) { return z.array(id).max(max).refine(unique, "Duplicate IDs"); }
function boundedRefMap(key: z.ZodString, max: number) {
  return z.custom<Record<string, unknown>>((value) => value !== null && typeof value === "object" &&
    !Array.isArray(value) && Object.keys(value).length <= max, "Ref map limit")
    .pipe(z.record(key, id).refine((r) => unique(Object.values(r))));
}

export const LayoutModeSchema = z.enum(["auto-detect", "three-tier", "spine-leaf", "layered"]);
export const LayoutObjectiveSchema = z.enum([
  "balanced", "reduce-crossings", "group-by-function", "keep-backbone-centered", "compact",
]);
export const GeometryVersionSchema = z.object({
  source: z.enum(["base-178x112", "asset-registry-v1"]),
  nodeWidth: z.number().finite().positive(), nodeHeight: z.number().finite().positive(),
  routingRectMargin: z.number().finite().nonnegative(),
  astContractVersion: z.string().min(1).max(80).optional(),
}).strict();
export const LayoutPositionSchema = z.object({ deviceId: id, x: coordinate, y: coordinate }).strict();
export const LayoutPositionsSchema = z.array(LayoutPositionSchema).max(5_000)
  .refine((ps) => unique(ps.map((p) => p.deviceId)), "Duplicate positions");
export const LayoutRequestSchema = z.object({
  requestId, topologyId: id, track: z.enum(["quick", "smart"]),
  requestedMode: LayoutModeSchema.default("auto-detect"),
  objective: LayoutObjectiveSchema.default("balanced"),
  pinnedDeviceIds: ids(5_000).default([]), preserveGroups: z.literal(true).default(true),
  baseRevision: revision, graphHash: revision, geometryVersion: GeometryVersionSchema,
}).strict().refine((r) => r.track !== "smart" || r.pinnedDeviceIds.length <= 60, "Smart pins limit");

// R1 §17.2 wire shape. No Project, identity, geometry, arbitrary options or inert toggles.
export const LayoutProposalRequestSchema = z.object({
  requestId, topologyId: id, baseRevision: revision,
  requestedMode: LayoutModeSchema.default("auto-detect"),
  objective: LayoutObjectiveSchema.default("balanced"), pinnedDeviceIds: ids(60).default([]),
}).strict();
export const ApplyLayoutRequestSchema = z.object({
  action: z.literal("applyLayout"), requestId, topologyId: id,
  expectedRevision: revision, positions: LayoutPositionsSchema,
}).strict();
export const LayoutIntentSchema = z.object({
  strategy: z.enum(["use-existing-mode", "layered", "grouped", "backbone-centered", "compact"]),
  direction: z.enum(["left-to-right", "top-to-bottom"]).optional(),
  layers: z.array(z.object({
    nodeRefs: z.array(nodeRef).min(1).max(60).refine(unique),
    label: z.string().max(80).optional(),
  }).strict()).max(60).optional(),
  groupOrder: z.array(groupRef).max(80).refine(unique).optional(),
  emphasisRefs: z.array(nodeRef).max(60).refine(unique).optional(),
  warnings: z.array(z.object({
    code: z.enum(["ambiguous-role", "insufficient-signal", "too-large", "ignored-request"]),
    message: z.string().max(160), refs: z.array(nodeRef).max(60).refine(unique).optional(),
  }).strict()).max(12),
}).strict();
export const ProviderRefMapSchema = z.object({
  graphRef: requestId,
  nodeByRef: boundedRefMap(nodeRef, 60),
  linkByRef: boundedRefMap(linkRef, 120),
  groupByRef: boundedRefMap(groupRef, 80),
}).strict();
export const ProviderGraphSchema = z.object({
  requestId, graphRef: requestId,
  nodes: z.array(z.object({
    ref: nodeRef,
    deviceType: z.enum(["router", "modem", "firewall", "switch", "server", "nas", "erp", "access-point", "client", "ssid", "mesh-node", "printer", "camera", "pos", "iot"]),
    degree: z.number().int().min(0).max(240), groupRef: groupRef.optional(),
    hints: z.array(z.enum(["edge", "core", "access", "endpoint", "storage", "wireless"])).max(6).refine(unique).optional(),
  }).strict()).max(60),
  links: z.array(z.object({ ref: linkRef, fromRef: nodeRef, toRef: nodeRef, kind: z.enum(["wired", "wireless"]) }).strict()).max(120),
  groups: z.array(z.object({ ref: groupRef, kind: z.enum(["site", "domain", "vlan"]), size: z.number().int().min(0).max(60) }).strict()).max(80),
  objective: LayoutObjectiveSchema, requestedMode: LayoutModeSchema,
  constraints: z.object({
    onlyMoveExistingDevices: z.literal(true), preserveLinks: z.literal(true),
    preserveGroups: z.literal(true), noCredentials: z.literal(true), noRawNamesOrNetworkIdentifiers: z.literal(true),
  }).strict(),
}).strict().superRefine((g, ctx) => {
  const nodes = new Set(g.nodes.map((n) => n.ref));
  const groups = new Set(g.groups.map((n) => n.ref));
  const bad = () => ctx.addIssue({ code: "custom", message: "Invalid provider graph references or counts" });
  if (nodes.size !== g.nodes.length || groups.size !== g.groups.length || !unique(g.links.map((l) => l.ref))) bad();
  const degree = new Map(g.nodes.map((n) => [n.ref, 0]));
  for (const l of g.links) {
    if (!nodes.has(l.fromRef) || !nodes.has(l.toRef) || l.fromRef === l.toRef) bad();
    degree.set(l.fromRef, (degree.get(l.fromRef) ?? 0) + 1);
    degree.set(l.toRef, (degree.get(l.toRef) ?? 0) + 1);
  }
  for (const n of g.nodes) if ((n.groupRef && !groups.has(n.groupRef)) || n.degree !== degree.get(n.ref)) bad();
  for (const group of g.groups) if (group.size !== g.nodes.filter((n) => n.groupRef === group.ref).length) bad();
});

export const LayoutErrorCodeSchema = z.enum([
  "UNAUTHENTICATED", "INVALID_LAYOUT_REQUEST", "INVALID_LAYOUT_PROPOSAL", "LAYOUT_READ_ONLY",
  "LAYOUT_NOT_FOUND", "STALE_LAYOUT", "LIMIT_EXCEEDED", "AI_DISABLED", "AI_UNAVAILABLE",
  "TIMEOUT", "NO_SAFE_LAYOUT", "SAVE_FAILED", "SAVE_STATE_UNKNOWN",
]);
export const LayoutErrorEnvelopeSchema = z.object({ ok: z.literal(false), error: z.object({
  code: LayoutErrorCodeSchema, message: z.string().max(200), requestId: requestId.optional(), retryable: z.boolean().optional(),
}).strict() }).strict();
export const LayoutProposalResponseSchema = z.union([z.object({
  ok: z.literal(true), requestId, topologyId: id, baseRevision: revision,
  contractVersion: z.literal(AIL_CONTRACT_VERSION), intent: LayoutIntentSchema,
  refMap: ProviderRefMapSchema, geometryVersion: GeometryVersionSchema,
}).strict(), LayoutErrorEnvelopeSchema]);
export const LayoutUndoCommandSchema = z.object({
  topologyId: id, appliedRevision: revision, beforePositions: LayoutPositionsSchema,
  afterPositions: LayoutPositionsSchema, expiresAt: z.iso.datetime(),
}).strict().refine((v) => canonicalJson(v.beforePositions.map((p) => p.deviceId).sort(ordinal)) ===
  canonicalJson(v.afterPositions.map((p) => p.deviceId).sort(ordinal)), "Undo IDs differ");
export const ApplyLayoutResponseSchema = z.union([z.object({
  ok: z.literal(true), topologyId: id, previousRevision: revision, currentRevision: revision,
  movedDevices: z.number().int().min(0).max(5_000), saveState: z.literal("saved"), undo: LayoutUndoCommandSchema,
}).strict().refine((v) => v.topologyId === v.undo.topologyId && v.currentRevision === v.undo.appliedRevision,
  "Undo context differs"), LayoutErrorEnvelopeSchema]);

export type LayoutProposalRequest = z.infer<typeof LayoutProposalRequestSchema>;
export type LayoutProposalResponse = z.infer<typeof LayoutProposalResponseSchema>;
export type ApplyLayoutRequest = z.infer<typeof ApplyLayoutRequestSchema>;
export type ApplyLayoutResponse = z.infer<typeof ApplyLayoutResponseSchema>;
export type LayoutUndoCommand = z.infer<typeof LayoutUndoCommandSchema>;
export type ProviderGraph = z.infer<typeof ProviderGraphSchema>;
export class LayoutContractError extends Error {
  readonly code: z.infer<typeof LayoutErrorCodeSchema>;
  constructor(code: z.infer<typeof LayoutErrorCodeSchema> = "INVALID_LAYOUT_REQUEST") {
    super(code); this.name = "LayoutContractError"; this.code = code;
  }
}
export function parseLayout<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new LayoutContractError(); // Never echo Project/provider text.
  return parsed.data;
}
export type LayoutMode = z.infer<typeof LayoutModeSchema>;
export type LayoutRequest = z.infer<typeof LayoutRequestSchema>;
export type LayoutIntent = z.infer<typeof LayoutIntentSchema>;
export type LayoutPosition = z.infer<typeof LayoutPositionSchema>;
export type GeometryVersion = z.infer<typeof GeometryVersionSchema>;
export type ProviderRefMap = z.infer<typeof ProviderRefMapSchema>;

/** Validate using the durable schema without letting its trim/color transforms mutate data. */
export function validateLayoutProject(value: unknown): Project {
  try { validateProject(value); } catch { throw new LayoutContractError(); }
  const project = structuredClone(value) as Project;
  for (const record of [...project.devices, ...project.links, ...project.groups]) parseLayout(id, record.id);
  const deviceIds = new Set(project.devices.map((d) => d.id));
  const groupIds = new Set(project.groups.map((g) => g.id));
  for (const d of project.devices) if (d.groupId !== undefined && !groupIds.has(d.groupId)) throw new LayoutContractError();
  for (const l of project.links) if (!deviceIds.has(l.from) || !deviceIds.has(l.to)) throw new LayoutContractError();
  return project;
}

/** Only use on already validated JSON values. Array order is significant unless normalized by caller. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))) return JSON.stringify(value);
  if (typeof value !== "object") throw new LayoutContractError();
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort(ordinal)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}
export function canonicalProject(value: unknown): string {
  const p = validateLayoutProject(value);
  return canonicalJson({
    devices: p.devices.sort((a, b) => ordinal(a.id, b.id)),
    links: p.links.sort((a, b) => ordinal(a.id, b.id)),
    groups: p.groups.sort((a, b) => ordinal(a.id, b.id)),
  });
}
/** Capture-only async hash. Do not await this in an unmanaged Dexie transaction. */
export async function sha256Canonical(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
export function immutable<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}
export function validatePins(project: Project, value: unknown, smart = false): string[] {
  const pins = parseLayout(ids(smart ? 60 : 5_000), value);
  const existing = new Set(project.devices.map((d) => d.id));
  if (pins.some((pin) => !existing.has(pin))) throw new LayoutContractError();
  return pins.sort(ordinal);
}
export function validateLayoutPositions(project: Project, value: unknown, pins: string[] = []): LayoutPosition[] {
  const positions = parseLayout(LayoutPositionsSchema, value);
  const pinned = new Set(validatePins(project, pins));
  const devices = new Map(project.devices.map((d) => [d.id, d]));
  if (positions.length !== devices.size) throw new LayoutContractError();
  for (const position of positions) {
    const device = devices.get(position.deviceId);
    if (!device || (pinned.has(device.id) && (position.x !== device.x || position.y !== device.y))) throw new LayoutContractError();
  }
  return positions.sort((a, b) => ordinal(a.deviceId, b.deviceId));
}
export function validateIntent(value: unknown, mapValue: unknown, project: Project): { intent: LayoutIntent; refMap: ProviderRefMap } {
  try {
    assertSmartLimits(project);
    const intent = LayoutIntentSchema.parse(value);
    const refMap = ProviderRefMapSchema.parse(mapValue);
    for (const [map, collection] of [[refMap.nodeByRef, project.devices], [refMap.linkByRef, project.links], [refMap.groupByRef, project.groups]] as const) {
      const expected = collection.map((r) => r.id).sort(ordinal);
      if (canonicalJson(Object.values(map).sort(ordinal)) !== canonicalJson(expected)) throw new Error();
    }
    const refs = new Set(Object.keys(refMap.nodeByRef));
    const layers = intent.layers?.flatMap((l) => l.nodeRefs);
    if (layers && (!unique(layers) || layers.length !== refs.size || layers.some((r) => !refs.has(r)))) throw new Error();
    for (const ref of [...(intent.emphasisRefs ?? []), ...intent.warnings.flatMap((w) => w.refs ?? [])]) if (!refs.has(ref)) throw new Error();
    if (intent.groupOrder?.some((r) => !Object.hasOwn(refMap.groupByRef, r))) throw new Error();
    return { intent, refMap };
  } catch { throw new LayoutContractError("INVALID_LAYOUT_PROPOSAL"); }
}
export function assertSmartLimits(project: Project) {
  if (project.devices.length > 60 || project.links.length > 120 || project.groups.length > 80) throw new LayoutContractError("LIMIT_EXCEEDED");
}
