import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { definePostgresMigrations, runPostgresMigrations } from "../db/postgres-migrations.js";

function fakePostgres(appliedRows = []) {
  const executedSql = [];
  const tx = (strings) => {
    const statement = strings.join("?").replace(/\s+/g, " ").trim();
    executedSql.push(statement);
    return Promise.resolve(statement.startsWith("select version, checksum") ? appliedRows : []);
  };
  tx.unsafe = (source) => ({
    simple: async () => {
      executedSql.push(source);
      return [];
    },
  });
  return {
    executedSql,
    sql: { begin: async (callback) => callback(tx) },
  };
}

test("PostgreSQL migrations are ordered, versioned, and idempotent", async () => {
  const filename = "0001_formal_topology_schema.sql";
  const source = await readFile(new URL(`../db/migrations/${filename}`, import.meta.url), "utf8");
  const migrations = definePostgresMigrations({ [filename]: source });

  assert.ok(migrations.length > 0);
  assert.equal(migrations[0].version, "0001");
  assert.equal(migrations[0].filename, "0001_formal_topology_schema.sql");
  assert.match(migrations[0].checksum, /^[a-f0-9]{64}$/);
  assert.match(migrations[0].source, /create table if not exists users/i);
  assert.match(migrations[0].source, /create table if not exists topologies/i);
  assert.match(migrations[0].source, /create table if not exists device_credentials/i);
  assert.match(migrations[0].source, /create table if not exists audit_logs/i);
});

test("migration directory contains one SQL file per version", async () => {
  const directory = new URL("../db/migrations/", import.meta.url);
  const filenames = (await readdir(directory)).filter((filename) => filename.endsWith(".sql"));
  const entries = Object.fromEntries(await Promise.all(filenames.map(async (filename) => [
    filename,
    await readFile(new URL(filename, directory), "utf8"),
  ])));
  const migrations = definePostgresMigrations(entries);

  assert.deepEqual(migrations.map((migration) => migration.version), ["0001", "0002", "0003", "0004"]);
});

test("dictionary constraints are delivered as a second immutable migration", async () => {
  const filenames = ["0001_formal_topology_schema.sql", "0002_dictionary_constraints.sql"];
  const entries = Object.fromEntries(await Promise.all(filenames.map(async (filename) => [
    filename,
    await readFile(new URL(`../db/migrations/${filename}`, import.meta.url), "utf8"),
  ])));
  const migrations = definePostgresMigrations(entries);

  assert.deepEqual(migrations.map((migration) => migration.version), ["0001", "0002"]);
  assert.match(migrations[1].source, /char_length\(email\).*254/i);
  assert.match(migrations[1].source, /users_email_half_width_check/i);
  assert.match(migrations[1].source, /topology_devices_mac_check/i);
  assert.match(migrations[1].source, /topology_links_distinct_devices_check/i);
});

test("project device credentials are added in a separate migration", async () => {
  const filename = "0003_project_device_credentials.sql";
  const source = await readFile(new URL(`../db/migrations/${filename}`, import.meta.url), "utf8");
  const migrations = definePostgresMigrations({ [filename]: source });

  assert.equal(migrations[0].version, "0003");
  assert.match(source, /add column if not exists project_device_id/i);
  assert.match(source, /create unique index if not exists device_credentials_project_device_kind_idx/i);
});

test("quantity nodes and collapsible groups use a separate migration", async () => {
  const filename = "0004_topology_quantity_and_collapse.sql";
  const source = await readFile(new URL(`../db/migrations/${filename}`, import.meta.url), "utf8");
  const migrations = definePostgresMigrations({ [filename]: source });

  assert.equal(migrations[0].version, "0004");
  assert.match(source, /add column if not exists quantity/i);
  assert.match(source, /add column if not exists collapsed/i);
  assert.match(source, /'mesh-node'/i);
});

test("runtime repository uses migrations instead of embedded create-table DDL", async () => {
  const source = await readFile(new URL("../db/topology-postgres.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /create\s+table/i);
  assert.match(source, /runPostgresMigrations/);
});

test("migration runner applies a new migration and records it", async () => {
  const migrations = definePostgresMigrations({ "0001_test.sql": "create table if not exists test_table (id text);" });
  const database = fakePostgres();

  const result = await runPostgresMigrations(database.sql, migrations);

  assert.deepEqual(result, { applied: ["0001_test.sql"], skipped: [] });
  assert.ok(database.executedSql.some((statement) => statement.includes("create table if not exists test_table")));
  assert.ok(database.executedSql.some((statement) => statement.startsWith("insert into schema_migrations")));
});

test("migration runner skips a migration with the recorded checksum", async () => {
  const migrations = definePostgresMigrations({ "0001_test.sql": "select 1;" });
  const database = fakePostgres([{ version: "0001", checksum: migrations[0].checksum }]);

  const result = await runPostgresMigrations(database.sql, migrations);

  assert.deepEqual(result, { applied: [], skipped: ["0001_test.sql"] });
  assert.equal(database.executedSql.includes("select 1;"), false);
});

test("migration runner rejects an edited migration", async () => {
  const migrations = definePostgresMigrations({ "0001_test.sql": "select 1;" });
  const database = fakePostgres([{ version: "0001", checksum: "different-checksum" }]);

  await assert.rejects(
    runPostgresMigrations(database.sql, migrations),
    /was changed after it was applied/,
  );
});
