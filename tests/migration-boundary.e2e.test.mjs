import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("runtime graph and build artifact stay free of migration SQL", async () => {
  const runtimePaths = [
    "db/topology-postgres.ts", "db/postgres-schema-check.ts", "db/postgres-schema-version.ts",
    "app/api/topology/route.ts", "app/api/credentials/route.ts", "app/api/audit-logs/route.ts",
    "app/api/session/route.ts", "app/api/health/schema/route.ts",
  ];
  const runtime = (await Promise.all(runtimePaths.map((path) => readFile(new URL(path, root), "utf8")))).join("\n");
  assert.doesNotMatch(runtime, /db\/migrations|\.sql\?raw|node:fs|runPostgresMigrations|postgres-migration-manifest/);
  assert.doesNotMatch(runtime, /create\s+table|alter\s+table|insert\s+into\s+roles/i);

  const artifactFiles = await walk(new URL("../dist/", import.meta.url));
  const artifact = (await Promise.all(artifactFiles.filter((p) => /\.(?:js|json|html)$/.test(p.pathname)).map((p) => readFile(p, "utf8")))).join("\n");
  assert.doesNotMatch(artifact, /\.sql\?raw|postgres-migration-manifest|create table if not exists roles|alter table roles|insert into roles/i);
});

test("migration and runtime connection credentials cannot fall back across boundaries", async () => {
  const connection = await readFile(new URL("db/postgres-connection.ts", root), "utf8");
  const migrate = await readFile(new URL("scripts/migrate-postgres.mjs", root), "utf8");
  const verify = await readFile(new URL("scripts/verify-postgres-schema.mjs", root), "utf8");
  assert.match(migrate, /createMigrationSql/);
  assert.doesNotMatch(migrate, /DATABASE_URL/);
  assert.match(verify, /createRuntimeSql/);
  assert.doesNotMatch(verify, /createMigrationSql|insert|update|delete/i);
  const migrationFactory = connection.slice(connection.indexOf("export function createMigrationSql"));
  assert.match(migrationFactory, /MIGRATION_DATABASE_URL/);
  assert.doesNotMatch(migrationFactory, /process\.env\.DATABASE_URL|\?\?/);
});

test("migration set ends at 0004 and local setup never seeds demo", async () => {
  const migrations = (await readdir(new URL("db/migrations/", root))).filter((name) => name.endsWith(".sql")).sort();
  assert.equal(migrations.at(-1), "0004_topology_quantity_and_collapse.sql");
  assert.equal(migrations.some((name) => name.startsWith("0005")), false);
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.match(pkg.scripts["db:local:setup"], /db:migrate.*db:verify/);
  assert.doesNotMatch(pkg.scripts["db:local:setup"], /seed/);
});

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(new URL(`${entry.name}/`, directory)) : [new URL(entry.name, directory)]));
  return nested.flat();
}
