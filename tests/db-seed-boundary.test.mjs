import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("demo seed dynamically loads only after policy gate and schema readiness remains runtime-owned", async () => {
  const seed = await readFile(new URL("../scripts/seed-demo.mjs", import.meta.url), "utf8");
  const repository = await readFile(new URL("../db/topology-postgres.ts", import.meta.url), "utf8");
  const seedStart = repository.indexOf("export async function seedDemoDatabase");
  const seedBody = repository.slice(seedStart);
  assert.ok(seed.indexOf("policy.capabilities.demoSeed") < seed.indexOf('import("../db/topology-postgres.ts")'));
  assert.match(seedBody, /withReadySql/);
  assert.doesNotMatch(seedBody, /runPostgresMigrations|create table|alter table/i);
  assert.match(seedBody, /on conflict/i);
});

test("formal dictionaries are migration content and do not depend on demo seed", async () => {
  const migration = await readFile(new URL("../db/migrations/0001_formal_topology_schema.sql", import.meta.url), "utf8");
  const seed = await readFile(new URL("../scripts/seed-demo.mjs", import.meta.url), "utf8");
  for (const table of ["roles", "permissions", "device_types", "group_kinds", "link_kinds"]) {
    assert.match(migration, new RegExp(`insert into ${table}`, "i"));
    assert.doesNotMatch(seed, new RegExp(`insert into ${table}`, "i"));
  }
});
