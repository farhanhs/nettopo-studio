import { z } from "zod";

import { validateProject } from "./topology-validation.ts";
import type {
  LegacyProject,
  ProjectV2,
  TrustedEntityType,
  TrustedNetworkIssue,
  TrustedNetworkIssueCode,
  TrustedNetworkModelV1,
} from "./trusted-network-types.ts";

const ID_MAX = 128;
const TEXT_MAX = 2_000;
const requiredId = z.string().trim().min(1).max(ID_MAX);
const requiredText = z.string().trim().min(1).max(TEXT_MAX);
const optionalText = z.string().trim().max(TEXT_MAX).optional().transform((value) => value || undefined);
const isoDate = z.iso.datetime({ offset: true });
const fingerprint = z.string().regex(/^[0-9a-f]{64}$/i, "fingerprint must be a 64-character hex value").transform((value) => value.toLowerCase());

const deviceType = z.enum([
  "router", "modem", "firewall", "switch", "server", "nas", "erp", "access-point", "client",
  "ssid", "mesh-node", "printer", "camera", "pos", "iot",
]);

const deviceSchema = z.object({
  id: requiredId,
  name: requiredText,
  type: deviceType,
  ip: optionalText,
  mac: optionalText,
  model: optionalText,
  location: optionalText,
  url: optionalText,
  quantity: z.number().int().min(1).max(10_000).optional(),
  x: z.number().finite().min(-1_000_000).max(1_000_000),
  y: z.number().finite().min(-1_000_000).max(1_000_000),
  groupId: optionalText,
  networkAreaId: optionalText,
}).strict();

const linkSchema = z.object({
  id: requiredId,
  from: requiredId,
  to: requiredId,
  kind: z.enum(["wired", "wireless"]),
  fromPort: optionalText,
  toPort: optionalText,
  vlan: optionalText,
  speed: optionalText,
  fromInterfaceId: optionalText,
  toInterfaceId: optionalText,
}).strict();

const groupSchema = z.object({
  id: requiredId,
  name: requiredText,
  kind: z.enum(["site", "domain", "vlan"]),
  color: z.string().trim().regex(/^#[0-9a-f]{6}$/i).transform((value) => value.toLowerCase()),
  collapsed: z.boolean().optional(),
}).strict();

const areaSchema = z.object({
  id: requiredId,
  kind: z.enum(["region", "site"]),
  name: requiredText,
  parentAreaId: optionalText,
  groupId: optionalText,
}).strict();

const interfaceSchema = z.object({
  id: requiredId,
  deviceId: requiredId,
  name: requiredText,
  kind: z.enum(["physical", "logical", "aggregate", "wireless"]),
  parentInterfaceId: optionalText,
  aliases: z.array(requiredText).max(512),
  mac: optionalText,
  description: optionalText,
  adminLabel: optionalText,
}).strict();

const vlanSchema = z.object({
  id: requiredId,
  vlanNumber: z.number().int().min(1).max(4094),
  name: optionalText,
  areaId: optionalText,
}).strict();

const subnetSchema = z.object({
  id: requiredId,
  cidr: requiredText,
  name: optionalText,
  areaId: optionalText,
  vlanId: optionalText,
}).strict();

const interfaceVlanSchema = z.object({
  id: requiredId,
  interfaceId: requiredId,
  vlanId: requiredId,
  mode: z.enum(["access", "trunk-allowed", "native", "tagged", "untagged", "unknown"]),
}).strict();

const interfaceSubnetSchema = z.object({
  id: requiredId,
  interfaceId: requiredId,
  subnetId: requiredId,
  address: optionalText,
  role: z.enum(["gateway", "member", "management", "unknown"]).optional(),
}).strict();

const resiliencySchema = z.object({
  id: requiredId,
  kind: z.enum(["primary-backup", "active-active", "candidate"]),
  memberLinkIds: z.array(requiredId).min(2).max(1_000),
  primaryLinkId: optionalText,
  name: optionalText,
}).strict();

const evidenceSchema = z.object({
  id: requiredId,
  method: z.enum(["parsed", "template", "inferred", "human", "legacy-upcast"]),
  sourceKind: z.enum(["document", "csv", "json", "template", "manual", "legacy-project"]),
  displayName: requiredText,
  locator: z.object({ file: optionalText, line: z.number().int().positive().optional(), section: optionalText }).strict().optional(),
  template: z.object({ templateId: requiredId, version: requiredText, fingerprint }).strict().optional(),
  ruleCode: optionalText,
  safeSummary: optionalText,
  capturedAt: isoDate.optional(),
}).strict();

const entityType = z.enum([
  "device", "link", "group", "area", "interface", "vlan", "subnet",
  "interface-vlan", "interface-subnet", "resiliency",
]);

const fieldTrustSchema = z.object({
  id: requiredId,
  entityType,
  entityId: requiredId,
  fieldPath: requiredText,
  valueFingerprint: fingerprint,
  evidenceIds: z.array(requiredId).min(1).max(100),
  verification: z.enum(["unverified", "verified"]),
  verifiedByUserId: optionalText,
  verifiedAt: isoDate.optional(),
}).strict();

const trustedNetworkSchema = z.object({
  modelVersion: z.literal(1),
  areas: z.array(areaSchema).max(10_000),
  interfaces: z.array(interfaceSchema).max(100_000),
  vlans: z.array(vlanSchema).max(10_000),
  subnets: z.array(subnetSchema).max(10_000),
  interfaceVlans: z.array(interfaceVlanSchema).max(200_000),
  interfaceSubnets: z.array(interfaceSubnetSchema).max(200_000),
  resiliencyRelations: z.array(resiliencySchema).max(20_000),
  evidence: z.array(evidenceSchema).max(200_000),
  fieldTrust: z.array(fieldTrustSchema).max(500_000),
}).strict();

const projectV2Schema = z.object({
  projectSchemaVersion: z.literal(2),
  devices: z.array(deviceSchema).max(5_000),
  links: z.array(linkSchema).max(20_000),
  groups: z.array(groupSchema).max(1_000),
  trustedNetwork: trustedNetworkSchema,
}).strict();

export class TrustedNetworkModelError extends Error {
  readonly issues: TrustedNetworkIssue[];

  constructor(issues: TrustedNetworkIssue[]) {
    super("Trusted network model validation failed.");
    this.name = "TrustedNetworkModelError";
    this.issues = issues.map((issue) => ({ ...issue }));
  }
}

function issue(code: TrustedNetworkIssueCode, path: string, message: string): TrustedNetworkIssue {
  return { code, path, message };
}

function emptyTrustedNetwork(): TrustedNetworkModelV1 {
  return {
    modelVersion: 1,
    areas: [],
    interfaces: [],
    vlans: [],
    subnets: [],
    interfaceVlans: [],
    interfaceSubnets: [],
    resiliencyRelations: [],
    evidence: [],
    fieldTrust: [],
  };
}

function normalizeLabel(value: string) {
  return value.normalize("NFC").trim().toLocaleLowerCase("en-US");
}

function hash32(value: string, seed: number) {
  let hash = seed >>> 0;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function stableHash(value: string) {
  return [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]
    .map((seed) => hash32(value, seed))
    .join("");
}

function provisionalId(prefix: "if" | "ev" | "trust", deviceId: string, label: string) {
  return `${prefix}-legacy-v1-${stableHash(`${deviceId}\u0000${normalizeLabel(label)}`)}`;
}

function fingerprintValue(value: unknown) {
  const serialized = JSON.stringify(value);
  return ["a", "b"].map((namespace) => stableHash(`${namespace}\u0000${serialized}`)).join("");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .map(([key, child]) => [key, stripUndefinedDeep(child)]),
  ) as T;
}

function canonicalKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(canonicalKeys) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalKeys((value as Record<string, unknown>)[key])]),
  ) as T;
}

function zodIssues(error: z.ZodError): TrustedNetworkIssue[] {
  return error.issues.slice(0, 20).map((entry) => issue(
    entry.path[0] === "projectSchemaVersion" ? "INVALID_PROJECT_VERSION" : "INVALID_PROJECT_SCHEMA",
    entry.path.length > 0 ? entry.path.join(".") : "project",
    "The trusted network document does not match the required schema.",
  ));
}

function duplicateIssues(project: ProjectV2) {
  const issues: TrustedNetworkIssue[] = [];
  const seen = new Map<string, string>();
  const collections: Array<[string, Array<{ id: string }>]> = [
    ["devices", project.devices], ["links", project.links], ["groups", project.groups],
    ["trustedNetwork.areas", project.trustedNetwork.areas],
    ["trustedNetwork.interfaces", project.trustedNetwork.interfaces],
    ["trustedNetwork.vlans", project.trustedNetwork.vlans],
    ["trustedNetwork.subnets", project.trustedNetwork.subnets],
    ["trustedNetwork.interfaceVlans", project.trustedNetwork.interfaceVlans],
    ["trustedNetwork.interfaceSubnets", project.trustedNetwork.interfaceSubnets],
    ["trustedNetwork.resiliencyRelations", project.trustedNetwork.resiliencyRelations],
    ["trustedNetwork.evidence", project.trustedNetwork.evidence],
    ["trustedNetwork.fieldTrust", project.trustedNetwork.fieldTrust],
  ];
  for (const [collection, records] of collections) {
    for (const [index, record] of records.entries()) {
      const previous = seen.get(record.id);
      if (previous) issues.push(issue("DUPLICATE_ID", `${collection}.${index}.id`, `ID is already used by ${previous}.`));
      else seen.set(record.id, `${collection}.${index}`);
    }
  }
  return issues;
}

function cycleIssues(records: Array<{ id: string; parentId?: string }>, path: string) {
  const issues: TrustedNetworkIssue[] = [];
  const byId = new Map(records.map((record) => [record.id, record]));
  for (const record of records) {
    const visited = new Set([record.id]);
    let current = record;
    while (current.parentId) {
      if (visited.has(current.parentId)) {
        issues.push(issue("RELATION_CYCLE", `${path}.${record.id}`, "A parent relation cycle is not allowed."));
        break;
      }
      visited.add(current.parentId);
      const parent = byId.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
  }
  return issues;
}

function parseIpv4(value: string) {
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return undefined;
  return parts.map(Number).join(".");
}

function parseIpv6(value: string) {
  if (!/^[0-9a-f:]+$/i.test(value) || value.includes(":::")) return undefined;
  const halves = value.split("::");
  if (halves.length > 2) return undefined;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  if ([...left, ...right].some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) return undefined;
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return undefined;
  return [...left, ...Array(Math.max(0, missing)).fill("0"), ...right]
    .map((part) => part.toLowerCase().padStart(4, "0"))
    .join(":");
}

function parseIp(value: string) {
  return parseIpv4(value) ?? parseIpv6(value);
}

function parseCidr(value: string) {
  const match = /^(.+)\/(\d{1,3})$/.exec(value.trim());
  if (!match) return undefined;
  const address = parseIp(match[1]);
  if (!address) return undefined;
  const prefix = Number(match[2]);
  const max = address.includes(":") ? 128 : 32;
  if (prefix < 0 || prefix > max) return undefined;
  return `${address}/${prefix}`;
}

function unsafeEvidence(value: string | undefined) {
  if (!value) return false;
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f]|(?:password|secret|token|cookie|ciphertext|nonce|database_url|postgres(?:ql)?:\/\/)/i.test(value);
}

function entityIndex(project: ProjectV2) {
  const pairs: Array<[TrustedEntityType, Array<{ id: string }>]> = [
    ["device", project.devices], ["link", project.links], ["group", project.groups],
    ["area", project.trustedNetwork.areas], ["interface", project.trustedNetwork.interfaces],
    ["vlan", project.trustedNetwork.vlans], ["subnet", project.trustedNetwork.subnets],
    ["interface-vlan", project.trustedNetwork.interfaceVlans],
    ["interface-subnet", project.trustedNetwork.interfaceSubnets],
    ["resiliency", project.trustedNetwork.resiliencyRelations],
  ];
  return new Map(pairs.map(([type, records]) => [type, new Set(records.map((record) => record.id))]));
}

function relationIssues(project: ProjectV2) {
  const issues = duplicateIssues(project);
  const devices = new Set(project.devices.map((record) => record.id));
  const groups = new Set(project.groups.map((record) => record.id));
  const areas = new Map(project.trustedNetwork.areas.map((record) => [record.id, record]));
  const interfaces = new Map(project.trustedNetwork.interfaces.map((record) => [record.id, record]));
  const vlans = new Set(project.trustedNetwork.vlans.map((record) => record.id));
  const subnets = new Set(project.trustedNetwork.subnets.map((record) => record.id));
  const links = new Set(project.links.map((record) => record.id));
  const evidence = new Set(project.trustedNetwork.evidence.map((record) => record.id));

  for (const [index, device] of project.devices.entries()) {
    if (device.groupId && !groups.has(device.groupId)) issues.push(issue("MISSING_REFERENCE", `devices.${index}.groupId`, "Referenced group does not exist."));
    if (device.networkAreaId && !areas.has(device.networkAreaId)) issues.push(issue("MISSING_REFERENCE", `devices.${index}.networkAreaId`, "Referenced area does not exist."));
  }
  for (const [index, area] of project.trustedNetwork.areas.entries()) {
    if (area.parentAreaId && !areas.has(area.parentAreaId)) issues.push(issue("MISSING_REFERENCE", `trustedNetwork.areas.${index}.parentAreaId`, "Referenced parent area does not exist."));
    if (area.groupId && !groups.has(area.groupId)) issues.push(issue("MISSING_REFERENCE", `trustedNetwork.areas.${index}.groupId`, "Referenced group does not exist."));
    if (area.parentAreaId && areas.get(area.parentAreaId)?.kind !== "region") issues.push(issue("INVALID_REFERENCE_OWNER", `trustedNetwork.areas.${index}.parentAreaId`, "An area parent must be a region."));
  }
  issues.push(...cycleIssues(project.trustedNetwork.areas.map((record) => ({ id: record.id, parentId: record.parentAreaId })), "trustedNetwork.areas"));

  for (const [index, networkInterface] of project.trustedNetwork.interfaces.entries()) {
    if (!devices.has(networkInterface.deviceId)) issues.push(issue("MISSING_REFERENCE", `trustedNetwork.interfaces.${index}.deviceId`, "Referenced device does not exist."));
    if (networkInterface.parentInterfaceId) {
      const parent = interfaces.get(networkInterface.parentInterfaceId);
      if (!parent) issues.push(issue("MISSING_REFERENCE", `trustedNetwork.interfaces.${index}.parentInterfaceId`, "Referenced parent interface does not exist."));
      else if (parent.deviceId !== networkInterface.deviceId) issues.push(issue("INVALID_REFERENCE_OWNER", `trustedNetwork.interfaces.${index}.parentInterfaceId`, "Parent interface must belong to the same device."));
    }
  }
  issues.push(...cycleIssues(project.trustedNetwork.interfaces.map((record) => ({ id: record.id, parentId: record.parentInterfaceId })), "trustedNetwork.interfaces"));

  const namesByDevice = new Map<string, Map<string, string>>();
  for (const [index, networkInterface] of project.trustedNetwork.interfaces.entries()) {
    const names = namesByDevice.get(networkInterface.deviceId) ?? new Map<string, string>();
    for (const candidate of [networkInterface.name, ...networkInterface.aliases]) {
      const normalized = normalizeLabel(candidate);
      const previous = names.get(normalized);
      if (previous) issues.push(issue("ALIAS_COLLISION", `trustedNetwork.interfaces.${index}.aliases`, "Interface names and aliases must be unique per device."));
      else names.set(normalized, networkInterface.id);
    }
    namesByDevice.set(networkInterface.deviceId, names);
  }

  for (const [index, link] of project.links.entries()) {
    if (!devices.has(link.from) || !devices.has(link.to)) issues.push(issue("MISSING_REFERENCE", `links.${index}`, "Link endpoint device does not exist."));
    if (link.from === link.to) issues.push(issue("INVALID_REFERENCE_OWNER", `links.${index}`, "A link cannot connect a device to itself."));
    for (const [field, interfaceId, deviceId] of [
      ["fromInterfaceId", link.fromInterfaceId, link.from],
      ["toInterfaceId", link.toInterfaceId, link.to],
    ] as const) {
      if (!interfaceId) continue;
      const endpoint = interfaces.get(interfaceId);
      if (!endpoint) issues.push(issue("MISSING_REFERENCE", `links.${index}.${field}`, "Referenced interface does not exist."));
      else if (endpoint.deviceId !== deviceId) issues.push(issue("INVALID_REFERENCE_OWNER", `links.${index}.${field}`, "Referenced interface belongs to a different device."));
    }
  }

  for (const [index, vlan] of project.trustedNetwork.vlans.entries()) {
    if (vlan.areaId && !areas.has(vlan.areaId)) issues.push(issue("MISSING_REFERENCE", `trustedNetwork.vlans.${index}.areaId`, "Referenced area does not exist."));
  }
  for (const [index, subnet] of project.trustedNetwork.subnets.entries()) {
    const canonical = parseCidr(subnet.cidr);
    if (!canonical || canonical !== subnet.cidr) issues.push(issue("INVALID_CIDR", `trustedNetwork.subnets.${index}.cidr`, "CIDR must use canonical IPv4 or IPv6 syntax."));
    if (subnet.areaId && !areas.has(subnet.areaId)) issues.push(issue("MISSING_REFERENCE", `trustedNetwork.subnets.${index}.areaId`, "Referenced area does not exist."));
    if (subnet.vlanId && !vlans.has(subnet.vlanId)) issues.push(issue("MISSING_REFERENCE", `trustedNetwork.subnets.${index}.vlanId`, "Referenced VLAN does not exist."));
  }
  for (const [index, relation] of project.trustedNetwork.interfaceVlans.entries()) {
    if (!interfaces.has(relation.interfaceId)) issues.push(issue("MISSING_REFERENCE", `trustedNetwork.interfaceVlans.${index}.interfaceId`, "Referenced interface does not exist."));
    if (!vlans.has(relation.vlanId)) issues.push(issue("MISSING_REFERENCE", `trustedNetwork.interfaceVlans.${index}.vlanId`, "Referenced VLAN does not exist."));
  }
  for (const [index, relation] of project.trustedNetwork.interfaceSubnets.entries()) {
    if (!interfaces.has(relation.interfaceId)) issues.push(issue("MISSING_REFERENCE", `trustedNetwork.interfaceSubnets.${index}.interfaceId`, "Referenced interface does not exist."));
    if (!subnets.has(relation.subnetId)) issues.push(issue("MISSING_REFERENCE", `trustedNetwork.interfaceSubnets.${index}.subnetId`, "Referenced subnet does not exist."));
    if (relation.address && !parseIp(relation.address)) issues.push(issue("INVALID_IP_ADDRESS", `trustedNetwork.interfaceSubnets.${index}.address`, "Address must be a valid IPv4 or IPv6 value."));
  }
  for (const [index, relation] of project.trustedNetwork.resiliencyRelations.entries()) {
    const unique = new Set(relation.memberLinkIds);
    if (unique.size !== relation.memberLinkIds.length || relation.memberLinkIds.some((id) => !links.has(id))) issues.push(issue("INVALID_RESILIENCY", `trustedNetwork.resiliencyRelations.${index}.memberLinkIds`, "Resiliency members must be unique existing links."));
    if (relation.primaryLinkId && !unique.has(relation.primaryLinkId)) issues.push(issue("INVALID_RESILIENCY", `trustedNetwork.resiliencyRelations.${index}.primaryLinkId`, "Primary link must be a member."));
    if (relation.kind === "active-active" && relation.primaryLinkId) issues.push(issue("INVALID_RESILIENCY", `trustedNetwork.resiliencyRelations.${index}.primaryLinkId`, "Active-active relations cannot select a primary link."));
  }

  for (const [index, source] of project.trustedNetwork.evidence.entries()) {
    if (source.locator?.file && /[\\/]/.test(source.locator.file)) issues.push(issue("UNSAFE_EVIDENCE", `trustedNetwork.evidence.${index}.locator.file`, "Evidence file must be a canonical basename."));
    if ([source.displayName, source.locator?.file, source.locator?.section, source.safeSummary].some(unsafeEvidence)) issues.push(issue("UNSAFE_EVIDENCE", `trustedNetwork.evidence.${index}`, "Evidence contains a forbidden sensitive value or raw source marker."));
  }

  const entities = entityIndex(project);
  for (const [index, trust] of project.trustedNetwork.fieldTrust.entries()) {
    if (!entities.get(trust.entityType)?.has(trust.entityId)) issues.push(issue("INVALID_TRUST_RECORD", `trustedNetwork.fieldTrust.${index}.entityId`, "Trust record references a missing entity."));
    if (trust.evidenceIds.some((id) => !evidence.has(id))) issues.push(issue("INVALID_TRUST_RECORD", `trustedNetwork.fieldTrust.${index}.evidenceIds`, "Trust record references missing evidence."));
    if (trust.verification === "verified" && (!trust.verifiedByUserId || !trust.verifiedAt)) issues.push(issue("INVALID_TRUST_RECORD", `trustedNetwork.fieldTrust.${index}.verification`, "Verified data requires an actor and timestamp."));
    if (trust.verification === "unverified" && (trust.verifiedByUserId || trust.verifiedAt)) issues.push(issue("INVALID_TRUST_RECORD", `trustedNetwork.fieldTrust.${index}.verification`, "Unverified data cannot carry verifier identity."));
  }
  return issues;
}

function parseV2(input: unknown): ProjectV2 {
  const parsed = projectV2Schema.safeParse(input);
  if (!parsed.success) throw new TrustedNetworkModelError(zodIssues(parsed.error));
  // Normalized values are validation views, not replacements for stored source text.
  const issues = relationIssues(parsed.data as ProjectV2);
  if (issues.length > 0) throw new TrustedNetworkModelError(issues);
  const project = stripUndefinedDeep(clone(input as ProjectV2));
  const rawIssues = relationIssues(project);
  if (rawIssues.length > 0) throw new TrustedNetworkModelError(rawIssues);
  return project;
}

function legacyEndpoint(
  model: TrustedNetworkModelV1,
  deviceId: string,
  label: string | undefined,
) {
  if (!label?.trim()) return undefined;
  const interfaceId = provisionalId("if", deviceId, label);
  if (!model.interfaces.some((record) => record.id === interfaceId)) {
    const evidenceId = provisionalId("ev", deviceId, label);
    const trustId = provisionalId("trust", deviceId, label);
    model.interfaces.push({ id: interfaceId, deviceId, name: label, kind: "physical", aliases: [] });
    model.evidence.push({
      id: evidenceId,
      method: "legacy-upcast",
      sourceKind: "legacy-project",
      displayName: "Legacy project port label",
      ruleCode: "LEGACY_PORT_UPCAST",
      safeSummary: "Explicit legacy port label was preserved as an unverified provisional interface.",
    });
    model.fieldTrust.push({
      id: trustId,
      entityType: "interface",
      entityId: interfaceId,
      fieldPath: "name",
      valueFingerprint: fingerprintValue(label),
      evidenceIds: [evidenceId],
      verification: "unverified",
    });
  }
  return interfaceId;
}

function parseLegacyPreservingText(input: unknown): LegacyProject {
  try {
    validateProject(input);
  } catch {
    throw new TrustedNetworkModelError([issue("INVALID_PROJECT_SCHEMA", "project", "Legacy project validation failed.")]);
  }
  return stripUndefinedDeep(clone(input as LegacyProject));
}

function upcastLegacy(input: unknown): ProjectV2 {
  const legacy = parseLegacyPreservingText(input);
  const trustedNetwork = emptyTrustedNetwork();
  const project: ProjectV2 = {
    projectSchemaVersion: 2,
    devices: legacy.devices.map((device) => ({ ...device })),
    links: legacy.links.map((link) => ({
      ...link,
      fromInterfaceId: legacyEndpoint(trustedNetwork, link.from, link.fromPort),
      toInterfaceId: legacyEndpoint(trustedNetwork, link.to, link.toPort),
    })),
    groups: legacy.groups.map((group) => ({ ...group })),
    trustedNetwork,
  };
  return parseV2(project);
}

export function upcastProject(input: unknown): ProjectV2 {
  if (input && typeof input === "object" && Object.hasOwn(input, "projectSchemaVersion")) {
    const version = (input as { projectSchemaVersion?: unknown }).projectSchemaVersion;
    if (version !== 2) throw new TrustedNetworkModelError([issue("INVALID_PROJECT_VERSION", "projectSchemaVersion", "Unsupported project schema version.")]);
    return parseV2(input);
  }
  return upcastLegacy(input);
}

export function validateProjectV2(input: unknown): ProjectV2 {
  return parseV2(input);
}

export function cloneProjectV2(project: ProjectV2): ProjectV2 {
  return parseV2(clone(project));
}

export function canonicalProjectV2(input: unknown): ProjectV2 {
  // Only object-key order is canonicalized; domain array order and text are meaningful.
  return canonicalKeys(parseV2(input));
}

export function downcastProjectV2(projectInput: unknown): LegacyProject {
  const project = parseV2(projectInput);
  const legacy = parseLegacyPreservingText({
    devices: project.devices.map((device) => ({
      id: device.id,
      name: device.name,
      type: device.type,
      ip: device.ip,
      mac: device.mac,
      model: device.model,
      location: device.location,
      url: device.url,
      quantity: device.quantity,
      x: device.x,
      y: device.y,
      groupId: device.groupId,
    })),
    links: project.links.map((link) => ({
      id: link.id,
      from: link.from,
      to: link.to,
      kind: link.kind,
      fromPort: link.fromPort,
      toPort: link.toPort,
      vlan: link.vlan,
      speed: link.speed,
    })),
    groups: project.groups.map((group) => ({ ...group })),
  });
  const expected = upcastLegacy(legacy);
  if (JSON.stringify(canonicalKeys(expected)) !== JSON.stringify(canonicalKeys(project))) {
    throw new TrustedNetworkModelError([issue("DOWNCAST_WOULD_LOSE_DATA", "project", "Project cannot be downcast without losing trusted network data.")]);
  }
  return legacy;
}

export function isTrustedNetworkModelError(error: unknown): error is TrustedNetworkModelError {
  return error instanceof TrustedNetworkModelError;
}

export type { ProjectV2, TrustedNetworkIssue } from "./trusted-network-types.ts";
