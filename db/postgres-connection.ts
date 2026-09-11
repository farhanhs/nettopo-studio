import postgres from "postgres";

function postgresOptions(max = Number(process.env.POSTGRES_POOL_MAX ?? 1)) {
  return {
    max,
    idle_timeout: 20,
    prepare: false,
  };
}

export function createRuntimeSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required when NEXT_PUBLIC_TOPOLOGY_STORAGE=server.");
  }
  return postgres(databaseUrl, postgresOptions());
}

export function createMigrationSql() {
  const databaseUrl = process.env.MIGRATION_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("MIGRATION_DATABASE_URL is required to run PostgreSQL migrations.");
  }
  return postgres(databaseUrl, postgresOptions(1));
}
