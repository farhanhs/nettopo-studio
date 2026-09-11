import { z } from "zod";

import type { Project } from "./topology-types.ts";

export const MissingInfoSchema = z.object({
  id: z.string().trim().min(1),
  severity: z.enum(["blocking", "warning", "info"]),
  entityType: z.enum(["project", "device", "link", "group", "credential"]),
  entityId: z.string().trim().optional().transform((value) => value || undefined),
  field: z.string().trim().min(1),
  code: z.string().trim().min(1),
  question: z.string().trim().min(1),
  suggestion: z.string().trim().optional().transform((value) => value || undefined),
  sourceFile: z.string().trim().optional().transform((value) => value || undefined),
  sourceLine: z.preprocess(
    (value) => value === "" || value === null || value === undefined ? undefined : value,
    z.coerce.number().int().min(1).optional(),
  ),
  status: z.enum(["open", "resolved", "accepted"]),
});

export const MissingInfoCsvRowSchema = MissingInfoSchema.extend({
  schemaVersion: z.literal(2),
  sharing: z.enum(["full", "safe"]),
});

export type MissingInfoItem = {
  id: string;
  severity: "blocking" | "warning" | "info";
  entityType: "project" | "device" | "link" | "group" | "credential";
  entityId?: string;
  field: string;
  code: string;
  question: string;
  suggestion?: string;
  sourceFile?: string;
  sourceLine?: number;
  status: "open" | "resolved" | "accepted";
};
export type MissingInfoCsvRow = z.infer<typeof MissingInfoCsvRowSchema>;

export type MissingInfoEvidence = Partial<Pick<MissingInfoItem, "sourceFile" | "sourceLine" | "suggestion">>;

const NETWORK_DEVICE_TYPES = new Set(["router", "modem", "firewall", "switch", "server", "nas", "erp", "access-point", "mesh-node"]);
const UNKNOWN_VALUES = new Set(["unknown", "n/a", "na", "待確認", "不確定", "未知", "未確認", "tbd", "todo"]);

function stablePart(value: string | undefined) {
  return (value ?? "project")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

export function missingInfoId(
  entityType: MissingInfoItem["entityType"],
  entityId: string | undefined,
  field: string,
  code: string,
) {
  return [entityType, stablePart(entityId), stablePart(field), stablePart(code)].join(":");
}

export function createMissingInfoItem(input: Omit<MissingInfoItem, "id" | "status"> & Partial<Pick<MissingInfoItem, "id" | "status">>): MissingInfoItem {
  return MissingInfoSchema.parse({
    ...input,
    id: input.id ?? missingInfoId(input.entityType, input.entityId, input.field, input.code),
    status: input.status ?? "open",
  }) as MissingInfoItem;
}

function hasUnknownValue(value?: string) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return UNKNOWN_VALUES.has(normalized);
}

function missingField(
  items: MissingInfoItem[],
  severity: MissingInfoItem["severity"],
  entityType: MissingInfoItem["entityType"],
  entityId: string | undefined,
  field: string,
  code: string,
  question: string,
  suggestion?: string,
) {
  items.push(createMissingInfoItem({ severity, entityType, entityId, field, code, question, suggestion }));
}

export function buildMissingInfo(project: Project, extraItems: MissingInfoItem[] = []): MissingInfoItem[] {
  const items: MissingInfoItem[] = [];
  const deviceIds = new Set(project.devices.map((device) => device.id));

  for (const device of project.devices) {
    if (!device.name?.trim()) {
      missingField(items, "blocking", "device", device.id, "name", "device.name.required", "請補上設備名稱。");
    }
    if (!device.type) {
      missingField(items, "blocking", "device", device.id, "type", "device.type.required", "請選擇設備類型。");
    }
    if (NETWORK_DEVICE_TYPES.has(device.type)) {
      for (const field of ["model", "ip", "location"] as const) {
        if (!device[field]) {
          missingField(
            items,
            "warning",
            "device",
            device.id,
            field,
            `device.${field}.missing`,
            `請確認 ${device.name} 的 ${field}。`,
            "可先匯入，但會影響後續維運與盤點完整性。",
          );
        }
      }
    }
    for (const field of ["name", "ip", "mac", "model", "location", "url"] as const) {
      if (hasUnknownValue(device[field])) {
        missingField(items, "warning", "device", device.id, field, `device.${field}.unknown`, `請確認 ${device.name} 的 ${field}，目前標示為未確認。`);
      }
    }
  }

  for (const link of project.links) {
    if (!link.from || !link.to || !deviceIds.has(link.from) || !deviceIds.has(link.to)) {
      missingField(items, "blocking", "link", link.id, "endpoint", "link.endpoint.invalid", "請確認連線兩端設備，端點必須存在於設備清單。");
    }
    if (!link.kind) {
      missingField(items, "blocking", "link", link.id, "kind", "link.kind.required", "請確認連線類型為 wired 或 wireless。");
    }
    if (link.kind === "wired") {
      if (!link.fromPort || !link.toPort) {
        missingField(items, "warning", "link", link.id, "port", "link.port.missing", "請確認有線連線的來源與目的 Port。");
      }
      if (!link.speed) {
        missingField(items, "warning", "link", link.id, "speed", "link.speed.missing", "請確認有線連線速率。");
      }
      if (!link.vlan) {
        missingField(items, "info", "link", link.id, "vlan", "link.vlan.missing", "如有 VLAN，請補上 VLAN 或 Trunk 資訊。");
      }
    } else if (!link.speed && !link.vlan) {
      missingField(items, "info", "link", link.id, "speed", "link.wireless.detail.missing", "可補充無線頻段、SSID 或速率資訊。");
    }
  }

  const merged = [...items, ...extraItems].map((item) => MissingInfoSchema.parse(item) as MissingInfoItem);
  const byId = new Map<string, MissingInfoItem>();
  for (const item of merged) byId.set(item.id, item);
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function countMissingInfo(items: MissingInfoItem[]) {
  return {
    blocking: items.filter((item) => item.severity === "blocking" && item.status === "open").length,
    warnings: items.filter((item) => item.severity === "warning" && item.status === "open").length,
  };
}
