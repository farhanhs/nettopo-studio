import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";

import { EMPTY_PROJECT } from "../app/lib/topology-types.ts";
import {
  createCustomer,
  createTopology,
  deleteCustomer,
  deleteTopology,
  duplicateCustomer,
  duplicateTopology,
  readAuditLogs,
  readDeviceCredentials,
  readTopologyDataset,
  renameCustomer,
  renameTopology,
  saveTopologyProject,
  upsertDeviceCredential,
} from "../db/topology-postgres.ts";

const prefix = "qa_pil_001";
const pilotSiteId = `${prefix}_pilot_site`;
const otherSiteId = `${prefix}_other_site`;

const admin = {
  id: `${prefix}_admin_user`,
  email: `${prefix}.admin@company.local`,
  role: "boss",
  name: "QA PIL Admin",
};
const engineer = {
  id: `${prefix}_engineer_user`,
  email: `${prefix}.engineer@company.local`,
  role: "engineer",
  name: "QA PIL Engineer",
};
const otherEngineer = {
  id: `${prefix}_other_engineer_user`,
  email: `${prefix}.other.engineer@company.local`,
  role: "engineer",
  name: "QA PIL Other Engineer",
};
const disabledEngineer = {
  id: `${prefix}_disabled_user`,
  email: `${prefix}.disabled@company.local`,
  role: "engineer",
  name: "QA PIL Disabled",
};
const multiSiteEngineer = {
  id: `${prefix}_multi_engineer_user`,
  email: `${prefix}.multi@company.local`,
  role: "engineer",
  name: "QA PIL Multi Engineer",
};

const adminPrincipal = { email: admin.email, pilotRole: "admin", version: "qa" };
const engineerPrincipal = { email: engineer.email, pilotRole: "engineer", version: "qa" };
const disabledPrincipal = { email: disabledEngineer.email, pilotRole: "engineer", version: "qa" };
const adminContext = { identitySource: "pilot-session", pilotPrincipal: adminPrincipal };
const engineerContext = { identitySource: "pilot-session", pilotPrincipal: engineerPrincipal };
const disabledContext = { identitySource: "pilot-session", pilotPrincipal: disabledPrincipal };

const projectWithDevice = {
  devices: [{ id: `${prefix}_device_1`, name: "QA Pilot Device", type: "switch", x: 10, y: 20 }],
  links: [],
  groups: [],
};

function parseRequiredDsn(name) {
  const value = process.env[name];
  assert.ok(value, `${name} is required`);
  return value;
}

function applyPilotEnv() {
  const keys = [
    "NETTOPO_RUNTIME_PROFILE",
    "NETTOPO_AUTH_MODE",
    "NETTOPO_ENABLE_DEV_IDENTITY_HEADER",
    "NETTOPO_ENABLE_DEMO_SEED",
    "NETTOPO_PILOT_SITE_ID",
    "NETTOPO_PILOT_USERS",
    "NETTOPO_PILOT_SESSION_SECRET",
    "NETTOPO_PILOT_ALLOW_FULL_EXPORT",
    "NETTOPO_CREDENTIAL_ENCRYPTION_KEY",
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.NETTOPO_RUNTIME_PROFILE = "pilot";
  process.env.NETTOPO_AUTH_MODE = "pilot";
  process.env.NETTOPO_ENABLE_DEV_IDENTITY_HEADER = "0";
  process.env.NETTOPO_ENABLE_DEMO_SEED = "0";
  process.env.NETTOPO_PILOT_SITE_ID = pilotSiteId;
  process.env.NETTOPO_PILOT_USERS = `${admin.email}:admin:qa,${engineer.email}:engineer:qa`;
  process.env.NETTOPO_PILOT_SESSION_SECRET = "qa-pil-001-session-secret-32chars";
  process.env.NETTOPO_PILOT_ALLOW_FULL_EXPORT = "0";
  process.env.NETTOPO_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

async function cleanup(sql) {
  await sql`
    delete from audit_logs
    where id like ${`${prefix}%`}
       or actor_user_id like ${`${prefix}%`}
       or customer_id like ${`${prefix}%`}
       or topology_id like ${`${prefix}%`}
       or site_id in (${pilotSiteId}, ${otherSiteId})
  `;
  await sql`
    delete from device_credentials
    where id like ${`${prefix}%`}
       or topology_id in (select id from topologies where id like ${`${prefix}%`} or customer_id like ${`${prefix}%`})
  `;
  await sql`delete from topologies where id like ${`${prefix}%`} or customer_id like ${`${prefix}%`}`;
  await sql`delete from customers where id like ${`${prefix}%`} or name like ${"QA PIL 001%"}`;
  await sql`delete from user_sites where user_id like ${`${prefix}%`} or site_id in (${pilotSiteId}, ${otherSiteId})`;
  await sql`delete from users where id like ${`${prefix}%`} or email like ${`${prefix}.%`}`;
  await sql`delete from sites where id in (${pilotSiteId}, ${otherSiteId})`;
}

async function seed(sql) {
  const now = new Date().toISOString();
  await cleanup(sql);
  await sql.begin(async (tx) => {
    await tx`
      insert into sites (id, name, created_at, updated_at)
      values
        (${pilotSiteId}, ${"QA PIL 001 Pilot Site"}, ${now}, ${now}),
        (${otherSiteId}, ${"QA PIL 001 Other Site"}, ${now}, ${now})
    `;
    for (const user of [admin, engineer, otherEngineer, disabledEngineer, multiSiteEngineer]) {
      await tx`
        insert into users (id, email, name, role, disabled_at, created_at, updated_at)
        values (
          ${user.id}, ${user.email}, ${user.name}, ${user.role},
          ${user.id === disabledEngineer.id ? now : null}, ${now}, ${now}
        )
      `;
    }
    for (const row of [
      [admin.id, pilotSiteId],
      [engineer.id, pilotSiteId],
      [otherEngineer.id, otherSiteId],
      [disabledEngineer.id, pilotSiteId],
      [multiSiteEngineer.id, pilotSiteId],
      [multiSiteEngineer.id, otherSiteId],
    ]) {
      await tx`insert into user_sites (user_id, site_id) values (${row[0]}, ${row[1]})`;
    }

    const customers = [
      [`${prefix}_pilot_customer`, "QA PIL 001 Pilot Only"],
      [`${prefix}_shared_customer`, "QA PIL 001 Shared"],
      [`${prefix}_other_customer`, "QA PIL 001 Other Only"],
    ];
    for (const [id, name] of customers) {
      await tx`insert into customers (id, name, created_at, updated_at) values (${id}, ${name}, ${now}, ${now})`;
    }

    const topologies = [
      [`${prefix}_pilot_topology_admin`, `${prefix}_pilot_customer`, pilotSiteId, admin.id, admin.id, "QA PIL 001 Pilot Admin"],
      [`${prefix}_pilot_topology_engineer`, `${prefix}_pilot_customer`, pilotSiteId, engineer.id, engineer.id, "QA PIL 001 Pilot Engineer"],
      [`${prefix}_shared_topology_pilot`, `${prefix}_shared_customer`, pilotSiteId, admin.id, admin.id, "QA PIL 001 Shared Pilot"],
      [`${prefix}_shared_topology_other`, `${prefix}_shared_customer`, otherSiteId, admin.id, admin.id, "QA PIL 001 Shared Other"],
      [`${prefix}_other_topology`, `${prefix}_other_customer`, otherSiteId, otherEngineer.id, otherEngineer.id, "QA PIL 001 Other"],
    ];
    for (const [id, customerId, siteId, ownerId, creatorId, name] of topologies) {
      await tx`
        insert into topologies (
          id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id,
          name, version_label, project, created_at, updated_at
        ) values (
          ${id}, ${customerId}, ${siteId}, ${ownerId}, ${creatorId}, ${creatorId},
          ${name}, ${"v1"}, ${tx.json(projectWithDevice)}, ${now}, ${now}
        )
      `;
    }

    await tx`
      insert into device_credentials (
        id, topology_id, project_device_id, kind, username_masked, secret_masked,
        secret_ciphertext, secret_nonce, key_version, created_by_user_id, updated_by_user_id,
        created_at, updated_at
      ) values
        (${`${prefix}_pilot_credential`}, ${`${prefix}_pilot_topology_admin`}, ${`${prefix}_device_1`}, ${"device_admin"}, ${"a***n"}, ${"********"}, ${"ciphertext-redacted"}, ${"nonce-redacted"}, ${"qa"}, ${admin.id}, ${admin.id}, ${now}, ${now}),
        (${`${prefix}_other_credential`}, ${`${prefix}_other_topology`}, ${`${prefix}_device_1`}, ${"device_admin"}, ${"o***r"}, ${"********"}, ${"ciphertext-redacted"}, ${"nonce-redacted"}, ${"qa"}, ${admin.id}, ${admin.id}, ${now}, ${now})
    `;

    await tx`
      insert into audit_logs (
        id, actor_user_id, action, entity_type, entity_id, site_id, customer_id, topology_id, metadata, created_at
      ) values
        (${`${prefix}_audit_pilot`}, ${admin.id}, ${"qa.seed"}, ${"topology"}, ${`${prefix}_pilot_topology_admin`}, ${pilotSiteId}, ${`${prefix}_pilot_customer`}, ${`${prefix}_pilot_topology_admin`}, ${tx.json({ source: "qa-pil-001" })}, ${now}),
        (${`${prefix}_audit_other`}, ${admin.id}, ${"qa.seed"}, ${"topology"}, ${`${prefix}_other_topology`}, ${otherSiteId}, ${`${prefix}_other_customer`}, ${`${prefix}_other_topology`}, ${tx.json({ source: "qa-pil-001" })}, ${now})
    `;
  });
}

async function snapshot(sql) {
  const [row] = await sql`
    select
      (select count(*)::int from customers where id like ${`${prefix}%`} or name like ${"QA PIL 001%"}) as customers,
      (select count(*)::int from topologies where id like ${`${prefix}%`} or customer_id like ${`${prefix}%`}) as topologies,
      (select count(*)::int from device_credentials where id like ${`${prefix}%`} or topology_id like ${`${prefix}%`}) as credentials,
      (select count(*)::int from audit_logs where id like ${`${prefix}%`} or customer_id like ${`${prefix}%`} or topology_id like ${`${prefix}%`} or actor_user_id like ${`${prefix}%`}) as audit_logs,
      (select count(*)::int from users where id like ${`${prefix}%`} or email like ${`${prefix}.%`}) as users,
      (select count(*)::int from sites where id in (${pilotSiteId}, ${otherSiteId})) as sites
  `;
  return row;
}

async function expectClosed(operation, fn) {
  const before = await operation.count();
  await assert.rejects(fn, /Authentication required|Resource not found|Permission denied/);
  assert.deepEqual(await operation.count(), before);
}

function assertNoCredentialLeak(records) {
  const serialized = JSON.stringify(records);
  assert.doesNotMatch(serialized, /ciphertext|nonce|secretCiphertext|secretNonce|password|token|cookie/i);
}

test("QA_PIL_001 real PostgreSQL pilot scope, shared-customer, credentials, audit, and cleanup boundaries", async () => {
  parseRequiredDsn("DATABASE_URL");
  parseRequiredDsn("MIGRATION_DATABASE_URL");
  const restoreEnv = applyPilotEnv();
  const migration = postgres(process.env.MIGRATION_DATABASE_URL, { max: 1, idle_timeout: 5, prepare: false });

  try {
    await seed(migration);

    const adminDataset = await readTopologyDataset(admin.email, adminContext);
    assert.deepEqual(adminDataset.sites.map((site) => site.id), [pilotSiteId]);
    assert.ok(adminDataset.topologies.length >= 3);
    assert.equal(adminDataset.topologies.every((topology) => topology.siteId === pilotSiteId), true);
    assert.equal(adminDataset.customers.some((customer) => customer.id === `${prefix}_other_customer`), false);
    assert.equal(adminDataset.topologies.some((topology) => topology.id === `${prefix}_other_topology`), false);

    const engineerDataset = await readTopologyDataset(engineer.email, engineerContext);
    assert.deepEqual(engineerDataset.topologies.map((topology) => topology.id), [`${prefix}_pilot_topology_engineer`]);
    assert.deepEqual(engineerDataset.customers.map((customer) => customer.id), [`${prefix}_pilot_customer`]);

    await assert.rejects(() => readTopologyDataset(disabledEngineer.email, disabledContext), /Authentication required/);

    const mutationCounter = {
      count: () => snapshot(migration),
    };
    await expectClosed(mutationCounter, () => renameTopology(admin.email, `${prefix}_other_topology`, "QA PIL 001 should not rename", adminContext));
    await expectClosed(mutationCounter, () => saveTopologyProject(admin.email, `${prefix}_other_topology`, EMPTY_PROJECT, adminContext));
    await expectClosed(mutationCounter, () => duplicateTopology(admin.email, `${prefix}_other_topology`, adminContext));
    await expectClosed(mutationCounter, () => deleteTopology(admin.email, `${prefix}_other_topology`, adminContext));
    await expectClosed(mutationCounter, () => readDeviceCredentials(admin.email, `${prefix}_other_topology`, adminContext));
    await expectClosed(mutationCounter, () => upsertDeviceCredential(admin.email, {
      topologyId: `${prefix}_other_topology`,
      projectDeviceId: `${prefix}_device_1`,
      kind: "device_admin",
      username: "qa-admin",
      secret: "qa-secret",
    }, adminContext));

    const sharedBefore = await snapshot(migration);
    await assert.rejects(() => renameCustomer(admin.email, `${prefix}_shared_customer`, "QA PIL 001 shared renamed", adminContext), /Resource not found/);
    await assert.rejects(() => deleteCustomer(admin.email, `${prefix}_shared_customer`, adminContext), /Resource not found/);
    await assert.rejects(() => createTopology(admin.email, `${prefix}_shared_customer`, "QA PIL 001 shared extra", EMPTY_PROJECT, pilotSiteId, adminContext), /Resource not found/);
    assert.deepEqual(await snapshot(migration), sharedBefore);

    await assert.rejects(() => createCustomer(engineer.email, "QA PIL 001 wrong site", otherSiteId, {
      ...engineerContext,
      synthetic: true,
    }), /Resource not found/);
    await assert.rejects(() => createCustomer(engineer.email, "QA PIL 001 formal engineer denied", pilotSiteId, {
      ...engineerContext,
      synthetic: false,
    }), /Permission denied/);

    const createdByEngineer = await createCustomer(engineer.email, "QA PIL 001 synthetic engineer allowed", undefined, {
      ...engineerContext,
      synthetic: true,
    });
    assert.ok(createdByEngineer.customers.some((customer) => customer.name === "QA PIL 001 synthetic engineer allowed"));
    assert.equal(createdByEngineer.topologies.some((topology) => topology.siteId !== pilotSiteId), false);

    await assert.rejects(() => renameCustomer(engineer.email, `${prefix}_pilot_customer`, "QA PIL 001 engineer rename denied", engineerContext), /Permission denied/);
    await assert.rejects(() => duplicateCustomer(engineer.email, `${prefix}_pilot_customer`, engineerContext), /Permission denied/);
    await assert.rejects(() => deleteCustomer(engineer.email, `${prefix}_pilot_customer`, engineerContext), /Permission denied/);

    const renamed = await renameCustomer(admin.email, `${prefix}_pilot_customer`, "QA PIL 001 Pilot Only Renamed", adminContext);
    assert.ok(renamed.customers.some((customer) => customer.name === "QA PIL 001 Pilot Only Renamed"));
    const duplicated = await duplicateCustomer(admin.email, `${prefix}_pilot_customer`, adminContext);
    assert.ok(duplicated.customers.some((customer) => customer.name === "QA PIL 001 Pilot Only Renamed copy"));
    const withExtraTopology = await createTopology(admin.email, `${prefix}_pilot_customer`, "QA PIL 001 Pilot Extra", EMPTY_PROJECT, pilotSiteId, adminContext);
    assert.ok(withExtraTopology.topologies.some((topology) => topology.name === "QA PIL 001 Pilot Extra"));

    const adminCredentials = await readDeviceCredentials(admin.email, `${prefix}_pilot_topology_admin`, adminContext);
    assert.equal(adminCredentials.length, 1);
    assert.equal(adminCredentials[0].secretMasked, "********");
    assertNoCredentialLeak(adminCredentials);
    await assert.rejects(() => readDeviceCredentials(engineer.email, `${prefix}_pilot_topology_admin`, engineerContext), /Resource not found|Permission denied/);
    await assert.rejects(() => upsertDeviceCredential(engineer.email, {
      topologyId: `${prefix}_pilot_topology_engineer`,
      projectDeviceId: `${prefix}_device_1`,
      kind: "device_admin",
      username: "qa-engineer",
      secret: "qa-secret",
    }, engineerContext), /Permission denied/);
    const updatedCredentials = await upsertDeviceCredential(admin.email, {
      topologyId: `${prefix}_pilot_topology_admin`,
      projectDeviceId: `${prefix}_device_1`,
      kind: "device_admin",
      username: "qa-admin",
      secret: "qa-secret",
    }, adminContext);
    assert.equal(updatedCredentials[0].secretMasked, "********");
    assertNoCredentialLeak(updatedCredentials);

    const adminAudit = await readAuditLogs(admin.email, 100, adminContext);
    assert.ok(adminAudit.length > 0);
    assert.equal(adminAudit.every((entry) => entry.siteId === pilotSiteId), true);
    assert.equal(adminAudit.some((entry) => entry.siteId === otherSiteId), false);
    assertNoCredentialLeak(adminAudit);
    await assert.rejects(() => readAuditLogs(engineer.email, 100, engineerContext), /Permission denied/);

    await migration`update users set role = 'boss', updated_at = now() where id = ${engineer.id}`;
    const beforeRoleChangedMutation = await snapshot(migration);
    await assert.rejects(() => renameTopology(engineer.email, `${prefix}_pilot_topology_engineer`, "QA PIL 001 role changed", engineerContext), /Authentication required/);
    assert.deepEqual(await snapshot(migration), beforeRoleChangedMutation);
    await migration`update users set role = 'engineer', updated_at = now() where id = ${engineer.id}`;

    await migration`delete from user_sites where user_id = ${engineer.id} and site_id = ${pilotSiteId}`;
    const beforeSiteRevokedMutation = await snapshot(migration);
    await assert.rejects(() => renameTopology(engineer.email, `${prefix}_pilot_topology_engineer`, "QA PIL 001 site revoked", engineerContext), /Authentication required/);
    assert.deepEqual(await snapshot(migration), beforeSiteRevokedMutation);
    await migration`insert into user_sites (user_id, site_id) values (${engineer.id}, ${pilotSiteId})`;

    await migration`update users set disabled_at = now(), updated_at = now() where id = ${engineer.id}`;
    const beforeDisabledMutation = await snapshot(migration);
    await assert.rejects(() => renameTopology(engineer.email, `${prefix}_pilot_topology_engineer`, "QA PIL 001 disabled", engineerContext), /Authentication required/);
    assert.deepEqual(await snapshot(migration), beforeDisabledMutation);
  } finally {
    await cleanup(migration);
    const remaining = await snapshot(migration);
    assert.deepEqual(remaining, {
      customers: 0,
      topologies: 0,
      credentials: 0,
      audit_logs: 0,
      users: 0,
      sites: 0,
    });
    await migration.end({ timeout: 5 });
    restoreEnv();
  }
});
