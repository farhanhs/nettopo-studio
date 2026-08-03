import Papa from "papaparse";
import { z } from "zod";

import type { Project } from "./topology-types";

export const PROJECT_SCHEMA_VERSION = 1 as const;

const optionalText = z.string().trim().optional().transform((value) => value || undefined);
const optionalQuantity = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number().int().min(1).max(10_000).optional(),
);
const optionalBoolean = z.preprocess(
  (value) => value === "" || value === null || value === undefined
    ? undefined
    : typeof value === "string"
      ? value.toLowerCase() === "true"
      : value,
  z.boolean().optional(),
);

export const DeviceSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: z.enum(["router", "modem", "firewall", "switch", "server", "nas", "erp", "access-point", "client", "ssid", "mesh-node", "printer", "camera", "pos", "iot"]),
  ip: optionalText,
  mac: optionalText,
  model: optionalText,
  location: optionalText,
  url: optionalText,
  username: optionalText,
  password: optionalText,
  quantity: optionalQuantity,
  x: z.coerce.number().finite(),
  y: z.coerce.number().finite(),
  groupId: optionalText,
});

export const LinkSchema = z.object({
  id: z.string().trim().min(1),
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  kind: z.enum(["wired", "wireless"]),
  fromPort: optionalText,
  toPort: optionalText,
  vlan: optionalText,
  speed: optionalText,
});

export const GroupSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  kind: z.enum(["site", "domain", "vlan"]),
  color: z.string().trim().regex(/^#[0-9a-f]{6}$/i, "color must be a six-digit hex value"),
  collapsed: optionalBoolean,
});

export const ProjectSchema = z.object({
  devices: z.array(DeviceSchema),
  links: z.array(LinkSchema),
  groups: z.array(GroupSchema),
});

export const ProjectExportSchema = z.object({
  schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
  kind: z.literal("nettopo-project"),
  sharing: z.enum(["full", "safe"]),
  exportedAt: z.iso.datetime(),
  topologyName: optionalText,
  project: ProjectSchema,
});

export type ProjectExport = z.infer<typeof ProjectExportSchema>;
export type ImportStrategy = "new" | "merge" | "replace";
export type ImportIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
};
export type ImportPlan = {
  sourceNames: string[];
  project: Project;
  issues: ImportIssue[];
  summary: { devices: number; links: number; groups: number };
  canApply: boolean;
  suggestedName: string;
};
export type ImportSource = { name: string; text: string };

function cloneProject(project: Project): Project {
  return {
    devices: project.devices.map((device) => ({ ...device })),
    links: project.links.map((link) => ({ ...link })),
    groups: project.groups.map((group) => ({ ...group })),
  };
}

export function createProjectExport(project: Project, options?: { safe?: boolean; topologyName?: string; exportedAt?: string }): ProjectExport {
  const sharing = options?.safe ? "safe" : "full";
  const exportedProject = cloneProject(ProjectSchema.parse(project));
  if (sharing === "safe") {
    exportedProject.devices = exportedProject.devices.map((device) => {
      const safeDevice = { ...device };
      delete safeDevice.password;
      delete safeDevice.username;
      delete safeDevice.url;
      delete safeDevice.ip;
      delete safeDevice.mac;
      delete safeDevice.location;
      return safeDevice;
    });
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

function csvValue(value: unknown) {
  return value === undefined ? "" : value;
}

export function projectToCsvFiles(project: Project, options?: { safe?: boolean }) {
  const validated = ProjectSchema.parse(project);
  const devices = validated.devices.map((device) => ({
    id: device.id,
    name: device.name,
    type: device.type,
    ip: options?.safe ? "" : csvValue(device.ip),
    mac: options?.safe ? "" : csvValue(device.mac),
    model: csvValue(device.model),
    location: options?.safe ? "" : csvValue(device.location),
    url: options?.safe ? "" : csvValue(device.url),
    username: options?.safe ? "" : csvValue(device.username),
    password: options?.safe ? "" : csvValue(device.password),
    quantity: csvValue(device.quantity),
    x: device.x,
    y: device.y,
    groupId: csvValue(device.groupId),
  }));
  const links = validated.links.map((link) => ({
    id: link.id,
    from: link.from,
    to: link.to,
    kind: link.kind,
    fromPort: csvValue(link.fromPort),
    toPort: csvValue(link.toPort),
    vlan: csvValue(link.vlan),
    speed: csvValue(link.speed),
  }));
  const groups = validated.groups.map((group) => ({ ...group }));

  return {
    "devices.csv": Papa.unparse(devices, { newline: "\r\n" }),
    "links.csv": Papa.unparse(links, { newline: "\r\n" }),
    "groups.csv": Papa.unparse(groups, { newline: "\r\n" }),
  };
}

function zodIssues(error: z.ZodError, prefix = ""): ImportIssue[] {
  return error.issues.map((issue) => ({
    severity: "error",
    code: "schema.invalid",
    message: issue.message,
    path: [prefix, ...issue.path.map(String)].filter(Boolean).join("."),
  }));
}

function parseCsvRows(source: ImportSource, issues: ImportIssue[]) {
  const parsed = Papa.parse<Record<string, string>>(source.text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  for (const error of parsed.errors) {
    issues.push({
      severity: "error",
      code: "csv.parse",
      message: error.message,
      path: `${source.name}${error.row === undefined ? "" : ` row ${error.row + 2}`}`,
    });
  }
  return parsed.data;
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
        message: "此 JSON 沒有 schemaVersion，已依舊版 Project 格式匯入。",
        path: source.name,
      });
      return { project: legacy.data };
    }
    issues.push(...zodIssues(envelope.error, source.name));
  } catch (error) {
    issues.push({
      severity: "error",
      code: "json.parse",
      message: error instanceof Error ? error.message : "JSON 解析失敗。",
      path: source.name,
    });
  }
  return undefined;
}

function nextPosition(index: number) {
  return { x: 80 + (index % 4) * 240, y: 100 + Math.floor(index / 4) * 170 };
}

function stripUndefined<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

function normalizeProject(project: Project): Project {
  return {
    devices: project.devices.map((device, index) => stripUndefined({
      ...device,
      id: device.id.trim(),
      name: device.name.trim(),
      x: Number.isFinite(device.x) ? device.x : nextPosition(index).x,
      y: Number.isFinite(device.y) ? device.y : nextPosition(index).y,
    })),
    links: project.links.map((link) => stripUndefined({
      ...link,
      id: link.id.trim(),
      from: link.from.trim(),
      to: link.to.trim(),
    })),
    groups: project.groups.map((group) => stripUndefined({
      ...group,
      id: group.id.trim(),
      name: group.name.trim(),
      color: group.color.toLowerCase(),
    })),
  };
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
    message: `${collection} 中有重複 ID：${id}`,
    path: collection,
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
        message: `設備 ${device.name} 引用不存在的群組 ${device.groupId}，套用時會移除該關聯。`,
        path: `devices.${index}.groupId`,
      });
    }
  }
  for (const [index, link] of project.links.entries()) {
    if (!deviceIds.has(link.from) || !deviceIds.has(link.to)) {
      issues.push({
        severity: "error",
        code: "link.device-missing",
        message: `連線 ${link.id} 引用不存在的設備。`,
        path: `links.${index}`,
      });
    }
    if (link.from === link.to) {
      issues.push({
        severity: "error",
        code: "link.self",
        message: `連線 ${link.id} 不可連回同一設備。`,
        path: `links.${index}`,
      });
    }
  }
  return issues;
}

export function buildImportPlan(sources: ImportSource[]): ImportPlan {
  const issues: ImportIssue[] = [];
  let suggestedName = "匯入拓樸";
  const jsonSources = sources.filter((source) => source.name.toLowerCase().endsWith(".json"));
  const csvSources = sources.filter((source) => source.name.toLowerCase().endsWith(".csv"));
  let project: Project = { devices: [], links: [], groups: [] };

  if (jsonSources.length > 0 && csvSources.length > 0) {
    issues.push({ severity: "error", code: "source.mixed", message: "請勿同時選擇 JSON 與 CSV；請分開匯入。" });
  } else if (jsonSources.length > 1) {
    issues.push({ severity: "error", code: "source.multiple-json", message: "一次只能匯入一個 JSON 檔案。" });
  } else if (jsonSources.length === 1) {
    const parsed = parseJsonSource(jsonSources[0], issues);
    if (parsed) {
      project = parsed.project;
      suggestedName = parsed.name || jsonSources[0].name.replace(/\.json$/i, "");
    }
  } else if (csvSources.length > 0) {
    const byName = new Map(csvSources.map((source) => [source.name.toLowerCase().split(/[\\/]/).pop(), source]));
    const unknown = csvSources.filter((source) => !["devices.csv", "links.csv", "groups.csv"].includes(source.name.toLowerCase().split(/[\\/]/).pop() ?? ""));
    for (const source of unknown) {
      issues.push({ severity: "error", code: "csv.filename", message: "CSV 檔名必須是 devices.csv、links.csv 或 groups.csv。", path: source.name });
    }

    const devicesRows = byName.get("devices.csv") ? parseCsvRows(byName.get("devices.csv")!, issues) : [];
    const linksRows = byName.get("links.csv") ? parseCsvRows(byName.get("links.csv")!, issues) : [];
    const groupsRows = byName.get("groups.csv") ? parseCsvRows(byName.get("groups.csv")!, issues) : [];
    const parsed = ProjectSchema.safeParse({
      devices: devicesRows.map((row, index) => ({ ...nextPosition(index), ...row })),
      links: linksRows,
      groups: groupsRows,
    });
    if (parsed.success) project = parsed.data;
    else issues.push(...zodIssues(parsed.error));
  } else {
    issues.push({ severity: "error", code: "source.unsupported", message: "請選擇 .json 或指定名稱的 .csv 檔案。" });
  }

  project = normalizeProject(project);
  issues.push(...validateProjectRelations(project));
  project = {
    ...project,
    devices: project.devices.map((device) =>
      device.groupId && !project.groups.some((group) => group.id === device.groupId)
        ? { ...device, groupId: undefined }
        : device,
    ),
  };

  return {
    sourceNames: sources.map((source) => source.name),
    project,
    issues,
    summary: {
      devices: project.devices.length,
      links: project.links.length,
      groups: project.groups.length,
    },
    canApply: !issues.some((issue) => issue.severity === "error"),
    suggestedName,
  };
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

export function materializeImport(current: Project, plan: ImportPlan, strategy: ImportStrategy): Project {
  if (!plan.canApply) throw new Error("ImportPlan 含有錯誤，無法套用。");
  if (strategy !== "merge") return cloneProject(plan.project);

  const deviceIds = new Set(current.devices.map((device) => device.id));
  const groupIds = new Set(current.groups.map((group) => group.id));
  const linkIds = new Set(current.links.map((link) => link.id));
  const deviceMap = new Map<string, string>();
  const groupMap = new Map<string, string>();
  const groups = plan.project.groups.map((group) => {
    const id = uniqueId(group.id, groupIds);
    groupMap.set(group.id, id);
    return { ...group, id };
  });
  const devices = plan.project.devices.map((device) => {
    const id = uniqueId(device.id, deviceIds);
    deviceMap.set(device.id, id);
    return { ...device, id, groupId: device.groupId ? groupMap.get(device.groupId) : undefined };
  });
  const links = plan.project.links.map((link) => ({
    ...link,
    id: uniqueId(link.id, linkIds),
    from: deviceMap.get(link.from) ?? link.from,
    to: deviceMap.get(link.to) ?? link.to,
  }));

  return {
    devices: [...current.devices.map((device) => ({ ...device })), ...devices],
    links: [...current.links.map((link) => ({ ...link })), ...links],
    groups: [...current.groups.map((group) => ({ ...group })), ...groups],
  };
}
