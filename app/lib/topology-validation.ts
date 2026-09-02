import { z } from "zod";

import type { Device, Project } from "./topology-types";

const MAX_ID_LENGTH = 128;
const MAX_TEXT_LENGTH = 2_000;
const MAX_COORDINATE = 1_000_000;

const requiredId = z.string().trim().min(1).max(MAX_ID_LENGTH);
const requiredName = z.string().trim().min(1).max(MAX_TEXT_LENGTH);
const optionalText = z.string().trim().max(MAX_TEXT_LENGTH).optional().transform((value) => value || undefined);
const coordinate = z.number().finite().min(-MAX_COORDINATE).max(MAX_COORDINATE);

const StoredDeviceSchema = z.object({
  id: requiredId,
  name: requiredName,
  type: z.enum(["router", "modem", "firewall", "switch", "server", "nas", "erp", "access-point", "client", "ssid", "mesh-node", "printer", "camera", "pos", "iot"]),
  ip: optionalText,
  mac: optionalText,
  model: optionalText,
  location: optionalText,
  url: optionalText,
  quantity: z.number().int().min(1).max(10_000).optional(),
  x: coordinate,
  y: coordinate,
  groupId: optionalText,
}).strict();

const StoredLinkSchema = z.object({
  id: requiredId,
  from: requiredId,
  to: requiredId,
  kind: z.enum(["wired", "wireless"]),
  fromPort: optionalText,
  toPort: optionalText,
  vlan: optionalText,
  speed: optionalText,
}).strict();

const StoredGroupSchema = z.object({
  id: requiredId,
  name: requiredName,
  kind: z.enum(["site", "domain", "vlan"]),
  color: z.string().trim().regex(/^#[0-9a-f]{6}$/i).transform((value) => value.toLowerCase()),
  collapsed: z.boolean().optional(),
}).strict();

const StoredProjectSchema = z.object({
  devices: z.array(StoredDeviceSchema).max(5_000),
  links: z.array(StoredLinkSchema).max(20_000),
  groups: z.array(StoredGroupSchema).max(1_000),
}).strict();

function duplicateId(collection: Array<{ id: string }>) {
  const seen = new Set<string>();
  for (const record of collection) {
    if (seen.has(record.id)) return record.id;
    seen.add(record.id);
  }
  return undefined;
}

function formatZodError(error: z.ZodError) {
  return error.issues.slice(0, 5).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "project";
    return `${path}: ${issue.message}`;
  }).join("; ");
}

export function containsProjectCredentials(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const devices = (value as { devices?: unknown }).devices;
  if (!Array.isArray(devices)) return false;
  return devices.some((device) =>
    Boolean(device) &&
    typeof device === "object" &&
    (Object.hasOwn(device, "username") || Object.hasOwn(device, "password") || Object.hasOwn(device, "secret")),
  );
}

export function validateProject(value: unknown): Project {
  if (containsProjectCredentials(value)) {
    throw new Error("Invalid project: device credentials must use the credentials API and cannot be stored in project JSON.");
  }

  const parsed = StoredProjectSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid project: ${formatZodError(parsed.error)}`);
  const project = parsed.data;

  for (const [name, records] of [
    ["device", project.devices],
    ["link", project.links],
    ["group", project.groups],
  ] as const) {
    const duplicate = duplicateId(records);
    if (duplicate) throw new Error(`Invalid project: duplicate ${name} id "${duplicate}".`);
  }

  const deviceIds = new Set(project.devices.map((device) => device.id));
  const groupIds = new Set(project.groups.map((group) => group.id));
  for (const device of project.devices) {
    if (device.groupId && !groupIds.has(device.groupId)) {
      throw new Error(`Invalid project: device "${device.id}" references missing group "${device.groupId}".`);
    }
  }
  for (const link of project.links) {
    if (!deviceIds.has(link.from)) {
      throw new Error(`Invalid project: link "${link.id}" references missing source device "${link.from}".`);
    }
    if (!deviceIds.has(link.to)) {
      throw new Error(`Invalid project: link "${link.id}" references missing target device "${link.to}".`);
    }
    if (link.from === link.to) {
      throw new Error(`Invalid project: link "${link.id}" cannot connect a device to itself.`);
    }
  }

  return project;
}

export function stripProjectCredentials(project: Project): Project {
  return {
    devices: project.devices.map((device) => {
      const safeDevice = { ...(device as Device & {
        username?: unknown;
        password?: unknown;
        secret?: unknown;
      }) };
      delete safeDevice.username;
      delete safeDevice.password;
      delete safeDevice.secret;
      return { ...safeDevice };
    }),
    links: project.links.map((link) => ({ ...link })),
    groups: project.groups.map((group) => ({ ...group })),
  };
}

export function sanitizeProject(project: Project): Project {
  return validateProject(stripProjectCredentials(project));
}
