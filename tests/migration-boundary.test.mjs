import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import { canonicalizePostgresMigrationSource, definePostgresMigrations } from "../db/postgres-migrations.js";
import { expectedPostgresMigrations } from "../db/postgres-schema-version.ts";
import { loadPostgresMigrationSources } from "../scripts/lib/load-postgres-migrations.mjs";

test("Node direct import of runtime repository does not load SQL modules", async () => {
  const topologyRepository = await import("../db/topology-postgres.ts");
  assert.equal(typeof topologyRepository.readTopologyDataset, "function");
});

test("runtime PostgreSQL module graph does not import migration-only dependencies", async () => {
  const runtimeFiles = [
    "../db/topology-postgres.ts",
    "../db/postgres-schema-check.ts",
    "../db/postgres-schema-version.ts",
    "../app/api/topology/route.ts",
    "../app/api/credentials/route.ts",
    "../app/api/audit-logs/route.ts",
    "../app/api/session/route.ts",
    "../app/api/health/schema/route.ts",
  ];
  const source = (await Promise.all(runtimeFiles.map((file) => readFile(new URL(file, import.meta.url), "utf8")))).join("\n");

  assert.doesNotMatch(source, /db\/migrations|\.sql\?raw|node:fs|runPostgresMigrations|postgres-migration-manifest/);
});

test("migration CLI uses MIGRATION_DATABASE_URL and runtime verify uses DATABASE_URL", async () => {
  const [migrateSource, verifySource, connectionSource] = await Promise.all([
    readFile(new URL("../scripts/migrate-postgres.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/verify-postgres-schema.mjs", import.meta.url), "utf8"),
    readFile(new URL("../db/postgres-connection.ts", import.meta.url), "utf8"),
  ]);

  assert.match(migrateSource, /createMigrationSql/);
  assert.doesNotMatch(migrateSource, /process\.env\.DATABASE_URL/);
  assert.match(verifySource, /createRuntimeSql/);
  assert.match(connectionSource, /MIGRATION_DATABASE_URL/);
  const migrationConnection = connectionSource.slice(connectionSource.indexOf("export function createMigrationSql"));
  assert.doesNotMatch(migrationConnection, /DATABASE_URL\s*\?\?|process\.env\.DATABASE_URL/);
});

test("runtime schema checker is read-only and does not write migration records", async () => {
  const source = await readFile(new URL("../db/postgres-schema-check.ts", import.meta.url), "utf8");
  assert.match(source, /select[\s\S]*schema_migrations/i);
  assert.doesNotMatch(source, /insert\s+into\s+schema_migrations|create\s+table|alter\s+table|drop\s+table/i);
});

test("generated schema version metadata is synchronized with SQL migrations and contains no SQL body", async () => {
  const generated = expectedPostgresMigrations;
  const loaded = definePostgresMigrations(await loadPostgresMigrationSources())
    .map(({ version, name, filename, checksum, compatibleChecksums }) => ({
      version,
      name,
      filename,
      checksum,
      ...(compatibleChecksums?.length ? { compatibleChecksums } : {}),
    }));
  const source = await readFile(new URL("../db/postgres-schema-version.ts", import.meta.url), "utf8");

  assert.deepEqual(generated, loaded);
  assert.doesNotMatch(source, /create table|alter table|insert into|\.sql\?raw|source/i);
});

test("generated schema metadata matches CRLF migration checkout text", async () => {
  const lfSources = await loadPostgresMigrationSources();
  const crlfSources = Object.fromEntries(
    Object.entries(lfSources).map(([filename, source]) => [
      filename,
      canonicalizePostgresMigrationSource(filename, source).canonicalSource.replaceAll("\n", "\r\n"),
    ]),
  );
  const loaded = definePostgresMigrations(crlfSources)
    .map(({ version, name, filename, checksum, compatibleChecksums }) => ({
      version,
      name,
      filename,
      checksum,
      ...(compatibleChecksums?.length ? { compatibleChecksums } : {}),
    }));

  assert.deepEqual(expectedPostgresMigrations, loaded);
});

test("no empty forward migration was created for the boundary refactor", async () => {
  const filenames = (await readdir(new URL("../db/migrations/", import.meta.url))).filter((filename) => filename.endsWith(".sql"));
  assert.deepEqual(filenames.sort(), [
    "0001_formal_topology_schema.sql",
    "0002_dictionary_constraints.sql",
    "0003_project_device_credentials.sql",
    "0004_topology_quantity_and_collapse.sql",
  ]);
});
