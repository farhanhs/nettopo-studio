import { createMigrationSql } from "../db/postgres-connection.ts";
import { definePostgresMigrations, runPostgresMigrations } from "../db/postgres-migrations.js";
import { loadPostgresMigrationSources } from "./lib/load-postgres-migrations.mjs";

async function main() {
  const sql = createMigrationSql();

  try {
    const migrations = definePostgresMigrations(await loadPostgresMigrationSources());
    const result = await runPostgresMigrations(sql, migrations);
    const applied = result.applied.length > 0 ? result.applied.join(", ") : "none";
    console.log(`PostgreSQL migrations complete. Applied: ${applied}. Skipped: ${result.skipped.length}.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
