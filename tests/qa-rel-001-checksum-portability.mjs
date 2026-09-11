import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import { definePostgresMigrations } from "../db/postgres-migrations.js";
import { expectedPostgresMigrations } from "../db/postgres-schema-version.ts";
import { loadPostgresMigrationSources } from "../scripts/lib/load-postgres-migrations.mjs";

function publicMigrationShape(migrations) {
  return migrations.map(({ version, name, filename, checksum }) => ({ version, name, filename, checksum }));
}

async function main() {
  const sources = await loadPostgresMigrationSources();
  const loaded = publicMigrationShape(definePostgresMigrations(sources));

  assert.deepEqual(
    loaded,
    expectedPostgresMigrations,
    "worktree migration sources must match generated schema metadata",
  );

  const crlfSources = Object.fromEntries(
    Object.entries(sources).map(([filename, source]) => [
      filename,
      source.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"),
    ]),
  );
  const crlfLoaded = publicMigrationShape(definePostgresMigrations(crlfSources));
  assert.deepEqual(
    crlfLoaded,
    expectedPostgresMigrations,
    "CRLF migration sources must produce the same canonical checksums as LF sources",
  );

  for (const migration of expectedPostgresMigrations) {
    const changedSources = {
      ...sources,
      [migration.filename]: `${sources[migration.filename].replace(/\r\n/g, "\n")}\n-- qa-rel-001 semantic checksum probe\n`,
    };
    const changed = publicMigrationShape(definePostgresMigrations(changedSources))
      .find((entry) => entry.filename === migration.filename);
    assert.notEqual(
      changed?.checksum,
      migration.checksum,
      `real SQL content change must still alter checksum for ${migration.filename}`,
    );
  }

  const metadataSource = await readFile(new URL("../db/postgres-schema-version.ts", import.meta.url), "utf8");
  assert.doesNotMatch(metadataSource, /create table|alter table|insert into|\.sql\?raw|source/i);

  if (process.env.QA_REL_001_RUN_DB === "1") {
    for (const script of ["db:migrate", "db:verify"]) {
      const result = spawnSync("npm.cmd", ["run", script], {
        cwd: new URL("..", import.meta.url),
        encoding: "utf8",
      });
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
      assert.equal(result.status, 0, `${script} must pass; output was intentionally not printed to avoid secret leakage`);
      assert.doesNotMatch(output, /password|secret|token|cookie|postgres:\/\/|postgresql:\/\//i);
    }
  }
}

main()
  .then(() => {
    console.log("QA_REL_001 checksum portability candidate: PASS");
  })
  .catch((error) => {
    console.error(`QA_REL_001 checksum portability candidate: FAIL - ${error.message}`);
    process.exitCode = 1;
  });
