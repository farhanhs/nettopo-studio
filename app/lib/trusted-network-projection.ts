import { inspectTrustedField, TrustedNetworkModelError, validateProjectV2 } from "./trusted-network-model.ts";
import type { ProjectV2, TrustedEntityType } from "./trusted-network-types.ts";

export type ProjectionView = "physical" | "logical";
export type ProjectionMode = "all" | "verified-only";
export type TrustedEntityRef = { type: "area" | "device" | "interface" | "physical-link" | "vlan" | "subnet" | "interface-vlan" | "interface-subnet" | "resiliency"; id: string };
export type ProjectionTrust = { state: "verified" | "unverified" | "mixed"; evidenceCount: number; safeReasonCodes: readonly string[]; verifiedAt?: string };
export type SafeProjectionEvidence = { method: string; sourceKind: string; displayName: string; safeSummary?: string; file?: string; line?: number; templateVersion?: string };
export type ProjectionItem = { ref: TrustedEntityRef; label: string; owner?: TrustedEntityRef; areaId?: string; trust: ProjectionTrust; evidence: readonly SafeProjectionEvidence[]; hiddenChildCounts?: Readonly<Record<string, number>> };
export type ProjectionRelation = ProjectionItem & { from: TrustedEntityRef; to: TrustedEntityRef; diagnostic?: "route-unresolved" };
export type ProjectionSummary = ProjectionItem & { memberRefs: readonly TrustedEntityRef[] };
export type ProjectionIssueCode = "SELECTION_NOT_VISIBLE" | "FOCUS_AREA_NOT_VISIBLE" | "LEGACY_INTERFACE_UNKNOWN" | "LEGACY_LOGICAL_RELATION_UNSTRUCTURED" | "UNVERIFIED_CLOSURE_HIDDEN" | "STALE_TRUST_RECORD_IGNORED" | "NO_VISIBLE_ENTITIES";
export type ProjectionRequest = { authorizedProject: ProjectV2; view: ProjectionView; mode: ProjectionMode; selection?: TrustedEntityRef; focusAreaId?: string; collapsedAreaIds?: readonly string[] };
export type ProjectionResult = {
  view: ProjectionView; mode: ProjectionMode; items: readonly ProjectionItem[];
  relations: readonly ProjectionRelation[]; summaries: readonly ProjectionSummary[];
  breadcrumb: readonly ProjectionItem[]; requestedSelection?: TrustedEntityRef; effectiveSelection?: TrustedEntityRef;
  issues: readonly { code: ProjectionIssueCode; ref?: TrustedEntityRef; count?: number }[];
  hidden: { unverifiedEntities: number; unverifiedRelations: number };
};
export type ProjectionOutcome = { ok: true; result: ProjectionResult } | { ok: false; error: {
  code: "INVALID_REQUEST" | "INVALID_PROJECT" | "DUPLICATE_ENTITY_ID";
  safeMessage: "Unable to display this topology projection."; issueCount: number;
} };

const rank: Record<TrustedEntityRef["type"], number> = { area: 10, device: 20, interface: 30, vlan: 40, subnet: 50, "physical-link": 60, "interface-vlan": 70, "interface-subnet": 80, resiliency: 90 };
function codePoints(a: string, b: string): number {
  const left = Array.from(a, (v) => v.codePointAt(0)!);
  const right = Array.from(b, (v) => v.codePointAt(0)!);
  for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] !== right[i]) return left[i] - right[i];
  return left.length - right.length;
}
function compareId(a: string, b: string) { return codePoints(a.normalize("NFC"), b.normalize("NFC")) || codePoints(a, b); }
function compareRef(a: TrustedEntityRef, b: TrustedEntityRef) { return rank[a.type] - rank[b.type] || compareId(a.id, b.id); }
const key = (ref: TrustedEntityRef) => JSON.stringify([ref.type, ref.id]);
const ref = (type: TrustedEntityRef["type"], id: string): TrustedEntityRef => ({ type, id });
const safeDisplay = (value: string | undefined) => value && !/(?:[a-z]:[\\/]|(?:^|\s)\/[\w.-]+\/|password|secret|token|cookie|ciphertext|nonce|postgres(?:ql)?:\/\/)/i.test(value) ? value : undefined;
const failure = (code: "INVALID_REQUEST" | "INVALID_PROJECT" | "DUPLICATE_ENTITY_ID", issueCount = 1): ProjectionOutcome => ({ ok: false, error: { code, safeMessage: "Unable to display this topology projection.", issueCount } });
type Entity = { ref: TrustedEntityRef; label: string; owner?: TrustedEntityRef; areaId?: string; dependencies: TrustedEntityRef[]; endpoints?: [TrustedEntityRef, TrustedEntityRef]; members?: TrustedEntityRef[]; primary?: TrustedEntityRef; incomplete?: boolean };

export async function projectTrustedNetworkView(request: ProjectionRequest): Promise<ProjectionOutcome> {
  try {
    if (!request || !["physical", "logical"].includes(request.view) || !["all", "verified-only"].includes(request.mode)
      || (request.collapsedAreaIds !== undefined && (!Array.isArray(request.collapsedAreaIds) || request.collapsedAreaIds.some((id) => typeof id !== "string")))) return failure("INVALID_REQUEST");
    const project = validateProjectV2(request.authorizedProject);
    const snapshot = { ...request, selection: structuredClone(request.selection), collapsedAreaIds: request.collapsedAreaIds ? [...request.collapsedAreaIds] : undefined };
    return { ok: true, result: await projectValidated(project, snapshot) };
  } catch (error) {
    if (error instanceof TrustedNetworkModelError) return failure(error.issues.some((i) => i.code === "DUPLICATE_ID") ? "DUPLICATE_ENTITY_ID" : "INVALID_PROJECT", error.issues.length);
    return failure("INVALID_PROJECT");
  }
}

async function projectValidated(project: ProjectV2, request: ProjectionRequest): Promise<ProjectionResult> {
  const model = project.trustedNetwork;
  const entities = new Map<string, Entity>();
  const put = (entity: Entity) => entities.set(key(entity.ref), entity);
  const get = (r: TrustedEntityRef | undefined) => r ? entities.get(key(r)) : undefined;
  const issues: ProjectionResult["issues"][number][] = [];
  for (const a of model.areas) put({ ref: ref("area", a.id), label: a.name, owner: a.parentAreaId ? ref("area", a.parentAreaId) : undefined, dependencies: a.parentAreaId ? [ref("area", a.parentAreaId)] : [] });
  for (const d of project.devices) put({ ref: ref("device", d.id), label: d.name, areaId: d.networkAreaId, owner: d.networkAreaId ? ref("area", d.networkAreaId) : undefined, dependencies: [] });
  for (const i of model.interfaces) put({ ref: ref("interface", i.id), label: i.name, owner: ref("device", i.deviceId), areaId: get(ref("device", i.deviceId))?.areaId, dependencies: [ref("device", i.deviceId), ...(i.parentInterfaceId ? [ref("interface", i.parentInterfaceId)] : [])] });
  for (const v of model.vlans) put({ ref: ref("vlan", v.id), label: v.name ?? `VLAN ${v.vlanNumber}`, areaId: v.areaId, owner: v.areaId ? ref("area", v.areaId) : undefined, dependencies: v.areaId ? [ref("area", v.areaId)] : [] });
  for (const s of model.subnets) put({ ref: ref("subnet", s.id), label: s.name ?? s.cidr, areaId: s.areaId ?? (s.vlanId ? get(ref("vlan", s.vlanId))?.areaId : undefined), owner: s.vlanId ? ref("vlan", s.vlanId) : s.areaId ? ref("area", s.areaId) : undefined, dependencies: [...(s.areaId ? [ref("area", s.areaId)] : []), ...(s.vlanId ? [ref("vlan", s.vlanId)] : [])] });
  for (const l of project.links) {
    const source = l.fromInterfaceId ? ref("interface", l.fromInterfaceId) : ref("device", l.from);
    const target = l.toInterfaceId ? ref("interface", l.toInterfaceId) : ref("device", l.to);
    put({ ref: ref("physical-link", l.id), label: l.speed || (l.kind === "wireless" ? "Wireless" : "Wired"), endpoints: [source, target], dependencies: [ref("device", l.from), ref("device", l.to), source, target], incomplete: !l.fromInterfaceId || !l.toInterfaceId });
    if (request.view === "physical" && (!l.fromInterfaceId || !l.toInterfaceId)) issues.push({ code: "LEGACY_INTERFACE_UNKNOWN", ref: ref("physical-link", l.id), count: Number(!l.fromInterfaceId) + Number(!l.toInterfaceId) });
  }
  for (const r of model.interfaceVlans) put({ ref: ref("interface-vlan", r.id), label: r.mode, endpoints: [ref("interface", r.interfaceId), ref("vlan", r.vlanId)], dependencies: [ref("interface", r.interfaceId), ref("vlan", r.vlanId)] });
  for (const r of model.interfaceSubnets) put({ ref: ref("interface-subnet", r.id), label: r.role ?? "member", endpoints: [ref("interface", r.interfaceId), ref("subnet", r.subnetId)], dependencies: [ref("interface", r.interfaceId), ref("subnet", r.subnetId)] });
  for (const r of model.resiliencyRelations) put({ ref: ref("resiliency", r.id), label: r.name ?? r.kind, members: r.memberLinkIds.map((id) => ref("physical-link", id)).sort(compareRef), primary: r.primaryLinkId ? ref("physical-link", r.primaryLinkId) : undefined, dependencies: r.memberLinkIds.map((id) => ref("physical-link", id)) });
  const ordered = [...entities.values()].sort((a, b) => compareRef(a.ref, b.ref));
  const statuses = new Map<string, Awaited<ReturnType<typeof inspectTrustedField>>>();
  for (const entity of ordered) {
    const entityType: TrustedEntityType = entity.ref.type === "physical-link" ? "link" : entity.ref.type;
    statuses.set(key(entity.ref), await inspectTrustedField(project, { entityType, entityId: entity.ref.id, fieldPath: "$record" }));
  }
  const closureCache = new Map<string, boolean>();
  function passes(entity: Entity): boolean {
    const id = key(entity.ref);
    if (closureCache.has(id)) return closureCache.get(id)!;
    closureCache.set(id, false);
    const pass = !entity.incomplete && statuses.get(id)?.state === "verified" && entity.dependencies.every((r) => { const d = get(r); return !!d && passes(d); });
    closureCache.set(id, pass);
    return pass;
  }
  const safeEvidence = (entity: Entity): SafeProjectionEvidence[] => {
    const type = entity.ref.type === "physical-link" ? "link" : entity.ref.type;
    const ids = new Set(model.fieldTrust.filter((t) => t.entityType === type && t.entityId === entity.ref.id).flatMap((t) => t.evidenceIds));
    return model.evidence.filter((e) => ids.has(e.id)).sort((a, b) => compareId(a.id, b.id)).map((e) => ({
      method: e.method, sourceKind: e.sourceKind, displayName: safeDisplay(e.displayName) ?? "Source",
      ...(safeDisplay(e.safeSummary) ? { safeSummary: safeDisplay(e.safeSummary) } : {}),
      ...(e.locator?.file ? { file: e.locator.file } : {}), ...(e.locator?.line ? { line: e.locator.line } : {}),
      ...(safeDisplay(e.template?.version) ? { templateVersion: safeDisplay(e.template?.version) } : {}),
    }));
  };
  const dto = (entity: Entity): ProjectionItem => {
    const own = statuses.get(key(entity.ref))!;
    const verified = passes(entity);
    const evidence = safeEvidence(entity);
    return { ref: entity.ref, label: entity.label, ...(entity.owner ? { owner: entity.owner } : {}), ...(entity.areaId ? { areaId: entity.areaId } : {}), evidence,
      trust: { state: verified ? "verified" : own.state === "verified" ? "mixed" : "unverified", evidenceCount: evidence.length,
        safeReasonCodes: verified ? [] : [own.state === "stale" ? "STALE_TRUST_RECORD_IGNORED" : "UNVERIFIED_CLOSURE"],
        ...(verified && own.verifiedAt ? { verifiedAt: own.verifiedAt } : {}),
      } };
  };
  const viewEntities = ordered.filter((e) => request.view === "logical" ? e.ref.type !== "physical-link" : ["area", "device", "interface", "physical-link"].includes(e.ref.type));
  const visible = viewEntities.filter((e) => request.mode === "all" || passes(e));
  const hiddenEntities = viewEntities.filter((e) => !visible.includes(e));
  const items = visible.filter((e) => !e.endpoints && !e.members).map(dto);
  const itemKeys = new Set(items.map((i) => key(i.ref)));
  const relations = visible.filter((e) => e.endpoints?.every((r) => itemKeys.has(key(r)))).map((e): ProjectionRelation => ({ ...dto(e), from: e.endpoints![0], to: e.endpoints![1] }));
  const summaries = visible.filter((e) => e.members).map((e): ProjectionSummary => ({ ...dto(e), memberRefs: e.members! }));
  const allVisible: ProjectionItem[] = [...items, ...relations, ...summaries].sort((a, b) => compareRef(a.ref, b.ref));
  const visibleMap = new Map(allVisible.map((i) => [key(i.ref), i]));
  for (const e of ordered) if (statuses.get(key(e.ref))?.state === "stale") issues.push({ code: "STALE_TRUST_RECORD_IGNORED", ref: e.ref });
  for (const trust of model.fieldTrust) {
    if (trust.verification !== "verified" || trust.fieldPath === "$record" || trust.entityType === "group") continue;
    const r = ref(trust.entityType === "link" ? "physical-link" : trust.entityType, trust.entityId);
    if ((await inspectTrustedField(project, trust)).state === "stale" && !issues.some((i) => i.code === "STALE_TRUST_RECORD_IGNORED" && i.ref && key(i.ref) === key(r))) issues.push({ code: "STALE_TRUST_RECORD_IGNORED", ref: r });
  }
  if (hiddenEntities.length) issues.push({ code: "UNVERIFIED_CLOSURE_HIDDEN", count: hiddenEntities.length });
  if (request.view === "logical") {
    const count = project.links.filter((l) => l.vlan?.trim()).length;
    if (count) issues.push({ code: "LEGACY_LOGICAL_RELATION_UNSTRUCTURED", count });
  }
  function areaChain(entity: Entity | undefined): Entity[] {
    if (!entity) return [];
    let current = entity.ref.type === "area" ? entity : entity.areaId ? get(ref("area", entity.areaId)) : undefined;
    if (!current && entity.endpoints) current = get(entity.endpoints[0]);
    if (current && current.ref.type !== "area") current = current.areaId ? get(ref("area", current.areaId)) : undefined;
    const chain: Entity[] = [];
    while (current) { chain.unshift(current); current = get(current.owner); }
    return chain;
  }
  const validRef = (r: unknown): r is TrustedEntityRef => !!r && typeof r === "object" && "type" in r && "id" in r && typeof r.id === "string" && typeof r.type === "string" && Object.hasOwn(rank, r.type) && entities.has(key(r as TrustedEntityRef));
  const requestedSelection = validRef(request.selection) ? request.selection : undefined;
  const selected = get(requestedSelection);
  const visibleRef = (r: TrustedEntityRef | undefined) => r && visibleMap.has(key(r)) ? r : undefined;
  const lex = (refs: TrustedEntityRef[]) => refs.sort((a, b) => compareId(a.id, b.id));
  function fallback(entity: Entity | undefined): TrustedEntityRef | undefined {
    if (!entity) return undefined;
    const candidates: TrustedEntityRef[] = [];
    if (entity.ref.type === "interface" && entity.owner) candidates.push(entity.owner);
    if (entity.endpoints) {
      const endpoints = entity.ref.type === "physical-link" ? lex([...entity.endpoints]) : entity.endpoints;
      candidates.push(...endpoints.filter((r) => r.type === "interface"));
      candidates.push(...endpoints.flatMap((r) => { const e = get(r); return r.type === "device" ? [r] : e?.owner?.type === "device" ? [e.owner] : []; }));
      if (entity.ref.type !== "physical-link") candidates.push(...endpoints.filter((r) => r.type === "vlan" || r.type === "subnet"));
    }
    if (entity.ref.type === "vlan" || entity.ref.type === "subnet") {
      const related = lex(ordered.filter((e) => e.endpoints?.some((r) => key(r) === key(entity.ref))).flatMap((e) => e.endpoints!.filter((r) => r.type === "interface")));
      candidates.push(...related, ...related.flatMap((r) => get(r)?.owner ? [get(r)!.owner!] : []));
    }
    if (entity.members) candidates.push(...(entity.primary ? [entity.primary] : []), ...lex([...entity.members]));
    candidates.push(...areaChain(entity).reverse().map((e) => e.ref));
    return candidates.find((r) => visibleRef(r));
  }
  let focus = typeof request.focusAreaId === "string" ? get(ref("area", request.focusAreaId)) : undefined;
  if (request.focusAreaId !== undefined && (!focus || !visibleRef(focus.ref))) {
    issues.push({ code: "FOCUS_AREA_NOT_VISIBLE", ...(focus ? { ref: focus.ref } : {}) });
    focus = focus ? areaChain(focus).reverse().find((e) => visibleRef(e.ref)) : undefined;
  }
  const effectiveSelection = visibleRef(requestedSelection) ?? fallback(selected) ?? visibleRef(focus?.ref) ?? items[0]?.ref;
  if (request.selection !== undefined && (!requestedSelection || !visibleRef(requestedSelection))) issues.push({ code: "SELECTION_NOT_VISIBLE", ...(requestedSelection ? { ref: requestedSelection } : {}) });
  if (!items.length) issues.push({ code: "NO_VISIBLE_ENTITIES" });
  const effective = get(effectiveSelection);
  const crumbRefs = areaChain(effective ?? focus).map((e) => e.ref);
  if (effective?.owner?.type === "device") crumbRefs.push(effective.owner);
  if (effective?.endpoints) {
    const endpoint = get(effective.endpoints[0]);
    if (endpoint?.owner?.type === "device") crumbRefs.push(endpoint.owner);
    if (endpoint) crumbRefs.push(endpoint.ref);
  }
  if (effective) crumbRefs.push(effective.ref);
  const seen = new Set<string>();
  const breadcrumb = crumbRefs.flatMap((r) => { const k = key(r); const item = visibleMap.get(k); if (!item || seen.has(k)) return []; seen.add(k); return [item]; });
  // Folding annotates view inventory, never deletes relation endpoints or writes Group.collapsed.
  for (const areaId of new Set(request.collapsedAreaIds ?? [])) {
    const area = items.find((i) => i.ref.type === "area" && i.ref.id === areaId);
    if (!area) continue;
    const counts: Record<string, number> = {};
    for (const item of items) if (item !== area && areaChain(get(item.ref)).some((e) => e.ref.id === areaId)) counts[item.ref.type] = (counts[item.ref.type] ?? 0) + 1;
    area.hiddenChildCounts = counts;
  }
  issues.sort((a, b) => codePoints(a.code, b.code) || (a.ref && b.ref ? compareRef(a.ref, b.ref) : Number(!!a.ref) - Number(!!b.ref)));
  return structuredClone({ view: request.view, mode: request.mode, items, relations, summaries, breadcrumb,
    ...(requestedSelection ? { requestedSelection } : {}), ...(effectiveSelection ? { effectiveSelection } : {}), issues,
    hidden: { unverifiedEntities: hiddenEntities.filter((e) => !e.endpoints && !e.members).length, unverifiedRelations: hiddenEntities.filter((e) => e.endpoints || e.members).length } });
}
