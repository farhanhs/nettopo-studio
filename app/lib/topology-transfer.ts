import Papa from "papaparse";
import { z } from "zod";

import { MASKED_SECRET, isMaskedCredentialUsername, maskCredentialUsername } from "./credential-masking.ts";
import { buildMissingInfo, countMissingInfo, MissingInfoSchema, type MissingInfoItem } from "./topology-missing-info.ts";
import { parseTopologyDocument } from "./topology-document-parser.ts";
import type { CredentialKind, Project } from "./topology-types.ts";

export const PROJECT_SCHEMA_VERSION = 1 as const;
export const CSV_BUNDLE_SCHEMA_VERSION = 2 as const;

const DEVICE_TYPES = ["router", "modem", "firewall", "switch", "server", "nas", "erp", "access-point", "client", "ssid", "mesh-node", "printer", "camera", "pos", "iot"] as const;
const LINK_KINDS = ["wired", "wireless"] as const;
const GROUP_KINDS = ["site", "domain", "vlan"] as const;
const CREDENTIAL_KINDS = ["device_admin", "device_readonly", "wifi", "vpn", "external_service"] as const;
const SHARING = ["full", "safe"] as const;

const DEVICE_LIMIT = 5_000;
const LINK_LIMIT = 20_000;
const GROUP_LIMIT = 1_000;
export const IMPORT_FILE_LIMIT_BYTES = 10 * 1024 * 1024;
export const IMPORT_BATCH_LIMIT_BYTES = 25 * 1024 * 1024;
const CREDENTIAL_LIMIT = 5_000;
const MISSING_INFO_LIMIT = 25_000;

const optionalText = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.string().trim().optional().transform((value) => value || undefined),
);
const optionalQuantity = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number().int().min(1).max(10_000).optional(),
);
const optionalNumber = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number().finite().optional(),
);
const requiredNumber = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number().finite(),
);
const optionalBoolean = z.preprocess(
  (value) => value === "" || value === null || value === undefined
    ? undefined
    : typeof value === "string"
      ? value.toLowerCase() === "true"
      : value,
  z.boolean().optional(),
);
const requiredCsvVersion = z.preprocess((value) => Number(value), z.literal(CSV_BUNDLE_SCHEMA_VERSION));

export const DeviceSchema = z.object({
  id: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(2_000),
  type: z.enum(DEVICE_TYPES),
  ip: optionalText,
  mac: optionalText,
  model: optionalText,
  location: optionalText,
  url: optionalText,
  quantity: optionalQuantity,
  x: requiredNumber,
  y: requiredNumber,
  groupId: optionalText,
}).strip();

export const LinkSchema = z.object({
  id: z.string().trim().min(1).max(128),
  from: z.string().trim().min(1).max(128),
  to: z.string().trim().min(1).max(128),
  kind: z.enum(LINK_KINDS),
  fromPort: optionalText,
  toPort: optionalText,
  vlan: optionalText,
  speed: optionalText,
}).strip();

export const GroupSchema = z.object({
  id: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(2_000),
  kind: z.enum(GROUP_KINDS),
  color: z.string().trim().regex(/^#[0-9a-f]{6}$/i, "color must be a six-digit hex value").transform((value) => value.toLowerCase()),
  collapsed: optionalBoolean,
}).strip();

export const ProjectSchema = z.object({
  devices: z.array(DeviceSchema).max(DEVICE_LIMIT),
  links: z.array(LinkSchema).max(LINK_LIMIT),
  groups: z.array(GroupSchema).max(GROUP_LIMIT),
}).strict();

export const ProjectExportSchema = z.object({
  schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
  kind: z.literal("nettopo-project"),
  sharing: z.enum(SHARING),
  exportedAt: z.iso.datetime(),
  topologyName: optionalText,
  project: ProjectSchema,
});

export const MaskedCredentialSchema = z.object({
  projectDeviceId: z.string().trim().min(1).max(128),
  deviceName: optionalText,
  kind: z.enum(CREDENTIAL_KINDS),
  usernameMasked: optionalText.refine(isMaskedCredentialUsername, "usernameMasked must be masked and cannot contain a full account."),
  secretMasked: z.literal(MASKED_SECRET),
  keyVersion: optionalText,
  lastRotatedAt: optionalText,
});

const DeviceCsvRowSchema = DeviceSchema.extend({
  schemaVersion: requiredCsvVersion,
  sharing: z.enum(SHARING),
});
const LinkCsvRowSchema = LinkSchema.extend({
  schemaVersion: requiredCsvVersion,
  sharing: z.enum(SHARING),
});
const GroupCsvRowSchema = GroupSchema.extend({
  schemaVersion: requiredCsvVersion,
  sharing: z.enum(SHARING),
});
const MaskedCredentialCsvRowSchema = MaskedCredentialSchema.extend({
  schemaVersion: requiredCsvVersion,
  sharing: z.enum(SHARING),
});
const MissingInfoCsvRowSchema = MissingInfoSchema.extend({
  schemaVersion: requiredCsvVersion,
  sharing: z.enum(SHARING),
});

const LegacyDeviceCsvRowSchema = DeviceSchema.extend({
  username: optionalText,
  password: optionalText,
  x: optionalNumber,
  y: optionalNumber,
}).strip();

export type ProjectExport = z.infer<typeof ProjectExportSchema>;
export type MaskedCredentialRow = {
  projectDeviceId: string;
  deviceName?: string;
  kind: CredentialKind;
  usernameMasked?: string;
  secretMasked: typeof MASKED_SECRET;
  keyVersion?: string;
  lastRotatedAt?: string;
};
export type ImportStrategy = "new" | "merge" | "replace";
export type ImportIssue = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  path?: string;
  phase?: "file" | "manifest" | "envelope" | "row" | "relation" | "missing-info" | "preview" | "apply";
  blocking?: boolean;
};
export type ImportBundlePlan = {
  sourceKind: "document" | "csv-bundle" | "json";
  sourceNames: string[];
  suggestedName: string;
  project: Project;
  maskedCredentials: MaskedCredentialRow[];
  missingInfo: MissingInfoItem[];
  issues: ImportIssue[];
  summary: {
    devices: number;
    links: number;
    groups: number;
    maskedCredentials: number;
    missingBlocking: number;
    missingWarnings: number;
  };
  canApply: boolean;
};
export type ImportPlan = ImportBundlePlan;
export type ImportSource = { name: string; text: string; size?: number; sizeBytes?: number; type?: string; lastModified?: number };
export type ImportFileDescriptor = {
  name: string;
  size: number;
  type?: string;
  lastModified?: number;
};
export type CsvBundleFiles = Record<"devices.csv" | "links.csv" | "groups.csv" | "credentials.masked.csv" | "missing-info.csv", string>;
export type CsvBundleMemberName = keyof CsvBundleFiles;
export type BundleManifest = {
  sourceKind: ImportBundlePlan["sourceKind"];
  canonicalNames: string[];
  csvVersion?: "v1" | "v2";
  envelope?: BundleEnvelope;
};
export type BundleEnvelope = {
  schemaVersion: typeof CSV_BUNDLE_SCHEMA_VERSION;
  sharing: "full" | "safe";
  inferredFrom: "rows" | "all-members-header-only";
};

type BuildPlanInput = {
  sourceKind: ImportBundlePlan["sourceKind"];
  sourceNames: string[];
  suggestedName: string;
  project: Project;
  maskedCredentials?: MaskedCredentialRow[];
  missingInfo?: MissingInfoItem[];
  issues?: ImportIssue[];
};

type CsvEnvelope = { schemaVersion: number; sharing: "full" | "safe" };

const CSV_FIELDS = {
  "devices.csv": ["schemaVersion", "sharing", "id", "name", "type", "ip", "mac", "model", "location", "url", "quantity", "x", "y", "groupId"],
  "links.csv": ["schemaVersion", "sharing", "id", "from", "to", "kind", "fromPort", "toPort", "vlan", "speed"],
  "groups.csv": ["schemaVersion", "sharing", "id", "name", "kind", "color", "collapsed"],
  "credentials.masked.csv": ["schemaVersion", "sharing", "projectDeviceId", "deviceName", "kind", "usernameMasked", "secretMasked", "keyVersion", "lastRotatedAt"],
  "missing-info.csv": ["schemaVersion", "sharing", "id", "severity", "entityType", "entityId", "field", "code", "question", "suggestion", "sourceFile", "sourceLine", "status"],
} as const;
const CSV_MEMBER_NAMES = Object.keys(CSV_FIELDS) as CsvBundleMemberName[];
const CSV_CORE_MEMBERS = ["devices.csv", "links.csv", "groups.csv"] as const;
const CSV_V2_OPTIONAL_MEMBERS = ["credentials.masked.csv", "missing-info.csv"] as const;
const LEGACY_FIELDS = {
  "devices.csv": ["id", "name", "type", "ip", "mac", "model", "location", "url", "quantity", "x", "y", "groupId", "username", "password"],
  "links.csv": ["id", "from", "to", "kind", "fromPort", "toPort", "vlan", "speed"],
  "groups.csv": ["id", "name", "kind", "color", "collapsed"],
} as const;

function cloneProject(project: Project): Project {
  return {
    devices: project.devices.map((device) => ({ ...device })),
    links: project.links.map((link) => ({ ...link })),
    groups: project.groups.map((group) => ({ ...group })),
  };
}

function csvValue(value: unknown) {
  return value === undefined ? "" : value;
}

function sanitizeCsvCell(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r\n＝＋－＠]/.test(value) ? `'${value}` : value;
}

function sanitizeCsvRecord<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, sanitizeCsvCell(value)])) as T;
}

function normalizeSharing(safe: boolean | undefined) {
  return safe === false ? "full" : "safe";
}

function nextPosition(index: number) {
  return { x: 80 + (index % 4) * 240, y: 100 + Math.floor(index / 4) * 170 };
}

function stripUndefined<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

function normalizeProject(project: Project): Project {
  return {
    devices: project.devices.map((device, index) => {
      const position = nextPosition(index);
      return stripUndefined({
        ...device,
        id: String(device.id ?? "").trim(),
        name: String(device.name ?? "").trim(),
        x: Number.isFinite(device.x) ? device.x : position.x,
        y: Number.isFinite(device.y) ? device.y : position.y,
      });
    }),
    links: project.links.map((link) => stripUndefined({
      ...link,
      id: String(link.id ?? "").trim(),
      from: String(link.from ?? "").trim(),
      to: String(link.to ?? "").trim(),
    })),
    groups: project.groups.map((group) => stripUndefined({
      ...group,
      id: String(group.id ?? "").trim(),
      name: String(group.name ?? "").trim(),
      color: String(group.color ?? "").toLowerCase(),
    })),
  };
}

export function canonicalProjectForTransfer(project: Project, options?: { safe?: boolean }): Project {
  const parsed = normalizeProject(ProjectSchema.parse(project));
  if (!options?.safe) return parsed;
  return {
    ...parsed,
    devices: parsed.devices.map((device) => stripUndefined({
      ...device,
      ip: undefined,
      mac: undefined,
      location: undefined,
      url: undefined,
    })),
  };
}

function zodIssues(error: z.ZodError, prefix = ""): ImportIssue[] {
  return error.issues.map((issue) => ({
    severity: "error",
    code: "schema.invalid",
    message: issue.message,
    path: [prefix, ...issue.path.map(String)].filter(Boolean).join("."),
    phase: "row",
    blocking: true,
  }));
}

function importIssue(issue: ImportIssue): ImportIssue {
  return {
    blocking: issue.severity === "error" ? true : undefined,
    ...issue,
  };
}

function hasBlockingIssue(issues: ImportIssue[]) {
  return issues.some((issue) => issue.severity === "error" || issue.blocking === true);
}

function emptyProject(): Project {
  return { devices: [], links: [], groups: [] };
}

function importSourceSize(source: ImportSource) {
  if (typeof source.sizeBytes === "number") return source.sizeBytes;
  if (typeof source.size === "number") return source.size;
  return new TextEncoder().encode(source.text).byteLength;
}

function canonicalFileName(name: string) {
  const normalized = name.normalize("NFC").trim();
  const basename = normalized.split(/[\\/]/).pop() ?? normalized;
  return basename.toLowerCase();
}

function hasPathSpoof(name: string) {
  const normalized = name.normalize("NFC").trim();
  return normalized.length === 0 || /[\\/]/.test(normalized) || normalized !== (normalized.split(/[\\/]/).pop() ?? normalized);
}

function buildBlockedImportPlan(sources: Array<{ name: string }>, issues: ImportIssue[], sourceKind: ImportBundlePlan["sourceKind"] = "csv-bundle"): ImportPlan {
  return buildPlan({
    sourceKind,
    sourceNames: sources.map((source) => source.name),
    suggestedName: "匯入拓樸",
    project: emptyProject(),
    issues,
  });
}

export function validateImportFileDescriptors(descriptors: ImportFileDescriptor[]): ImportIssue[] {
  return validateImportMetadata(descriptors.map((descriptor) => ({
    name: descriptor.name,
    size: descriptor.size,
    type: descriptor.type,
    lastModified: descriptor.lastModified,
    text: "",
  })));
}

export function buildImportPlanFromFileDescriptors(descriptors: ImportFileDescriptor[]): ImportPlan | undefined {
  const issues = validateImportFileDescriptors(descriptors);
  return hasBlockingIssue(issues) ? buildBlockedImportPlan(descriptors, issues) : undefined;
}

function validateImportMetadata(sources: ImportSource[]): ImportIssue[] {
  const issues: ImportIssue[] = [];
  if (sources.length === 0) return issues;

  let batchSize = 0;
  const canonicalSeen = new Set<string>();
  for (const source of sources) {
    const size = importSourceSize(source);
    batchSize += size;
    const canonical = canonicalFileName(source.name);
    if (hasPathSpoof(source.name)) {
      issues.push(importIssue({
        severity: "error",
        code: "csv.filename.path-spoof",
        phase: "file",
        message: "檔名只能使用 basename，不能包含路徑或空白檔名。",
        path: source.name,
      }));
    }
    if (size > IMPORT_FILE_LIMIT_BYTES) {
      issues.push(importIssue({
        severity: "error",
        code: "source.size.file",
        phase: "file",
        message: "單一匯入檔案不可超過 10 MiB。",
        path: source.name,
      }));
    }
    if (canonicalSeen.has(canonical)) {
      issues.push(importIssue({
        severity: "error",
        code: "csv.filename.duplicate",
        phase: "file",
        message: `匯入批次包含重複檔名：${canonical}。`,
        path: canonical,
      }));
    }
    canonicalSeen.add(canonical);
  }
  if (batchSize > IMPORT_BATCH_LIMIT_BYTES) {
    issues.push(importIssue({
      severity: "error",
      code: "source.size.batch",
      phase: "file",
      message: "同一批次匯入檔案總大小不可超過 25 MiB。",
    }));
  }

  const jsonSources = sources.filter((source) => canonicalFileName(source.name).endsWith(".json"));
  const csvSources = sources.filter((source) => canonicalFileName(source.name).endsWith(".csv"));
  const documentSources = sources.filter((source) => /\.(txt|md)$/i.test(canonicalFileName(source.name)));
  const zipSources = sources.filter((source) => canonicalFileName(source.name).endsWith(".zip"));
  const knownKindCount = [jsonSources.length > 0, csvSources.length > 0, documentSources.length > 0].filter(Boolean).length;

  if (zipSources.length > 0) {
    for (const source of zipSources) {
      issues.push(importIssue({
        severity: "error",
        code: "source.unsupported",
        phase: "file",
        message: "ZIP 匯入尚未支援；目前只支援 CSV bundle 匯出 ZIP。",
        path: source.name,
      }));
    }
  }
  if (knownKindCount > 1 || (zipSources.length > 0 && sources.length > zipSources.length)) {
    issues.push(importIssue({
      severity: "error",
      code: "source.mixed",
      phase: "file",
      message: "同一批次不得混用 JSON、CSV bundle、文件或 ZIP 匯入。",
    }));
  }
  if (jsonSources.length > 1) {
    issues.push(importIssue({
      severity: "error",
      code: "source.multiple-json",
      phase: "file",
      message: "一次只能匯入一份 JSON。",
    }));
  }
  if (documentSources.length > 1) {
    issues.push(importIssue({
      severity: "error",
      code: "source.multiple-documents",
      phase: "file",
      message: "第一階段一次只解析一份 TXT 或 Markdown 文件。",
    }));
  }
  if (sources.length > 5 && csvSources.length === sources.length) {
    issues.push(importIssue({
      severity: "error",
      code: "csv.bundle.member-count",
      phase: "file",
      message: "CSV bundle v2 固定為五個 canonical CSV 檔案。",
    }));
  }
  if (knownKindCount === 0 && zipSources.length === 0) {
    issues.push(importIssue({
      severity: "error",
      code: "source.unsupported",
      phase: "file",
      message: "請選擇 .txt、.md、.json 或 CSV bundle 檔案。",
    }));
  }

  return issues;
}

function duplicateIssues<T extends { id: string }>(records: T[], collection: string): ImportIssue[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) duplicates.add(record.id);
    seen.add(record.id);
  }
  return [...duplicates].map((id) => ({
    severity: "error",
    code: "id.duplicate",
    message: `${collection} has duplicate ID: ${id}`,
    path: collection,
    phase: "relation",
    blocking: true,
  }));
}

export function validateProjectRelations(project: Project): ImportIssue[] {
  const issues = [
    ...duplicateIssues(project.devices, "devices"),
    ...duplicateIssues(project.links, "links"),
    ...duplicateIssues(project.groups, "groups"),
  ];
  const deviceIds = new Set(project.devices.map((device) => device.id));
  const groupIds = new Set(project.groups.map((group) => group.id));

  for (const [index, device] of project.devices.entries()) {
    if (device.groupId && !groupIds.has(device.groupId)) {
      issues.push({
        severity: "warning",
        code: "device.group-missing",
        message: `設備 ${device.name} 參照不存在的群組 ${device.groupId}，匯入時會移除此 groupId。`,
        path: `devices.${index}.groupId`,
        phase: "relation",
      });
    }
  }
  for (const [index, link] of project.links.entries()) {
    if (!deviceIds.has(link.from) || !deviceIds.has(link.to)) {
      issues.push({
        severity: "error",
        code: "link.device-missing",
        message: `連線 ${link.id} 參照不存在的設備。`,
        path: `links.${index}`,
        phase: "relation",
        blocking: true,
      });
    }
    if (link.from === link.to) {
      issues.push({
        severity: "error",
        code: "link.self",
        message: `連線 ${link.id} 不可連到同一個設備。`,
        path: `links.${index}`,
        phase: "relation",
        blocking: true,
      });
    }
  }
  return issues;
}

function removeMissingGroupReferences(project: Project): Project {
  const groupIds = new Set(project.groups.map((group) => group.id));
  return {
    ...project,
    devices: project.devices.map((device) =>
      device.groupId && !groupIds.has(device.groupId)
        ? { ...device, groupId: undefined }
        : device,
    ),
  };
}

function buildPlan(input: BuildPlanInput): ImportBundlePlan {
  let project = normalizeProject(input.project);
  const issues = [...(input.issues ?? [])];
  const parsedProject = ProjectSchema.safeParse(project);
  if (parsedProject.success) project = parsedProject.data;
  else issues.push(...zodIssues(parsedProject.error));

  issues.push(...validateProjectRelations(project));
  project = removeMissingGroupReferences(project);

  const missingInfo = buildMissingInfo(project, input.missingInfo ?? []);
  const missingCounts = countMissingInfo(missingInfo);
  const maskedCredentials = (input.maskedCredentials ?? []).map((row) => MaskedCredentialSchema.parse(row) as MaskedCredentialRow);
  const canApply = !hasBlockingIssue(issues) && missingCounts.blocking === 0;

  return {
    sourceKind: input.sourceKind,
    sourceNames: input.sourceNames,
    suggestedName: input.suggestedName,
    project,
    maskedCredentials,
    missingInfo,
    issues,
    summary: {
      devices: project.devices.length,
      links: project.links.length,
      groups: project.groups.length,
      maskedCredentials: maskedCredentials.length,
      missingBlocking: missingCounts.blocking,
      missingWarnings: missingCounts.warnings,
    },
    canApply,
  };
}

export function createProjectExport(project: Project, options?: { safe?: boolean; topologyName?: string; exportedAt?: string }): ProjectExport {
  const sharing = normalizeSharing(options?.safe);
  const exportedProject = cloneProject(ProjectSchema.parse(project));
  if (sharing === "safe") {
    exportedProject.devices = exportedProject.devices.map((device) => ({
      ...device,
      ip: undefined,
      mac: undefined,
      location: undefined,
      url: undefined,
    }));
  }
  return ProjectExportSchema.parse({
    schemaVersion: PROJECT_SCHEMA_VERSION,
    kind: "nettopo-project",
    sharing,
    exportedAt: options?.exportedAt ?? new Date().toISOString(),
    topologyName: options?.topologyName,
    project: exportedProject,
  });
}

export function projectExportToJson(project: Project, options?: { safe?: boolean; topologyName?: string; exportedAt?: string }) {
  return `${JSON.stringify(createProjectExport(project, options), null, 2)}\n`;
}

function csvRows<T extends Record<string, unknown>>(fields: readonly string[], data: T[]) {
  return `\uFEFF${Papa.unparse({ fields: [...fields], data: data.map(sanitizeCsvRecord) }, { newline: "\r\n" })}`;
}

export function projectToCsvFiles(project: Project, options?: {
  safe?: boolean;
  maskedCredentials?: MaskedCredentialRow[];
  missingInfo?: MissingInfoItem[];
}): CsvBundleFiles {
  const sharing = normalizeSharing(options?.safe);
  const validated = ProjectSchema.parse(project);
  const redactedDevices = validated.devices.map((device) => ({
    schemaVersion: CSV_BUNDLE_SCHEMA_VERSION,
    sharing,
    id: device.id,
    name: device.name,
    type: device.type,
    ip: sharing === "safe" ? "" : csvValue(device.ip),
    mac: sharing === "safe" ? "" : csvValue(device.mac),
    model: csvValue(device.model),
    location: sharing === "safe" ? "" : csvValue(device.location),
    url: sharing === "safe" ? "" : csvValue(device.url),
    quantity: csvValue(device.quantity),
    x: device.x,
    y: device.y,
    groupId: csvValue(device.groupId),
  }));
  const links = validated.links.map((link) => ({
    schemaVersion: CSV_BUNDLE_SCHEMA_VERSION,
    sharing,
    id: link.id,
    from: link.from,
    to: link.to,
    kind: link.kind,
    fromPort: csvValue(link.fromPort),
    toPort: csvValue(link.toPort),
    vlan: csvValue(link.vlan),
    speed: csvValue(link.speed),
  }));
  const groups = validated.groups.map((group) => ({
    schemaVersion: CSV_BUNDLE_SCHEMA_VERSION,
    sharing,
    id: group.id,
    name: group.name,
    kind: group.kind,
    color: group.color,
    collapsed: csvValue(group.collapsed),
  }));
  const credentials = (options?.maskedCredentials ?? []).map((credential) => ({
    schemaVersion: CSV_BUNDLE_SCHEMA_VERSION,
    sharing,
    ...(MaskedCredentialSchema.parse(credential) as MaskedCredentialRow),
  }));
  const missingInfo = (options?.missingInfo ?? buildMissingInfo(validated)).map((item) => ({
    schemaVersion: CSV_BUNDLE_SCHEMA_VERSION,
    sharing,
    ...MissingInfoSchema.parse(item),
  }));

  return {
    "devices.csv": csvRows(CSV_FIELDS["devices.csv"], redactedDevices),
    "links.csv": csvRows(CSV_FIELDS["links.csv"], links),
    "groups.csv": csvRows(CSV_FIELDS["groups.csv"], groups),
    "credentials.masked.csv": csvRows(CSV_FIELDS["credentials.masked.csv"], credentials),
    "missing-info.csv": csvRows(CSV_FIELDS["missing-info.csv"], missingInfo),
  };
}

export async function projectToCsvBundleZip(project: Project, options?: {
  safe?: boolean;
  maskedCredentials?: MaskedCredentialRow[];
  missingInfo?: MissingInfoItem[];
}) {
  const { zipSync, strToU8 } = await import("fflate");
  const files = projectToCsvFiles(project, options);
  const entries = Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)]));
  return zipSync(entries);
}

function parseCsvRows(source: ImportSource, issues: ImportIssue[]) {
  const parsed = Papa.parse<Record<string, string>>(source.text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  });
  for (const error of parsed.errors) {
    issues.push({
      severity: "error",
      code: "csv.parse",
      message: error.message,
      path: `${source.name}${error.row === undefined ? "" : ` row ${error.row + 2}`}`,
      phase: "row",
      blocking: true,
    });
  }
  return { rows: parsed.data, headers: (parsed.meta.fields ?? []).map((field) => field.trim()) };
}

function parseJsonSource(source: ImportSource, issues: ImportIssue[]) {
  try {
    const raw = JSON.parse(source.text) as unknown;
    const envelope = ProjectExportSchema.safeParse(raw);
    if (envelope.success) return { project: envelope.data.project, name: envelope.data.topologyName };
    const legacy = ProjectSchema.safeParse(raw);
    if (legacy.success) {
      issues.push({
        severity: "warning",
        code: "json.legacy-project",
        message: "JSON 未包含 schemaVersion，已依 legacy Project 匯入。",
        path: source.name,
        phase: "row",
      });
      return { project: legacy.data };
    }
    issues.push(...zodIssues(envelope.error, source.name));
  } catch (error) {
    issues.push({
      severity: "error",
      code: "json.parse",
      message: error instanceof Error ? error.message : "JSON parse failed.",
      path: source.name,
      phase: "row",
      blocking: true,
    });
  }
  return undefined;
}

function sourceFileName(source: ImportSource) {
  return canonicalFileName(source.name);
}

function headersEqual(actual: string[], expected: readonly string[]) {
  return actual.length === expected.length && expected.every((field, index) => actual[index] === field);
}

function headerHasV2Envelope(headers: string[]) {
  return headers.includes("schemaVersion") || headers.includes("sharing");
}

function rowLimitIssue(name: string, count: number, limit: number): ImportIssue | undefined {
  if (count <= limit) return undefined;
  return importIssue({
    severity: "error",
    code: "csv.row-limit",
    phase: "row",
    message: `${name} 資料列不可超過 ${limit} 筆。`,
    path: name,
  });
}

function parseCsvSourceByName(source: ImportSource, issues: ImportIssue[]) {
  const parsed = parseCsvRows(source, issues);
  return {
    ...parsed,
    name: sourceFileName(source),
    source,
  };
}

function parseCsvBundle(sources: ImportSource[], issues: ImportIssue[]) {
  const byName = new Map<string, ImportSource>();
  const known = new Set(Object.keys(CSV_FIELDS));
  for (const source of sources) {
    const name = sourceFileName(source);
    if (!byName.has(name)) byName.set(name, source);
  }
  for (const source of sources) {
    if (!known.has(sourceFileName(source))) {
      issues.push(importIssue({ severity: "error", code: "csv.filename", phase: "manifest", message: "CSV bundle 只接受 devices.csv、links.csv、groups.csv、credentials.masked.csv、missing-info.csv。", path: source.name }));
    }
  }
  if (hasBlockingIssue(issues)) {
    return { project: emptyProject(), maskedCredentials: [], missingInfo: [] };
  }

  const parsedSources = new Map<string, ReturnType<typeof parseCsvSourceByName>>();
  for (const source of sources) parsedSources.set(sourceFileName(source), parseCsvSourceByName(source, issues));

  const names = [...parsedSources.keys()];
  const hasV2OnlyMember = CSV_V2_OPTIONAL_MEMBERS.some((name) => parsedSources.has(name));
  const hasV2EnvelopeHeader = [...parsedSources.values()].some((parsed) => headerHasV2Envelope(parsed.headers));
  const hasAllV2Members = CSV_MEMBER_NAMES.every((name) => parsedSources.has(name));
  const isV2 = hasV2OnlyMember || hasV2EnvelopeHeader || hasAllV2Members;

  if (isV2) {
    for (const name of CSV_MEMBER_NAMES) {
      if (!parsedSources.has(name)) {
        issues.push(importIssue({
          severity: "error",
          code: "csv.v2.missing",
          phase: "manifest",
          message: `CSV Bundle v2 缺少必要檔案：${name}。`,
          path: name,
        }));
      }
    }
    for (const [name, parsed] of parsedSources.entries()) {
      const expected = CSV_FIELDS[name as CsvBundleMemberName];
      if (!expected || !headersEqual(parsed.headers, expected)) {
        issues.push(importIssue({
          severity: "error",
          code: "csv.header.invalid",
          phase: "manifest",
          message: `CSV Bundle v2 檔案表頭不符合契約：${name}。`,
          path: name,
        }));
      }
    }

    const parsedDevices = z.array(DeviceCsvRowSchema).safeParse(parsedSources.get("devices.csv")?.rows ?? []);
    const parsedLinks = z.array(LinkCsvRowSchema).safeParse(parsedSources.get("links.csv")?.rows ?? []);
    const parsedGroups = z.array(GroupCsvRowSchema).safeParse(parsedSources.get("groups.csv")?.rows ?? []);
    const parsedCredentials = z.array(MaskedCredentialCsvRowSchema).safeParse(parsedSources.get("credentials.masked.csv")?.rows ?? []);
    const parsedMissing = z.array(MissingInfoCsvRowSchema).safeParse(parsedSources.get("missing-info.csv")?.rows ?? []);
    for (const [parsed, name] of [
      [parsedDevices, "devices.csv"],
      [parsedLinks, "links.csv"],
      [parsedGroups, "groups.csv"],
      [parsedCredentials, "credentials.masked.csv"],
      [parsedMissing, "missing-info.csv"],
    ] as const) {
      if (!parsed.success) issues.push(...zodIssues(parsed.error, name));
    }

    for (const issue of [
      rowLimitIssue("devices.csv", parsedSources.get("devices.csv")?.rows.length ?? 0, DEVICE_LIMIT),
      rowLimitIssue("links.csv", parsedSources.get("links.csv")?.rows.length ?? 0, LINK_LIMIT),
      rowLimitIssue("groups.csv", parsedSources.get("groups.csv")?.rows.length ?? 0, GROUP_LIMIT),
      rowLimitIssue("credentials.masked.csv", parsedSources.get("credentials.masked.csv")?.rows.length ?? 0, CREDENTIAL_LIMIT),
      rowLimitIssue("missing-info.csv", parsedSources.get("missing-info.csv")?.rows.length ?? 0, MISSING_INFO_LIMIT),
    ]) {
      if (issue) issues.push(issue);
    }

    const envelopeRows = [...parsedSources.values()].flatMap((parsed) => parsed.rows.map((row) => ({ row, name: parsed.name })));
    const nonEmptyRows = envelopeRows.filter(({ row }) => Object.values(row).some((value) => value !== ""));
    const versions = new Set(nonEmptyRows.map(({ row }) => row.schemaVersion));
    const sharings = new Set(nonEmptyRows.map(({ row }) => row.sharing));
    if (nonEmptyRows.length === 0 && hasAllV2Members && !hasBlockingIssue(issues)) {
      issues.push({
        severity: "info",
        code: "EMPTY_V2_BUNDLE",
        phase: "envelope",
        message: "CSV Bundle v2 只有表頭，將視為空的 safe bundle。",
      });
    }
    if ([...versions].some((version) => version !== String(CSV_BUNDLE_SCHEMA_VERSION))) {
      issues.push(importIssue({
        severity: "error",
        code: "csv.bundle.version",
        phase: "envelope",
        message: "CSV Bundle v2 所有資料列的 schemaVersion 必須一致為 2。",
      }));
    }
    if (sharings.size > 1 || [...sharings].some((sharing) => !SHARING.includes(sharing as "full" | "safe"))) {
      issues.push(importIssue({
        severity: "error",
        code: "csv.bundle.sharing",
        phase: "envelope",
        message: "CSV Bundle v2 所有資料列的 sharing 必須一致為 safe 或 full。",
      }));
    }

    return {
      project: {
        devices: parsedDevices.success ? parsedDevices.data.map(withoutCsvEnvelope) : [],
        links: parsedLinks.success ? parsedLinks.data.map(withoutCsvEnvelope) : [],
        groups: parsedGroups.success ? parsedGroups.data.map(withoutCsvEnvelope) : [],
      },
      maskedCredentials: parsedCredentials.success ? parsedCredentials.data.map(withoutCsvEnvelope) : [],
      missingInfo: parsedMissing.success ? parsedMissing.data.map(withoutCsvEnvelope) : [],
    };
  }

  const missingLegacy = CSV_CORE_MEMBERS.filter((name) => !parsedSources.has(name));
  const unknownLegacy = names.filter((name) => !CSV_CORE_MEMBERS.includes(name as (typeof CSV_CORE_MEMBERS)[number]));
  for (const name of missingLegacy) {
    issues.push(importIssue({ severity: "error", code: "csv.v1.missing", phase: "manifest", message: `legacy CSV 匯入缺少必要檔案：${name}。`, path: name }));
  }
  for (const name of unknownLegacy) {
    issues.push(importIssue({ severity: "error", code: "csv.filename", phase: "manifest", message: "legacy CSV 只接受 devices.csv、links.csv、groups.csv。", path: name }));
  }
  for (const name of CSV_CORE_MEMBERS) {
    const parsed = parsedSources.get(name);
    if (parsed && headerHasV2Envelope(parsed.headers)) {
      issues.push(importIssue({ severity: "error", code: "csv.version.mixed", phase: "manifest", message: "legacy CSV 不可混用 v2 schemaVersion/sharing 表頭。", path: name }));
    }
    const expected = LEGACY_FIELDS[name].filter((field) => parsed?.headers.includes(field));
    if (parsed && expected.length === 0) {
      issues.push(importIssue({ severity: "error", code: "csv.header.invalid", phase: "manifest", message: `legacy CSV 表頭不符合契約：${name}。`, path: name }));
    }
  }
  const devicesRows = parsedSources.get("devices.csv")?.rows ?? [];
  const linksRows = parsedSources.get("links.csv")?.rows ?? [];
  const groupsRows = parsedSources.get("groups.csv")?.rows ?? [];
  const parsedDevices = z.array(LegacyDeviceCsvRowSchema).safeParse(devicesRows.map((row, index) => ({ ...nextPosition(index), ...row })));
  const parsedLinks = z.array(LinkSchema).safeParse(linksRows);
  const parsedGroups = z.array(GroupSchema).safeParse(groupsRows);
  for (const [parsed, name] of [[parsedDevices, "devices.csv"], [parsedLinks, "links.csv"], [parsedGroups, "groups.csv"]] as const) {
    if (!parsed.success) issues.push(...zodIssues(parsed.error, name));
  }
  const maskedCredentials: MaskedCredentialRow[] = parsedDevices.success
    ? parsedDevices.data
      .filter((row) => row.username || row.password)
      .map((row): MaskedCredentialRow => ({
        projectDeviceId: row.id,
        deviceName: row.name,
        kind: "device_admin" as CredentialKind,
        usernameMasked: maskCredentialUsername(row.username),
        secretMasked: MASKED_SECRET,
      }))
    : [];
  if (maskedCredentials.length > 0) {
    issues.push({
      severity: "warning",
      code: "csv.v1-credentials-masked",
      message: "legacy devices.csv 偵測到 username/password 欄位，已只保留遮蔽預覽，不會寫入 Project。",
      path: "devices.csv",
      phase: "row",
    });
  }
  return {
    project: {
      devices: parsedDevices.success ? parsedDevices.data.map((row, index) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        ip: row.ip,
        mac: row.mac,
        model: row.model,
        location: row.location,
        url: row.url,
        quantity: row.quantity,
        groupId: row.groupId,
        x: row.x ?? nextPosition(index).x,
        y: row.y ?? nextPosition(index).y,
      })) : [],
      links: parsedLinks.success ? parsedLinks.data : [],
      groups: parsedGroups.success ? parsedGroups.data : [],
    },
    maskedCredentials,
    missingInfo: [],
  };
}

function withoutCsvEnvelope<T extends CsvEnvelope>(row: T): Omit<T, keyof CsvEnvelope> {
  const copy: Partial<T> = { ...row };
  delete copy.schemaVersion;
  delete copy.sharing;
  return copy as Omit<T, keyof CsvEnvelope>;
}

export function buildImportPlan(sources: ImportSource[]): ImportPlan {
  const metadataIssues = validateImportMetadata(sources);
  const jsonSources = sources.filter((source) => sourceFileName(source).endsWith(".json"));
  const csvSources = sources.filter((source) => sourceFileName(source).endsWith(".csv"));
  const documentSources = sources.filter((source) => /\.(txt|md)$/i.test(sourceFileName(source)));
  const sourceKindCount = [jsonSources.length > 0, csvSources.length > 0, documentSources.length > 0].filter(Boolean).length;

  if (hasBlockingIssue(metadataIssues)) {
    const sourceKind = jsonSources.length > 0 ? "json" : documentSources.length > 0 ? "document" : "csv-bundle";
    return buildBlockedImportPlan(sources, metadataIssues, sourceKind);
  }

  const issues: ImportIssue[] = [...metadataIssues];

  if (sourceKindCount > 1) {
    return buildPlan({
      sourceKind: "csv-bundle",
      sourceNames: sources.map((source) => source.name),
      suggestedName: "匯入拓樸",
      project: { devices: [], links: [], groups: [] },
      issues: [importIssue({ severity: "error", code: "source.mixed", phase: "file", message: "同一批次不得混用 JSON、CSV bundle 與文件匯入。" })],
    });
  }

  if (jsonSources.length > 1) {
    return buildPlan({
      sourceKind: "json",
      sourceNames: sources.map((source) => source.name),
      suggestedName: "匯入拓樸",
      project: { devices: [], links: [], groups: [] },
      issues: [importIssue({ severity: "error", code: "source.multiple-json", phase: "file", message: "一次只能匯入一份 JSON。" })],
    });
  }

  if (jsonSources.length === 1) {
    const parsed = parseJsonSource(jsonSources[0], issues);
    return buildPlan({
      sourceKind: "json",
      sourceNames: sources.map((source) => source.name),
      suggestedName: parsed?.name || jsonSources[0].name.replace(/\.json$/i, ""),
      project: parsed?.project ?? { devices: [], links: [], groups: [] },
      issues,
    });
  }

  if (csvSources.length > 0) {
    const parsed = parseCsvBundle(csvSources, issues);
    return buildPlan({
      sourceKind: "csv-bundle",
      sourceNames: sources.map((source) => source.name),
      suggestedName: csvSources[0].name.replace(/\.csv$/i, ""),
      project: parsed.project,
      maskedCredentials: parsed.maskedCredentials,
      missingInfo: parsed.missingInfo,
      issues,
    });
  }

  if (documentSources.length > 0) {
    if (documentSources.length > 1) {
      issues.push({ severity: "error", code: "source.multiple-documents", message: "第一階段一次只解析一份 TXT 或 Markdown 文件。" });
    }
    const draft = parseTopologyDocument(documentSources[0]);
    return buildPlan({
      sourceKind: "document",
      sourceNames: sources.map((source) => source.name),
      suggestedName: documentSources[0].name.replace(/\.(txt|md)$/i, ""),
      project: draft.project,
      maskedCredentials: draft.maskedCredentials,
      missingInfo: draft.missingInfo,
      issues: [...issues, ...draft.issues],
    });
  }

  return buildPlan({
    sourceKind: "csv-bundle",
    sourceNames: sources.map((source) => source.name),
    suggestedName: "匯入拓樸",
    project: { devices: [], links: [], groups: [] },
      issues: [importIssue({ severity: "error", code: "source.unsupported", phase: "file", message: "請選擇 .txt、.md、.json 或 CSV bundle 檔案。" })],
  });
}

export function applyImportPlanExclusions(plan: ImportPlan, exclusions: {
  deviceIds?: string[];
  linkIds?: string[];
  groupIds?: string[];
  missingInfoIds?: string[];
}) {
  const excludedDevices = new Set(exclusions.deviceIds ?? []);
  const excludedLinks = new Set(exclusions.linkIds ?? []);
  const excludedGroups = new Set(exclusions.groupIds ?? []);
  const excludedMissing = new Set(exclusions.missingInfoIds ?? []);
  const retainedDeviceIds = new Set(plan.project.devices.filter((device) => !excludedDevices.has(device.id)).map((device) => device.id));
  const project = {
    devices: plan.project.devices.filter((device) => !excludedDevices.has(device.id) && !excludedGroups.has(device.groupId ?? "")),
    links: plan.project.links.filter((link) =>
      !excludedLinks.has(link.id) &&
      retainedDeviceIds.has(link.from) &&
      retainedDeviceIds.has(link.to),
    ),
    groups: plan.project.groups.filter((group) => !excludedGroups.has(group.id)),
  };
  return buildPlan({
    sourceKind: plan.sourceKind,
    sourceNames: plan.sourceNames,
    suggestedName: plan.suggestedName,
    project,
    maskedCredentials: plan.maskedCredentials.filter((credential) => retainedDeviceIds.has(credential.projectDeviceId)),
    missingInfo: plan.missingInfo.filter((item) => !excludedMissing.has(item.id) && (!item.entityId || retainedDeviceIds.has(item.entityId))),
    issues: plan.issues.filter((issue) => issue.severity !== "error"),
  });
}

function uniqueId(id: string, used: Set<string>) {
  if (!used.has(id)) {
    used.add(id);
    return id;
  }
  let counter = 2;
  while (used.has(`${id}-import-${counter}`)) counter += 1;
  const next = `${id}-import-${counter}`;
  used.add(next);
  return next;
}

export function materializeImportBundle(current: Project, plan: ImportPlan, strategy: ImportStrategy) {
  if (!plan.canApply) throw new Error("ImportPlan cannot be applied while it has blocking errors.");
  const planProject = canonicalProjectForTransfer(plan.project);
  if (strategy !== "merge") {
    return {
      project: cloneProject(planProject),
      maskedCredentials: plan.maskedCredentials.map((credential) => ({ ...credential })),
    };
  }

  const deviceIds = new Set(current.devices.map((device) => device.id));
  const groupIds = new Set(current.groups.map((group) => group.id));
  const linkIds = new Set(current.links.map((link) => link.id));
  const deviceMap = new Map<string, string>();
  const groupMap = new Map<string, string>();
  const groups = planProject.groups.map((group) => {
    const id = uniqueId(group.id, groupIds);
    groupMap.set(group.id, id);
    return { ...group, id };
  });
  const devices = planProject.devices.map((device) => {
    const id = uniqueId(device.id, deviceIds);
    deviceMap.set(device.id, id);
    return { ...device, id, groupId: device.groupId ? groupMap.get(device.groupId) : undefined };
  });
  const links = planProject.links.map((link) => ({
    ...link,
    id: uniqueId(link.id, linkIds),
    from: deviceMap.get(link.from) ?? link.from,
    to: deviceMap.get(link.to) ?? link.to,
  }));
  const maskedCredentials = plan.maskedCredentials.map((credential) => ({
    ...credential,
    projectDeviceId: deviceMap.get(credential.projectDeviceId) ?? credential.projectDeviceId,
  }));

  return {
    project: {
      devices: [...current.devices.map((device) => ({ ...device })), ...devices],
      links: [...current.links.map((link) => ({ ...link })), ...links],
      groups: [...current.groups.map((group) => ({ ...group })), ...groups],
    },
    maskedCredentials,
  };
}

export function materializeImport(current: Project, plan: ImportPlan, strategy: ImportStrategy): Project {
  return materializeImportBundle(current, plan, strategy).project;
}
