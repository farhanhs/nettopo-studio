import { z } from "zod";

import { ProjectSchema } from "../app/lib/topology-transfer.ts";

export type CharacterWidth = "half-width-ascii" | "unicode";
export type DictionaryField = {
  dataType: "string" | "integer" | "json" | "datetime";
  characterWidth?: CharacterWidth;
  maxLength?: number;
  nullable?: boolean;
  description: string;
};

export type ValidationIssue = {
  table: string;
  field: string;
  code: string;
  message: string;
  expected?: string;
  received?: string;
};

const HALF_WIDTH_TEXT = /^[\x20-\x7e]+$/;
const MACHINE_CODE = /^[a-z][a-z0-9._-]*$/;
const RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const NO_CONTROL_CHARACTERS = /^[^\u0000-\u001f\u007f]*$/;

function halfWidthString(maxLength: number, label: string) {
  return z.string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} must contain at most ${maxLength} characters.`)
    .regex(HALF_WIDTH_TEXT, `${label} must use half-width ASCII characters.`);
}

function unicodeString(maxLength: number, label: string) {
  return z.string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} must contain at most ${maxLength} characters.`)
    .regex(NO_CONTROL_CHARACTERS, `${label} cannot contain control characters.`);
}

export const MachineCodeSchema = halfWidthString(64, "code")
  .regex(MACHINE_CODE, "code must start with a lowercase letter and contain only lowercase letters, digits, dot, underscore, or hyphen.");

export const RecordIdSchema = halfWidthString(128, "id")
  .regex(RECORD_ID, "id contains unsupported characters.");

export const EmailSchema = halfWidthString(254, "email").pipe(z.email("email must be valid."));
export const HumanNameSchema = unicodeString(120, "name");
export const EntityNameSchema = unicodeString(160, "name");
export const OptionalNotesSchema = unicodeString(4000, "notes").optional();
export const DateTimeSchema = z.iso.datetime({ offset: true });

export const RoleRecordSchema = z.object({
  code: MachineCodeSchema,
  name: HumanNameSchema,
  description: unicodeString(1000, "description").optional(),
});

export const PermissionRecordSchema = RoleRecordSchema;

export const SiteRecordSchema = z.object({
  id: RecordIdSchema,
  name: HumanNameSchema,
});

export const UserDatabaseRecordSchema = z.object({
  id: RecordIdSchema,
  email: EmailSchema,
  name: HumanNameSchema,
  role: MachineCodeSchema,
  siteIds: z.array(RecordIdSchema).max(100),
});

export const CustomerDatabaseRecordSchema = z.object({
  id: RecordIdSchema,
  name: EntityNameSchema,
  notes: OptionalNotesSchema,
});

export const TopologyDatabaseRecordSchema = z.object({
  id: RecordIdSchema,
  customerId: RecordIdSchema,
  siteId: RecordIdSchema.optional(),
  ownerUserId: RecordIdSchema.optional(),
  name: EntityNameSchema,
  versionLabel: halfWidthString(64, "versionLabel"),
  project: ProjectSchema,
});

export const TopologyGroupRecordSchema = z.object({
  id: RecordIdSchema,
  topologyId: RecordIdSchema,
  name: EntityNameSchema,
  kind: z.enum(["site", "domain", "vlan"]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "color must use #RRGGBB format."),
  collapsed: z.boolean().default(false),
});

export const TopologyDeviceRecordSchema = z.object({
  id: RecordIdSchema,
  topologyId: RecordIdSchema,
  deviceType: z.enum(["router", "modem", "firewall", "switch", "server", "nas", "erp", "access-point", "client", "ssid", "mesh-node", "printer", "camera", "pos", "iot"]),
  groupId: RecordIdSchema.optional(),
  name: EntityNameSchema,
  ip: halfWidthString(45, "ip").pipe(z.union([z.ipv4(), z.ipv6()])).optional(),
  mac: halfWidthString(17, "mac").regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i, "mac must use AA:BB:CC:DD:EE:FF format.").optional(),
  model: unicodeString(160, "model").optional(),
  location: unicodeString(240, "location").optional(),
  managementUrl: halfWidthString(2048, "managementUrl").pipe(z.url("managementUrl must be a valid URL.")).optional(),
  quantity: z.number().int().min(1).max(10_000).default(1),
  positionX: z.number().int().min(-1_000_000).max(1_000_000),
  positionY: z.number().int().min(-1_000_000).max(1_000_000),
});

export const TopologyLinkRecordSchema = z.object({
  id: RecordIdSchema,
  topologyId: RecordIdSchema,
  fromDeviceId: RecordIdSchema,
  toDeviceId: RecordIdSchema,
  kind: z.enum(["wired", "wireless"]),
  fromPort: halfWidthString(64, "fromPort").optional(),
  toPort: halfWidthString(64, "toPort").optional(),
  vlan: halfWidthString(64, "vlan").optional(),
  speed: halfWidthString(64, "speed").optional(),
}).refine((record) => record.fromDeviceId !== record.toDeviceId, {
  message: "fromDeviceId and toDeviceId must be different.",
  path: ["toDeviceId"],
});

export const DATABASE_DICTIONARY = {
  roles: {
    code: { dataType: "string", characterWidth: "half-width-ascii", maxLength: 64, description: "Stable role code." },
    name: { dataType: "string", characterWidth: "unicode", maxLength: 120, description: "Role display name." },
  },
  sites: {
    id: { dataType: "string", characterWidth: "half-width-ascii", maxLength: 128, description: "Site identifier." },
    name: { dataType: "string", characterWidth: "unicode", maxLength: 120, description: "Site display name." },
  },
  users: {
    id: { dataType: "string", characterWidth: "half-width-ascii", maxLength: 128, description: "User identifier." },
    email: { dataType: "string", characterWidth: "half-width-ascii", maxLength: 254, description: "Login email." },
    name: { dataType: "string", characterWidth: "unicode", maxLength: 120, description: "Employee name." },
    role: { dataType: "string", characterWidth: "half-width-ascii", maxLength: 64, description: "Role dictionary code." },
  },
  customers: {
    id: { dataType: "string", characterWidth: "half-width-ascii", maxLength: 128, description: "Customer identifier." },
    name: { dataType: "string", characterWidth: "unicode", maxLength: 160, description: "Customer name." },
    notes: { dataType: "string", characterWidth: "unicode", maxLength: 4000, nullable: true, description: "Customer notes." },
  },
  topologies: {
    id: { dataType: "string", characterWidth: "half-width-ascii", maxLength: 128, description: "Topology identifier." },
    name: { dataType: "string", characterWidth: "unicode", maxLength: 160, description: "Topology name." },
    versionLabel: { dataType: "string", characterWidth: "half-width-ascii", maxLength: 64, description: "Version label." },
    project: { dataType: "json", description: "Validated ProjectSchema payload." },
  },
  topology_devices: {
    name: { dataType: "string", characterWidth: "unicode", maxLength: 160, description: "Device name." },
    quantity: { dataType: "integer", description: "Number of physical units represented by this node." },
    ip: { dataType: "string", characterWidth: "half-width-ascii", maxLength: 45, nullable: true, description: "IPv4 or IPv6 address." },
    mac: { dataType: "string", characterWidth: "half-width-ascii", maxLength: 17, nullable: true, description: "Colon-separated MAC address." },
    positionX: { dataType: "integer", description: "Canvas X coordinate." },
    positionY: { dataType: "integer", description: "Canvas Y coordinate." },
  },
} as const satisfies Record<string, Record<string, DictionaryField>>;

function receivedType(value: unknown) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function validateDatabaseRecord<T>(table: string, schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) return { success: true as const, data: result.data, issues: [] as ValidationIssue[] };
  const root = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const issues = result.error.issues.map((issue): ValidationIssue => {
    const field = issue.path.map(String).join(".") || "$record";
    const value = field === "$record" ? input : root[issue.path[0] as string];
    return {
      table,
      field,
      code: issue.code,
      message: issue.message,
      expected: "expected" in issue ? String(issue.expected) : undefined,
      received: receivedType(value),
    };
  });
  return { success: false as const, issues };
}

export class DatabaseValidationError extends Error {
  readonly table: string;
  readonly issues: ValidationIssue[];

  constructor(table: string, issues: ValidationIssue[]) {
    super(`Database validation failed for ${table}: ${issues.map((issue) => `${issue.field}: ${issue.message}`).join("; ")}`);
    this.name = "DatabaseValidationError";
    this.table = table;
    this.issues = issues;
  }
}

export function parseDatabaseRecord<T>(table: string, schema: z.ZodType<T>, input: unknown): T {
  const result = validateDatabaseRecord(table, schema, input);
  if (!result.success) throw new DatabaseValidationError(table, result.issues);
  return result.data;
}
