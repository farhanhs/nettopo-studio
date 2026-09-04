import type { Sql } from "postgres";
import {
  expectedPostgresMigrations,
  requiredPostgresSchemaVersion,
  type PostgresMigrationExpectation,
} from "./postgres-schema-version.ts";

export type PostgresSchemaState =
  | "ready"
  | "uninitialized"
  | "outdated"
  | "too_new"
  | "checksum_mismatch"
  | "unavailable";

export type MigrationBoundaryErrorCode =
  | "DATABASE_SCHEMA_UNINITIALIZED"
  | "DATABASE_SCHEMA_OUTDATED"
  | "DATABASE_SCHEMA_TOO_NEW"
  | "DATABASE_SCHEMA_CHECKSUM_MISMATCH"
  | "DATABASE_UNAVAILABLE";

export type PostgresSchemaStatus = {
  ready: boolean;
  state: PostgresSchemaState;
  requiredVersion: string;
  currentVersion?: string;
  appliedVersions: string[];
  missingVersions: string[];
  incompatibleVersions: string[];
  checksumMismatches: Array<{
    version: string;
    expectedChecksum: string;
    actualChecksum: string;
  }>;
  checkedAt: string;
  errorCode?: MigrationBoundaryErrorCode;
};

type SchemaMigrationRow = {
  version: string;
  checksum: string;
};

type TableStatusRow = {
  schema_migrations_exists: boolean;
  users_exists: boolean;
  topologies_exists: boolean;
};

const READY_TTL_MS = 30_000;
const FAILURE_TTL_MS = 5_000;
const CHECK_TIMEOUT_MS = 2_000;

let cachedStatus: { status: PostgresSchemaStatus; expiresAt: number } | undefined;

function nowIso() {
  return new Date().toISOString();
}

function unavailableStatus(): PostgresSchemaStatus {
  return {
    ready: false,
    state: "unavailable",
    requiredVersion: requiredPostgresSchemaVersion,
    appliedVersions: [],
    missingVersions: expectedPostgresMigrations.map((migration) => migration.version),
    incompatibleVersions: [],
    checksumMismatches: [],
    checkedAt: nowIso(),
    errorCode: "DATABASE_UNAVAILABLE",
  };
}

function errorCodeForState(state: PostgresSchemaState): MigrationBoundaryErrorCode | undefined {
  switch (state) {
    case "uninitialized":
      return "DATABASE_SCHEMA_UNINITIALIZED";
    case "outdated":
      return "DATABASE_SCHEMA_OUTDATED";
    case "too_new":
      return "DATABASE_SCHEMA_TOO_NEW";
    case "checksum_mismatch":
      return "DATABASE_SCHEMA_CHECKSUM_MISMATCH";
    case "unavailable":
      return "DATABASE_UNAVAILABLE";
    case "ready":
      return undefined;
  }
}

function compareVersion(left: string | undefined, right: string | undefined) {
  return (left ?? "").localeCompare(right ?? "", "en", { numeric: true });
}

function isCompatibleMigrationChecksum(row: SchemaMigrationRow, expected: PostgresMigrationExpectation) {
  if (row.checksum === expected.checksum) return true;
  return Boolean(expected.compatibleChecksums?.some(({ checksum }) => checksum === row.checksum));
}

export function evaluatePostgresSchemaStatus(
  appliedRows: SchemaMigrationRow[],
  expectations: PostgresMigrationExpectation[] = expectedPostgresMigrations,
): PostgresSchemaStatus {
  const expectedByVersion = new Map(expectations.map((migration) => [migration.version, migration]));
  const appliedVersions = appliedRows.map((row) => row.version).sort((left, right) => compareVersion(left, right));
  const currentVersion = appliedVersions.at(-1);
  const missingVersions = expectations
    .filter((migration) => !appliedRows.some((row) => row.version === migration.version))
    .map((migration) => migration.version);
  const incompatibleVersions = appliedVersions.filter((version) => !expectedByVersion.has(version));
  const checksumMismatches = appliedRows
    .map((row) => {
      const expected = expectedByVersion.get(row.version);
      if (!expected || isCompatibleMigrationChecksum(row, expected)) return undefined;
      return {
        version: row.version,
        expectedChecksum: expected.checksum,
        actualChecksum: row.checksum,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  let state: PostgresSchemaState = "ready";
  if (appliedRows.length === 0) state = "uninitialized";
  else if (checksumMismatches.length > 0) state = "checksum_mismatch";
  else if (incompatibleVersions.length > 0 || compareVersion(currentVersion, requiredPostgresSchemaVersion) > 0) state = "too_new";
  else if (missingVersions.length > 0 || compareVersion(currentVersion, requiredPostgresSchemaVersion) < 0) state = "outdated";

  return {
    ready: state === "ready",
    state,
    requiredVersion: requiredPostgresSchemaVersion,
    currentVersion,
    appliedVersions,
    missingVersions,
    incompatibleVersions,
    checksumMismatches,
    checkedAt: nowIso(),
    errorCode: errorCodeForState(state),
  };
}

async function withTimeout<T>(operation: Promise<T>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("PostgreSQL schema check timed out.")), CHECK_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function readPostgresSchemaStatus(sql: Sql): Promise<PostgresSchemaStatus> {
  try {
    return await withTimeout((async () => {
      const [tableStatus] = await sql<TableStatusRow[]>`
        select
          to_regclass('public.schema_migrations') is not null as schema_migrations_exists,
          to_regclass('public.users') is not null as users_exists,
          to_regclass('public.topologies') is not null as topologies_exists
      `;
      if (!tableStatus?.schema_migrations_exists || !tableStatus.users_exists || !tableStatus.topologies_exists) {
        return {
          ready: false,
          state: "uninitialized",
          requiredVersion: requiredPostgresSchemaVersion,
          appliedVersions: [],
          missingVersions: expectedPostgresMigrations.map((migration) => migration.version),
          incompatibleVersions: [],
          checksumMismatches: [],
          checkedAt: nowIso(),
          errorCode: "DATABASE_SCHEMA_UNINITIALIZED",
        };
      }

      const appliedRows = await sql<SchemaMigrationRow[]>`
        select version, checksum
        from schema_migrations
        order by version
      `;
      return evaluatePostgresSchemaStatus(appliedRows);
    })());
  } catch {
    return unavailableStatus();
  }
}

export class PostgresSchemaNotReadyError extends Error {
  status: PostgresSchemaStatus;

  constructor(status: PostgresSchemaStatus) {
    super(status.errorCode ?? "DATABASE_SCHEMA_NOT_READY");
    this.name = "PostgresSchemaNotReadyError";
    this.status = status;
  }
}

export async function assertPostgresSchemaReady(sql: Sql, fresh = false) {
  const now = Date.now();
  if (!fresh && cachedStatus && cachedStatus.expiresAt > now) {
    if (cachedStatus.status.ready) return cachedStatus.status;
    throw new PostgresSchemaNotReadyError(cachedStatus.status);
  }

  const status = await readPostgresSchemaStatus(sql);
  cachedStatus = {
    status,
    expiresAt: now + (status.ready ? READY_TTL_MS : FAILURE_TTL_MS),
  };
  if (!status.ready) throw new PostgresSchemaNotReadyError(status);
  return status;
}

export function schemaStatusAction(status: PostgresSchemaStatus) {
  switch (status.errorCode) {
    case "DATABASE_SCHEMA_UNINITIALIZED":
      return "run db:migrate";
    case "DATABASE_SCHEMA_OUTDATED":
      return "run migration before serving traffic";
    case "DATABASE_SCHEMA_TOO_NEW":
      return "app too old; deploy compatible app version";
    case "DATABASE_SCHEMA_CHECKSUM_MISMATCH":
      return "stop deployment; do not edit published migration; create forward migration if needed";
    case "DATABASE_UNAVAILABLE":
      return "check DB/network/credentials";
    default:
      return "schema ready";
  }
}

export function safePostgresSchemaError(status: PostgresSchemaStatus) {
  const response: Record<string, unknown> = {
    error: status.errorCode ?? "DATABASE_SCHEMA_NOT_READY",
    requiredVersion: status.requiredVersion,
    action: schemaStatusAction(status),
  };
  if (status.currentVersion) response.currentVersion = status.currentVersion;
  if (status.state === "checksum_mismatch" && status.checksumMismatches[0]) {
    response.version = status.checksumMismatches[0].version;
  }
  return response;
}
