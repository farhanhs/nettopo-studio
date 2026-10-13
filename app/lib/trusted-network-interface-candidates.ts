import { z } from "zod";

import { upcastProject, validateProjectV2 } from "./trusted-network-model.ts";
import type { EvidenceSource, NetworkInterface, ProjectV2 } from "./trusted-network-types.ts";

export const INTERFACE_CANDIDATE_LIMITS = Object.freeze({
  sources: 32, templates: 32, rowsPerSource: 512, totalRows: 4096,
  quantity: 512, maxIndex: 999999, aliases: 32, name: 256,
  depth: 12, nodes: 100000, textUnits: 1048576,
});

export type InterfaceCandidateErrorCode =
  | "INVALID_INPUT" | "INPUT_LIMIT_EXCEEDED" | "INVALID_CURRENT_PROJECT"
  | "DEVICE_NOT_FOUND" | "INVALID_MANUAL_FORMAT" | "UNSAFE_INPUT";

export class InterfaceCandidateError extends Error {
  readonly code: InterfaceCandidateErrorCode;

  constructor(code: InterfaceCandidateErrorCode) {
    super("Interface candidate input was rejected.");
    this.name = "InterfaceCandidateError";
    this.code = code;
  }
}

const id = z.string().min(1).max(128).refine((value) => value.trim() === value);
const text = z.string().min(1).max(2000).refine((value) => value.trim().length > 0);
const label = text.max(INTERFACE_CANDIDATE_LIMITS.name);
const kind = z.enum(["physical", "logical", "aggregate", "wireless"]);
const hex = z.string().regex(/^[a-f0-9]{64}$/i);
const templateKey = z.object({ templateId: id, version: text, fingerprint: hex }).strict();
const rowSchema = z.object({
  name: label, kind,
  aliases: z.array(label).max(INTERFACE_CANDIDATE_LIMITS.aliases).optional(),
  parentName: label.optional(), mac: text.optional(), description: text.optional(), adminLabel: text.optional(),
}).strict();
const templateSchema = z.object({
  ...templateKey.shape, vendor: label, modelMatch: label,
  reviewedAt: z.iso.datetime({ offset: true }),
  interfaces: z.array(rowSchema.pick({ name: true, kind: true, aliases: true, parentName: true }))
    .max(INTERFACE_CANDIDATE_LIMITS.rowsPerSource),
}).strict();
const manualSchema = z.object({
  quantity: z.number().int().min(1).max(INTERFACE_CANDIDATE_LIMITS.quantity),
  start: z.number().int().min(0).max(INTERFACE_CANDIDATE_LIMITS.maxIndex),
  pattern: z.string().max(16), prefix: z.string().max(128).optional(), suffix: z.string().max(128).optional(),
  kind,
}).strict();
const inputSchema = z.object({
  deviceId: id, vendor: label.optional(), model: label.optional(),
  explicit: z.array(z.object({
    evidence: z.unknown(), interfaces: z.array(rowSchema).max(INTERFACE_CANDIDATE_LIMITS.rowsPerSource),
  }).strict()).max(INTERFACE_CANDIDATE_LIMITS.sources).optional(),
  templateSelection: templateKey.optional(), manual: manualSchema.optional(),
}).strict();

export type InterfaceCandidateRow = z.infer<typeof rowSchema>;
export type InterfaceTemplate = z.infer<typeof templateSchema>;
export type InterfaceCandidateInput = Omit<z.infer<typeof inputSchema>, "explicit"> & {
  explicit?: Array<{ evidence: EvidenceSource; interfaces: InterfaceCandidateRow[] }>;
};
type Source = "explicit" | "template" | "manual";
export type InterfaceCandidate = {
  interface: NetworkInterface;
  parentName?: string;
  source: Source;
  evidenceIds: string[];
  verification: "unverified";
};
export type InterfaceCandidateConflictCode =
  | "SOURCE_DISAGREEMENT" | "ALIAS_COLLISION" | "EXISTING_DIFFERENCE"
  | "TEMPLATE_AMBIGUOUS" | "TEMPLATE_CHANGED" | "TEMPLATE_REMOVED"
  | "PARENT_MISSING" | "PARENT_CYCLE" | "PARENT_BLOCKED" | "ID_COLLISION";
export type InterfaceCandidateConflict = {
  code: InterfaceCandidateConflictCode;
  proposals: InterfaceCandidate[];
  existingInterfaceIds: string[];
  evidenceIds: string[];
  protected: boolean;
};
export type InterfaceCandidatePlan = {
  deviceId: string;
  candidates: InterfaceCandidate[];
  evidence: EvidenceSource[];
  conflicts: InterfaceCandidateConflict[];
  missingInfo: Array<{ code: "NO_SOURCE" | "TEMPLATE_NOT_FOUND" | "TEMPLATE_IDENTITY_MISSING" }>;
};

function reject(code: InterfaceCandidateErrorCode): never {
  throw new InterfaceCandidateError(code);
}

function normalize(value: string) {
  return value.normalize("NFC").trim().toLocaleLowerCase("en-US");
}

function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => compare(a, b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function stableId(prefix: "if" | "ev", value: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)));
  return `${prefix}-gen-v1-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

// Accept bounded JSON data, never executable/accessor objects or raw source blobs.
function checkStructuredInput(value: unknown) {
  let nodes = 0;
  let textUnits = 0;
  const ancestors = new Set<object>();
  const visit = (item: unknown, depth: number): void => {
    if (++nodes > INTERFACE_CANDIDATE_LIMITS.nodes || depth > INTERFACE_CANDIDATE_LIMITS.depth) reject("INPUT_LIMIT_EXCEEDED");
    if (typeof item === "string") {
      textUnits += item.length;
      if (item.length > 2000 || textUnits > INTERFACE_CANDIDATE_LIMITS.textUnits) reject("INPUT_LIMIT_EXCEEDED");
      if (/[\u0000-\u001f\u007f]|password|secret|token|cookie|ciphertext|nonce|username|authorization|database_url|postgres(?:ql)?:\/\/|-----BEGIN|raw.?config/i.test(item)) reject("UNSAFE_INPUT");
      return;
    }
    if (item === null || typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))) return;
    if (!item || typeof item !== "object") reject("INVALID_INPUT");
    if (ancestors.has(item)) reject("INVALID_INPUT");
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) reject("INVALID_INPUT");
    ancestors.add(item);
    const keys = Reflect.ownKeys(item);
    if (Array.isArray(item) && keys.length !== item.length + 1) reject("INVALID_INPUT");
    for (const key of keys) {
      if (Array.isArray(item) && key === "length") continue;
      if (typeof key !== "string") reject("INVALID_INPUT");
      if (Array.isArray(item) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= item.length)) reject("INVALID_INPUT");
      const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
      if (!descriptor.enumerable || !("value" in descriptor)) reject("INVALID_INPUT");
      visit(key, depth + 1);
      visit(descriptor.value, depth + 1);
    }
    ancestors.delete(item);
  };
  visit(value, 0);
}

function validateEvidence(input: unknown): EvidenceSource {
  try {
    const project = upcastProject({ devices: [], links: [], groups: [] });
    project.trustedNetwork.evidence = [input as EvidenceSource];
    return validateProjectV2(project).trustedNetwork.evidence[0];
  } catch {
    return reject("UNSAFE_INPUT");
  }
}

type Draft = {
  key: string;
  id: string;
  row: InterfaceCandidateRow;
  source: Source;
  evidenceIds: Set<string>;
  variants: Array<{ row: InterfaceCandidateRow; source: Source; evidenceId: string }>;
  codes: Set<InterfaceCandidateConflictCode>;
  existingIds: Set<string>;
  parentId?: string;
};

function asInterface(draft: Draft, deviceId: string, row = draft.row): NetworkInterface {
  const parentId = row.parentName === draft.row.parentName ? draft.parentId : undefined;
  return {
    id: draft.id, deviceId, name: row.name, kind: row.kind, aliases: [...(row.aliases ?? [])],
    ...(parentId ? { parentInterfaceId: parentId } : {}),
    ...(row.mac !== undefined ? { mac: row.mac } : {}),
    ...(row.description !== undefined ? { description: row.description } : {}),
    ...(row.adminLabel !== undefined ? { adminLabel: row.adminLabel } : {}),
  };
}

function proposal(draft: Draft, deviceId: string): InterfaceCandidate {
  return { interface: asInterface(draft, deviceId), ...(draft.row.parentName ? { parentName: draft.row.parentName } : {}),
    source: draft.source, evidenceIds: [...draft.evidenceIds].sort(compare), verification: "unverified" };
}

/** A preview only. No current record, verification state, or persistence is changed. */
export async function generateInterfaceCandidates(
  currentProject: unknown,
  input: unknown,
  trustedTemplates: unknown = [],
): Promise<InterfaceCandidatePlan> {
  checkStructuredInput(input);
  checkStructuredInput(trustedTemplates);
  const parsed = inputSchema.safeParse(input);
  const registry = z.array(templateSchema).max(INTERFACE_CANDIDATE_LIMITS.templates).safeParse(trustedTemplates);
  if (!parsed.success || !registry.success) reject("INVALID_INPUT");
  const request = parsed.data;
  if (registry.data.reduce((count, template) => count + template.interfaces.length, 0) > INTERFACE_CANDIDATE_LIMITS.totalRows) reject("INPUT_LIMIT_EXCEEDED");
  let project: ProjectV2;
  try {
    checkStructuredInput(currentProject);
    project = validateProjectV2(currentProject);
  } catch { return reject("INVALID_CURRENT_PROJECT"); }
  if (!project.devices.some((device) => device.id === request.deviceId)) reject("DEVICE_NOT_FOUND");

  const plan: InterfaceCandidatePlan = { deviceId: request.deviceId, candidates: [], evidence: [], conflicts: [], missingInfo: [] };
  const sources: Array<{ source: Source; evidence: EvidenceSource; rows: InterfaceCandidateRow[] }> = [];
  for (const source of request.explicit ?? []) {
    const evidence = validateEvidence(source.evidence);
    if (evidence.method !== "parsed" || !["document", "csv", "json"].includes(evidence.sourceKind) || evidence.template) reject("INVALID_INPUT");
    sources.push({ source: "explicit", evidence, rows: source.interfaces });
  }
  sources.sort((a, b) => compare(a.evidence.id, b.evidence.id));

  const templateKeys = new Map<string, string>();
  for (const template of registry.data) {
    const key = canonical([template.templateId, template.version]);
    if (templateKeys.has(key) && templateKeys.get(key) !== canonical(template)) reject("INVALID_INPUT");
    templateKeys.set(key, canonical(template));
  }
  let selected: InterfaceTemplate | undefined;
  if (request.vendor && request.model) {
    const matching = registry.data.filter((template) => normalize(template.vendor) === normalize(request.vendor!)
      && normalize(template.modelMatch) === normalize(request.model!)
      && (!request.templateSelection || (template.templateId === request.templateSelection.templateId
        && template.version === request.templateSelection.version
        && template.fingerprint.toLowerCase() === request.templateSelection.fingerprint.toLowerCase())));
    const unique = [...new Map(matching.map((template) => [canonical(template), template])).values()];
    if (unique.length === 1) selected = unique[0];
    else if (unique.length > 1) plan.conflicts.push({ code: "TEMPLATE_AMBIGUOUS", proposals: [], existingInterfaceIds: [], evidenceIds: [], protected: false });
    else plan.missingInfo.push({ code: "TEMPLATE_NOT_FOUND" });
  } else if (request.vendor || request.model || request.templateSelection) {
    plan.missingInfo.push({ code: "TEMPLATE_IDENTITY_MISSING" });
  }
  let templateEvidence: EvidenceSource | undefined;
  if (selected) {
    templateEvidence = validateEvidence({
      id: await stableId("ev", [request.deviceId, selected.templateId, selected.version, selected.fingerprint.toLowerCase()]),
      method: "template", sourceKind: "template", displayName: "Selected reviewed interface template",
      template: { templateId: selected.templateId, version: selected.version, fingerprint: selected.fingerprint },
    });
    sources.push({ source: "template", evidence: templateEvidence, rows: selected.interfaces });
  }
  if (request.manual) {
    const manual = request.manual;
    const pattern = /^\{n(?::0([2-6]))?\}$/.exec(manual.pattern);
    if (!pattern || /[{}]/.test((manual.prefix ?? "") + (manual.suffix ?? ""))) reject("INVALID_MANUAL_FORMAT");
    if (manual.start + manual.quantity - 1 > INTERFACE_CANDIDATE_LIMITS.maxIndex) reject("INPUT_LIMIT_EXCEEDED");
    const rows = Array.from({ length: manual.quantity }, (_, index) => ({
      name: `${manual.prefix ?? ""}${String(manual.start + index).padStart(Number(pattern[1] ?? 1), "0")}${manual.suffix ?? ""}`,
      kind: manual.kind,
    }));
    if (rows.some((row) => !label.safeParse(row.name).success)) reject("INVALID_MANUAL_FORMAT");
    const evidence = validateEvidence({
      id: await stableId("ev", [request.deviceId, "manual", manual]),
      method: "human", sourceKind: "manual", displayName: "Manual interface numbering preview",
    });
    sources.push({ source: "manual", evidence, rows });
  }
  if (sources.reduce((count, source) => count + source.rows.length, 0) > INTERFACE_CANDIDATE_LIMITS.totalRows) reject("INPUT_LIMIT_EXCEEDED");
  if (!sources.some((source) => source.rows.length > 0)) plan.missingInfo.push({ code: "NO_SOURCE" });

  const evidenceById = new Map<string, EvidenceSource>();
  const currentEvidence = new Map(project.trustedNetwork.evidence.map((source) => [source.id, source]));
  for (const { evidence } of sources) {
    const old = evidenceById.get(evidence.id) ?? currentEvidence.get(evidence.id);
    if (old && canonical(old) !== canonical(evidence)) reject("INVALID_INPUT");
    evidenceById.set(evidence.id, evidence);
  }

  const drafts = new Map<string, Draft>();
  for (const source of sources) {
    for (const row of source.rows) {
      const key = normalize(row.name);
      let draft = drafts.get(key);
      if (!draft) {
        draft = { key, id: await stableId("if", [request.deviceId, key]), row: structuredClone(row), source: source.source,
          evidenceIds: new Set(), variants: [], codes: new Set(), existingIds: new Set() };
        drafts.set(key, draft);
      } else {
        // Priority fills absent values only; every disagreement remains reviewable.
        for (const field of Object.keys(row) as Array<keyof InterfaceCandidateRow>) {
          if (draft.row[field] === undefined) Object.assign(draft.row, { [field]: row[field] });
          else if (canonical(draft.row[field]) !== canonical(row[field])) draft.codes.add("SOURCE_DISAGREEMENT");
        }
      }
      draft.evidenceIds.add(source.evidence.id);
      if (!draft.variants.some((item) => canonical(item.row) === canonical(row) && item.evidenceId === source.evidence.id)) {
        draft.variants.push({ row: structuredClone(row), source: source.source, evidenceId: source.evidence.id });
      }
    }
  }
  const ordered = [...drafts.values()].sort((a, b) => compare(a.key, b.key));
  const existing = project.trustedNetwork.interfaces.filter((row) => row.deviceId === request.deviceId);
  const existingById = new Map(existing.map((row) => [row.id, row]));
  const allIds = new Set<string>([...project.devices, ...project.links, ...project.groups,
    ...Object.values(project.trustedNetwork).filter(Array.isArray).flat()].map((record) => record.id));
  const verified = new Set(project.trustedNetwork.fieldTrust.filter((trust) => trust.entityType === "interface" && trust.verification === "verified").map((trust) => trust.entityId));
  const fromTemplate = new Set(project.trustedNetwork.fieldTrust.filter((trust) => trust.entityType === "interface"
    && selected && trust.evidenceIds.some((evidenceId) => currentEvidence.get(evidenceId)?.template?.templateId === selected.templateId)).map((trust) => trust.entityId));

  const labels = new Map<string, { drafts: Set<Draft>; existing: Set<string> }>();
  const addLabel = (name: string, draft?: Draft, existingId?: string) => {
    const key = normalize(name);
    const slot = labels.get(key) ?? { drafts: new Set<Draft>(), existing: new Set<string>() };
    if (draft) slot.drafts.add(draft);
    if (existingId) slot.existing.add(existingId);
    labels.set(key, slot);
  };
  for (const row of existing) for (const name of [row.name, ...row.aliases]) addLabel(name, undefined, row.id);
  for (const draft of ordered) {
    for (const variant of draft.variants) {
      const names = [variant.row.name, ...(variant.row.aliases ?? [])];
      if (new Set(names.map(normalize)).size !== names.length) draft.codes.add("ALIAS_COLLISION");
      for (const name of names) addLabel(name, draft);
    }
  }
  for (const slot of labels.values()) {
    for (const draft of slot.drafts) {
      if (slot.drafts.size > 1) draft.codes.add("ALIAS_COLLISION");
      for (const existingId of slot.existing) draft.existingIds.add(existingId);
    }
  }
  for (const draft of ordered) {
    if (draft.existingIds.size === 1) draft.id = [...draft.existingIds][0];
    else if (draft.existingIds.size > 1) draft.codes.add("ALIAS_COLLISION");
    else if (allIds.has(draft.id)) draft.codes.add("ID_COLLISION");
  }
  for (const draft of ordered) {
    if (!draft.row.parentName) continue;
    const slot = labels.get(normalize(draft.row.parentName));
    const ids = new Set([...(slot?.existing ?? []), ...[...(slot?.drafts ?? [])].map((parent) => parent.id)]);
    if (ids.size !== 1) draft.codes.add("PARENT_MISSING");
    else draft.parentId = [...ids][0];
  }
  for (const draft of ordered) {
    if (draft.existingIds.size !== 1) continue;
    const old = existingById.get(draft.id)!;
    const proposed = asInterface(draft, request.deviceId);
    const fields: Array<keyof NetworkInterface> = ["name", "kind"];
    for (const field of ["aliases", "mac", "description", "adminLabel"] as const) {
      if (draft.row[field] !== undefined) fields.push(field);
    }
    if (draft.row.parentName !== undefined) fields.push("parentInterfaceId");
    if (fields.some((field) => canonical(old[field]) !== canonical(proposed[field]))) {
      draft.codes.add(fromTemplate.has(old.id) ? "TEMPLATE_CHANGED" : "EXISTING_DIFFERENCE");
    }
  }

  // Validate parent graph against existing records too, then propagate blocked parents.
  const byId = new Map(ordered.map((draft) => [draft.id, draft]));
  for (const draft of ordered) {
    const visited = new Set<string>();
    let next: string | undefined = draft.id;
    while (next) {
      if (visited.has(next)) { draft.codes.add("PARENT_CYCLE"); break; }
      visited.add(next);
      next = byId.get(next)?.parentId ?? existingById.get(next)?.parentInterfaceId;
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const draft of ordered) {
      if (!draft.parentId || draft.codes.has("PARENT_BLOCKED")) continue;
      const parent = byId.get(draft.parentId);
      if (parent?.codes.size) { draft.codes.add("PARENT_BLOCKED"); changed = true; }
    }
  }
  for (const draft of ordered) {
    if (draft.codes.size) {
      for (const code of [...draft.codes].sort(compare)) {
        plan.conflicts.push({ code,
          proposals: draft.variants.map((variant) => ({ interface: asInterface(draft, request.deviceId, variant.row),
            ...(variant.row.parentName ? { parentName: variant.row.parentName } : {}),
            source: variant.source, evidenceIds: [variant.evidenceId], verification: "unverified" })),
          existingInterfaceIds: [...draft.existingIds].sort(compare), evidenceIds: [...draft.evidenceIds].sort(compare),
          protected: [...draft.existingIds].some((id) => verified.has(id)),
        });
      }
    } else if (draft.existingIds.size === 0) plan.candidates.push(proposal(draft, request.deviceId));
  }
  if (selected && templateEvidence) {
    const names = new Set(selected.interfaces.flatMap((row) => [row.name, ...(row.aliases ?? [])]).map(normalize));
    for (const old of [...existing].sort((a, b) => compare(a.id, b.id))) {
      if (!fromTemplate.has(old.id) || names.has(normalize(old.name))) continue;
      plan.conflicts.push({ code: "TEMPLATE_REMOVED", proposals: [], existingInterfaceIds: [old.id],
        evidenceIds: [templateEvidence.id], protected: verified.has(old.id) });
    }
  }
  const usedEvidence = new Set([...plan.candidates, ...plan.conflicts].flatMap((record) => record.evidenceIds));
  plan.evidence = [...evidenceById.values()].filter((evidence) => usedEvidence.has(evidence.id)).sort((a, b) => compare(a.id, b.id));

  // Defense in depth: the conflict-free additions must fit the unchanged core contract.
  try {
    validateProjectV2({ ...project, trustedNetwork: { ...project.trustedNetwork,
      interfaces: [...project.trustedNetwork.interfaces, ...plan.candidates.map((candidate) => candidate.interface)],
      evidence: [...project.trustedNetwork.evidence, ...plan.evidence.filter((source) => !currentEvidence.has(source.id))],
    } });
  } catch { return reject("INVALID_INPUT"); }
  return structuredClone(plan);
}
