import { z } from "zod";
import { canonicalProjectV2, upcastProject, validateProjectV2 } from "./trusted-network-model.ts";
import type { InterfaceCandidate, InterfaceCandidateConflictCode, InterfaceCandidatePlan } from "./trusted-network-interface-candidates.ts";
import type { EvidenceSource, NetworkInterface, ProjectV2 } from "./trusted-network-types.ts";

export type TrustedChangePlanErrorCode =
  | "TRUSTED_CANDIDATE_PLAN_INVALID" | "TRUSTED_OPERATION_UNSUPPORTED"
  | "TRUSTED_PLAN_HANDLE_INVALID" | "TRUSTED_PLAN_CAPACITY_EXCEEDED" | "TRUSTED_PLAN_STATE_INVALID"
  | "TRUSTED_PLAN_SCOPE_MISMATCH" | "TRUSTED_PLAN_STALE" | "TRUSTED_FIELD_INTENT_AMBIGUOUS"
  | "TRUSTED_TRUST_FINGERPRINT_STALE" | "TRUSTED_LEGACY_PORT_INCOMPATIBLE"
  | "TRUSTED_DECISION_UNKNOWN" | "TRUSTED_DECISION_DUPLICATE" | "TRUSTED_DECISION_INCOMPLETE"
  | "TRUSTED_DECISION_INVALID_FOR_OPERATION" | "TRUSTED_DECISION_DEPENDENCY_CONFLICT"
  | "TRUSTED_ALTERNATIVE_CONFLICT" | "TRUSTED_BLOCKING_ISSUE" | "TRUSTED_WARNING_ACK_REQUIRED"
  | "TRUSTED_DEPENDENCY_EXCLUDED" | "TRUSTED_ACTOR_REQUIRED" | "TRUSTED_RESULT_INVALID";

export class TrustedChangePlanError extends Error {
  readonly code: TrustedChangePlanErrorCode;
  constructor(code: TrustedChangePlanErrorCode) {
    super("Trusted change plan was rejected.");
    this.code = code;
  }
  toJSON() { return { code: this.code }; }
}
function reject(code: TrustedChangePlanErrorCode): never { throw new TrustedChangePlanError(code); }
function safeError(error: unknown): never {
  if (error instanceof TrustedChangePlanError) throw error;
  return reject("TRUSTED_CANDIDATE_PLAN_INVALID");
}

const FIELDS = ["name", "kind", "aliases", "parentInterfaceId", "mac", "description", "adminLabel"] as const;
type Leaf = typeof FIELDS[number];
export type TrustedFieldKey = { entityType: "interface"; entityId: string; fieldPath: "$record" | Leaf };
export type TrustedPlanOwner = { projectScopeId: string; deviceId: string };
export type TrustedPlanHandle = object;
export type TrustedFieldProposal = TrustedFieldKey & {
  proposalId: string; operation: "add" | "replace"; currentFingerprint?: string;
  proposedFingerprint: string; proposedValue: unknown; evidenceIds: readonly string[];
  conflict: "none" | "unverified-existing" | "verified-protected" | "relation" | "alias-collision";
  protected: boolean; alternativeGroupId?: string; dependsOn: readonly string[];
  applicability: "applicable" | "exclude-only";
};
export type TrustedPlanIssue = {
  id: string; severity: "blocking" | "warning" | "info";
  disposition: "hard-block" | "resolved-by-decisions" | "acknowledge" | "observe";
  code: TrustedChangePlanErrorCode | InterfaceCandidateConflictCode | "MISSING_INFO";
  proposalIds: readonly string[]; safePath?: string;
};
export type TrustedPlanPreview = {
  planVersion: "trusted-network-plan-r1.1"; planId: string; owner: TrustedPlanOwner;
  baseRevision: string; candidateFingerprint: string; previewFingerprint: string;
  proposals: readonly TrustedFieldProposal[]; issues: readonly TrustedPlanIssue[];
  summary: { total: number; blocking: number; warnings: number; protected: number }; canResolve: boolean;
};
export type TrustedProposalResolution = {
  proposalId: string; action: "accept-unverified" | "accept-and-verify" | "keep-current" | "exclude";
};
export type TrustedPlanDecision = { kind: "cancel" } | {
  kind: "resolve"; resolutions: readonly TrustedProposalResolution[]; warningAcknowledged: boolean;
};
export type PreparedTrustedPlan = { handle: TrustedPlanHandle; preview: TrustedPlanPreview };
export type ResolvedTrustedPlan = PreparedTrustedPlan & {
  decisionSummary: { acceptedProposalIds: readonly string[]; excludedProposalIds: readonly string[]; warningAcknowledged: boolean };
};
export type TrustedSnapshotApplyResult = {
  project: ProjectV2;
  receipt: { planId: string; beforeRevision: string; afterRevision: string; acceptedProposalIds: readonly string[];
    excludedProposalIds: readonly string[]; trustInvalidated: readonly TrustedFieldKey[]; verified: readonly []; persistence: "not-performed" };
};
type PrepareInput = { owner: TrustedPlanOwner; currentProject: ProjectV2; candidatePlan: InterfaceCandidatePlan };
type ApplyInput = { owner: TrustedPlanOwner; currentProject: ProjectV2 };
export type TrustedChangePlanner = {
  prepare(input: PrepareInput): Promise<PreparedTrustedPlan>;
  resolve(handle: TrustedPlanHandle, decision: TrustedPlanDecision): Promise<ResolvedTrustedPlan | { status: "cancelled" }>;
  apply(handle: TrustedPlanHandle, input: ApplyInput): Promise<TrustedSnapshotApplyResult>;
};

const id = z.string().min(1).max(128).refine((s) => s.trim() === s);
const text = z.string().min(1).max(2000).refine((s) => s.trim().length > 0);
const interfaceSchema = z.object({
  id, deviceId: id, name: text, kind: z.enum(["physical", "logical", "aggregate", "wireless"]),
  aliases: z.array(text).max(512), parentInterfaceId: id.optional(),
  mac: text.optional(), description: text.optional(), adminLabel: text.optional(),
}).strict();
const candidateSchema = z.object({
  interface: interfaceSchema, parentName: text.optional(), source: z.enum(["explicit", "template", "manual"]),
  evidenceIds: z.array(id).min(1).max(100), verification: z.literal("unverified"),
}).strict();
const planSchema = z.object({
  deviceId: id, candidates: z.array(candidateSchema).max(4096), evidence: z.array(z.unknown()).max(4096),
  conflicts: z.array(z.object({ code: text, proposals: z.array(candidateSchema).max(4096),
    existingInterfaceIds: z.array(id).max(4096), evidenceIds: z.array(id).max(100), protected: z.boolean() }).strict()).max(4096),
  missingInfo: z.array(z.object({ code: text }).strict()).max(100),
}).strict();
const ownerSchema = z.object({ projectScopeId: id, deviceId: id }).strict();
const prepareSchema = z.object({ owner: ownerSchema, currentProject: z.unknown(), candidatePlan: planSchema }).strict();
const applySchema = z.object({ owner: ownerSchema, currentProject: z.unknown() }).strict();
const decisionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("cancel") }).strict(),
  z.object({ kind: z.literal("resolve"), warningAcknowledged: z.boolean(),
    resolutions: z.array(z.object({ proposalId: id, action: text }).strict()).max(32768) }).strict(),
]);
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const ids = (values: Iterable<string>) => [...new Set(values)].sort(compare);
const normalized = (value: string) => value.normalize("NFC").trim().toLocaleLowerCase("en-US");
import { canonicalTrustedValue as canonical, fingerprintTrustedValue as fingerprint } from "./trusted-network-digest.ts";
function unionAliases(current: string[], extra: string[]) {
  const seen = new Set(current.map(normalized));
  const result = [...current];
  for (const value of extra) if (!seen.has(normalized(value))) { result.push(value); seen.add(normalized(value)); }
  return result;
}

// Inspect descriptors before cloning/parsing so accessors cannot run as validation.
function checkJson(value: unknown) {
  let nodes = 0;
  let units = 0;
  const ancestors = new Set<object>();
  function visit(item: unknown, depth: number): void {
    if (++nodes > 200000 || depth > 20) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
    if (typeof item === "string") {
      units += item.length;
      if (units > 2097152 || item.length > 2000 ||
        /[\u0000-\u001f\u007f]|password|secret|token|cookie|ciphertext|nonce|username|authorization|database_url|postgres(?:ql)?:\/\/|-----BEGIN|raw.?config/i.test(item)) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
      return;
    }
    if (item === null || typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))) return;
    if (!item || typeof item !== "object" || ancestors.has(item)) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
    ancestors.add(item);
    const keys = Reflect.ownKeys(item);
    if (Array.isArray(item) && keys.length !== item.length + 1) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
    for (const key of keys) {
      if (Array.isArray(item) && key === "length") continue;
      if (typeof key !== "string" || ["__proto__", "constructor", "prototype"].includes(key)) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
      if (Array.isArray(item) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= item.length)) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
      const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
      if (!descriptor.enumerable || !("value" in descriptor)) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
      visit(key, depth + 1); visit(descriptor.value, depth + 1);
    }
    ancestors.delete(item);
  }
  visit(value, 0);
}

type Draft = {
  entityId: string; fieldPath: TrustedFieldKey["fieldPath"]; value: unknown; current?: unknown;
  evidenceIds: Set<string>; codes: Set<string>; excludeOnly: boolean; protected: boolean;
  dependencies: Set<Draft>; parentDependencies: Set<Draft>; coupled: Set<Draft>;
  proposal?: TrustedFieldProposal;
};
type PendingIssue = {
  code: TrustedPlanIssue["code"]; severity: TrustedPlanIssue["severity"]; disposition: TrustedPlanIssue["disposition"];
  drafts: Draft[]; safePath?: string;
};
type Entry = {
  state: "prepared" | "resolved"; project: ProjectV2; gen: z.infer<typeof planSchema>;
  evidence: Map<string, EvidenceSource>; drafts: Draft[]; preview: TrustedPlanPreview;
  decisions?: Map<string, TrustedProposalResolution["action"]>; warningAcknowledged?: boolean;
};
const accepted = (action: string | undefined) => action === "accept-unverified" || action === "accept-and-verify";
const relationCodes = new Set(["PARENT_MISSING", "PARENT_CYCLE", "PARENT_BLOCKED", "ID_COLLISION"]);
const knownCodes = new Set([...relationCodes, "SOURCE_DISAGREEMENT", "ALIAS_COLLISION", "EXISTING_DIFFERENCE",
  "TEMPLATE_AMBIGUOUS", "TEMPLATE_CHANGED", "TEMPLATE_REMOVED"]);

function legacyPorts(project: ProjectV2, interfaceId: string) {
  return project.links.flatMap((link) => [
    ...(link.fromInterfaceId === interfaceId && link.fromPort ? [link.fromPort] : []),
    ...(link.toInterfaceId === interfaceId && link.toPort ? [link.toPort] : []),
  ]);
}
function portsCompatible(project: ProjectV2, row: NetworkInterface) {
  const labels = new Set([row.name, ...row.aliases].map(normalized));
  return legacyPorts(project, row.id).every((port) => labels.has(normalized(port)));
}

async function prepareEntry(input: PrepareInput): Promise<Entry> {
  checkJson(input);
  const parsed = prepareSchema.safeParse(structuredClone(input));
  if (!parsed.success) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
  const { owner, candidatePlan: gen } = parsed.data;
  const project = validateProjectV2(parsed.data.currentProject);
  if (gen.deviceId !== owner.deviceId || !project.devices.some((d) => d.id === owner.deviceId)) reject("TRUSTED_PLAN_SCOPE_MISMATCH");
  const existing = new Map(project.trustedNetwork.interfaces.map((row) => [row.id, row]));
  const pending: PendingIssue[] = [];
  const addIssue = (code: PendingIssue["code"], severity: PendingIssue["severity"], disposition: PendingIssue["disposition"], drafts: Draft[] = [], safePath?: string) =>
    pending.push({ code, severity, disposition, drafts, ...(safePath ? { safePath } : {}) });
  const evidence = new Map(project.trustedNetwork.evidence.map((source) => [source.id, source]));
  for (const source of gen.evidence) {
    const shell = upcastProject({ devices: [], links: [], groups: [] });
    shell.trustedNetwork.evidence = [source as EvidenceSource];
    const safe = validateProjectV2(shell).trustedNetwork.evidence[0];
    if (evidence.has(safe.id) && canonical(evidence.get(safe.id)) !== canonical(safe)) addIssue("TRUSTED_CANDIDATE_PLAN_INVALID", "blocking", "hard-block");
    else evidence.set(safe.id, safe);
  }
  const checkEvidence = (values: string[]) => {
    for (const value of values) if (!evidence.has(value)) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
    return ids(values);
  };
  const rows = [...gen.candidates, ...gen.conflicts.flatMap((c) => c.proposals)];
  if (rows.length > 16384) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
  for (const row of rows) {
    row.evidenceIds = checkEvidence(row.evidenceIds);
    if (row.interface.deviceId !== owner.deviceId || (existing.has(row.interface.id) && existing.get(row.interface.id)!.deviceId !== owner.deviceId)) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
    const methods = row.evidenceIds.map((key) => evidence.get(key)!.method);
    if (!methods.includes(row.source === "manual" ? "human" : row.source === "template" ? "template" : "parsed")) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
  }
  for (const conflict of gen.conflicts) {
    conflict.evidenceIds = checkEvidence(conflict.evidenceIds);
    conflict.existingInterfaceIds = ids(conflict.existingInterfaceIds);
    if (conflict.existingInterfaceIds.some((key) => !existing.has(key) || existing.get(key)!.deviceId !== owner.deviceId)) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
  }
  const baseRevision = await fingerprint(canonicalProjectV2(project));
  const candidateFingerprint = await fingerprint(gen);
  const planVersion = "trusted-network-plan-r1.1" as const;
  const planId = "plan-" + await fingerprint({ planVersion, owner, baseRevision, candidateFingerprint });
  const draftsByValue = new Map<string, Draft>();
  function draftFor(row: NetworkInterface, fieldPath: Draft["fieldPath"], value: unknown, candidate: InterfaceCandidate, codes: string[]) {
    const key = canonical([row.id, fieldPath, value]);
    let draft = draftsByValue.get(key);
    if (!draft) {
      const current = fieldPath === "$record" ? undefined : existing.get(row.id)?.[fieldPath];
      draft = { entityId: row.id, fieldPath, value: structuredClone(value), current, evidenceIds: new Set(), codes: new Set(),
        excludeOnly: false, protected: false, dependencies: new Set(), parentDependencies: new Set(), coupled: new Set() };
      draftsByValue.set(key, draft);
    }
    candidate.evidenceIds.forEach((key) => draft.evidenceIds.add(key));
    codes.forEach((code) => draft.codes.add(code));
    if (codes.some((code) => relationCodes.has(code) || code === "ALIAS_COLLISION")) draft.excludeOnly = true;
    return draft;
  }
  function mapRow(candidate: InterfaceCandidate, codes: string[]) {
    const row = candidate.interface;
    const current = existing.get(row.id);
    const result: Draft[] = [];
    if (!current) result.push(draftFor(row, "$record", row, candidate, codes));
    else {
      for (const field of FIELDS) {
        if (row[field] === undefined || (field === "aliases" && row.aliases.length === 0)) continue;
        const value = field === "aliases" ? unionAliases(current.aliases, row.aliases) : row[field];
        if (canonical(value) !== canonical(current[field])) result.push(draftFor(row, field, value, candidate, codes));
      }
      if (!result.length && canonical(current) !== canonical(row) && codes.some((code) => code === "EXISTING_DIFFERENCE" || code === "TEMPLATE_CHANGED")) {
        addIssue("TRUSTED_FIELD_INTENT_AMBIGUOUS", "blocking", "hard-block");
      }
    }
    if (candidate.parentName && (!row.parentInterfaceId ||
      ![...existing.values(), ...rows.map((r) => r.interface)].some((p) => p.id === row.parentInterfaceId &&
        p.deviceId === row.deviceId && [p.name, ...p.aliases].some((label) => normalized(label) === normalized(candidate.parentName!))))) {
      result.forEach((draft) => { draft.excludeOnly = true; });
      addIssue("PARENT_MISSING", "blocking", result.length ? "resolved-by-decisions" : "hard-block", result);
    }
    return result;
  }
  for (const row of gen.candidates) mapRow(row, []);
  for (const conflict of gen.conflicts) {
    const mapped = [...new Set(conflict.proposals.flatMap((row) => mapRow(row, [conflict.code])))];
    if (!knownCodes.has(conflict.code)) addIssue("TRUSTED_CANDIDATE_PLAN_INVALID", "blocking", "hard-block", mapped);
    else if (["TEMPLATE_CHANGED", "TEMPLATE_REMOVED", "EXISTING_DIFFERENCE"].includes(conflict.code)) {
      addIssue(conflict.code as InterfaceCandidateConflictCode, "warning", "acknowledge", mapped);
    } else if (conflict.code === "TEMPLATE_AMBIGUOUS") addIssue("TEMPLATE_AMBIGUOUS", "blocking", "hard-block", mapped);
    else addIssue(conflict.code as InterfaceCandidateConflictCode, "blocking", mapped.length ? "resolved-by-decisions" : "hard-block", mapped);
  }
  for (const missing of gen.missingInfo) {
    if (["NO_SOURCE", "TEMPLATE_NOT_FOUND", "TEMPLATE_IDENTITY_MISSING"].includes(missing.code)) {
      addIssue("MISSING_INFO", "warning", "acknowledge", [], "candidatePlan.missingInfo." + missing.code);
    }
    else addIssue("TRUSTED_CANDIDATE_PLAN_INVALID", "blocking", "hard-block");
  }

  // A rename may require a second visible proposal; never silently edit a Link.
  for (const rename of [...draftsByValue.values()].filter((d) => d.fieldPath === "name")) {
    const old = existing.get(rename.entityId)!;
    if (portsCompatible(project, { ...old, name: rename.value as string })) continue;
    const aliases = [...draftsByValue.values()].filter((d) => d.entityId === old.id && d.fieldPath === "aliases");
    if (aliases.length > 1) { addIssue("TRUSTED_LEGACY_PORT_INCOMPATIBLE", "blocking", "hard-block", [rename, ...aliases]); continue; }
    const value = unionAliases(aliases.length ? aliases[0].value as string[] : old.aliases, [old.name]);
    let paired = aliases[0];
    if (paired) paired.value = value;
    else paired = draftFor(old, "aliases", value, { interface: old, source: "explicit", verification: "unverified", evidenceIds: ids(rename.evidenceIds) }, []);
    rename.dependencies.add(paired); paired.dependencies.add(rename);
    rename.coupled.add(paired); paired.coupled.add(rename);
    if (!portsCompatible(project, { ...old, name: rename.value as string, aliases: value })) addIssue("TRUSTED_LEGACY_PORT_INCOMPATIBLE", "blocking", "hard-block", [rename, paired]);
  }
  const drafts = [...draftsByValue.values()];
  const allProjectIds = new Set<string>([...project.devices, ...project.links, ...project.groups,
    ...Object.values(project.trustedNetwork).filter(Array.isArray).flat()].map((r) => r.id));
  const newById = new Map<string, Draft[]>();
  for (const draft of drafts.filter((d) => d.fieldPath === "$record")) {
    newById.set(draft.entityId, [...(newById.get(draft.entityId) ?? []), draft]);
    if (allProjectIds.has(draft.entityId)) { draft.excludeOnly = true; addIssue("ID_COLLISION", "blocking", "resolved-by-decisions", [draft]); }
  }
  for (const draft of drafts) {
    const row = draft.fieldPath === "$record" ? draft.value as NetworkInterface : { ...existing.get(draft.entityId)!, [draft.fieldPath]: draft.value };
    for (const pair of draft.coupled) Object.assign(row, { [pair.fieldPath]: pair.value });
    const parentId = row.parentInterfaceId;
    if (parentId && (draft.fieldPath === "$record" || draft.fieldPath === "parentInterfaceId")) {
      const newParents = newById.get(parentId) ?? [];
      if (newParents.length === 1) {
        draft.dependencies.add(newParents[0]); draft.parentDependencies.add(newParents[0]);
      } else if (newParents.length > 1 || !existing.has(parentId) || existing.get(parentId)!.deviceId !== row.deviceId) {
        draft.excludeOnly = true; addIssue("PARENT_MISSING", "blocking", "resolved-by-decisions", [draft]);
      }
      const seen = new Set([row.id]);
      let cursor: string | undefined = parentId;
      while (cursor) {
        if (seen.has(cursor)) { draft.excludeOnly = true; addIssue("PARENT_CYCLE", "blocking", "resolved-by-decisions", [draft]); break; }
        seen.add(cursor);
        const proposed = newById.get(cursor);
        const parentEdits = drafts.filter((d) => d.entityId === cursor && d.fieldPath === "parentInterfaceId");
        cursor = proposed?.length === 1 ? (proposed[0].value as NetworkInterface).parentInterfaceId :
          parentEdits.length === 1 ? parentEdits[0].value as string : existing.get(cursor)?.parentInterfaceId;
      }
    }
    if (["$record", "name", "aliases"].includes(draft.fieldPath)) {
      const labels = [row.name, ...row.aliases].map(normalized);
      const collision = new Set(labels).size !== labels.length || [...existing.values()].some((other) => other.id !== row.id &&
        other.deviceId === row.deviceId && [other.name, ...other.aliases].some((label) => labels.includes(normalized(label))));
      if (collision) { draft.excludeOnly = true; addIssue("ALIAS_COLLISION", "blocking", "resolved-by-decisions", [draft]); }
    }
  }
  const additions = drafts.filter((d) => d.fieldPath === "$record");
  for (const draft of additions) {
    const row = draft.value as NetworkInterface;
    const labels = [row.name, ...row.aliases].map(normalized);
    if (additions.some((other) => other.entityId !== draft.entityId &&
      [(other.value as NetworkInterface).name, ...(other.value as NetworkInterface).aliases].some((label) => labels.includes(normalized(label))))) {
      draft.excludeOnly = true; addIssue("ALIAS_COLLISION", "blocking", "resolved-by-decisions", [draft]);
    }
  }
  // Any verified field on the target device remains protected even with a stale/legacy digest.
  for (const trust of project.trustedNetwork.fieldTrust.filter((t) => t.entityType === "interface" &&
    t.verification === "verified" && existing.get(t.entityId)?.deviceId === owner.deviceId)) {
    const row = existing.get(trust.entityId)!;
    const matches = drafts.filter((d) => d.entityId === row.id && (trust.fieldPath === "$record" || d.fieldPath === trust.fieldPath));
    matches.forEach((d) => { d.protected = true; });
    const value = trust.fieldPath === "$record" ? row : FIELDS.includes(trust.fieldPath as Leaf) ? row[trust.fieldPath as Leaf] : undefined;
    if (value === undefined || trust.valueFingerprint.toLowerCase() !== await fingerprint(value)) {
      addIssue("TRUSTED_TRUST_FINGERPRINT_STALE", "blocking", "hard-block", matches);
    }
  }
  for (const issue of [...pending]) if (issue.code === "EXISTING_DIFFERENCE" && issue.drafts.some((d) => d.protected)) {
    const unprotected = issue.drafts.filter((d) => !d.protected);
    if (unprotected.length) addIssue("EXISTING_DIFFERENCE", "warning", "acknowledge", unprotected);
    issue.drafts = issue.drafts.filter((d) => d.protected);
    issue.severity = "blocking"; issue.disposition = "resolved-by-decisions";
  }
  const groups = new Map<string, Draft[]>();
  for (const draft of drafts) {
    const key = canonical([draft.entityId, draft.fieldPath]);
    groups.set(key, [...(groups.get(key) ?? []), draft]);
  }
  for (const group of groups.values()) {
    const hashes = await Promise.all(group.map((d) => fingerprint(d.value)));
    const alternativeGroupId = group.length > 1 ? "alt-" + await fingerprint({
      owner, entityType: "interface", entityId: group[0].entityId, fieldPath: group[0].fieldPath, values: ids(hashes),
    }) : undefined;
    for (let i = 0; i < group.length; i++) {
      const d = group[i];
      const key: TrustedFieldKey = { entityType: "interface", entityId: d.entityId, fieldPath: d.fieldPath };
      const operation = d.fieldPath === "$record" ? "add" : "replace";
      const evidenceIds = ids(d.evidenceIds);
      const currentFingerprint = d.current === undefined ? undefined : await fingerprint(d.current);
      const proposedFingerprint = hashes[i];
      const proposalId = "proposal-" + await fingerprint({ planId, ...key, operation, currentFingerprint, proposedFingerprint, evidenceIds, alternativeGroupId });
      d.proposal = { ...key, proposalId, operation, ...(currentFingerprint ? { currentFingerprint } : {}),
        proposedFingerprint, proposedValue: structuredClone(d.value), evidenceIds, protected: d.protected,
        conflict: d.protected ? "verified-protected" : d.excludeOnly ? (d.codes.has("ALIAS_COLLISION") ? "alias-collision" : "relation") :
          d.current !== undefined ? "unverified-existing" : "none",
        ...(alternativeGroupId ? { alternativeGroupId } : {}), dependsOn: [], applicability: d.excludeOnly ? "exclude-only" : "applicable" };
    }
  }
  for (const draft of drafts) draft.proposal!.dependsOn = ids([...draft.dependencies].map((d) => d.proposal!.proposalId));
  const issuesById = new Map<string, TrustedPlanIssue>();
  for (const issue of pending) {
    const proposalIds = ids(issue.drafts.map((d) => d.proposal!.proposalId));
    const issueId = "issue-" + await fingerprint({ planId, code: issue.code, proposalIds, safePath: issue.safePath });
    const old = issuesById.get(issueId);
    if (old?.disposition === "hard-block") continue;
    issuesById.set(issueId, { id: issueId, code: issue.code, severity: issue.severity, disposition: issue.disposition, proposalIds,
      ...(issue.safePath ? { safePath: issue.safePath } : {}) });
  }
  const issues = [...issuesById.values()].sort((a, b) => compare(a.id, b.id));
  const proposals = drafts.map((d) => d.proposal!).sort((a, b) => compare(a.proposalId, b.proposalId));
  const body = { planVersion, planId, owner, baseRevision, candidateFingerprint, proposals, issues,
    summary: { total: proposals.length, blocking: issues.filter((i) => i.severity === "blocking").length,
      warnings: issues.filter((i) => i.severity === "warning").length, protected: proposals.filter((p) => p.protected).length },
    canResolve: !issues.some((i) => i.disposition === "hard-block") };
  const preview: TrustedPlanPreview = { ...body, previewFingerprint: await fingerprint(body) };
  return { state: "prepared", project, gen, evidence, drafts, preview };
}

function validateDecisions(entry: Entry, actions: Map<string, TrustedProposalResolution["action"]>, ack: boolean) {
  const proposals = entry.preview.proposals;
  const selectedAlternatives = new Set<string>();
  for (const p of proposals) {
    if (!actions.has(p.proposalId)) reject("TRUSTED_DECISION_INCOMPLETE");
    if (p.alternativeGroupId && accepted(actions.get(p.proposalId))) {
      if (selectedAlternatives.has(p.alternativeGroupId)) reject("TRUSTED_ALTERNATIVE_CONFLICT");
      selectedAlternatives.add(p.alternativeGroupId);
    }
    if (actions.get(p.proposalId) === "keep-current" && !p.currentFingerprint) reject("TRUSTED_DECISION_INVALID_FOR_OPERATION");
  }
  const issues = entry.preview.issues;
  if (issues.some((i) => i.code === "TRUSTED_TRUST_FINGERPRINT_STALE")) reject("TRUSTED_TRUST_FINGERPRINT_STALE");
  if (issues.some((i) => i.disposition === "hard-block")) reject("TRUSTED_BLOCKING_ISSUE");
  for (const p of proposals) if (p.applicability === "exclude-only" && accepted(actions.get(p.proposalId))) reject("TRUSTED_BLOCKING_ISSUE");
  for (const p of proposals) if (p.alternativeGroupId && selectedAlternatives.has(p.alternativeGroupId) &&
    !accepted(actions.get(p.proposalId)) && actions.get(p.proposalId) !== "exclude") reject("TRUSTED_ALTERNATIVE_CONFLICT");
  for (const issue of issues.filter((i) => i.code === "SOURCE_DISAGREEMENT")) {
    if (issue.proposalIds.some((key) => actions.get(key) === "keep-current")) reject("TRUSTED_BLOCKING_ISSUE");
  }
  if (issues.some((i) => i.disposition === "acknowledge") && !ack) reject("TRUSTED_WARNING_ACK_REQUIRED");
  for (const p of proposals) {
    if (actions.get(p.proposalId) === "accept-and-verify" || (p.protected && accepted(actions.get(p.proposalId)))) reject("TRUSTED_ACTOR_REQUIRED");
  }
  for (const draft of entry.drafts) {
    const action = actions.get(draft.proposal!.proposalId);
    for (const dep of draft.dependencies) {
      const parentAction = actions.get(dep.proposal!.proposalId);
      const coupledAlternative = draft.coupled.has(dep) && dep.proposal!.alternativeGroupId &&
        [...draft.coupled].some((other) => other.proposal!.alternativeGroupId === dep.proposal!.alternativeGroupId &&
          accepted(actions.get(other.proposal!.proposalId)));
      if (accepted(action) && !accepted(parentAction) && !coupledAlternative) reject("TRUSTED_DECISION_DEPENDENCY_CONFLICT");
      if (draft.parentDependencies.has(dep) && !accepted(parentAction) && action !== "exclude") reject("TRUSTED_DECISION_DEPENDENCY_CONFLICT");
    }
  }
}

async function resolvedPreview(entry: Entry) {
  const preview = structuredClone(entry.preview);
  preview.issues = preview.issues.filter((issue) => issue.disposition !== "resolved-by-decisions");
  preview.summary.blocking = preview.issues.filter((issue) => issue.severity === "blocking").length;
  const { previewFingerprint: previous, ...body } = preview;
  void previous;
  preview.previewFingerprint = await fingerprint(body);
  return preview;
}

async function snapshot(entry: Entry): Promise<TrustedSnapshotApplyResult> {
  const result = structuredClone(entry.project);
  const actions = entry.decisions!;
  const chosen = entry.drafts.filter((d) => accepted(actions.get(d.proposal!.proposalId)))
    .sort((a, b) => compare(a.proposal!.proposalId, b.proposal!.proposalId));
  const usedEvidence = ids(chosen.flatMap((d) => [...d.evidenceIds]));
  for (const key of usedEvidence) if (!result.trustedNetwork.evidence.some((e) => e.id === key)) {
    const source = entry.evidence.get(key);
    if (!source) reject("TRUSTED_RESULT_INVALID");
    result.trustedNetwork.evidence.push(structuredClone(source));
  }
  const invalidated: TrustedFieldKey[] = [];
  // Build the entire graph before CORE validation; no partial snapshot escapes.
  for (const draft of chosen) {
    if (draft.fieldPath === "$record") result.trustedNetwork.interfaces.push(structuredClone(draft.value as NetworkInterface));
    else {
      const row = result.trustedNetwork.interfaces.find((r) => r.id === draft.entityId);
      if (!row) reject("TRUSTED_RESULT_INVALID");
      Object.assign(row, { [draft.fieldPath]: structuredClone(draft.value) });
    }
    const row = result.trustedNetwork.interfaces.find((r) => r.id === draft.entityId)!;
    const leaves = draft.fieldPath === "$record" ? FIELDS.filter((field) => row[field] !== undefined) : [draft.fieldPath];
    for (const fieldPath of leaves) {
      const key: TrustedFieldKey = { entityType: "interface", entityId: row.id, fieldPath };
      const prior = result.trustedNetwork.fieldTrust.filter((t) => t.entityType === key.entityType &&
        t.entityId === key.entityId && (t.fieldPath === fieldPath || t.fieldPath === "$record"));
      if (prior.some((t) => t.verification === "verified")) reject("TRUSTED_ACTOR_REQUIRED");
      if (prior.length) invalidated.push(key);
      result.trustedNetwork.fieldTrust = result.trustedNetwork.fieldTrust.filter((t) => !prior.includes(t));
      result.trustedNetwork.fieldTrust.push({ ...key, id: "trust-plan-" + await fingerprint(key),
        valueFingerprint: await fingerprint(row[fieldPath as Leaf]), evidenceIds: ids(draft.evidenceIds), verification: "unverified" });
    }
  }
  for (const row of result.trustedNetwork.interfaces.filter((r) => r.deviceId === entry.preview.owner.deviceId)) {
    if (!portsCompatible(result, row)) reject("TRUSTED_LEGACY_PORT_INCOMPATIBLE");
  }
  let project: ProjectV2;
  try { project = canonicalProjectV2(result); } catch { return reject("TRUSTED_RESULT_INVALID"); }
  return { project, receipt: { planId: entry.preview.planId, beforeRevision: entry.preview.baseRevision,
    afterRevision: await fingerprint(project), acceptedProposalIds: ids(chosen.map((d) => d.proposal!.proposalId)),
    excludedProposalIds: ids([...actions].filter(([, a]) => a === "exclude").map(([key]) => key)),
    trustInvalidated: invalidated, verified: [], persistence: "not-performed" } };
}

/** Snapshot-only planner. Handles never survive cloning, reload or another instance. */
export function createTrustedChangePlanner(): TrustedChangePlanner {
  const registry = new Map<TrustedPlanHandle, Entry>();
  let preparing = 0;
  function entryFor(handle: TrustedPlanHandle) {
    const entry = registry.get(handle);
    if (!entry) reject("TRUSTED_PLAN_HANDLE_INVALID");
    return entry;
  }
  return {
    async prepare(input) {
      if (registry.size + preparing >= 32) reject("TRUSTED_PLAN_CAPACITY_EXCEEDED");
      preparing++;
      try {
        const entry = await prepareEntry(input);
        const handle = Object.freeze({});
        registry.set(handle, entry);
        return { handle, preview: structuredClone(entry.preview) };
      } catch (error) { return safeError(error); }
      finally { preparing--; }
    },
    async resolve(handle, decision) {
      const entry = entryFor(handle);
      try {
        checkJson(decision);
        const parsed = decisionSchema.safeParse(decision);
        if (!parsed.success) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
        if (parsed.data.kind === "cancel") { registry.delete(handle); return { status: "cancelled" }; }
        if (entry.state !== "prepared") reject("TRUSTED_PLAN_STATE_INVALID");
        if (entry.preview.issues.some((i) => i.code === "TRUSTED_TRUST_FINGERPRINT_STALE")) reject("TRUSTED_TRUST_FINGERPRINT_STALE");
        const actions = new Map<string, TrustedProposalResolution["action"]>();
        const known = new Set(entry.preview.proposals.map((p) => p.proposalId));
        for (const { proposalId, action } of parsed.data.resolutions) {
          if (!known.has(proposalId)) reject("TRUSTED_DECISION_UNKNOWN");
          if (actions.has(proposalId)) reject("TRUSTED_DECISION_DUPLICATE");
          if (!["accept-unverified", "accept-and-verify", "keep-current", "exclude"].includes(action)) reject("TRUSTED_OPERATION_UNSUPPORTED");
          actions.set(proposalId, action as TrustedProposalResolution["action"]);
        }
        validateDecisions(entry, actions, parsed.data.warningAcknowledged);
        entry.decisions = actions; entry.warningAcknowledged = parsed.data.warningAcknowledged; entry.state = "resolved";
        return { handle, preview: await resolvedPreview(entry), decisionSummary: {
          acceptedProposalIds: ids([...actions].filter(([, a]) => accepted(a)).map(([key]) => key)),
          excludedProposalIds: ids([...actions].filter(([, a]) => a === "exclude").map(([key]) => key)),
          warningAcknowledged: parsed.data.warningAcknowledged,
        } };
      } catch (error) { return safeError(error); }
    },
    async apply(handle, input) {
      const entry = entryFor(handle);
      registry.delete(handle);
      try {
        if (entry.state !== "resolved") reject("TRUSTED_PLAN_STATE_INVALID");
        checkJson(input);
        const parsed = applySchema.safeParse(input);
        if (!parsed.success) reject("TRUSTED_CANDIDATE_PLAN_INVALID");
        const current = validateProjectV2(parsed.data.currentProject);
        if (canonical(parsed.data.owner) !== canonical(entry.preview.owner)) reject("TRUSTED_PLAN_SCOPE_MISMATCH");
        if (await fingerprint(canonicalProjectV2(current)) !== entry.preview.baseRevision) reject("TRUSTED_PLAN_STALE");
        validateDecisions(entry, entry.decisions!, entry.warningAcknowledged!);
        return await snapshot(entry);
      } catch (error) { return safeError(error); }
    },
  };
}
