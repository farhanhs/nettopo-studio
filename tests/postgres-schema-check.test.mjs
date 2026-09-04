import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluatePostgresSchemaStatus,
  readPostgresSchemaStatus,
  safePostgresSchemaError,
} from "../db/postgres-schema-check.ts";
import { expectedPostgresMigrations, requiredPostgresSchemaVersion } from "../db/postgres-schema-version.ts";

const applied = expectedPostgresMigrations.map(({ version, checksum }) => ({ version, checksum }));

test("schema status reports ready when every expected migration is applied", () => {
  const status = evaluatePostgresSchemaStatus(applied);

  assert.equal(status.ready, true);
  assert.equal(status.state, "ready");
  assert.equal(status.requiredVersion, requiredPostgresSchemaVersion);
  assert.equal(status.currentVersion, requiredPostgresSchemaVersion);
  assert.deepEqual(status.missingVersions, []);
  assert.deepEqual(status.incompatibleVersions, []);
  assert.deepEqual(status.checksumMismatches, []);
});

test("schema status accepts deterministic legacy raw CRLF migration checksums", () => {
  const legacyApplied = expectedPostgresMigrations.map((migration) => ({
    version: migration.version,
    checksum: migration.compatibleChecksums?.[0]?.checksum ?? migration.checksum,
  }));
  const status = evaluatePostgresSchemaStatus(legacyApplied);

  assert.equal(status.ready, true);
  assert.equal(status.state, "ready");
  assert.deepEqual(status.checksumMismatches, []);
});

test("schema status reports uninitialized and outdated states", () => {
  assert.equal(evaluatePostgresSchemaStatus([]).state, "uninitialized");

  const status = evaluatePostgresSchemaStatus(applied.slice(0, -1));
  assert.equal(status.ready, false);
  assert.equal(status.state, "outdated");
  assert.equal(status.currentVersion, "0003");
  assert.deepEqual(status.missingVersions, ["0004"]);
  assert.deepEqual(safePostgresSchemaError(status), {
    error: "DATABASE_SCHEMA_OUTDATED",
    requiredVersion: "0004",
    currentVersion: "0003",
    action: "run migration before serving traffic",
  });
});

test("schema status reports too-new and checksum mismatch states", () => {
  const tooNew = evaluatePostgresSchemaStatus([...applied, { version: "0005", checksum: "abc" }]);
  assert.equal(tooNew.state, "too_new");
  assert.deepEqual(tooNew.incompatibleVersions, ["0005"]);

  const mismatch = evaluatePostgresSchemaStatus([
    ...applied.slice(0, -1),
    { version: "0004", checksum: "changed" },
  ]);
  assert.equal(mismatch.state, "checksum_mismatch");
  assert.equal(mismatch.checksumMismatches[0].version, "0004");
  assert.deepEqual(safePostgresSchemaError(mismatch), {
    error: "DATABASE_SCHEMA_CHECKSUM_MISMATCH",
    requiredVersion: "0004",
    currentVersion: "0004",
    version: "0004",
    action: "stop deployment; do not edit published migration; create forward migration if needed",
  });
});

test("schema checker reports unavailable without leaking the original database error", async () => {
  const sql = async () => {
    throw new Error("postgres://secret@example.local/should-not-leak");
  };

  const status = await readPostgresSchemaStatus(sql);
  assert.equal(status.ready, false);
  assert.equal(status.state, "unavailable");
  assert.equal(status.errorCode, "DATABASE_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(status), /secret@example/);
});
