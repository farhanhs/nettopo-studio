import assert from "node:assert/strict";
import test from "node:test";
import { fingerprint, isolatedEnvironment, selectNativeCase } from "../scripts/qa-env/environment.mjs";

test("ENV-01: OS-only child environment excludes DB, auth, preload and container credentials", () => {
  const env = isolatedEnvironment({
    Path: "os-path", SystemRoot: "os-root", TEMP: "os-temp",
    DATABASE_URL: "sentinel-db", MIGRATION_DATABASE_URL: "sentinel-migration",
    DUS_AUTH_CLIENT_SECRET: "sentinel-dus", NODE_OPTIONS: "--require unsafe-loader",
    PGHOST: "external-host", PGPASSFILE: "secret-file", COMPOSE_FILE: "production.yml",
    DOCKER_HOST: "remote-engine", HTTP_PROXY: "proxy-secret", HOME: "private-home",
    NETTOPO_RUNTIME_PROFILE: "production", OTHER_SECRET: "sentinel-extra",
  });
  assert.deepEqual(env, { Path: "os-path", SystemRoot: "os-root", TEMP: "os-temp", TZ: "UTC", LANG: "C", LC_ALL: "C", NO_COLOR: "1" });
  assert.ok(!JSON.stringify(env).includes("sentinel"));
});

test("ENV-02: environment construction does not mutate the developer shell", () => {
  const source = Object.freeze({ DATABASE_URL: "sentinel-db", PATH: "os-path" });
  isolatedEnvironment(source);
  assert.equal(source.DATABASE_URL, "sentinel-db");
});

test("ENV-03: native case selection rejects arbitrary commands, env flags and prototype keys", () => {
  assert.equal(selectNativeCase("auth-schema"), "tests/qa-auth-003-phase-a-real-postgres.test.mjs");
  for (const id of ["../scripts/migrate-postgres.mjs", "--env-file=.env.local", "toString", "__proto__", "auth-schema; arbitrary-command"]) {
    assert.throws(() => selectNativeCase(id), /Unknown approved/);
  }
});

test("ENV-04: candidate fingerprint is order-independent and detects modifications", () => {
  assert.equal(fingerprint({ b: "2", a: "1" }), fingerprint({ a: "1", b: "2" }));
  assert.notEqual(fingerprint({ a: "1" }), fingerprint({ a: "changed" }));
  assert.notEqual(fingerprint({ a: "1" }), fingerprint({ a: "1", added: "2" }));
});
