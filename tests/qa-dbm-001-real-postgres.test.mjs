import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";

import postgres from "postgres";

import {
  assertPostgresSchemaReady,
  evaluatePostgresSchemaStatus,
  readPostgresSchemaStatus,
  safePostgresSchemaError,
} from "../db/postgres-schema-check.ts";
import { expectedPostgresMigrations } from "../db/postgres-schema-version.ts";

const projectRoot = new URL("..", import.meta.url);
const logPath = new URL("../.local/logs/postgres.log", import.meta.url);
const envLocalPath = new URL("../.env.local", import.meta.url);
const approvedRedactedPasswordMarker = "[REDACTED_TOKEN]";

function parseDsn(name) {
  const value = process.env[name];
  assert.ok(value, `${name} is required`);
  const url = new URL(value);
  return {
    name,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: url.port || "5432",
    database: url.pathname.replace(/^\//, ""),
    origin: `${url.protocol}//${url.hostname}:${url.port || "5432"}/${url.pathname.replace(/^\//, "")}`,
    value,
  };
}

function secretLeakRegex() {
  const runtime = parseDsn("DATABASE_URL");
  const migration = parseDsn("MIGRATION_DATABASE_URL");
  const escaped = [runtime.password, migration.password, runtime.value, migration.value]
    .filter(Boolean)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(escaped.join("|"), "i");
}

function assertNoActiveSecret(text, label) {
  assert.doesNotMatch(text, secretLeakRegex(), `${label} leaked an active secret or full DSN`);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: process.env,
    ...options,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assertNoActiveSecret(output, `${command} ${args.join(" ")}`);
  return { status: result.status, output };
}

function runNpmScript(script) {
  return runCommand(process.env.ComSpec ?? "cmd.exe", ["/d", "/c", "npm.cmd", "run", script]);
}

async function expectDenied(operation, fn) {
  try {
    await fn();
  } catch (error) {
    return error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 120) : "denied";
  }
  throw new Error(`${operation} unexpectedly succeeded`);
}

function trackedFiles() {
  const output = execFileSync("git", ["ls-files"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  return output.split(/\r?\n/).filter(Boolean);
}

function readTextFile(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function trackedUsablePostgresDsnFallbackFiles() {
  const placeholderPattern = /REPLACE_WITH|\$\{|<|>|your_|placeholder|example|change_me|required|NETTOPO_/i;
  const dsnPattern = /postgres(?:ql)?:\/\/[^\s"'<>]+:[^\s"'<>@]+@[^\s"'<>]+/gi;
  const files = [];

  for (const file of trackedFiles()) {
    const content = readTextFile(new URL(`../${file}`, import.meta.url));
    const matches = content.matchAll(dsnPattern);
    for (const match of matches) {
      const dsn = match[0];
      if (!placeholderPattern.test(dsn)) {
        files.push(file);
        break;
      }
    }
  }

  return files;
}

function extractPowerShellFunctionBody(content, functionName) {
  const start = content.search(new RegExp(`function\\s+${functionName}\\b`, "i"));
  if (start < 0) return "";
  const open = content.indexOf("{", start);
  if (open < 0) return "";

  let depth = 0;
  for (let index = open; index < content.length; index += 1) {
    const char = content[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return content.slice(open + 1, index);
  }

  return "";
}

function legacyTrackedDefaultPasswordCandidates() {
  let historicalScript = "";
  try {
    historicalScript = execFileSync("git", ["show", "HEAD:scripts/postgres-local.ps1"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return [];
  }

  const body = extractPowerShellFunctionBody(historicalScript, "Get-LocalMigrationPassword");
  const candidates = new Set();
  const quotedLiteralPattern = /"([^"\r\n]{8,256})"/g;
  for (const match of body.matchAll(quotedLiteralPattern)) {
    const value = match[1];
    if (/\s/.test(value)) continue;
    if (/[$\\/:{}<>]/.test(value)) continue;
    if (/^(?:NETTOPO_|DATABASE_|MIGRATION_|POSTGRES_|Local|required|placeholder|REPLACE_WITH)/i.test(value)) continue;
    candidates.add(value);
  }

  return [...candidates];
}

async function assertCredentialsAreRejected(baseDsn, passwords, label) {
  for (const password of passwords) {
    assert.notEqual(password, baseDsn.password, `${label} candidate must not equal active credential`);
    const url = new URL(baseDsn.value);
    url.password = password;
    const sql = postgres(url.toString(), { max: 1, idle_timeout: 1, connect_timeout: 2, prepare: false });
    try {
      await sql`select 1`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assertNoActiveSecret(message, `${label} rejection message`);
      continue;
    } finally {
      await sql.end({ timeout: 1 }).catch(() => {});
    }
    throw new Error(`${label} candidate unexpectedly authenticated`);
  }
  return passwords.length;
}

function normalizeSqlPasswordOperand(rawOperand) {
  let operand = rawOperand.trim().replace(/[;,)]+$/g, "");

  if (operand.startsWith("'")) {
    if (!operand.endsWith("'")) return undefined;
    return operand.slice(1, -1).replace(/''/g, "'");
  }

  if (operand.startsWith('"')) {
    if (!operand.endsWith('"')) return undefined;
    return operand.slice(1, -1).replace(/""/g, '"');
  }

  return operand;
}

function parseRolePasswordStatements(text) {
  const statements = [];
  const pattern =
    /\b(?:create|alter)\s+role\b[^\r\n]{0,2000}?\bpassword\b\s+((?:'(?:[^']|'')*')|(?:"(?:[^"]|"")*")|\[[^\]\r\n]+\]|[^\s;,)]+)/gi;

  for (const match of text.matchAll(pattern)) {
    const normalizedOperand = normalizeSqlPasswordOperand(match[1]);
    statements.push({
      parseable: typeof normalizedOperand === "string" && normalizedOperand.length > 0,
      approved: normalizedOperand === approvedRedactedPasswordMarker,
    });
  }

  return statements;
}

function countRolePasswordStatementContexts(text) {
  return [...text.matchAll(/\b(?:create|alter)\s+role\b[^\r\n]{0,2000}?\bpassword\b/gi)].length;
}

test("QA_DBM_001 real PostgreSQL role, migration, schema, artifact, and secret boundaries", async () => {
  const runtimeDsn = parseDsn("DATABASE_URL");
  const migrationDsn = parseDsn("MIGRATION_DATABASE_URL");
  assert.equal(runtimeDsn.user, "nettopo_runtime");
  assert.equal(migrationDsn.user, "nettopo");
  assert.notEqual(runtimeDsn.user, migrationDsn.user);
  assert.equal(runtimeDsn.host, "127.0.0.1");
  assert.equal(migrationDsn.host, "127.0.0.1");
  assert.equal(runtimeDsn.database, "nettopo_studio");
  assert.equal(migrationDsn.database, "nettopo_studio");

  const runtime = postgres(process.env.DATABASE_URL, { max: 1, idle_timeout: 5, prepare: false });
  const migration = postgres(process.env.MIGRATION_DATABASE_URL, { max: 1, idle_timeout: 5, prepare: false });

  const unexpectedObjects = {
    table: "qa_dbm_001_runtime_should_not_create",
    tempTable: "qa_dbm_001_runtime_temp_should_not_create",
    schema: "qa_dbm_001_runtime_schema_should_not_create",
    role: "qa_dbm_001_should_not_exist",
    column: "qa_dbm_001_should_not_exist",
    customer: "qa_dbm_001_runtime_fixture",
  };

  try {
    const [role] = await migration`
      select rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
      from pg_roles
      where rolname = 'nettopo_runtime'
    `;
    assert.deepEqual(role, {
      rolcanlogin: true,
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolreplication: false,
      rolbypassrls: false,
    });

    const [inventory] = await migration`
      select
        (select pg_get_userbyid(datdba) from pg_database where datname = current_database()) as database_owner,
        (select pg_get_userbyid(nspowner) from pg_namespace where nspname = 'public') as public_schema_owner,
        (select count(*)::int from pg_tables where schemaname = 'public' and tableowner = 'nettopo') as nettopo_owned_tables,
        (select count(*)::int from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') as public_tables,
        (select count(*)::int from information_schema.sequences where sequence_schema = 'public') as public_sequences
    `;
    assert.equal(inventory.database_owner, "nettopo");
    assert.ok(inventory.public_schema_owner === "pg_database_owner" || inventory.public_schema_owner === "nettopo");
    assert.equal(inventory.nettopo_owned_tables, inventory.public_tables);

    const [databasePrivileges] = await migration`
      select
        has_database_privilege('nettopo_runtime', current_database(), 'CONNECT') as runtime_connect,
        has_database_privilege('nettopo_runtime', current_database(), 'CREATE') as runtime_create,
        has_database_privilege('nettopo_runtime', current_database(), 'TEMPORARY') as runtime_temporary,
        has_database_privilege('nettopo', current_database(), 'CREATE') as migration_create,
        has_database_privilege('nettopo', current_database(), 'TEMPORARY') as migration_temporary
    `;
    assert.deepEqual(databasePrivileges, {
      runtime_connect: true,
      runtime_create: false,
      runtime_temporary: false,
      migration_create: true,
      migration_temporary: true,
    });

    const [schemaPrivileges] = await migration`
      select
        has_schema_privilege('nettopo_runtime', 'public', 'USAGE') as runtime_usage,
        has_schema_privilege('nettopo_runtime', 'public', 'CREATE') as runtime_schema_create
    `;
    assert.deepEqual(schemaPrivileges, { runtime_usage: true, runtime_schema_create: false });

    const [tableGrants] = await migration`
      select
        count(*) filter (where privilege_type = 'SELECT')::int as select_count,
        count(*) filter (where privilege_type = 'INSERT')::int as insert_count,
        count(*) filter (where privilege_type = 'UPDATE')::int as update_count,
        count(*) filter (where privilege_type = 'DELETE')::int as delete_count
      from information_schema.role_table_grants
      where grantee = 'nettopo_runtime' and table_schema = 'public'
    `;
    assert.equal(tableGrants.select_count, inventory.public_tables);
    assert.equal(tableGrants.insert_count, inventory.public_tables);
    assert.equal(tableGrants.update_count, inventory.public_tables);
    assert.equal(tableGrants.delete_count, inventory.public_tables);

    const defaultPrivileges = await migration`
      select defaclobjtype, defaclacl::text as acl
      from pg_default_acl
      where defaclrole = 'nettopo'::regrole
      order by defaclobjtype
    `;
    assert.ok(defaultPrivileges.some((row) => row.defaclobjtype === "r" && row.acl.includes("nettopo_runtime=arwd/nettopo")));
    assert.ok(defaultPrivileges.some((row) => row.defaclobjtype === "S" && row.acl.includes("nettopo_runtime=rU/nettopo")));

    const [readCheck] = await runtime`select count(*)::int as customers from customers`;
    assert.ok(Number.isInteger(readCheck.customers));

    class RollbackFixture extends Error {}
    try {
      await runtime.begin(async (tx) => {
        await tx`
          insert into customers (id, name, notes, created_at, updated_at)
          values (${unexpectedObjects.customer}, 'QA DBM 001 fixture', 'rollback fixture', now(), now())
        `;
        await tx`update customers set notes = 'rollback fixture updated' where id = ${unexpectedObjects.customer}`;
        const [inside] = await tx`select count(*)::int as count from customers where id = ${unexpectedObjects.customer}`;
        assert.equal(inside.count, 1);
        await tx`delete from customers where id = ${unexpectedObjects.customer}`;
        const [afterDelete] = await tx`select count(*)::int as count from customers where id = ${unexpectedObjects.customer}`;
        assert.equal(afterDelete.count, 0);
        throw new RollbackFixture("rollback fixture");
      });
    } catch (error) {
      if (!(error instanceof RollbackFixture)) throw error;
    }
    const [afterRollback] = await runtime`select count(*)::int as count from customers where id = ${unexpectedObjects.customer}`;
    assert.equal(afterRollback.count, 0);

    const denies = {
      createTable: await expectDenied("CREATE TABLE", () => runtime.unsafe(`create table public.${unexpectedObjects.table} (id text primary key)`)),
      createTempTable: await expectDenied("CREATE TEMP TABLE", () => runtime.unsafe(`create temp table ${unexpectedObjects.tempTable} (id text primary key)`)),
      createSchema: await expectDenied("CREATE SCHEMA", () => runtime.unsafe(`create schema ${unexpectedObjects.schema}`)),
      alterTable: await expectDenied("ALTER TABLE", () => runtime.unsafe(`alter table public.customers add column ${unexpectedObjects.column} text`)),
      dropTable: await expectDenied("DROP TABLE", () => runtime.unsafe("drop table public.customers")),
      createRole: await expectDenied("CREATE ROLE", () => runtime.unsafe(`create role ${unexpectedObjects.role}`)),
    };
    for (const message of Object.values(denies)) {
      assert.match(message, /permission denied|must be owner|temporary tables|create role/i);
    }

    const [cleanup] = await migration`
      select
        to_regclass('public.qa_dbm_001_runtime_should_not_create') is not null as unexpected_table,
        exists(select 1 from information_schema.schemata where schema_name = 'qa_dbm_001_runtime_schema_should_not_create') as unexpected_schema,
        exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'customers' and column_name = 'qa_dbm_001_should_not_exist') as unexpected_column,
        exists(select 1 from pg_roles where rolname = 'qa_dbm_001_should_not_exist') as unexpected_role,
        exists(select 1 from customers where id = 'qa_dbm_001_runtime_fixture') as unexpected_customer
    `;
    assert.deepEqual(cleanup, {
      unexpected_table: false,
      unexpected_schema: false,
      unexpected_column: false,
      unexpected_role: false,
      unexpected_customer: false,
    });

    const readyStatus = await readPostgresSchemaStatus(runtime);
    assert.equal(readyStatus.ready, true);
    assert.equal(readyStatus.state, "ready");
    assert.equal(readyStatus.currentVersion, "0004");
    await assertPostgresSchemaReady(runtime, true);

    assert.equal(evaluatePostgresSchemaStatus([]).state, "uninitialized");
    assert.equal(evaluatePostgresSchemaStatus(expectedPostgresMigrations.slice(0, 3)).state, "outdated");
    assert.equal(evaluatePostgresSchemaStatus([...expectedPostgresMigrations, { version: "9999", checksum: "x" }]).state, "too_new");
    assert.equal(evaluatePostgresSchemaStatus([{ ...expectedPostgresMigrations[0], checksum: "bad" }, ...expectedPostgresMigrations.slice(1)]).state, "checksum_mismatch");
    for (const rows of [
      [],
      expectedPostgresMigrations.slice(0, 3),
      [...expectedPostgresMigrations, { version: "9999", checksum: "x" }],
      [{ ...expectedPostgresMigrations[0], checksum: "bad" }, ...expectedPostgresMigrations.slice(1)],
    ]) {
      assertNoActiveSecret(JSON.stringify(safePostgresSchemaError(evaluatePostgresSchemaStatus(rows))), "safe schema error");
    }

    const migrate = runNpmScript("db:migrate");
    assert.equal(migrate.status, 0);
    assert.match(migrate.output, /Applied: none\. Skipped: 4/);

    const verify = runNpmScript("db:verify");
    assert.equal(verify.status, 0);
    assert.match(verify.output, /"?ready"?\s*:?\s*true/i);
    assert.match(verify.output, /"?currentVersion"?\s*:?\s*"?0004"?/i);

    const [{ checksum: originalChecksum }] = await migration`select checksum from schema_migrations where version = '0001'`;
    assert.ok(originalChecksum);
    try {
      await migration`update schema_migrations set checksum = 'qa-db-mismatch' where version = '0001'`;
      const mismatchMigrate = runCommand(process.execPath, ["--env-file-if-exists=.env.local", "--env-file-if-exists=.env", "scripts/migrate-postgres.mjs"]);
      assert.notEqual(mismatchMigrate.status, 0);
      assert.match(mismatchMigrate.output, /changed after it was applied/i);
      await assert.rejects(() => assertPostgresSchemaReady(runtime, true), /DATABASE_SCHEMA_CHECKSUM_MISMATCH/);
    } finally {
      await migration`update schema_migrations set checksum = ${originalChecksum} where version = '0001'`;
    }
    await new Promise((resolve) => setTimeout(resolve, 5_250));
    const recovered = await assertPostgresSchemaReady(runtime);
    assert.equal(recovered.ready, true);
    assert.equal(recovered.currentVersion, "0004");

    const postRecoveryVerify = runNpmScript("db:verify");
    assert.equal(postRecoveryVerify.status, 0);
    assert.match(postRecoveryVerify.output, /"?ready"?\s*:?\s*true/i);

    const artifactScan = runCommand("powershell", [
      "-NoProfile",
      "-Command",
      "if (Test-Path dist) { rg -n \"db/migrations|load-postgres-migrations|runPostgresMigrations|node:fs|\\.sql\\?raw|create table if not exists roles|alter table roles|insert into roles\" dist }",
    ]);
    assert.notEqual(artifactScan.status, 0);

    assert.equal(existsSync(envLocalPath), true);
    const ignored = runCommand("git", ["check-ignore", "-q", ".env.local"]);
    assert.equal(ignored.status, 0);

    const activeSecret = secretLeakRegex();
    const leakedTrackedFiles = [];
    for (const file of trackedFiles()) {
      const content = readTextFile(new URL(`../${file}`, import.meta.url));
      if (activeSecret.test(content)) leakedTrackedFiles.push(file);
    }
    assert.deepEqual(leakedTrackedFiles, []);
    assert.deepEqual(trackedUsablePostgresDsnFallbackFiles(), []);
    const rejectedLegacyCandidateCount = await assertCredentialsAreRejected(
      migrationDsn,
      legacyTrackedDefaultPasswordCandidates(),
      "legacy tracked default credential",
    );

    const localLog = existsSync(logPath) ? readTextFile(logPath) : "";
    assertNoActiveSecret(localLog, "local postgres log");
    assert.equal(/postgres(?:ql)?:\/\/\S+:\S+@/i.test(localLog), false, "local postgres log contains a full DSN pattern");
    const rolePasswordStatements = parseRolePasswordStatements(localLog);
    assert.equal(
      rolePasswordStatements.length,
      countRolePasswordStatementContexts(localLog),
      "local postgres log contains an unparseable role-password statement context",
    );
    assert.equal(
      rolePasswordStatements.every((statement) => statement.parseable),
      true,
      "local postgres log contains an unparseable role-password operand",
    );
    assert.equal(
      rolePasswordStatements.every((statement) => statement.approved),
      true,
      "local postgres log contains an unapproved role-password operand",
    );

    const summary = {
      dsnUsers: {
        runtime: runtimeDsn.user,
        migration: migrationDsn.user,
        host: runtimeDsn.host,
        port: runtimeDsn.port,
        database: runtimeDsn.database,
      },
      inventory: {
        databaseOwner: inventory.database_owner,
        publicSchemaOwner: inventory.public_schema_owner,
        publicTables: inventory.public_tables,
        nettopoOwnedTables: inventory.nettopo_owned_tables,
        publicSequences: inventory.public_sequences,
      },
      runtimeDdlDenied: Object.fromEntries(Object.keys(denies).map((key) => [key, true])),
      schemaReady: true,
      migrationIdempotent: true,
      checksumMismatchFailSafe: true,
      ttlRecovery: true,
      artifactBoundary: true,
      secretBoundary: true,
      trackedUsableDsnFallbacks: 0,
      legacyTrackedDefaultCandidatesChecked: rejectedLegacyCandidateCount,
      localLogRolePasswordStatements: rolePasswordStatements.length,
      localLogRolePasswordOperandsApproved: true,
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await migration`delete from customers where id = 'qa_dbm_001_runtime_fixture'`;
    await migration`drop table if exists public.qa_dbm_001_runtime_should_not_create`;
    await migration`drop schema if exists qa_dbm_001_runtime_schema_should_not_create cascade`;
    await migration.end({ timeout: 5 });
    await runtime.end({ timeout: 5 });
  }
});
