import assert from "node:assert/strict";
import test from "node:test";

import {
  getRuntimePolicy,
  isLoopbackHost,
  validateRuntimePolicy,
} from "../app/lib/server/runtime-policy.ts";

test("runtime policy defaults to production with every dev capability off", () => {
  assert.deepEqual(getRuntimePolicy({}), {
    profile: "production",
    authMode: "disabled",
    capabilities: {
      demoAuth: false,
      devIdentityOverride: false,
      demoSeed: false,
      pilotAuth: false,
      pilotFullExport: false,
    },
  });
});

test("production rejects every development gate", () => {
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "production",
    NETTOPO_AUTH_MODE: "demo",
    MIGRATION_DATABASE_URL: "postgres://migration",
  }), /production cannot enable demo auth/i);
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "production",
    NETTOPO_ENABLE_DEV_IDENTITY_HEADER: "1",
    MIGRATION_DATABASE_URL: "postgres://migration",
  }), /production cannot enable demo auth/i);
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "production",
    NETTOPO_ENABLE_DEMO_SEED: "1",
    MIGRATION_DATABASE_URL: "postgres://migration",
  }), /production cannot enable demo auth/i);
});

test("explicit production and CI require a migration DSN without falling back to runtime DSN", () => {
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "production",
    NETTOPO_AUTH_MODE: "disabled",
    DATABASE_URL: "postgres://runtime",
  }), /MIGRATION_DATABASE_URL/);
  assert.throws(() => validateRuntimePolicy({
    CI: "true",
    DATABASE_URL: "postgres://runtime",
  }), /MIGRATION_DATABASE_URL/);
  assert.equal(validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "production",
    NETTOPO_AUTH_MODE: "disabled",
    DATABASE_URL: "postgres://runtime",
    MIGRATION_DATABASE_URL: "postgres://migration",
  }).profile, "production");
});

test("dev identity override requires a loopback host", () => {
  const env = {
    NETTOPO_RUNTIME_PROFILE: "development",
    NETTOPO_AUTH_MODE: "demo",
    NETTOPO_ENABLE_DEV_IDENTITY_HEADER: "1",
  };

  assert.equal(isLoopbackHost("127.0.0.1"), true);
  assert.equal(isLoopbackHost("localhost:4173"), true);
  assert.equal(isLoopbackHost("10.0.0.8"), false);
  assert.throws(() => validateRuntimePolicy(env, "10.0.0.8"), /loopback|localhost/i);
  assert.equal(validateRuntimePolicy(env, "127.0.0.1").capabilities.devIdentityOverride, true);
});

test("pilot profile forbids development capabilities and exposes only pilot auth", () => {
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "demo",
  }), /pilot cannot enable demo auth/i);
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_ENABLE_DEV_IDENTITY_HEADER: "1",
    NETTOPO_PILOT_SESSION_SECRET: "pilot-test-secret-at-least-thirty-two-characters",
    NETTOPO_PILOT_USERS: "pilot.engineer@dus.local:engineer:1",
    NETTOPO_PILOT_SITE_ID: "pilot-site",
  }), /pilot cannot enable demo auth/i);
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
  }), /NETTOPO_PILOT_SESSION_SECRET/i);
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_SESSION_SECRET: "pilot-test-secret-at-least-thirty-two-characters",
    NETTOPO_PILOT_USERS: "pilot.engineer@dus.local:engineer:1",
  }), /NETTOPO_PILOT_SITE_ID/i);
  assert.deepEqual(getRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_ALLOW_FULL_EXPORT: "1",
  }).capabilities, {
    demoAuth: false,
    devIdentityOverride: false,
    demoSeed: false,
    pilotAuth: true,
    pilotFullExport: true,
  });
});
