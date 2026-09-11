import { type Sql, type TransactionSql } from "postgres";
import { encryptCredentialEnvelope } from "./credential-crypto.ts";
import { createRuntimeSql } from "./postgres-connection.ts";
import { assertPostgresSchemaReady } from "./postgres-schema-check.ts";
import { loadActiveUser, loadCustomer, loadSite, loadTopology } from "./topology-scope.ts";
import {
  canCreateTopology as policyCanCreateTopology,
  canReadTopology as policyCanReadTopology,
  canWriteCustomer,
  canWriteTopology as policyCanWriteTopology,
  roleCanReadAudit,
  rolePermissions as policyRolePermissions,
} from "../app/lib/server/rbac-policy.ts";
import type { IdentitySource } from "../app/lib/server/request-identity.ts";
import { canPilotEngineerCreateSyntheticCustomer, isPilotSubjectBound, pilotAuditMetadata } from "../app/lib/server/pilot-policy.ts";
import { pilotSiteId, type PilotPrincipal } from "../app/lib/server/pilot-session.ts";
import { stripProjectCredentials, validateProject } from "../app/lib/topology-validation.ts";
import {
  cloneProject,
  EMPTY_PROJECT,
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
} from "../app/lib/topology-types.ts";

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
  identitySource?: IdentitySource;
  action: string;
  entityType: string;
  entityId?: string;
  siteId?: string;
  customerId?: string;
  topologyId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type RepositoryContext = {
  identitySource?: IdentitySource;
  pilotPrincipal?: PilotPrincipal;
};

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
  const sql = createRuntimeSql();
  try {
    await assertPostgresSchemaReady(sql);
    return await operation(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function seedDemoDatabase() {
  const sql = createRuntimeSql();
  try {
    await assertPostgresSchemaReady(sql, true);
    await seedOrganization(sql);
    await seedIfEmpty(sql);
    await seedSeanSpineLeafDemo(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function seedOrganization(sql: Sql) {
  const timestamp = nowIso();
  const northOneId = "site-north-1";
  const northTwoId = "site-north-2";
  const users = [
    { id: "user-sean-sie", email: "sean.sie@dus.local", name: "Sean Sie", role: "engineer" as RoleCode, siteIds: [northOneId, northTwoId] },
    { id: "user-boss-manner", email: "manner@company.local", name: "manner", role: "boss" as RoleCode, siteIds: [northOneId, northTwoId] },
    { id: "user-manager-north-1", email: "north1.manager@company.local", name: "North 1 Manager", role: "site_manager" as RoleCode, siteIds: [northOneId] },
    { id: "user-manager-north-2", email: "north2.manager@company.local", name: "North 2 Manager", role: "site_manager" as RoleCode, siteIds: [northTwoId] },
    { id: "user-engineer-demo", email: "engineer@company.local", name: "Demo Engineer", role: "engineer" as RoleCode, siteIds: [northOneId] },
    { id: "user-sales-demo", email: "sales@company.local", name: "Sales Procurement", role: "sales_procurement" as RoleCode, siteIds: [northOneId, northTwoId] },
  ];

  await sql.begin(async (tx) => {
    await tx`
      insert into sites (id, name, created_at, updated_at)
      values
        (${northOneId}, ${"North 1"}, ${timestamp}, ${timestamp}),
        (${northTwoId}, ${"North 2"}, ${timestamp}, ${timestamp})
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
  const { SAMPLE_PROJECT } = await import("../app/lib/topology-types.ts");
  const [{ count }] = await sql<{ count: string }[]>`select count(*)::text as count from customers`;
  if (Number(count) > 0) return;

  const timestamp = nowIso();
  const customer: CustomerRecord = {
    id: uid("customer"),
    name: "Demo Customer",
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
    name: "????祈璆???",
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
  const {
    SEAN_SPINE_LEAF_PROJECT,
    SEAN_SPINE_LEAF_TOPOLOGY_ID,
    SEAN_SPINE_LEAF_TOPOLOGY_NAME,
  } = await import("../app/lib/demo-topologies.ts");
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
  const user = await loadActiveUser(sql, email);
  if (!user) throw new Error("Authentication required.");
  return user;
}

function rolePermissions(user: UserRecord) {
  return policyRolePermissions(user);
}

function canReadTopology(user: UserRecord, topology: TopologyRecord) {
  return policyCanReadTopology(user, topology);
}

function canWriteTopology(user: UserRecord, topology: TopologyRecord) {
  return policyCanWriteTopology(user, topology);
}

function assertCanWriteCustomer(user: UserRecord) {
  if (!canWriteCustomer(user)) throw new Error("Permission denied: this role cannot mutate customers.");
}

function assertCanCreateTopology(user: UserRecord, targetSiteId: string) {
  if (!policyCanCreateTopology(user, targetSiteId)) throw new Error("Permission denied: cannot create topology for this site.");
}

function isPilotContext(context?: RepositoryContext | IdentitySource) {
  return typeof context === "string" ? context === "pilot-session" : context?.identitySource === "pilot-session";
}

function normalizeRepositoryContext(context?: RepositoryContext | IdentitySource): RepositoryContext {
  return typeof context === "string" ? { identitySource: context } : (context ?? {});
}

function assertPilotSite(siteId: string | undefined | null, context?: RepositoryContext | IdentitySource) {
  if (isPilotContext(context) && siteId !== pilotSiteId()) throw new Error("Resource not found.");
}

export function assertPilotRepositorySubject(user: UserRecord, context?: RepositoryContext | IdentitySource) {
  if (!isPilotContext(context)) return;
  const principal = normalizeRepositoryContext(context).pilotPrincipal;
  if (!principal || !isPilotSubjectBound(user, principal, pilotSiteId())) {
    throw new Error("Authentication required.");
  }
}

function pilotReadableTopology(user: UserRecord, topology: TopologyRecord, context?: RepositoryContext | IdentitySource) {
  if (isPilotContext(context) && topology.siteId !== pilotSiteId()) return false;
  return canReadTopology(user, topology);
}

function pilotWritableTopology(user: UserRecord, topology: TopologyRecord, context?: RepositoryContext | IdentitySource) {
  if (isPilotContext(context) && topology.siteId !== pilotSiteId()) return false;
  return canWriteTopology(user, topology);
}

async function customerVisibleInPilotSite(sql: Sql | TransactionSql, customerId: string) {
  const [{ visible }] = await sql<{ visible: boolean }[]>`
    select exists (
      select 1 from topologies
      where customer_id = ${customerId} and site_id = ${pilotSiteId()}
    ) as visible
  `;
  return visible;
}

async function customerIsPilotOnly(sql: Sql | TransactionSql, customerId: string) {
  const [{ allowed }] = await sql<{ allowed: boolean }[]>`
    select
      exists (
        select 1 from topologies
        where customer_id = ${customerId} and site_id = ${pilotSiteId()}
      )
      and not exists (
        select 1 from topologies
        where customer_id = ${customerId} and (site_id is distinct from ${pilotSiteId()})
      ) as allowed
  `;
  return allowed;
}

async function assertPilotOnlyCustomer(sql: Sql | TransactionSql, customerId: string, context: RepositoryContext = {}) {
  if (isPilotContext(context) && !await customerIsPilotOnly(sql, customerId)) throw new Error("Resource not found.");
}

export function isPilotOnlyCustomerScope(siteIds: Array<string | null | undefined>, siteId = pilotSiteId()) {
  return siteIds.some((candidate) => candidate === siteId) && siteIds.every((candidate) => candidate === siteId);
}

async function hasPermission(sql: Sql | TransactionSql, user: UserRecord, permissionCode: string) {
  const [{ allowed }] = await sql<{ allowed: boolean }[]>`
    select exists (
      select 1 from role_permissions
      where role_code = ${user.role} and permission_code = ${permissionCode}
    ) as allowed
  `;
  return allowed;
}

async function writeAuditLog(tx: TransactionSql, entry: AuditEntry) {
  const metadata = entry.identitySource
    ? { ...(entry.metadata ?? {}), identitySource: entry.identitySource }
    : entry.metadata ?? {};
  await tx`
    insert into audit_logs (
      id, actor_user_id, action, entity_type, entity_id,
      site_id, customer_id, topology_id, metadata, created_at
    ) values (
      ${uid("audit")}, ${entry.actorUserId}, ${entry.action}, ${entry.entityType}, ${entry.entityId ?? null},
      ${entry.siteId ?? null}, ${entry.customerId ?? null}, ${entry.topologyId ?? null},
      ${tx.json(metadata)}, ${nowIso()}
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

export async function readTopologyDataset(email: string, context?: RepositoryContext | IdentitySource): Promise<TopologyDataset> {
  return withReadySql(async (sql) => {
  const repositoryContext = normalizeRepositoryContext(context);
  const currentUser = await getCurrentUser(sql, email);
  assertPilotRepositorySubject(currentUser, repositoryContext);
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
  const readableTopologies = topologies.map(mapTopology).filter((topology) => pilotReadableTopology(currentUser, topology, repositoryContext));
  const readableCustomerIds = new Set(readableTopologies.map((topology) => topology.customerId));
  const readableSites = isPilotContext(repositoryContext)
    ? (await readAllSites(sql)).filter((site) => site.id === pilotSiteId())
    : await readAllSites(sql);
  return {
    customers: sortByUpdatedAt(customers.map(mapCustomer).filter((customer) =>
      isPilotContext(repositoryContext) ? readableCustomerIds.has(customer.id) : rolePermissions(currentUser).canReadAll || readableCustomerIds.has(customer.id),
    )),
    topologies: sortByUpdatedAt(readableTopologies),
    sites: readableSites,
    currentUser,
    permissions: rolePermissions(currentUser),
  };
  });
}

export async function readDeviceCredentials(email: string, topologyId: string, context?: RepositoryContext | IdentitySource) {
  return withReadySql(async (sql) => {
  const repositoryContext = normalizeRepositoryContext(context);
  const currentUser = await getCurrentUser(sql, email);
  assertPilotRepositorySubject(currentUser, repositoryContext);
  const topology = await readTopology(sql, topologyId);
  if (!topology || !pilotReadableTopology(currentUser, topology, repositoryContext)) {
    throw new Error("Resource not found.");
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

export async function upsertDeviceCredential(email: string, input: DeviceCredentialWriteInput, context?: RepositoryContext | IdentitySource) {
  return withReadySql(async (sql) => {
  const repositoryContext = normalizeRepositoryContext(context);
  const currentUser = await getCurrentUser(sql, email);
  assertPilotRepositorySubject(currentUser, repositoryContext);
  const topology = await readTopology(sql, input.topologyId);
  if (!topology || !pilotReadableTopology(currentUser, topology, repositoryContext)) {
    throw new Error("Resource not found.");
  }
  if (!pilotWritableTopology(currentUser, topology, repositoryContext)) {
    throw new Error("Permission denied: this role cannot write this topology.");
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
    const txUser = await loadActiveUser(tx, email);
    if (!txUser) throw new Error("Authentication required.");
    assertPilotRepositorySubject(txUser, repositoryContext);
    const lockedTopology = await loadTopology(tx, input.topologyId, true);
    if (!lockedTopology || !pilotReadableTopology(txUser, lockedTopology, repositoryContext)) throw new Error("Resource not found.");
    if (!pilotWritableTopology(txUser, lockedTopology, repositoryContext)) {
      throw new Error("Permission denied: this role cannot write this topology.");
    }
    if (!await hasPermission(tx, txUser, "credential.write")) {
      throw new Error("Permission denied: this role cannot write credentials.");
    }
    if (!lockedTopology.project.devices.some((device) => device.id === input.projectDeviceId)) {
      throw new Error(`Credential device "${input.projectDeviceId}" does not exist in this topology.`);
    }
    const [saved] = await tx<{ id: string }[]>`
      insert into device_credentials (
        id, topology_id, device_id, project_device_id, kind,
        username_masked, username_ciphertext, secret_masked, secret_ciphertext,
        secret_nonce, key_version, created_by_user_id, updated_by_user_id,
        last_rotated_at, created_at, updated_at
      ) values (
        ${uid("credential")}, ${input.topologyId}, ${null}, ${input.projectDeviceId}, ${input.kind},
        ${encrypted.usernameMasked ?? null}, ${null}, ${encrypted.secretMasked}, ${encrypted.secretCiphertext},
        ${encrypted.secretNonce}, ${encrypted.keyVersion}, ${txUser.id}, ${txUser.id},
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
      actorUserId: txUser.id,
      action: "credential.upsert",
      entityType: "device_credential",
      entityId: saved.id,
      siteId: lockedTopology.siteId,
      customerId: lockedTopology.customerId,
      topologyId: lockedTopology.id,
      metadata: { projectDeviceId: input.projectDeviceId, kind: input.kind, keyVersion: encrypted.keyVersion },
    });
  });

  return readDeviceCredentials(email, input.topologyId, repositoryContext);
  });
}

export async function deleteDeviceCredential(email: string, credentialId: string, context?: RepositoryContext | IdentitySource) {
  return withReadySql(async (sql) => {
  const repositoryContext = normalizeRepositoryContext(context);
  const currentUser = await getCurrentUser(sql, email);
  assertPilotRepositorySubject(currentUser, repositoryContext);
  const [credential] = await sql<DeviceCredentialRow[]>`
    select id, topology_id, project_device_id, kind, username_masked, secret_masked,
      key_version, last_rotated_at, created_at, updated_at
    from device_credentials
    where id = ${credentialId} and project_device_id is not null
  `;
  if (!credential) throw new Error("Credential not found.");
  const topology = await readTopology(sql, credential.topology_id);
  if (!topology || !pilotReadableTopology(currentUser, topology, repositoryContext)) {
    throw new Error("Resource not found.");
  }
  if (!pilotWritableTopology(currentUser, topology, repositoryContext)) {
    throw new Error("Permission denied: this role cannot write this topology.");
  }
  if (!await hasPermission(sql, currentUser, "credential.write")) {
    throw new Error("Permission denied: this role cannot write credentials.");
  }

  await sql.begin(async (tx) => {
    const txUser = await loadActiveUser(tx, email);
    if (!txUser) throw new Error("Authentication required.");
    assertPilotRepositorySubject(txUser, repositoryContext);
    const lockedTopology = await loadTopology(tx, credential.topology_id, true);
    if (!lockedTopology || !pilotReadableTopology(txUser, lockedTopology, repositoryContext)) throw new Error("Resource not found.");
    if (!pilotWritableTopology(txUser, lockedTopology, repositoryContext)) {
      throw new Error("Permission denied: this role cannot write this topology.");
    }
    if (!await hasPermission(tx, txUser, "credential.write")) {
      throw new Error("Permission denied: this role cannot write credentials.");
    }
    await tx`delete from device_credentials where id = ${credentialId}`;
    await writeAuditLog(tx, {
      actorUserId: txUser.id,
      action: "credential.delete",
      entityType: "device_credential",
      entityId: credential.id,
      siteId: lockedTopology.siteId,
      customerId: lockedTopology.customerId,
      topologyId: lockedTopology.id,
      metadata: { projectDeviceId: credential.project_device_id, kind: credential.kind },
    });
  });

  return readDeviceCredentials(email, credential.topology_id, repositoryContext);
  });
}

export async function readAuditLogs(email: string, requestedLimit = 100, context?: RepositoryContext | IdentitySource) {
  return withReadySql(async (sql) => {
  const repositoryContext = normalizeRepositoryContext(context);
  const currentUser = await getCurrentUser(sql, email);
  assertPilotRepositorySubject(currentUser, repositoryContext);
  if (!roleCanReadAudit(currentUser.role) || !await hasPermission(sql, currentUser, "audit.read")) {
    throw new Error("Permission denied: this role cannot read audit logs.");
  }
  const limit = Math.max(1, Math.min(200, Math.trunc(requestedLimit)));
  const rows = isPilotContext(repositoryContext)
    ? await sql<AuditLogRow[]>`
    select id, actor_user_id, action, entity_type, entity_id, site_id,
      customer_id, topology_id, metadata, created_at
    from audit_logs
    where site_id = ${pilotSiteId()}
    order by created_at desc
    limit ${limit}
  `
    : await sql<AuditLogRow[]>`
    select id, actor_user_id, action, entity_type, entity_id, site_id,
      customer_id, topology_id, metadata, created_at
    from audit_logs
    order by created_at desc
    limit ${limit}
  `;
  return rows.map(mapAuditLog);
  });
}

type CreateCustomerOptions = {
  identitySource?: IdentitySource;
  pilotPrincipal?: PilotPrincipal;
  synthetic?: boolean;
};

function canCreateCustomerForContext(user: UserRecord, options: CreateCustomerOptions, siteId: string) {
  if (canWriteCustomer(user)) return true;
  return options.identitySource === "pilot-session" &&
    options.synthetic === true &&
    canPilotEngineerCreateSyntheticCustomer(user, options.pilotPrincipal, siteId);
}

export async function loadPilotSessionUser(email: string) {
  return withReadySql(async (sql) => getCurrentUser(sql, email));
}

export async function createCustomer(email: string, name: string, siteId?: string, options: CreateCustomerOptions = {}) {
  return withReadySql(async (sql) => {
  const initialUser = await getCurrentUser(sql, email);
  assertPilotRepositorySubject(initialUser, options);
  if (isPilotContext(options) && siteId && siteId !== pilotSiteId()) throw new Error("Resource not found.");
  const nextSiteId = options.identitySource === "pilot-session" ? (siteId || pilotSiteId()) : defaultSiteFor(initialUser, siteId);
  if (!nextSiteId) throw new Error("A site is required before creating topology data.");
  if (!canCreateCustomerForContext(initialUser, options, nextSiteId)) {
    throw new Error("Permission denied: this role cannot mutate customers.");
  }
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
    ownerUserId: initialUser.id,
    createdByUserId: initialUser.id,
    updatedByUserId: initialUser.id,
    name: options.synthetic ? "Pilot Topology" : "Default Topology",
    versionLabel: "v1",
    project: cloneProject(EMPTY_PROJECT),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await sql.begin(async (tx) => {
    const currentUser = await loadActiveUser(tx, email);
    if (!currentUser) throw new Error("Authentication required.");
    assertPilotRepositorySubject(currentUser, options);
    if (!canCreateCustomerForContext(currentUser, options, nextSiteId)) {
      throw new Error("Permission denied: this role cannot mutate customers.");
    }
    if (!await loadSite(tx, nextSiteId)) throw new Error("Resource not found.");
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
      identitySource: options.identitySource,
      metadata: options.synthetic && options.pilotPrincipal
        ? pilotAuditMetadata(options.pilotPrincipal, { name: customer.name, synthetic: true })
        : { name: customer.name },
    });
    await writeAuditLog(tx, {
      actorUserId: currentUser.id,
      action: "topology.create",
      entityType: "topology",
      entityId: topology.id,
      siteId: nextSiteId,
      customerId: customer.id,
      topologyId: topology.id,
      identitySource: options.identitySource,
      metadata: options.synthetic && options.pilotPrincipal
        ? pilotAuditMetadata(options.pilotPrincipal, { name: topology.name, versionLabel: topology.versionLabel, synthetic: true })
        : { name: topology.name, versionLabel: topology.versionLabel, source: "customer.create" },
    });
  });

  return readTopologyDataset(email, options);
  });
}

async function canUseCustomerForTopologyCreate(sql: Sql | TransactionSql, user: UserRecord, customerId: string, targetSiteId: string, context: RepositoryContext = {}) {
  if (user.role === "boss" && !isPilotContext(context)) return true;
  const rows = await sql<TopologyRow[]>`
    select id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at
    from topologies
    where customer_id = ${customerId} and site_id = ${targetSiteId}
  `;
  return rows.map(mapTopology).some((topology) => canReadTopology(user, topology));
}

export async function createTopology(email: string, customerId: string, name: string, project: Project, siteId?: string, context: RepositoryContext = {}) {
  return withReadySql(async (sql) => {
  const initialUser = await getCurrentUser(sql, email);
  assertPilotRepositorySubject(initialUser, context);
  if (isPilotContext(context) && siteId && siteId !== pilotSiteId()) throw new Error("Resource not found.");
  siteId = isPilotContext(context) ? pilotSiteId() : siteId;
  if (!siteId) throw new Error("siteId is required.");
  const targetSiteId = siteId;
  assertPilotSite(targetSiteId, context);
  if (!await loadSite(sql, targetSiteId)) throw new Error("Resource not found.");
  if (!await loadCustomer(sql, customerId)) throw new Error("Resource not found.");
  await assertPilotOnlyCustomer(sql, customerId, context);
  if (!await canUseCustomerForTopologyCreate(sql, initialUser, customerId, targetSiteId, context)) throw new Error("Resource not found.");
  assertCanCreateTopology(initialUser, targetSiteId);
  const validatedProject = validateProject(project);
  const timestamp = nowIso();
  const topology: TopologyRecord = {
    id: uid("topology"),
    customerId,
    siteId: targetSiteId,
    ownerUserId: initialUser.id,
    createdByUserId: initialUser.id,
    updatedByUserId: initialUser.id,
    name,
    versionLabel: "v1",
    project: cloneProject(validatedProject),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await sql.begin(async (tx) => {
    const currentUser = await loadActiveUser(tx, email);
    if (!currentUser) throw new Error("Authentication required.");
    assertPilotRepositorySubject(currentUser, context);
    if (!await loadSite(tx, targetSiteId)) throw new Error("Resource not found.");
    if (!await loadCustomer(tx, customerId)) throw new Error("Resource not found.");
    await assertPilotOnlyCustomer(tx, customerId, context);
    if (!await canUseCustomerForTopologyCreate(tx, currentUser, customerId, targetSiteId, context)) throw new Error("Resource not found.");
    assertCanCreateTopology(currentUser, targetSiteId);
    const [{ count }] = await tx<{ count: string }[]>`
      select count(*)::text as count from topologies where customer_id = ${customerId}
    `;
    const versionLabel = `v${Number(count) + 1}`;
    await tx`
      insert into topologies (id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at)
      values (${topology.id}, ${topology.customerId}, ${targetSiteId}, ${currentUser.id}, ${currentUser.id}, ${currentUser.id}, ${topology.name}, ${versionLabel}, ${tx.json(topology.project)}, ${topology.createdAt}, ${topology.updatedAt})
    `;
    await writeAuditLog(tx, {
      actorUserId: currentUser.id,
      action: "topology.create",
      entityType: "topology",
      entityId: topology.id,
      siteId,
      customerId: topology.customerId,
      topologyId: topology.id,
      metadata: {
        name: topology.name,
        versionLabel,
        deviceCount: topology.project.devices.length,
        linkCount: topology.project.links.length,
        groupCount: topology.project.groups.length,
      },
    });
  });
  return readTopologyDataset(email, context);
  });
}

export async function saveTopologyProject(email: string, topologyId: string, project: Project, context: RepositoryContext = {}) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  assertPilotRepositorySubject(currentUser, context);
  const topology = await readTopology(sql, topologyId);
  if (!topology || !pilotWritableTopology(currentUser, topology, context)) throw new Error("Resource not found.");
  const validatedProject = validateProject(project);
  const timestamp = nowIso();
  await sql.begin(async (tx) => {
    const txUser = await loadActiveUser(tx, email);
    if (!txUser) throw new Error("Authentication required.");
    assertPilotRepositorySubject(txUser, context);
    const lockedTopology = await loadTopology(tx, topologyId, true);
    if (!lockedTopology || !pilotWritableTopology(txUser, lockedTopology, context)) throw new Error("Resource not found.");
    await tx`
      update topologies
      set project = ${tx.json(validatedProject)}, updated_by_user_id = ${txUser.id}, updated_at = ${timestamp}
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
        actorUserId: txUser.id,
        action: "credential.delete",
        entityType: "device_credential",
        entityId: credential.id,
        siteId: lockedTopology.siteId,
        customerId: lockedTopology.customerId,
        topologyId: lockedTopology.id,
        metadata: {
          projectDeviceId: credential.project_device_id,
          kind: credential.kind,
          reason: "device-removed-from-project",
        },
      });
    }
    await writeAuditLog(tx, {
      actorUserId: txUser.id,
      action: "topology.project.save",
      entityType: "topology",
      entityId: lockedTopology.id,
      siteId: lockedTopology.siteId,
      customerId: lockedTopology.customerId,
      topologyId: lockedTopology.id,
      metadata: {
        deviceCount: validatedProject.devices.length,
        linkCount: validatedProject.links.length,
        groupCount: validatedProject.groups.length,
      },
    });
  });
  return readTopologyDataset(email, context);
  });
}

export async function renameCustomer(email: string, customerId: string, name: string, context: RepositoryContext = {}) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  assertPilotRepositorySubject(currentUser, context);
  assertCanWriteCustomer(currentUser);
  await assertPilotOnlyCustomer(sql, customerId, context);
  const customer = await loadCustomer(sql, customerId);
  if (!customer) throw new Error("Resource not found.");
  const topologies = await sql<TopologyRow[]>`
    select id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at
    from topologies
    where customer_id = ${customerId}
  `;
  const writableTopologies = topologies.map(mapTopology).filter((topology) => canWriteTopology(currentUser, topology));
  await sql.begin(async (tx) => {
    const txUser = await loadActiveUser(tx, email);
    if (!txUser) throw new Error("Authentication required.");
    assertPilotRepositorySubject(txUser, context);
    assertCanWriteCustomer(txUser);
    await assertPilotOnlyCustomer(tx, customerId, context);
    const lockedCustomer = await loadCustomer(tx, customerId, true);
    if (!lockedCustomer) throw new Error("Resource not found.");
    await tx`
      update customers
      set name = ${name}, updated_at = ${nowIso()}
      where id = ${customerId}
    `;
    await writeAuditLog(tx, {
      actorUserId: txUser.id,
      action: "customer.rename",
      entityType: "customer",
      entityId: customerId,
      siteId: writableTopologies[0]?.siteId,
      customerId,
      metadata: { previousName: lockedCustomer.name, nextName: name },
    });
  });
  return readTopologyDataset(email, context);
  });
}

export async function renameTopology(email: string, topologyId: string, name: string, context: RepositoryContext = {}) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  assertPilotRepositorySubject(currentUser, context);
  const topology = await readTopology(sql, topologyId);
  if (!topology || !pilotWritableTopology(currentUser, topology, context)) throw new Error("Resource not found.");
  await sql.begin(async (tx) => {
    const txUser = await loadActiveUser(tx, email);
    if (!txUser) throw new Error("Authentication required.");
    assertPilotRepositorySubject(txUser, context);
    const lockedTopology = await loadTopology(tx, topologyId, true);
    if (!lockedTopology || !pilotWritableTopology(txUser, lockedTopology, context)) throw new Error("Resource not found.");
    await tx`
      update topologies
      set name = ${name}, updated_by_user_id = ${txUser.id}, updated_at = ${nowIso()}
      where id = ${topologyId}
    `;
    await writeAuditLog(tx, {
      actorUserId: txUser.id,
      action: "topology.rename",
      entityType: "topology",
      entityId: lockedTopology.id,
      siteId: lockedTopology.siteId,
      customerId: lockedTopology.customerId,
      topologyId: lockedTopology.id,
      metadata: { previousName: lockedTopology.name, nextName: name },
    });
  });
  return readTopologyDataset(email, context);
  });
}

export async function duplicateCustomer(email: string, customerId: string, context: RepositoryContext = {}) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  assertPilotRepositorySubject(currentUser, context);
  assertCanWriteCustomer(currentUser);
  if (isPilotContext(context) && !await customerVisibleInPilotSite(sql, customerId)) throw new Error("Resource not found.");
  const sourceCustomer = await loadCustomer(sql, customerId);
  if (!sourceCustomer) throw new Error("Resource not found.");
  const timestamp = nowIso();
  const nextCustomer: CustomerRecord = {
    id: uid("customer"),
    name: `${sourceCustomer.name} copy`,
    notes: sourceCustomer.notes ?? undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await sql.begin(async (tx) => {
    const txUser = await loadActiveUser(tx, email);
    if (!txUser) throw new Error("Authentication required.");
    assertPilotRepositorySubject(txUser, context);
    assertCanWriteCustomer(txUser);
    await assertPilotOnlyCustomer(tx, customerId, context);
    const lockedCustomer = await loadCustomer(tx, customerId, true);
    if (!lockedCustomer) throw new Error("Resource not found.");
    const sourceTopologies = (await tx<TopologyRow[]>`
      select id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at
      from topologies
      where customer_id = ${customerId}
      order by updated_at desc
    `).map(mapTopology).filter((topology) => !isPilotContext(context) || topology.siteId === pilotSiteId());
    await tx`
      insert into customers (id, name, notes, created_at, updated_at)
      values (${nextCustomer.id}, ${nextCustomer.name}, ${nextCustomer.notes ?? null}, ${nextCustomer.createdAt}, ${nextCustomer.updatedAt})
    `;
    await writeAuditLog(tx, {
      actorUserId: txUser.id,
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
        values (${copiedTopologyId}, ${nextCustomer.id}, ${source.siteId ?? defaultSiteFor(txUser)}, ${txUser.id}, ${txUser.id}, ${txUser.id}, ${source.name}, ${source.versionLabel}, ${tx.json(source.project)}, ${timestamp}, ${timestamp})
      `;
      await writeAuditLog(tx, {
        actorUserId: txUser.id,
        action: "topology.duplicate",
        entityType: "topology",
        entityId: copiedTopologyId,
        siteId: source.siteId ?? defaultSiteFor(txUser),
        customerId: nextCustomer.id,
        topologyId: copiedTopologyId,
        metadata: { sourceTopologyId: source.id, sourceCustomerId: customerId },
      });
    }
  });

  return readTopologyDataset(email, context);
  });
}

export async function duplicateTopology(email: string, topologyId: string, context: RepositoryContext = {}) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  assertPilotRepositorySubject(currentUser, context);
  const source = await readTopology(sql, topologyId);
  if (!source || !source.siteId || !pilotReadableTopology(currentUser, source, context)) throw new Error("Resource not found.");
  assertCanCreateTopology(currentUser, source.siteId);
  const [{ count }] = await sql<{ count: string }[]>`
    select count(*)::text as count from topologies where customer_id = ${source.customerId}
  `;
  const timestamp = nowIso();
  await sql.begin(async (tx) => {
    const txUser = await loadActiveUser(tx, email);
    if (!txUser) throw new Error("Authentication required.");
    assertPilotRepositorySubject(txUser, context);
    const lockedSource = await loadTopology(tx, topologyId, true);
    if (!lockedSource || !lockedSource.siteId || !pilotReadableTopology(txUser, lockedSource, context)) throw new Error("Resource not found.");
    assertCanCreateTopology(txUser, lockedSource.siteId);
    const copiedTopologyId = uid("topology");
    await tx`
      insert into topologies (id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at)
      values (${copiedTopologyId}, ${lockedSource.customerId}, ${lockedSource.siteId}, ${txUser.id}, ${txUser.id}, ${txUser.id}, ${`${lockedSource.name} copy`}, ${`v${Number(count) + 1}`}, ${tx.json(lockedSource.project)}, ${timestamp}, ${timestamp})
    `;
    await writeAuditLog(tx, {
      actorUserId: txUser.id,
      action: "topology.duplicate",
      entityType: "topology",
      entityId: copiedTopologyId,
      siteId: lockedSource.siteId,
      customerId: lockedSource.customerId,
      topologyId: copiedTopologyId,
      metadata: { sourceTopologyId: lockedSource.id },
    });
  });
  return readTopologyDataset(email, context);
  });
}

export async function deleteCustomer(email: string, customerId: string, context: RepositoryContext = {}) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  assertPilotRepositorySubject(currentUser, context);
  assertCanWriteCustomer(currentUser);
  await assertPilotOnlyCustomer(sql, customerId, context);
  const customer = await loadCustomer(sql, customerId);
  if (!customer) throw new Error("Resource not found.");
  const [scope] = await sql<{ site_id: string | null }[]>`
    select site_id from topologies where customer_id = ${customerId} order by updated_at desc limit 1
  `;
  await sql.begin(async (tx) => {
    const txUser = await loadActiveUser(tx, email);
    if (!txUser) throw new Error("Authentication required.");
    assertPilotRepositorySubject(txUser, context);
    assertCanWriteCustomer(txUser);
    await assertPilotOnlyCustomer(tx, customerId, context);
    const lockedCustomer = await loadCustomer(tx, customerId, true);
    if (!lockedCustomer) throw new Error("Resource not found.");
    await writeAuditLog(tx, {
      actorUserId: txUser.id,
      action: "customer.delete",
      entityType: "customer",
      entityId: lockedCustomer.id,
      siteId: scope?.site_id ?? undefined,
      customerId: lockedCustomer.id,
      metadata: { name: lockedCustomer.name },
    });
    await tx`delete from customers where id = ${customerId}`;
  });
  const dataset = await readTopologyDataset(email, context);
  if (dataset.customers.length > 0 && dataset.topologies.length > 0) return dataset;
  return dataset;
  });
}

export async function deleteTopology(email: string, topologyId: string, context: RepositoryContext = {}) {
  return withReadySql(async (sql) => {
  const currentUser = await getCurrentUser(sql, email);
  assertPilotRepositorySubject(currentUser, context);
  const source = await readTopology(sql, topologyId);
  if (!source || !pilotWritableTopology(currentUser, source, context)) throw new Error("Resource not found.");
  await sql.begin(async (tx) => {
    const txUser = await loadActiveUser(tx, email);
    if (!txUser) throw new Error("Authentication required.");
    assertPilotRepositorySubject(txUser, context);
    const lockedSource = await loadTopology(tx, topologyId, true);
    if (!lockedSource || !pilotWritableTopology(txUser, lockedSource, context)) throw new Error("Resource not found.");
    await writeAuditLog(tx, {
      actorUserId: txUser.id,
      action: "topology.delete",
      entityType: "topology",
      entityId: lockedSource.id,
      siteId: lockedSource.siteId,
      customerId: lockedSource.customerId,
      topologyId: lockedSource.id,
      metadata: { name: lockedSource.name, versionLabel: lockedSource.versionLabel },
    });
    await tx`delete from topologies where id = ${topologyId}`;
    const [{ count }] = await tx<{ count: string }[]>`
      select count(*)::text as count from topologies where customer_id = ${lockedSource.customerId}
    `;
    if (Number(count) === 0) {
      const timestamp = nowIso();
      await tx`
      insert into topologies (id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at)
      values (${uid("topology")}, ${lockedSource.customerId}, ${lockedSource.siteId ?? defaultSiteFor(txUser)}, ${txUser.id}, ${txUser.id}, ${txUser.id}, ${"Default Topology"}, ${"v1"}, ${tx.json(EMPTY_PROJECT)}, ${timestamp}, ${timestamp})
      `;
      const [replacement] = await tx<{ id: string }[]>`
        select id from topologies
        where customer_id = ${lockedSource.customerId} and created_at = ${timestamp}
        order by id desc limit 1
      `;
      await writeAuditLog(tx, {
        actorUserId: txUser.id,
        action: "topology.create",
        entityType: "topology",
        entityId: replacement.id,
        siteId: lockedSource.siteId ?? defaultSiteFor(txUser),
        customerId: lockedSource.customerId,
        topologyId: replacement.id,
        metadata: { source: "last-topology-deleted", versionLabel: "v1" },
      });
    }
  });
  return readTopologyDataset(email, context);
  });
}
