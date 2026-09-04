import { writeFile } from "node:fs/promises";
import { definePostgresMigrations } from "../db/postgres-migrations.js";
import { loadPostgresMigrationSources } from "./lib/load-postgres-migrations.mjs";

async function main() {
  const migrations = definePostgresMigrations(await loadPostgresMigrationSources());
  const requiredVersion = migrations.at(-1)?.version;
  if (!requiredVersion) throw new Error("No PostgreSQL migrations found.");

const body = `export type PostgresMigrationExpectation = {
  version: string;
  name: string;
  filename: string;
  checksum: string;
  compatibleChecksums?: Array<{
    checksum: string;
    reason: "legacy_raw_crlf";
  }>;
};

export const requiredPostgresSchemaVersion = ${JSON.stringify(requiredVersion)};

export const expectedPostgresMigrations: PostgresMigrationExpectation[] = ${JSON.stringify(
    migrations.map(({ version, name, filename, checksum, compatibleChecksums }) => ({
      version,
      name,
      filename,
      checksum,
      ...(compatibleChecksums?.length ? { compatibleChecksums } : {}),
    })),
    null,
    2,
  )};
`;

  await writeFile(new URL("../db/postgres-schema-version.ts", import.meta.url), body, "utf8");
  console.log(`Generated db/postgres-schema-version.ts for PostgreSQL schema ${requiredVersion}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
