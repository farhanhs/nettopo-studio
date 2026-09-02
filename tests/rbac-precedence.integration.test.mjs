import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import postgres from "postgres";

import { createTopology, upsertDeviceCredential } from "../db/topology-postgres.ts";
import { EMPTY_PROJECT } from "../app/lib/topology-types.ts";

const enabled = Boolean(process.env.DATABASE_URL);
const integration = enabled ? test : test.skip;
const prefix = `qa-rbac-precedence-${Date.now().toString(36)}`;
const ids = {
  north1: `${prefix}-north-1`,
  north2: `${prefix}-north-2`,
  manager1: `${prefix}-manager-1`,
  manager2: `${prefix}-manager-2`,
  sales: `${prefix}-sales`,
  customer1: `${prefix}-customer-1`,
  customer2: `${prefix}-customer-2`,
  topology1: `${prefix}-topology-1`,
  topology2: `${prefix}-topology-2`,
};
const emails = {
  manager1: `${ids.manager1}@example.test`,
  manager2: `${ids.manager2}@example.test`,
  sales: `${ids.sales}@example.test`,
};
const project = {
  devices: [{ id: "qa-device-1", name: "QA Device", type: "router", x: 0, y: 0 }],
  links: [],
  groups: [],
};

let sql;

before(async () => {
  if (!enabled) return;
  sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  const now = new Date().toISOString();
  await sql`insert into sites (id,name,created_at,updated_at) values (${ids.north1},${`${prefix} North 1`},${now},${now}),(${ids.north2},${`${prefix} North 2`},${now},${now})`;
  await sql`
    insert into users (id,email,name,role,created_at,updated_at) values
      (${ids.manager1},${emails.manager1},${"manager1"},${"site_manager"},${now},${now}),
      (${ids.manager2},${emails.manager2},${"manager2"},${"site_manager"},${now},${now}),
      (${ids.sales},${emails.sales},${"sales"},${"sales_procurement"},${now},${now})
  `;
  await sql`
    insert into user_sites (user_id,site_id) values
      (${ids.manager1},${ids.north1}),
      (${ids.manager2},${ids.north2}),
      (${ids.sales},${ids.north1}),
      (${ids.sales},${ids.north2})
  `;
  await sql`insert into customers (id,name,created_at,updated_at) values (${ids.customer1},${"QA Customer 1"},${now},${now}),(${ids.customer2},${"QA Customer 2"},${now},${now})`;
  await sql`
    insert into topologies (id,customer_id,site_id,owner_user_id,created_by_user_id,updated_by_user_id,name,version_label,project,created_at,updated_at) values
      (${ids.topology1},${ids.customer1},${ids.north1},${ids.manager1},${ids.manager1},${ids.manager1},${"QA Topology 1"},${"v1"},${sql.json(project)},${now},${now}),
      (${ids.topology2},${ids.customer2},${ids.north2},${ids.manager2},${ids.manager2},${ids.manager2},${"QA Topology 2"},${"v1"},${sql.json(EMPTY_PROJECT)},${now},${now})
  `;
});

after(async () => {
  if (!sql) return;
  try {
    await sql`delete from customers where id::text like ${`${prefix}%`}`;
    await sql`delete from users where id::text like ${`${prefix}%`}`;
    await sql`delete from sites where id::text like ${`${prefix}%`}`;
  } finally {
    await sql.end({ timeout: 5 });
  }
});

integration("createTopology hides missing, invisible customer, and unassigned site scopes", async () => {
  await assert.rejects(
    () => createTopology(emails.manager1, `${prefix}-missing-customer`, "denied", EMPTY_PROJECT, ids.north1),
    (error) => error.message === "Resource not found.",
  );
  await assert.rejects(
    () => createTopology(emails.manager1, ids.customer2, "denied", EMPTY_PROJECT, ids.north1),
    (error) => error.message === "Resource not found.",
  );
  await assert.rejects(
    () => createTopology(emails.manager1, ids.customer1, "denied", EMPTY_PROJECT, ids.north2),
    (error) => error.message === "Resource not found.",
  );
});

integration("credential write returns 403 for readable topology and 404 for hidden topology", async () => {
  await assert.rejects(
    () => upsertDeviceCredential(emails.sales, {
      topologyId: ids.topology1,
      projectDeviceId: "qa-device-1",
      kind: "device_admin",
      secret: "denied-secret",
    }),
    /Permission denied/,
  );
  await assert.rejects(
    () => upsertDeviceCredential(emails.manager2, {
      topologyId: ids.topology1,
      projectDeviceId: "qa-device-1",
      kind: "device_admin",
      secret: "denied-secret",
    }),
    (error) => error.message === "Resource not found.",
  );
});
