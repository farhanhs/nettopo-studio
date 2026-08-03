import postgres, { type Sql, type TransactionSql } from "postgres";
import { postgresMigrations } from "@/db/postgres-migration-manifest";
import { runPostgresMigrations } from "@/db/postgres-migrations.js";
import { encryptCredentialEnvelope } from "@/db/credential-crypto";
import { stripProjectCredentials, validateProject } from "@/app/lib/topology-validation";
import {
  SEAN_SPINE_LEAF_PROJECT,
  SEAN_SPINE_LEAF_TOPOLOGY_ID,
  SEAN_SPINE_LEAF_TOPOLOGY_NAME,
} from "@/app/lib/demo-topologies";
import {
  cloneProject,
  EMPTY_PROJECT,
  SAMPLE_PROJECT,
  type AuditLogRecord,
  type CredentialKind,
  type CustomerRecord,
  type DeviceCredentialRecord,
  type DeviceCredentialWriteInput,
  type Project,
  type RoleCode,
  type SiteRecord,
  type TopologyRecord,
  type UserRecord,
} from "@/app/lib/topology-types";

let databaseBootstrapped = false;

export type TopologyDataset = {
  customers: CustomerRecord[];
  topologies: TopologyRecord[];
  sites: SiteRecord[];
  currentUser: UserRecord;
  permissions: {
    canCreate: boolean;
    canWriteAll: boolean;
    canReadAll: boolean;
  };
};

type CustomerRow = {
  id: string;
  name: string;
  notes: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type SiteRow = {
  id: string;
  name: string;
  created_at: string | Date;
  updated_at: string | Date;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: RoleCode;
  site_ids: string[] | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type TopologyRow = {
  id: string;
  customer_id: string;
  site_id: string | null;
  owner_user_id: string | null;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  name: string;
  version_label: string;
  project: Project;
  created_at: string | Date;
  updated_at: string | Date;
};

type DeviceCredentialRow = {
  id: string;
  topology_id: string;
  project_device_id: string;
  kind: CredentialKind;
  username_masked: string | null;
  secret_masked: string;
  key_version: string | null;
  last_rotated_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type AuditLogRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  site_id: string | null;
  customer_id: string | null;
  topology_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
};

type AuditEntry = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  siteId?: string;
  customerId?: string;
  topologyId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

function createSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required when NEXT_PUBLIC_TOPOLOGY_STORAGE=server.");
  }
  return postgres(databaseUrl, {
    max: Number(process.env.POSTGRES_POOL_MAX ?? 1),
    idle_timeout: 20,
    prepare: false,
  });
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function toIso(value: string | Date) {
  return typeof value === "string" ? new Date(value).toISOString() : value.toISOString();
}

function mapCustomer(row: CustomerRow): CustomerRecord {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapSite(row: SiteRow): SiteRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    siteIds: row.site_ids ?? [],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapTopology(row: TopologyRow): TopologyRecord {
  return {
    id: row.id,
    customerId: row.customer_id,
    siteId: row.site_id ?? undefined,
    ownerUserId: row.owner_user_id ?? undefined,
    createdByUserId: row.created_by_user_id ?? undefined,
    updatedByUserId: row.updated_by_user_id ?? undefined,
    name: row.name,
    versionLabel: row.version_label,
    project: stripProjectCredentials(row.project),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapDeviceCredential(row: DeviceCredentialRow): DeviceCredentialRecord {
  return {
    id: row.id,
    topologyId: row.topology_id,
    projectDeviceId: row.project_device_id,
    kind: row.kind,
    usernameMasked: row.username_masked ?? undefined,
    secretMasked: row.secret_masked,
    keyVersion: row.key_version ?? undefined,
    lastRotatedAt: row.last_rotated_at ? toIso(row.last_rotated_at) : undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapAuditLog(row: AuditLogRow): AuditLogRecord {
  return {
    id: row.id,
    actorUserId: row.actor_user_id ?? undefined,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    siteId: row.site_id ?? undefined,
    customerId: row.customer_id ?? undefined,
    topologyId: row.topology_id ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: toIso(row.created_at),
  };
}

function sortByUpdatedAt<T extends { updatedAt: string }>(records: T[]) {
  return [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function withReadySql<T>(operation: (sql: Sql) => Promise<T>) {
  const sql = createSql();
  try {
    if (!databaseBootstrapped) {
      await runPostgresMigrations(sql, postgresMigrations);
      await seedDictionaries(sql);
      await seedOrganization(sql);
      await seedIfEmpty(sql);
      await seedSeanSpineLeafDemo(sql);
      databaseBootstrapped = true;
    }
    return await operation(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function seedDictionaries(sql: Sql) {
  const timestamp = nowIso();
  await sql.begin(async (tx) => {
    const roles = [
      ["boss", "Boss", "Read and edit every customer and topology."],
      ["site_manager", "Site manager", "Read and edit data for assigned sites."],
      ["engineer", "Engineer", "Create and edit owned topology files."],
      ["sales_procurement", "Sales and procurement", "Read all files without write access."],
    ];
    for (const [code, name, description] of roles) {
      await tx`
        insert into roles (code, name, description, created_at, updated_at)
        values (${code}, ${name}, ${description}, ${timestamp}, ${timestamp})
        on conflict (code) do update set name = excluded.name, description = excluded.description, updated_at = excluded.updated_at
      `;
    }

    const permissions = [
      ["customer.read.all", "Read all customers", "Can read all customer records."],
      ["customer.write.all", "Write all customers", "Can edit all customer records."],
      ["topology.read.all", "Read all topologies", "Can read all topology records."],
      ["topology.write.all", "Write all topologies", "Can edit all topology records."],
      ["topology.read.site", "Read site topologies", "Can read topology records in assigned sites."],
      ["topology.write.site", "Write site topologies", "Can edit topology records in assigned sites."],
      ["topology.write.owned", "Write owned topologies", "Can edit topology records created or owned by the user."],
      ["credential.read.masked", "Read masked credentials", "Can read masked credential fields."],
      ["credential.write", "Write credentials", "Can create or rotate encrypted credential records."],
      ["audit.read", "Read audit logs", "Can review audit log records."],
    ];
    for (const [code, name, description] of permissions) {
      await tx`
        insert into permissions (code, name, description, created_at, updated_at)
        values (${code}, ${name}, ${description}, ${timestamp}, ${timestamp})
        on conflict (code) do update set name = excluded.name, description = excluded.description, updated_at = excluded.updated_at
      `;
    }

    const rolePermissions = [
      ["boss", "customer.read.all"],
      ["boss", "customer.write.all"],
      ["boss", "topology.read.all"],
      ["boss", "topology.write.all"],
      ["boss", "credential.read.masked"],
      ["boss", "credential.write"],
      ["boss", "audit.read"],
      ["site_manager", "topology.read.site"],
      ["site_manager", "topology.write.site"],
      ["site_manager", "credential.read.masked"],
      ["engineer", "topology.write.owned"],
      ["engineer", "credential.read.masked"],
      ["sales_procurement", "customer.read.all"],
      ["sales_procurement", "topology.read.all"],
      ["sales_procurement", "credential.read.masked"],
    ];
    for (const [roleCode, permissionCode] of rolePermissions) {
      await tx`
        insert into role_permissions (role_code, permission_code)
        values (${roleCode}, ${permissionCode})
        on conflict do nothing
      `;
    }

    const configKinds = [
      ["customer_profile", "Customer profile", "Structured customer settings and metadata."],
      ["topology_profile", "Topology profile", "Structured topology settings and metadata."],
      ["import_mapping", "Import mapping", "CSV or document import mapping settings."],
      ["export_template", "Export template", "Export and report template settings."],
    ];
    for (const [code, name, description] of configKinds) {
      await tx`
        insert into config_kinds (code, name, description, created_at, updated_at)
        values (${code}, ${name}, ${description}, ${timestamp}, ${timestamp})
        on conflict (code) do update set name = excluded.name, description = excluded.description, updated_at = excluded.updated_at
      `;
    }

    const deviceTypes = ["router", "modem", "firewall", "switch", "server", "nas", "erp", "access-point", "client", "ssid", "mesh-node", "printer", "camera", "pos", "iot"];
    for (const code of deviceTypes) {
      await tx`
        insert into device_types (code, name, created_at, updated_at)
        values (${code}, ${code}, ${timestamp}, ${timestamp})
        on conflict (code) do update set name = excluded.name, updated_at = excluded.updated_at
      `;
    }

    for (const code of ["site", "domain", "vlan"]) {
      await tx`
        insert into group_kinds (code, name, created_at, updated_at)
        values (${code}, ${code}, ${timestamp}, ${timestamp})
        on conflict (code) do update set name = excluded.name, updated_at = excluded.updated_at
      `;
    }

    for (const code of ["wired", "wireless"]) {
      await tx`
        insert into link_kinds (code, name, created_at, updated_at)
        values (${code}, ${code}, ${timestamp}, ${timestamp})
        on conflict (code) do update set name = excluded.name, updated_at = excluded.updated_at
      `;
    }

    const credentialKinds = [
      ["device_admin", "Device admin", "Administrative credential for a network device."],
      ["device_readonly", "Device read only", "Read-only credential for a network device."],
      ["wifi", "Wi-Fi", "Wireless network credential."],
      ["vpn", "VPN", "VPN credential."],
      ["external_service", "External service", "Credential for an external service."],
    ];
    for (const [code, name, description] of credentialKinds) {
      await tx`
        insert into credential_kinds (code, name, description, created_at, updated_at)
        values (${code}, ${name}, ${description}, ${timestamp}, ${timestamp})
        on conflict (code) do update set name = excluded.name, description = excluded.description, updated_at = excluded.updated_at
      `;
    }
  });
}

async function seedOrganization(sql: Sql) {
  const timestamp = nowIso();
  const northOneId = "site-north-1";
  const northTwoId = "site-north-2";
  const users = [
    { id: "user-sean-sie", email: "sean.sie@dus.local", name: "謝慶宣", role: "engineer" as RoleCode, siteIds: [northOneId, northTwoId] },
    { id: "user-boss-manner", email: "manner@company.local", name: "manner", role: "boss" as RoleCode, siteIds: [northOneId, northTwoId] },
    { id: "user-manager-north-1", email: "north1.manager@company.local", name: "北一站站長", role: "site_manager" as RoleCode, siteIds: [northOneId] },
    { id: "user-manager-north-2", email: "north2.manager@company.local", name: "北二站站長", role: "site_manager" as RoleCode, siteIds: [northTwoId] },
    { id: "user-engineer-demo", email: "engineer@company.local", name: "工程師", role: "engineer" as RoleCode, siteIds: [northOneId] },
    { id: "user-sales-demo", email: "sales@company.local", name: "採購與業務", role: "sales_procurement" as RoleCode, siteIds: [northOneId, northTwoId] },
  ];

  await sql.begin(async (tx) => {
    await tx`
      insert into sites (id, name, created_at, updated_at)
      values
        (${northOneId}, ${"北一站"}, ${timestamp}, ${timestamp}),
        (${northTwoId}, ${"北二站"}, ${timestamp}, ${timestamp})
      on conflict (id) do nothing
    `;
    for (const user of users) {
      await tx`
        insert into users (id, email, name, role, created_at, updated_at)
        values (${user.id}, ${user.email}, ${user.name}, ${user.role}, ${timestamp}, ${timestamp})
        on conflict (email) do nothing
      `;
      for (const siteId of user.siteIds) {
        await tx`
          insert into user_sites (user_id, site_id)
          values (${user.id}, ${siteId})
          on conflict do nothing
        `;
      }
    }
  });
}

async function seedIfEmpty(sql: Sql) {
  const [{ count }] = await sql<{ count: string }[]>`select count(*)::text as count from customers`;
  if (Number(count) > 0) return;

  const timestamp = nowIso();
  const customer: CustomerRecord = {
    id: uid("customer"),
    name: "示範客戶",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const topology: TopologyRecord = {
    id: uid("topology"),
    customerId: customer.id,
    siteId: "site-north-1",
    ownerUserId: "user-boss-manner",
    createdByUserId: "user-boss-manner",
    updatedByUserId: "user-boss-manner",
    name: "我的網路架構",
    versionLabel: "v1",
    project: cloneProject(SAMPLE_PROJECT),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await sql.begin(async (tx) => {
    await tx`
      insert into customers (id, name, created_at, updated_at)
      values (${customer.id}, ${customer.name}, ${customer.createdAt}, ${customer.updatedAt})
    `;
    await tx`
      insert into topologies (id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at)
      values (${topology.id}, ${topology.customerId}, ${topology.siteId ?? null}, ${topology.ownerUserId ?? null}, ${topology.createdByUserId ?? null}, ${topology.updatedByUserId ?? null}, ${topology.name}, ${topology.versionLabel}, ${tx.json(topology.project)}, ${topology.createdAt}, ${topology.updatedAt})
    `;
  });
}

async function seedSeanSpineLeafDemo(sql: Sql) {
  const [customer] = await sql<{ id: string }[]>`select id from customers order by created_at asc limit 1`;
  if (!customer) return;
  const timestamp = nowIso();
  await sql`
    insert into topologies (
      id, customer_id, owner_user_id, created_by_user_id, updated_by_user_id,
      name, version_label, project, created_at, updated_at
    ) values (
      ${SEAN_SPINE_LEAF_TOPOLOGY_ID}, ${customer.id}, ${"user-sean-sie"}, ${"user-sean-sie"}, ${"user-sean-sie"},
      ${SEAN_SPINE_LEAF_TOPOLOGY_NAME}, ${"v1"}, ${sql.json(SEAN_SPINE_LEAF_PROJECT)}, ${timestamp}, ${timestamp}
    )
    on conflict (id) do nothing
  `;
}

async function getCurrentUser(sql: Sql, email: string) {
  const [row] = await sql<UserRow[]>`
    select u.id, u.email, u.name, u.role::text as role, coalesce(array_agg(us.site_id) filter (where us.site_id is not null), '{}') as site_ids, u.created_at, u.updated_at
    from users u
    left join user_sites us on us.user_id = u.id
    where lower(u.email) = lower(${email})
    group by u.id
  `;
  if (!row) throw new Error("Current user is not registered.");
  return mapUser(row);
}

function rolePermissions(user: UserRecord) {
  return {
    canCreate: user.role !== "sales_procurement",
    canWriteAll: user.role === "boss",
    canReadAll: user.role === "boss" || user.role === "sales_procurement",
  };
}

function canReadTopology(user: UserRecord, topology: TopologyRecord) {
  if (user.role === "boss" || user.role === "sales_procurement") return true;
  if (user.role === "site_manager") return Boolean(topology.siteId && user.siteIds.includes(topology.siteId));
  return topology.ownerUserId === user.id || topology.createdByUserId === user.id;
}

function canWriteTopology(user: UserRecord, topology: TopologyRecord) {
  if (user.role === "boss") return true;
  if (user.role === "sales_procurement") return false;
  if (user.role === "site_manager") return Boolean(topology.siteId && user.siteIds.includes(topology.siteId));
  return topology.ownerUserId === user.id || topology.createdByUserId === user.id;
}

function assertCanCreate(user: UserRecord) {
  if (!rolePermissions(user).canCreate) throw new Error("Permission denied: this role is read-only.");
}

async function hasPermission(sql: Sql, user: UserRecord, permissionCode: string) {
  const [{ allowed }] = await sql<{ allowed: boolean }[]>`
    select exists (
      select 1 from role_permissions
      where role_code = ${user.role} and permission_code = ${permissionCode}
    ) as allowed
  `;
  return allowed;
}

async function writeAuditLog(tx: TransactionSql, entry: AuditEntry) {
  await tx`
    insert into audit_logs (
      id, actor_user_id, action, entity_type, entity_id,
      site_id, customer_id, topology_id, metadata, created_at
    ) values (
      ${uid("audit")}, ${entry.actorUserId}, ${entry.action}, ${entry.entityType}, ${entry.entityId ?? null},
      ${entry.siteId ?? null}, ${entry.customerId ?? null}, ${entry.topologyId ?? null},
      ${tx.json(entry.metadata ?? {})}, ${nowIso()}
    )
  `;
}

async function readTopology(sql: Sql, topologyId: string) {
  const [row] = await sql<TopologyRow[]>`
    select id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at
    from topologies
    where id = ${topologyId}
  `;
  return row ? mapTopology(row) : undefined;
}

function defaultSiteFor(user: UserRecord, requestedSiteId?: string) {
  if (requestedSiteId && (user.role === "boss" || user.siteIds.includes(requestedSiteId))) return requestedSiteId;
  return user.siteIds[0];
}

async function readAllSites(sql: Sql) {
  const rows = await sql<SiteRow[]>`select id, name, created_at, updated_at from sites order by name`;
  return rows.map(mapSite);
}

export async function readTopologyDataset(email: string): Promise<TopologyDataset> {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  const customers = await sql<CustomerRow[]>`
    select id, name, notes, created_at, updated_at
    from customers
    order by updated_at desc
  `;
  const topologies = await sql<TopologyRow[]>`
    select id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at
    from topologies
    order by updated_at desc
  `;
  const readableTopologies = topologies.map(mapTopology).filter((topology) => canReadTopology(currentUser, topology));
  const readableCustomerIds = new Set(readableTopologies.map((topology) => topology.customerId));
  return {
    customers: sortByUpdatedAt(customers.map(mapCustomer).filter((customer) =>
      rolePermissions(currentUser).canReadAll || readableCustomerIds.has(customer.id),
    )),
    topologies: sortByUpdatedAt(readableTopologies),
    sites: await readAllSites(sql),
    currentUser,
    permissions: rolePermissions(currentUser),
  };
  });
}

export async function readDeviceCredentials(email: string, topologyId: string) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  const topology = await readTopology(sql, topologyId);
  if (!topology || !canReadTopology(currentUser, topology)) {
    throw new Error("Permission denied: cannot read credentials for this topology.");
  }
  if (!await hasPermission(sql, currentUser, "credential.read.masked")) {
    throw new Error("Permission denied: this role cannot read credential metadata.");
  }

  const rows = await sql<DeviceCredentialRow[]>`
    select id, topology_id, project_device_id, kind, username_masked, secret_masked,
      key_version, last_rotated_at, created_at, updated_at
    from device_credentials
    where topology_id = ${topologyId} and project_device_id is not null
    order by updated_at desc
  `;
  return rows.map(mapDeviceCredential);
  });
}

export async function upsertDeviceCredential(email: string, input: DeviceCredentialWriteInput) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  const topology = await readTopology(sql, input.topologyId);
  if (!topology || !canWriteTopology(currentUser, topology)) {
    throw new Error("Permission denied: cannot edit credentials for this topology.");
  }
  if (!await hasPermission(sql, currentUser, "credential.write")) {
    throw new Error("Permission denied: this role cannot write credentials.");
  }
  if (!topology.project.devices.some((device) => device.id === input.projectDeviceId)) {
    throw new Error(`Credential device "${input.projectDeviceId}" does not exist in this topology.`);
  }

  const encrypted = await encryptCredentialEnvelope({
    username: input.username,
    secret: input.secret,
    context: `${input.topologyId}:${input.projectDeviceId}:${input.kind}`,
  });
  const timestamp = nowIso();

  await sql.begin(async (tx) => {
    const [saved] = await tx<{ id: string }[]>`
      insert into device_credentials (
        id, topology_id, device_id, project_device_id, kind,
        username_masked, username_ciphertext, secret_masked, secret_ciphertext,
        secret_nonce, key_version, created_by_user_id, updated_by_user_id,
        last_rotated_at, created_at, updated_at
      ) values (
        ${uid("credential")}, ${input.topologyId}, ${null}, ${input.projectDeviceId}, ${input.kind},
        ${encrypted.usernameMasked ?? null}, ${null}, ${encrypted.secretMasked}, ${encrypted.secretCiphertext},
        ${encrypted.secretNonce}, ${encrypted.keyVersion}, ${currentUser.id}, ${currentUser.id},
        ${timestamp}, ${timestamp}, ${timestamp}
      )
      on conflict (topology_id, project_device_id, kind) where project_device_id is not null
      do update set
        username_masked = excluded.username_masked,
        username_ciphertext = excluded.username_ciphertext,
        secret_masked = excluded.secret_masked,
        secret_ciphertext = excluded.secret_ciphertext,
        secret_nonce = excluded.secret_nonce,
        key_version = excluded.key_version,
        updated_by_user_id = excluded.updated_by_user_id,
        last_rotated_at = excluded.last_rotated_at,
        updated_at = excluded.updated_at
      returning id
    `;
    await writeAuditLog(tx, {
      actorUserId: currentUser.id,
      action: "credential.upsert",
      entityType: "device_credential",
      entityId: saved.id,
      siteId: topology.siteId,
      customerId: topology.customerId,
      topologyId: topology.id,
      metadata: { projectDeviceId: input.projectDeviceId, kind: input.kind, keyVersion: encrypted.keyVersion },
    });
  });

  return readDeviceCredentials(email, input.topologyId);
  });
}

export async function deleteDeviceCredential(email: string, credentialId: string) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  const [credential] = await sql<DeviceCredentialRow[]>`
    select id, topology_id, project_device_id, kind, username_masked, secret_masked,
      key_version, last_rotated_at, created_at, updated_at
    from device_credentials
    where id = ${credentialId} and project_device_id is not null
  `;
  if (!credential) throw new Error("Credential not found.");
  const topology = await readTopology(sql, credential.topology_id);
  if (!topology || !canWriteTopology(currentUser, topology)) {
    throw new Error("Permission denied: cannot delete credentials for this topology.");
  }
  if (!await hasPermission(sql, currentUser, "credential.write")) {
    throw new Error("Permission denied: this role cannot write credentials.");
  }

  await sql.begin(async (tx) => {
    await tx`delete from device_credentials where id = ${credentialId}`;
    await writeAuditLog(tx, {
      actorUserId: currentUser.id,
      action: "credential.delete",
      entityType: "device_credential",
      entityId: credential.id,
      siteId: topology.siteId,
      customerId: topology.customerId,
      topologyId: topology.id,
      metadata: { projectDeviceId: credential.project_device_id, kind: credential.kind },
    });
  });

  return readDeviceCredentials(email, credential.topology_id);
  });
}

export async function readAuditLogs(email: string, requestedLimit = 100) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  if (!await hasPermission(sql, currentUser, "audit.read")) {
    throw new Error("Permission denied: this role cannot read audit logs.");
  }
  const limit = Math.max(1, Math.min(200, Math.trunc(requestedLimit)));
  const rows = await sql<AuditLogRow[]>`
    select id, actor_user_id, action, entity_type, entity_id, site_id,
      customer_id, topology_id, metadata, created_at
    from audit_logs
    order by created_at desc
    limit ${limit}
  `;
  return rows.map(mapAuditLog);
  });
}

export async function createCustomer(email: string, name: string, siteId?: string) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  assertCanCreate(currentUser);
  const nextSiteId = defaultSiteFor(currentUser, siteId);
  if (!nextSiteId) throw new Error("A site is required before creating topology data.");
  const timestamp = nowIso();
  const customer: CustomerRecord = {
    id: uid("customer"),
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const topology: TopologyRecord = {
    id: uid("topology"),
    customerId: customer.id,
    siteId: nextSiteId,
    ownerUserId: currentUser.id,
    createdByUserId: currentUser.id,
    updatedByUserId: currentUser.id,
    name: "現況拓樸",
    versionLabel: "v1",
    project: cloneProject(EMPTY_PROJECT),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await sql.begin(async (tx) => {
    await tx`
      insert into customers (id, name, created_at, updated_at)
      values (${customer.id}, ${customer.name}, ${customer.createdAt}, ${customer.updatedAt})
    `;
    await tx`
      insert into topologies (id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at)
      values (${topology.id}, ${topology.customerId}, ${nextSiteId}, ${currentUser.id}, ${currentUser.id}, ${currentUser.id}, ${topology.name}, ${topology.versionLabel}, ${tx.json(topology.project)}, ${topology.createdAt}, ${topology.updatedAt})
    `;
    await writeAuditLog(tx, {
      actorUserId: currentUser.id,
      action: "customer.create",
      entityType: "customer",
      entityId: customer.id,
      siteId: nextSiteId,
      customerId: customer.id,
      metadata: { name: customer.name },
    });
    await writeAuditLog(tx, {
      actorUserId: currentUser.id,
      action: "topology.create",
      entityType: "topology",
      entityId: topology.id,
      siteId: nextSiteId,
      customerId: customer.id,
      topologyId: topology.id,
      metadata: { name: topology.name, versionLabel: topology.versionLabel, source: "customer.create" },
    });
  });

  return readTopologyDataset(email);
  });
}

export async function createTopology(email: string, customerId: string, name: string, project: Project, siteId?: string) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  assertCanCreate(currentUser);
  const nextSiteId = defaultSiteFor(currentUser, siteId);
  if (!nextSiteId) throw new Error("A site is required before creating topology data.");
  const [{ count }] = await sql<{ count: string }[]>`
    select count(*)::text as count from topologies where customer_id = ${customerId}
  `;
  const validatedProject = validateProject(project);
  const timestamp = nowIso();
  const topology: TopologyRecord = {
    id: uid("topology"),
    customerId,
    siteId: nextSiteId,
    ownerUserId: currentUser.id,
    createdByUserId: currentUser.id,
    updatedByUserId: currentUser.id,
    name,
    versionLabel: `v${Number(count) + 1}`,
    project: cloneProject(validatedProject),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await sql.begin(async (tx) => {
    await tx`
      insert into topologies (id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at)
      values (${topology.id}, ${topology.customerId}, ${nextSiteId}, ${currentUser.id}, ${currentUser.id}, ${currentUser.id}, ${topology.name}, ${topology.versionLabel}, ${tx.json(topology.project)}, ${topology.createdAt}, ${topology.updatedAt})
    `;
    await writeAuditLog(tx, {
      actorUserId: currentUser.id,
      action: "topology.create",
      entityType: "topology",
      entityId: topology.id,
      siteId: nextSiteId,
      customerId: topology.customerId,
      topologyId: topology.id,
      metadata: {
        name: topology.name,
        versionLabel: topology.versionLabel,
        deviceCount: topology.project.devices.length,
        linkCount: topology.project.links.length,
        groupCount: topology.project.groups.length,
      },
    });
  });
  return readTopologyDataset(email);
  });
}

export async function saveTopologyProject(email: string, topologyId: string, project: Project) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  const topology = await readTopology(sql, topologyId);
  if (!topology || !canWriteTopology(currentUser, topology)) throw new Error("Permission denied: cannot edit this topology.");
  const validatedProject = validateProject(project);
  const timestamp = nowIso();
  await sql.begin(async (tx) => {
    await tx`
      update topologies
      set project = ${tx.json(validatedProject)}, updated_by_user_id = ${currentUser.id}, updated_at = ${timestamp}
      where id = ${topologyId}
    `;
    const retainedDeviceIds = new Set(validatedProject.devices.map((device) => device.id));
    const credentials = await tx<DeviceCredentialRow[]>`
      select id, topology_id, project_device_id, kind, username_masked, secret_masked,
        key_version, last_rotated_at, created_at, updated_at
      from device_credentials
      where topology_id = ${topologyId} and project_device_id is not null
    `;
    for (const credential of credentials) {
      if (retainedDeviceIds.has(credential.project_device_id)) continue;
      await tx`delete from device_credentials where id = ${credential.id}`;
      await writeAuditLog(tx, {
        actorUserId: currentUser.id,
        action: "credential.delete",
        entityType: "device_credential",
        entityId: credential.id,
        siteId: topology.siteId,
        customerId: topology.customerId,
        topologyId: topology.id,
        metadata: {
          projectDeviceId: credential.project_device_id,
          kind: credential.kind,
          reason: "device-removed-from-project",
        },
      });
    }
    await writeAuditLog(tx, {
      actorUserId: currentUser.id,
      action: "topology.project.save",
      entityType: "topology",
      entityId: topology.id,
      siteId: topology.siteId,
      customerId: topology.customerId,
      topologyId: topology.id,
      metadata: {
        deviceCount: validatedProject.devices.length,
        linkCount: validatedProject.links.length,
        groupCount: validatedProject.groups.length,
      },
    });
  });
  return readTopologyDataset(email);
  });
}

export async function renameCustomer(email: string, customerId: string, name: string) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  const [customer] = await sql<CustomerRow[]>`
    select id, name, notes, created_at, updated_at from customers where id = ${customerId}
  `;
  if (!customer) throw new Error("Customer not found.");
  const topologies = await sql<TopologyRow[]>`
    select id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at
    from topologies
    where customer_id = ${customerId}
  `;
  if (!topologies.map(mapTopology).some((topology) => canWriteTopology(currentUser, topology))) {
    throw new Error("Permission denied: cannot rename this customer.");
  }
  const writableTopologies = topologies.map(mapTopology).filter((topology) => canWriteTopology(currentUser, topology));
  await sql.begin(async (tx) => {
    await tx`
      update customers
      set name = ${name}, updated_at = ${nowIso()}
      where id = ${customerId}
    `;
    await writeAuditLog(tx, {
      actorUserId: currentUser.id,
      action: "customer.rename",
      entityType: "customer",
      entityId: customerId,
      siteId: writableTopologies[0]?.siteId,
      customerId,
      metadata: { previousName: customer.name, nextName: name },
    });
  });
  return readTopologyDataset(email);
  });
}

export async function renameTopology(email: string, topologyId: string, name: string) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  const topology = await readTopology(sql, topologyId);
  if (!topology || !canWriteTopology(currentUser, topology)) throw new Error("Permission denied: cannot rename this topology.");
  await sql.begin(async (tx) => {
    await tx`
      update topologies
      set name = ${name}, updated_by_user_id = ${currentUser.id}, updated_at = ${nowIso()}
      where id = ${topologyId}
    `;
    await writeAuditLog(tx, {
      actorUserId: currentUser.id,
      action: "topology.rename",
      entityType: "topology",
      entityId: topology.id,
      siteId: topology.siteId,
      customerId: topology.customerId,
      topologyId: topology.id,
      metadata: { previousName: topology.name, nextName: name },
    });
  });
  return readTopologyDataset(email);
  });
}

export async function duplicateCustomer(email: string, customerId: string) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  assertCanCreate(currentUser);
  const [sourceCustomer] = await sql<CustomerRow[]>`
    select id, name, notes, created_at, updated_at from customers where id = ${customerId}
  `;
  if (!sourceCustomer) return readTopologyDataset(email);
  const sourceTopologies = (await sql<TopologyRow[]>`
    select id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at
    from topologies
    where customer_id = ${customerId}
    order by updated_at desc
  `).map(mapTopology).filter((topology) => canReadTopology(currentUser, topology));
  if (sourceTopologies.length === 0) throw new Error("Permission denied: no readable topology to duplicate.");
  const timestamp = nowIso();
  const nextCustomer: CustomerRecord = {
    id: uid("customer"),
    name: `${sourceCustomer.name} 複本`,
    notes: sourceCustomer.notes ?? undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await sql.begin(async (tx) => {
    await tx`
      insert into customers (id, name, notes, created_at, updated_at)
      values (${nextCustomer.id}, ${nextCustomer.name}, ${nextCustomer.notes ?? null}, ${nextCustomer.createdAt}, ${nextCustomer.updatedAt})
    `;
    await writeAuditLog(tx, {
      actorUserId: currentUser.id,
      action: "customer.duplicate",
      entityType: "customer",
      entityId: nextCustomer.id,
      siteId: sourceTopologies[0]?.siteId,
      customerId: nextCustomer.id,
      metadata: { sourceCustomerId: customerId, topologyCount: sourceTopologies.length },
    });
    for (const source of sourceTopologies) {
      const copiedTopologyId = uid("topology");
      await tx`
        insert into topologies (id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at)
        values (${copiedTopologyId}, ${nextCustomer.id}, ${source.siteId ?? defaultSiteFor(currentUser)}, ${currentUser.id}, ${currentUser.id}, ${currentUser.id}, ${source.name}, ${source.versionLabel}, ${tx.json(source.project)}, ${timestamp}, ${timestamp})
      `;
      await writeAuditLog(tx, {
        actorUserId: currentUser.id,
        action: "topology.duplicate",
        entityType: "topology",
        entityId: copiedTopologyId,
        siteId: source.siteId ?? defaultSiteFor(currentUser),
        customerId: nextCustomer.id,
        topologyId: copiedTopologyId,
        metadata: { sourceTopologyId: source.id, sourceCustomerId: customerId },
      });
    }
  });

  return readTopologyDataset(email);
  });
}

export async function duplicateTopology(email: string, topologyId: string) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  assertCanCreate(currentUser);
  const source = await readTopology(sql, topologyId);
  if (!source || !canReadTopology(currentUser, source)) throw new Error("Permission denied: cannot duplicate this topology.");
  const [{ count }] = await sql<{ count: string }[]>`
    select count(*)::text as count from topologies where customer_id = ${source.customerId}
  `;
  const timestamp = nowIso();
  await sql.begin(async (tx) => {
    await tx`
      insert into topologies (id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at)
    values (${uid("topology")}, ${source.customerId}, ${source.siteId ?? defaultSiteFor(currentUser)}, ${currentUser.id}, ${currentUser.id}, ${currentUser.id}, ${`${source.name} 複本`}, ${`v${Number(count) + 1}`}, ${sql.json(source.project)}, ${timestamp}, ${timestamp})
    `;
    const [created] = await tx<{ id: string }[]>`
      select id from topologies
      where customer_id = ${source.customerId}
        and created_by_user_id = ${currentUser.id}
        and created_at = ${timestamp}
      order by id desc
      limit 1
    `;
    await writeAuditLog(tx, {
      actorUserId: currentUser.id,
      action: "topology.duplicate",
      entityType: "topology",
      entityId: created.id,
      siteId: source.siteId ?? defaultSiteFor(currentUser),
      customerId: source.customerId,
      topologyId: created.id,
      metadata: { sourceTopologyId: source.id },
    });
  });
  return readTopologyDataset(email);
  });
}

export async function deleteCustomer(email: string, customerId: string) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  if (currentUser.role !== "boss") throw new Error("Permission denied: only boss can delete customers.");
  const [customer] = await sql<CustomerRow[]>`
    select id, name, notes, created_at, updated_at from customers where id = ${customerId}
  `;
  if (!customer) throw new Error("Customer not found.");
  const [scope] = await sql<{ site_id: string | null }[]>`
    select site_id from topologies where customer_id = ${customerId} order by updated_at desc limit 1
  `;
  await sql.begin(async (tx) => {
    await writeAuditLog(tx, {
      actorUserId: currentUser.id,
      action: "customer.delete",
      entityType: "customer",
      entityId: customer.id,
      siteId: scope?.site_id ?? undefined,
      customerId: customer.id,
      metadata: { name: customer.name },
    });
    await tx`delete from customers where id = ${customerId}`;
  });
  const dataset = await readTopologyDataset(email);
  if (dataset.customers.length > 0 && dataset.topologies.length > 0) return dataset;
  await createCustomer(email, "示範客戶", defaultSiteFor(currentUser));
  return readTopologyDataset(email);
  });
}

export async function deleteTopology(email: string, topologyId: string) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  const source = await readTopology(sql, topologyId);
  if (!source || !canWriteTopology(currentUser, source)) throw new Error("Permission denied: cannot delete this topology.");
  await sql.begin(async (tx) => {
    await writeAuditLog(tx, {
      actorUserId: currentUser.id,
      action: "topology.delete",
      entityType: "topology",
      entityId: source.id,
      siteId: source.siteId,
      customerId: source.customerId,
      topologyId: source.id,
      metadata: { name: source.name, versionLabel: source.versionLabel },
    });
    await tx`delete from topologies where id = ${topologyId}`;
    const [{ count }] = await tx<{ count: string }[]>`
      select count(*)::text as count from topologies where customer_id = ${source.customerId}
    `;
    if (Number(count) === 0) {
      const timestamp = nowIso();
      await tx`
      insert into topologies (id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at)
      values (${uid("topology")}, ${source.customerId}, ${source.siteId ?? defaultSiteFor(currentUser)}, ${currentUser.id}, ${currentUser.id}, ${currentUser.id}, ${"現況拓樸"}, ${"v1"}, ${sql.json(EMPTY_PROJECT)}, ${timestamp}, ${timestamp})
      `;
      const [replacement] = await tx<{ id: string }[]>`
        select id from topologies
        where customer_id = ${source.customerId} and created_at = ${timestamp}
        order by id desc limit 1
      `;
      await writeAuditLog(tx, {
        actorUserId: currentUser.id,
        action: "topology.create",
        entityType: "topology",
        entityId: replacement.id,
        siteId: source.siteId ?? defaultSiteFor(currentUser),
        customerId: source.customerId,
        topologyId: replacement.id,
        metadata: { source: "last-topology-deleted", versionLabel: "v1" },
      });
    }
  });
  return readTopologyDataset(email);
  });
}
