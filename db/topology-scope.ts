import type { Sql, TransactionSql } from "postgres";
import type { CustomerRecord, Project, RoleCode, SiteRecord, TopologyRecord, UserRecord } from "../app/lib/topology-types.ts";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: RoleCode;
  site_ids: string[] | null;
  created_at: string | Date;
  updated_at: string | Date;
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

function toIso(value: string | Date) {
  return typeof value === "string" ? new Date(value).toISOString() : value.toISOString();
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
    project: row.project,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function loadActiveUser(sql: Sql | TransactionSql, email: string) {
  const [row] = await sql<UserRow[]>`
    select u.id, u.email, u.name, u.role::text as role, coalesce(array_agg(us.site_id) filter (where us.site_id is not null), '{}') as site_ids, u.created_at, u.updated_at
    from users u
    left join user_sites us on us.user_id = u.id
    where lower(u.email) = lower(${email}) and u.disabled_at is null
    group by u.id
  `;
  return row ? mapUser(row) : undefined;
}

export async function loadCustomer(sql: Sql | TransactionSql, customerId: string, forUpdate = false) {
  const rows = forUpdate
    ? await sql<CustomerRow[]>`
        select id, name, notes, created_at, updated_at
        from customers
        where id = ${customerId}
        for update
      `
    : await sql<CustomerRow[]>`
        select id, name, notes, created_at, updated_at
        from customers
        where id = ${customerId}
      `;
  return rows[0] ? mapCustomer(rows[0]) : undefined;
}

export async function loadSite(sql: Sql | TransactionSql, siteId: string) {
  const [row] = await sql<SiteRow[]>`
    select id, name, created_at, updated_at
    from sites
    where id = ${siteId}
  `;
  return row ? mapSite(row) : undefined;
}

export async function loadTopology(sql: Sql | TransactionSql, topologyId: string, forUpdate = false) {
  const rows = forUpdate
    ? await sql<TopologyRow[]>`
        select id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at
        from topologies
        where id = ${topologyId}
        for update
      `
    : await sql<TopologyRow[]>`
        select id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id, name, version_label, project, created_at, updated_at
        from topologies
        where id = ${topologyId}
      `;
  return rows[0] ? mapTopology(rows[0]) : undefined;
}
