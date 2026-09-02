import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canCreateTopology,
  canReadTopology,
  canWriteCustomer,
  canWriteTopology,
  roleCanReadAudit,
  rolePermissions,
} from "../app/lib/server/rbac-policy.ts";

const users = {
  boss: { id: "u-boss", role: "boss", siteIds: ["north-1", "north-2"] },
  north1: { id: "u-n1-manager", role: "site_manager", siteIds: ["north-1"] },
  north2: { id: "u-n2-manager", role: "site_manager", siteIds: ["north-2"] },
  engineer1: { id: "u-n1-engineer", role: "engineer", siteIds: ["north-1"] },
  engineer2: { id: "u-n2-engineer", role: "engineer", siteIds: ["north-2"] },
  sales: { id: "u-sales", role: "sales_procurement", siteIds: ["north-1", "north-2"] },
};
const topologies = {
  north1: { id: "t-n1", siteId: "north-1", ownerUserId: "u-n1-engineer", createdByUserId: "u-n1-engineer" },
  north2: { id: "t-n2", siteId: "north-2", ownerUserId: "u-n2-engineer", createdByUserId: "u-n2-engineer" },
  crossOwned: { id: "t-cross", siteId: "north-2", ownerUserId: "u-n1-engineer", createdByUserId: "u-n1-engineer" },
};

test("boss and sales have global read, but only boss has global write", () => {
  for (const topology of Object.values(topologies)) {
    assert.equal(canReadTopology(users.boss, topology), true);
    assert.equal(canWriteTopology(users.boss, topology), true);
    assert.equal(canReadTopology(users.sales, topology), true);
    assert.equal(canWriteTopology(users.sales, topology), false);
  }
  assert.deepEqual(rolePermissions(users.sales), { canCreate: false, canWriteAll: false, canReadAll: true });
  assert.equal(canWriteCustomer(users.boss), true);
  assert.equal(canWriteCustomer(users.north1), false);
  assert.equal(canWriteCustomer(users.engineer1), false);
  assert.equal(canWriteCustomer(users.sales), false);
});

test("site managers are isolated to their assigned site", () => {
  assert.equal(canReadTopology(users.north1, topologies.north1), true);
  assert.equal(canWriteTopology(users.north1, topologies.north1), true);
  assert.equal(canReadTopology(users.north1, topologies.north2), false);
  assert.equal(canWriteTopology(users.north1, topologies.north2), false);
  assert.equal(canReadTopology(users.north2, topologies.north1), false);
  assert.equal(canWriteTopology(users.north2, topologies.north2), true);
});

test("engineers require assigned site plus owner or creator", () => {
  assert.equal(canReadTopology(users.engineer1, topologies.north1), true);
  assert.equal(canWriteTopology(users.engineer1, topologies.north1), true);
  assert.equal(canReadTopology(users.engineer1, topologies.north2), false);
  assert.equal(canWriteTopology(users.engineer1, topologies.north2), false);
  assert.equal(canReadTopology(users.engineer1, topologies.crossOwned), false);
  assert.equal(canWriteTopology(users.engineer1, topologies.crossOwned), false);
});

test("topology creation requires the actor to be assigned to the target site", () => {
  assert.equal(canCreateTopology(users.boss, "north-2"), true);
  assert.equal(canCreateTopology(users.north1, "north-1"), true);
  assert.equal(canCreateTopology(users.north1, "north-2"), false);
  assert.equal(canCreateTopology(users.engineer1, "north-1"), true);
  assert.equal(canCreateTopology(users.engineer1, "north-2"), false);
  assert.equal(canCreateTopology(users.sales, "north-1"), false);
});

test("credential and audit permission dictionary matches role policy", async () => {
  const migration = await readFile(new URL("../db/migrations/0001_formal_topology_schema.sql", import.meta.url), "utf8");
  const has = (role, permission) => migration.includes(`('${role}', '${permission}')`);
  assert.equal(has("boss", "credential.read.masked"), true);
  assert.equal(has("boss", "credential.write"), true);
  assert.equal(has("site_manager", "credential.read.masked"), true);
  assert.equal(has("site_manager", "credential.write"), false);
  assert.equal(has("engineer", "credential.read.masked"), true);
  assert.equal(has("engineer", "credential.write"), false);
  assert.equal(has("sales_procurement", "credential.read.masked"), true);
  assert.equal(has("sales_procurement", "credential.write"), false);
  assert.equal(roleCanReadAudit("boss"), true);
  for (const role of ["site_manager", "engineer", "sales_procurement"]) {
    assert.equal(has(role, "audit.read"), false);
    assert.equal(roleCanReadAudit(role), false);
  }
});

test("PostgreSQL repository keeps customer mutations boss-only except explicit pilot synthetic create", async () => {
  const source = await readFile(new URL("../db/topology-postgres.ts", import.meta.url), "utf8");
  for (const functionName of ["renameCustomer", "deleteCustomer", "duplicateCustomer"]) {
    const start = source.indexOf(`export async function ${functionName}`);
    assert.notEqual(start, -1, `${functionName} should exist`);
    const end = source.indexOf("\nexport async function ", start + 1);
    const body = source.slice(start, end === -1 ? source.length : end);
    assert.match(body, /assertCanWriteCustomer\(/, `${functionName} should require customer.write.all`);
  }
  const createStart = source.indexOf("export async function createCustomer");
  const createEnd = source.indexOf("\nasync function canUseCustomerForTopologyCreate", createStart + 1);
  const createBody = source.slice(createStart, createEnd);
  assert.match(createBody, /canCreateCustomerForContext/);
  assert.match(createBody, /identitySource === "pilot-session"/);
  assert.match(source, /options\.synthetic === true/);

  const duplicateStart = source.indexOf("export async function duplicateCustomer");
  const duplicateEnd = source.indexOf("\nexport async function duplicateTopology", duplicateStart + 1);
  const duplicateBody = source.slice(duplicateStart, duplicateEnd);
  assert.doesNotMatch(duplicateBody, /device_credentials|credential\./, "duplicateCustomer must not copy credentials");
});
