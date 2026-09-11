import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import postgres from "postgres";

import {
  createTopology,
  duplicateCustomer,
  readAuditLogs,
  readDeviceCredentials,
  readTopologyDataset,
  renameCustomer,
  renameTopology,
  upsertDeviceCredential,
} from "../db/topology-postgres.ts";
import { EMPTY_PROJECT } from "../app/lib/topology-types.ts";

const enabled = Boolean(process.env.DATABASE_URL);
const integration = enabled ? test : test.skip;
const prefix = `qa-rbac-${Date.now().toString(36)}`;
const ids = {
  north1: `${prefix}-north-1`, north2: `${prefix}-north-2`,
  boss: `${prefix}-boss`, manager1: `${prefix}-manager-1`, manager2: `${prefix}-manager-2`,
  engineer1: `${prefix}-engineer-1`, sales: `${prefix}-sales`, disabled: `${prefix}-disabled`,
  customer1: `${prefix}-customer-1`, customer2: `${prefix}-customer-2`,
  topology1: `${prefix}-topology-1`, topology2: `${prefix}-topology-2`, crossOwned: `${prefix}-cross-owned`,
};
const emails = Object.fromEntries(["boss", "manager1", "manager2", "engineer1", "sales", "disabled"].map((key) => [key, `${ids[key]}@example.test`]));
let sql;
const generatedCustomerIds = [];
const credentialProject = {
  devices: [{ id: "qa-device-1", name: "QA Router", type: "router", x: 0, y: 0 }],
  links: [],
  groups: [],
};

before(async () => {
  if (!enabled) return;
  sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  const now = new Date().toISOString();
  await sql`insert into sites (id,name,created_at,updated_at) values (${ids.north1},${"QA North 1"},${now},${now}),(${ids.north2},${"QA North 2"},${now},${now})`;
  for (const [key, role] of [["boss","boss"],["manager1","site_manager"],["manager2","site_manager"],["engineer1","engineer"],["sales","sales_procurement"],["disabled","boss"]]) {
    await sql`insert into users (id,email,name,role,disabled_at,created_at,updated_at) values (${ids[key]},${emails[key]},${key},${role},${key === "disabled" ? now : null},${now},${now})`;
  }
  for (const [user, site] of [["boss","north1"],["boss","north2"],["manager1","north1"],["manager2","north2"],["engineer1","north1"],["sales","north1"],["sales","north2"],["disabled","north1"]]) {
    await sql`insert into user_sites (user_id,site_id) values (${ids[user]},${ids[site]})`;
  }
  await sql`insert into customers (id,name,created_at,updated_at) values (${ids.customer1},${"QA Customer 1"},${now},${now}),(${ids.customer2},${"QA Customer 2"},${now},${now})`;
  for (const row of [
    [ids.topology1,ids.customer1,ids.north1,ids.engineer1,ids.engineer1,credentialProject],
    [ids.topology2,ids.customer2,ids.north2,ids.manager2,ids.manager2],
    [ids.crossOwned,ids.customer2,ids.north2,ids.engineer1,ids.engineer1],
  ]) {
    await sql`insert into topologies (id,customer_id,site_id,owner_user_id,created_by_user_id,updated_by_user_id,name,version_label,project,created_at,updated_at)
      values (${row[0]},${row[1]},${row[2]},${row[3]},${row[4]},${row[4]},${row[0]},${"v1"},${sql.json(row[5] ?? EMPTY_PROJECT)},${now},${now})`;
  }
});

after(async () => {
  if (!sql) return;
  try {
    for (const id of generatedCustomerIds) await sql`delete from customers where id=${id}`;
    await sql`delete from customers where id::text like ${`${prefix}%`}`;
    await sql`delete from users where id::text like ${`${prefix}%`}`;
    await sql`delete from sites where id::text like ${`${prefix}%`}`;
  } finally {
    await sql.end({ timeout: 5 });
  }
});

integration("repository projections enforce global, site, and owner scopes", async () => {
  const boss = await readTopologyDataset(emails.boss);
  const manager1 = await readTopologyDataset(emails.manager1);
  const manager2 = await readTopologyDataset(emails.manager2);
  const engineer = await readTopologyDataset(emails.engineer1);
  const sales = await readTopologyDataset(emails.sales);
  const includes = (dataset, id) => dataset.topologies.some((topology) => topology.id === id);
  assert.equal(includes(boss, ids.topology1) && includes(boss, ids.topology2), true);
  assert.equal(includes(sales, ids.topology1) && includes(sales, ids.topology2), true);
  assert.equal(includes(manager1, ids.topology1), true);
  assert.equal(includes(manager1, ids.topology2), false);
  assert.equal(includes(manager2, ids.topology2), true);
  assert.equal(includes(manager2, ids.topology1), false);
  assert.equal(includes(engineer, ids.topology1), true);
  assert.equal(includes(engineer, ids.crossOwned), false);
});

integration("disabled active account fails closed without exposing disabled status", async () => {
  await assert.rejects(() => readTopologyDataset(emails.disabled), (error) => error.message === "Authentication required.");
});

integration("customer mutations are boss-only and topology cross-site writes look not found", async () => {
  for (const actor of [emails.manager1, emails.engineer1, emails.sales]) {
    await assert.rejects(() => renameCustomer(actor, ids.customer1, "denied"), /Permission denied/);
  }
  await renameCustomer(emails.boss, ids.customer1, "QA Customer 1 renamed");
  await assert.rejects(() => renameTopology(emails.manager1, ids.topology2, "denied"), (error) => error.message === "Resource not found.");
  await assert.rejects(() => renameTopology(emails.engineer1, ids.crossOwned, "denied"), (error) => error.message === "Resource not found.");
});

integration("createTopology hides unknown, invisible customer and unassigned site scopes", async () => {
  await assert.rejects(() => createTopology(emails.manager1, "missing-customer", "denied", EMPTY_PROJECT, ids.north1), (error) => error.message === "Resource not found.");
  await assert.rejects(() => createTopology(emails.manager1, ids.customer2, "denied", EMPTY_PROJECT, ids.north1), (error) => error.message === "Resource not found.");
  await assert.rejects(() => createTopology(emails.manager1, ids.customer1, "denied", EMPTY_PROJECT, ids.north2), (error) => error.message === "Resource not found.");
});

integration("duplicateCustomer reassigns copied topology ownership and does not copy credentials", async () => {
  const beforeRows = await sql`select id from customers`;
  await duplicateCustomer(emails.boss, ids.customer1);
  const afterRows = await sql`select id from customers`;
  assert.equal(afterRows.length, beforeRows.length + 1);
  const duplicate = afterRows.find((row) => !beforeRows.some((old) => old.id === row.id));
  generatedCustomerIds.push(duplicate.id);
  const copied = await sql`select owner_user_id,created_by_user_id,updated_by_user_id from topologies where customer_id=${duplicate.id}`;
  assert.ok(copied.length > 0);
  assert.ok(copied.every((row) => row.owner_user_id === ids.boss && row.created_by_user_id === ids.boss && row.updated_by_user_id === ids.boss));
  const credentials = await sql`select count(*)::int as count from device_credentials where topology_id in (select id from topologies where customer_id=${duplicate.id})`;
  assert.equal(credentials[0].count, 0);
  const audit = await sql`select action,metadata from audit_logs where customer_id=${duplicate.id} order by created_at`;
  assert.ok(audit.some((row) => row.action === "customer.duplicate"));
  assert.ok(audit.every((row) => !/(secret|cookie|token|ciphertext|nonce)/i.test(JSON.stringify(row.metadata))));
});

integration("audit read is boss-only", async () => {
  await readAuditLogs(emails.boss, 5);
  for (const actor of [emails.manager1, emails.engineer1, emails.sales]) {
    await assert.rejects(() => readAuditLogs(actor, 5), /Permission denied/);
  }
});

integration("credential reads are masked and writes are boss-only", async () => {
  if (!process.env.NETTOPO_CREDENTIAL_ENCRYPTION_KEY) return test.skip("credential key is required");
  await upsertDeviceCredential(emails.boss, {
    topologyId: ids.topology1,
    projectDeviceId: "qa-device-1",
    kind: "device_admin",
    username: "qa-admin",
    secret: "qa-secret-sentinel",
  });
  for (const actor of [emails.boss, emails.manager1, emails.engineer1, emails.sales]) {
    const rows = await readDeviceCredentials(actor, ids.topology1);
    assert.equal(rows.length, 1);
    assert.doesNotMatch(JSON.stringify(rows), /qa-admin|qa-secret-sentinel|ciphertext|nonce/i);
  }
  for (const actor of [emails.manager1, emails.engineer1]) {
    await assert.rejects(() => upsertDeviceCredential(actor, {
      topologyId: ids.topology1,
      projectDeviceId: "qa-device-1",
      kind: "device_admin",
      secret: "denied-secret",
    }), /Permission denied/);
  }
  await assert.rejects(() => upsertDeviceCredential(emails.sales, {
    topologyId: ids.topology1,
    projectDeviceId: "qa-device-1",
    kind: "device_admin",
    secret: "denied-secret",
  }), /Permission denied/, "Sales can read this topology, so a forbidden write must be 403 rather than resource-hidden 404");
});
