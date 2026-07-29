import postgres, { type Sql } from "postgres";
import {
  cloneProject,
  EMPTY_PROJECT,
  SAMPLE_PROJECT,
  type CustomerRecord,
  type Project,
  type RoleCode,
  type SiteRecord,
  type TopologyRecord,
  type UserRecord,
} from "@/app/lib/topology-types";

let sqlClient: Sql | undefined;
let schemaReady: Promise<void> | undefined;

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

function getSql() {
  if (sqlClient) return sqlClient;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required when NEXT_PUBLIC_TOPOLOGY_STORAGE=server.");
  }
  sqlClient = postgres(databaseUrl, {
    max: Number(process.env.POSTGRES_POOL_MAX ?? 10),
    idle_timeout: 20,
    prepare: false,
  });
  return sqlClient;
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
    project: cloneProject(row.project),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function sortByUpdatedAt<T extends { updatedAt: string }>(records: T[]) {
  return [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function ensureSchema() {
  const sql = getSql();
  await sql`
    create table if not exists customers (
      id text primary key,
      name text not null,
      notes text,
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `;
  await sql`
    create table if not exists sites (
      id text primary key,
      name text not null unique,
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `;
  await sql`
    create table if not exists users (
      id text primary key,
      email text not null unique,
      name text not null,
      role text not null,
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `;
  await sql`
    create table if not exists user_sites (
      user_id text not null references users(id) on delete cascade,
      site_id text not null references sites(id) on delete cascade,
      primary key (user_id, site_id)
    )
  `;
  await sql`
    create table if not exists topologies (
      id text primary key,
      customer_id text not null references customers(id) on delete cascade,
      name text not null,
      version_label text not null,
      project jsonb not null,
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `;
  await sql`alter table topologies add column if not exists site_id text references sites(id)`;
  await sql`alter table topologies add column if not exists owner_user_id text references users(id)`;
  await sql`alter table topologies add column if not exists created_by_user_id text references users(id)`;
  await sql`alter table topologies add column if not exists updated_by_user_id text references users(id)`;
  await sql`create index if not exists topologies_customer_id_idx on topologies(customer_id)`;
  await sql`create index if not exists topologies_site_id_idx on topologies(site_id)`;
  await sql`create index if not exists topologies_owner_user_id_idx on topologies(owner_user_id)`;
  await sql`create index if not exists topologies_updated_at_idx on topologies(updated_at desc)`;
}

async function readySql() {
  if (!schemaReady) schemaReady = ensureSchema();
  await schemaReady;
  const sql = getSql();
  await seedOrganization(sql);
  await seedIfEmpty(sql);
  return sql;
}

async function seedOrganization(sql: Sql) {
  const [{ count }] = await sql<{ count: string }[]>`select count(*)::text as count from sites`;
  if (Number(count) > 0) return;

  const timestamp = nowIso();
  const northOneId = "site-north-1";
  const northTwoId = "site-north-2";
  const users = [
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
  const sql = await readySql();
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
}

export async function createCustomer(email: string, name: string, siteId?: string) {
  const sql = await readySql();
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
  });

  return readTopologyDataset(email);
}

export async function createTopology(email: string, customerId: string, name: string, project: Project, siteId?: string) {
  const sql = await readySql();
  const currentUser = await getCurrentUser(sql, email);
  assertCanCreate(currentUser);
  const nextSiteId = defaultSiteFor(currentUser, siteId);
  if (!nextSiteId) throw new Error("A site is required before creating topology data.");
  const [{ count }] = await sql<{ count: string }[]>`
    select count(*)::text as count from topologies where customer_id = ${customerId}
  `;
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
    project: cloneProject(project),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await sql`
    insert into topologies (id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at)
    values (${topology.id}, ${topology.customerId}, ${nextSiteId}, ${currentUser.id}, ${currentUser.id}, ${currentUser.id}, ${topology.name}, ${topology.versionLabel}, ${sql.json(topology.project)}, ${topology.createdAt}, ${topology.updatedAt})
  `;
  return readTopologyDataset(email);
}

export async function saveTopologyProject(email: string, topologyId: string, project: Project) {
  const sql = await readySql();
  const currentUser = await getCurrentUser(sql, email);
  const topology = await readTopology(sql, topologyId);
  if (!topology || !canWriteTopology(currentUser, topology)) throw new Error("Permission denied: cannot edit this topology.");
  await sql`
    update topologies
    set project = ${sql.json(project)}, updated_by_user_id = ${currentUser.id}, updated_at = ${nowIso()}
    where id = ${topologyId}
  `;
  return readTopologyDataset(email);
}

export async function renameCustomer(email: string, customerId: string, name: string) {
  const sql = await readySql();
  const currentUser = await getCurrentUser(sql, email);
  const topologies = await sql<TopologyRow[]>`
    select id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at
    from topologies
    where customer_id = ${customerId}
  `;
  if (!topologies.map(mapTopology).some((topology) => canWriteTopology(currentUser, topology))) {
    throw new Error("Permission denied: cannot rename this customer.");
  }
  await sql`
    update customers
    set name = ${name}, updated_at = ${nowIso()}
    where id = ${customerId}
  `;
  return readTopologyDataset(email);
}

export async function renameTopology(email: string, topologyId: string, name: string) {
  const sql = await readySql();
  const currentUser = await getCurrentUser(sql, email);
  const topology = await readTopology(sql, topologyId);
  if (!topology || !canWriteTopology(currentUser, topology)) throw new Error("Permission denied: cannot rename this topology.");
  await sql`
    update topologies
    set name = ${name}, updated_by_user_id = ${currentUser.id}, updated_at = ${nowIso()}
    where id = ${topologyId}
  `;
  return readTopologyDataset(email);
}

export async function duplicateCustomer(email: string, customerId: string) {
  const sql = await readySql();
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
    for (const source of sourceTopologies) {
      await tx`
        insert into topologies (id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at)
        values (${uid("topology")}, ${nextCustomer.id}, ${source.siteId ?? defaultSiteFor(currentUser)}, ${currentUser.id}, ${currentUser.id}, ${currentUser.id}, ${source.name}, ${source.versionLabel}, ${tx.json(source.project)}, ${timestamp}, ${timestamp})
      `;
    }
  });

  return readTopologyDataset(email);
}

export async function duplicateTopology(email: string, topologyId: string) {
  const sql = await readySql();
  const currentUser = await getCurrentUser(sql, email);
  assertCanCreate(currentUser);
  const source = await readTopology(sql, topologyId);
  if (!source || !canReadTopology(currentUser, source)) throw new Error("Permission denied: cannot duplicate this topology.");
  const [{ count }] = await sql<{ count: string }[]>`
    select count(*)::text as count from topologies where customer_id = ${source.customerId}
  `;
  const timestamp = nowIso();
  await sql`
    insert into topologies (id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at)
    values (${uid("topology")}, ${source.customerId}, ${source.siteId ?? defaultSiteFor(currentUser)}, ${currentUser.id}, ${currentUser.id}, ${currentUser.id}, ${`${source.name} 複本`}, ${`v${Number(count) + 1}`}, ${sql.json(source.project)}, ${timestamp}, ${timestamp})
  `;
  return readTopologyDataset(email);
}

export async function deleteCustomer(email: string, customerId: string) {
  const sql = await readySql();
  const currentUser = await getCurrentUser(sql, email);
  if (currentUser.role !== "boss") throw new Error("Permission denied: only boss can delete customers.");
  await sql`delete from customers where id = ${customerId}`;
  const dataset = await readTopologyDataset(email);
  if (dataset.customers.length > 0 && dataset.topologies.length > 0) return dataset;
  await createCustomer(email, "示範客戶", defaultSiteFor(currentUser));
  return readTopologyDataset(email);
}

export async function deleteTopology(email: string, topologyId: string) {
  const sql = await readySql();
  const currentUser = await getCurrentUser(sql, email);
  const source = await readTopology(sql, topologyId);
  if (!source || !canWriteTopology(currentUser, source)) throw new Error("Permission denied: cannot delete this topology.");
  await sql`delete from topologies where id = ${topologyId}`;
  const [{ count }] = await sql<{ count: string }[]>`
    select count(*)::text as count from topologies where customer_id = ${source.customerId}
  `;
  if (Number(count) === 0) {
    const timestamp = nowIso();
    await sql`
      insert into topologies (id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at)
      values (${uid("topology")}, ${source.customerId}, ${source.siteId ?? defaultSiteFor(currentUser)}, ${currentUser.id}, ${currentUser.id}, ${currentUser.id}, ${"現況拓樸"}, ${"v1"}, ${sql.json(EMPTY_PROJECT)}, ${timestamp}, ${timestamp})
    `;
  }
  return readTopologyDataset(email);
}
