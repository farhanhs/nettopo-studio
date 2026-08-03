import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { definePostgresMigrations, runPostgresMigrations } from "../db/postgres-migrations.js";

const migrationsDirectory = fileURLToPath(new URL("../db/migrations/", import.meta.url));

async function loadMigrationSources() {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name);
  const sources = {};

  for (const filename of filenames) {
    sources[filename] = await readFile(join(migrationsDirectory, filename), "utf8");
  }

  return sources;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to run PostgreSQL migrations.");

  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 5,
    prepare: false,
  });

  try {
    const migrations = definePostgresMigrations(await loadMigrationSources());
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
