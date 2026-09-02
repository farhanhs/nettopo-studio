import assert from "node:assert/strict";
import test from "node:test";

import { assertPostgresSchemaReady, evaluatePostgresSchemaStatus, safePostgresSchemaError } from "../db/postgres-schema-check.ts";
import { expectedPostgresMigrations } from "../db/postgres-schema-version.ts";

const ready = expectedPostgresMigrations.map(({ version, checksum }) => ({ version, checksum }));
const fixtures = [
  ["ready", ready, true],
  ["uninitialized", [], false],
  ["outdated", ready.slice(0, 3), false],
  ["too_new", [...ready, { version: "0005", checksum: "extra" }], false],
  ["checksum_mismatch", [...ready.slice(0, 3), { version: "0004", checksum: "changed" }], false],
];

for (const [state, rows, isReady] of fixtures) {
  test(`schema fixture ${state} produces a safe stable contract`, () => {
    const status = evaluatePostgresSchemaStatus(rows);
    assert.equal(status.state, state);
    assert.equal(status.ready, isReady);
    const safe = safePostgresSchemaError(status);
    assert.doesNotMatch(JSON.stringify(safe), /postgres:|password|secret|stack|create table|expectedChecksum|actualChecksum/i);
    if (!isReady) assert.match(String(safe.error), /^DATABASE_/);
  });
}

test("too-new database is explicitly rejected rather than treated as ready", () => {
  const status = evaluatePostgresSchemaStatus([...ready, { version: "9999", checksum: "future" }]);
  assert.equal(status.ready, false);
  assert.equal(status.errorCode, "DATABASE_SCHEMA_TOO_NEW");
  assert.match(String(safePostgresSchemaError(status).action), /app too old/i);
});

test("failed schema cache recovers after its TTL without an application restart", async () => {
  let available = false;
  const sql = async (strings) => {
    if (!available) throw new Error("fixture unavailable");
    const query = strings.join(" ");
    if (query.includes("to_regclass")) {
      return [{ schema_migrations_exists: true, users_exists: true, topologies_exists: true }];
    }
    return ready;
  };

  await assert.rejects(() => assertPostgresSchemaReady(sql, true), /DATABASE_UNAVAILABLE/);
  available = true;
  await assert.rejects(() => assertPostgresSchemaReady(sql), /DATABASE_UNAVAILABLE/);
  await new Promise((resolve) => setTimeout(resolve, 5_050));
  const recovered = await assertPostgresSchemaReady(sql);
  assert.equal(recovered.ready, true);
  assert.equal(recovered.state, "ready");
});
