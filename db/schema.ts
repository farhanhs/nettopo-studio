import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const schemaMigrations = pgTable("schema_migrations", {
  version: text("version").primaryKey(),
  name: text("name").notNull(),
  checksum: text("checksum").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
});

export const roles = pgTable("roles", {
  code: varchar("code", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 1000 }),
  ...timestamps,
});

export const permissions = pgTable("permissions", {
  code: varchar("code", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 1000 }),
  ...timestamps,
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleCode: varchar("role_code", { length: 64 })
      .notNull()
      .references(() => roles.code, { onDelete: "cascade" }),
    permissionCode: varchar("permission_code", { length: 64 })
      .notNull()
      .references(() => permissions.code, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.roleCode, table.permissionCode] })],
);

export const sites = pgTable("sites", {
  id: varchar("id", { length: 128 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  ...timestamps,
});

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    email: varchar("email", { length: 254 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    role: varchar("role", { length: 64 })
      .notNull()
      .references(() => roles.code),
    passwordHash: varchar("password_hash", { length: 255 }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("users_role_idx").on(table.role), index("users_disabled_at_idx").on(table.disabledAt)],
);

export const userSites = pgTable(
  "user_sites",
  {
    userId: varchar("user_id", { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    siteId: varchar("site_id", { length: 128 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.siteId] })],
);

export const customers = pgTable("customers", {
  id: varchar("id", { length: 128 }).primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  notes: varchar("notes", { length: 4000 }),
  ...timestamps,
});

export const configKinds = pgTable("config_kinds", {
  code: varchar("code", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 1000 }),
  ...timestamps,
});

export const customerProfiles = pgTable(
  "customer_profiles",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    customerId: varchar("customer_id", { length: 128 })
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    kind: text("kind")
      .notNull()
      .references(() => configKinds.code),
    profileKey: text("profile_key").notNull(),
    profileValue: jsonb("profile_value").$type<Record<string, unknown>>().notNull(),
    updatedByUserId: text("updated_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("customer_profiles_customer_key_idx").on(table.customerId, table.kind, table.profileKey),
    index("customer_profiles_customer_id_idx").on(table.customerId),
  ],
);

export const topologies = pgTable(
  "topologies",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    siteId: varchar("site_id", { length: 128 }).references(() => sites.id),
    ownerUserId: varchar("owner_user_id", { length: 128 }).references(() => users.id),
    createdByUserId: varchar("created_by_user_id", { length: 128 }).references(() => users.id),
    updatedByUserId: varchar("updated_by_user_id", { length: 128 }).references(() => users.id),
    name: varchar("name", { length: 160 }).notNull(),
    versionLabel: varchar("version_label", { length: 64 }).notNull(),
    project: jsonb("project").$type<{
      devices: unknown[];
      links: unknown[];
      groups: unknown[];
    }>().notNull(),
    ...timestamps,
  },
  (table) => [
    index("topologies_customer_id_idx").on(table.customerId),
    index("topologies_site_id_idx").on(table.siteId),
    index("topologies_owner_user_id_idx").on(table.ownerUserId),
    index("topologies_updated_at_idx").on(table.updatedAt),
  ],
);

export const topologyProfiles = pgTable(
  "topology_profiles",
  {
    id: text("id").primaryKey(),
    topologyId: text("topology_id")
      .notNull()
      .references(() => topologies.id, { onDelete: "cascade" }),
    kind: text("kind")
      .notNull()
      .references(() => configKinds.code),
    profileKey: text("profile_key").notNull(),
    profileValue: jsonb("profile_value").$type<Record<string, unknown>>().notNull(),
    updatedByUserId: text("updated_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("topology_profiles_topology_key_idx").on(table.topologyId, table.kind, table.profileKey),
    index("topology_profiles_topology_id_idx").on(table.topologyId),
  ],
);

export const topologyVersions = pgTable(
  "topology_versions",
  {
    id: text("id").primaryKey(),
    topologyId: text("topology_id")
      .notNull()
      .references(() => topologies.id, { onDelete: "cascade" }),
    versionLabel: text("version_label").notNull(),
    projectSnapshot: jsonb("project_snapshot").$type<Record<string, unknown>>().notNull(),
    changeNote: text("change_note"),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("topology_versions_topology_label_idx").on(table.topologyId, table.versionLabel),
    index("topology_versions_topology_id_idx").on(table.topologyId),
  ],
);

export const deviceTypes = pgTable("device_types", {
  code: varchar("code", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 1000 }),
  ...timestamps,
});

export const groupKinds = pgTable("group_kinds", {
  code: varchar("code", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 1000 }),
  ...timestamps,
});

export const linkKinds = pgTable("link_kinds", {
  code: varchar("code", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 1000 }),
  ...timestamps,
});

export const topologyGroups = pgTable(
  "topology_groups",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    topologyId: varchar("topology_id", { length: 128 })
      .notNull()
      .references(() => topologies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    kind: varchar("kind", { length: 64 })
      .notNull()
      .references(() => groupKinds.code),
    color: varchar("color", { length: 7 }).notNull(),
    collapsed: boolean("collapsed").default(false).notNull(),
    rawMetadata: jsonb("raw_metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [index("topology_groups_topology_id_idx").on(table.topologyId)],
);

export const topologyDevices = pgTable(
  "topology_devices",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    topologyId: varchar("topology_id", { length: 128 })
      .notNull()
      .references(() => topologies.id, { onDelete: "cascade" }),
    deviceType: varchar("device_type", { length: 64 })
      .notNull()
      .references(() => deviceTypes.code),
    groupId: varchar("group_id", { length: 128 }).references(() => topologyGroups.id, { onDelete: "set null" }),
    name: varchar("name", { length: 160 }).notNull(),
    ip: varchar("ip", { length: 45 }),
    mac: varchar("mac", { length: 17 }),
    model: varchar("model", { length: 160 }),
    location: varchar("location", { length: 240 }),
    managementUrl: varchar("management_url", { length: 2048 }),
    quantity: integer("quantity").default(1).notNull(),
    positionX: integer("position_x").notNull(),
    positionY: integer("position_y").notNull(),
    rawMetadata: jsonb("raw_metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("topology_devices_topology_id_idx").on(table.topologyId),
    index("topology_devices_group_id_idx").on(table.groupId),
    index("topology_devices_type_idx").on(table.deviceType),
  ],
);

export const topologyLinks = pgTable(
  "topology_links",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    topologyId: varchar("topology_id", { length: 128 })
      .notNull()
      .references(() => topologies.id, { onDelete: "cascade" }),
    fromDeviceId: varchar("from_device_id", { length: 128 })
      .notNull()
      .references(() => topologyDevices.id, { onDelete: "cascade" }),
    toDeviceId: varchar("to_device_id", { length: 128 })
      .notNull()
      .references(() => topologyDevices.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 64 })
      .notNull()
      .references(() => linkKinds.code),
    fromPort: varchar("from_port", { length: 64 }),
    toPort: varchar("to_port", { length: 64 }),
    vlan: varchar("vlan", { length: 64 }),
    speed: varchar("speed", { length: 64 }),
    rawMetadata: jsonb("raw_metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("topology_links_topology_id_idx").on(table.topologyId),
    index("topology_links_from_device_id_idx").on(table.fromDeviceId),
    index("topology_links_to_device_id_idx").on(table.toDeviceId),
  ],
);

export const credentialKinds = pgTable("credential_kinds", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ...timestamps,
});

export const deviceCredentials = pgTable(
  "device_credentials",
  {
    id: text("id").primaryKey(),
    topologyId: text("topology_id")
      .notNull()
      .references(() => topologies.id, { onDelete: "cascade" }),
    deviceId: text("device_id").references(() => topologyDevices.id, { onDelete: "set null" }),
    projectDeviceId: text("project_device_id"),
    kind: text("kind")
      .notNull()
      .references(() => credentialKinds.code),
    usernameMasked: text("username_masked"),
    usernameCiphertext: text("username_ciphertext"),
    secretMasked: text("secret_masked").notNull(),
    secretCiphertext: text("secret_ciphertext"),
    secretNonce: text("secret_nonce"),
    keyVersion: text("key_version"),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    updatedByUserId: text("updated_by_user_id").references(() => users.id),
    lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("device_credentials_topology_id_idx").on(table.topologyId),
    index("device_credentials_device_id_idx").on(table.deviceId),
    index("device_credentials_project_device_id_idx").on(table.topologyId, table.projectDeviceId),
    index("device_credentials_kind_idx").on(table.kind),
    uniqueIndex("device_credentials_project_device_kind_idx").on(table.topologyId, table.projectDeviceId, table.kind),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    siteId: text("site_id").references(() => sites.id, { onDelete: "set null" }),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    topologyId: text("topology_id").references(() => topologies.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_actor_user_id_idx").on(table.actorUserId),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("api_tokens_token_hash_idx").on(table.tokenHash), index("api_tokens_user_id_idx").on(table.userId)],
);
