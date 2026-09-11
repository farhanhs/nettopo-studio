import assert from "node:assert/strict";
import test from "node:test";

import {
  createPilotSessionPostHandler,
  mapPilotSessionError,
} from "../app/api/pilot/session/route.ts";
import { PostgresSchemaNotReadyError } from "../db/postgres-schema-check.ts";

const policy = {
  profile: "pilot",
  authMode: "pilot",
  capabilities: {
    demoAuth: false,
    devIdentityOverride: false,
    demoSeed: false,
    pilotAuth: true,
    pilotFullExport: false,
  },
};

const principal = {
  email: "pilot.engineer@company.local",
  pilotRole: "engineer",
  version: "1",
};

const pilotUser = {
  id: "user-pilot-engineer",
  email: principal.email,
  name: "Pilot Engineer",
  role: "engineer",
  siteIds: ["pilot-site"],
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

async function withEnv(env, fn) {
  const previous = {
    NETTOPO_PILOT_SITE_ID: process.env.NETTOPO_PILOT_SITE_ID,
  };
  Object.assign(process.env, env);
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function pilotRequest(body = { email: principal.email }, headers = {}) {
  return new Request("https://pilot.local/api/pilot/session", {
    method: "POST",
    headers: {
      origin: "https://pilot.local",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function body(response) {
  return await response.json();
}

function assertSafeHeaders(response) {
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(response.headers.get("content-security-policy"));
  assert.ok(response.headers.get("x-content-type-options"));
  assert.ok(response.headers.get("referrer-policy"));
  assert.ok(response.headers.get("permissions-policy"));
}

function assertNoSensitiveLeakage(payload) {
  assert.doesNotMatch(JSON.stringify(payload), /stack|select\s|insert\s|postgres:\/\/|DATABASE_URL|secret|token|cookie|allowlist|x-nettopo/i);
}

test("pilot session login binds allowlist principal to active DB role and pilot site before issuing cookie", async () => {
  await withEnv({ NETTOPO_PILOT_SITE_ID: "pilot-site" }, async () => {
    const calls = [];
    const handler = createPilotSessionPostHandler({
      getPolicy: () => policy,
      assertMutationRequest: () => calls.push("mutation"),
      findPrincipal: () => principal,
      loadPilotUser: async (email) => {
        calls.push(["loadUser", email]);
        return pilotUser;
      },
      createSessionValue: (email) => {
        calls.push(["cookie", email]);
        return "signed-session";
      },
    });

    const response = await handler(pilotRequest());
    const payload = await body(response);

    assert.equal(response.status, 200);
    assert.deepEqual(payload, {
      ok: true,
      pilotUser: { email: principal.email, pilotRole: "engineer" },
      ttlSeconds: 21600,
    });
    assert.deepEqual(calls, ["mutation", ["loadUser", principal.email], ["cookie", principal.email]]);
    assert.match(response.headers.get("set-cookie") ?? "", /__Host-nettopo-pilot-session=signed-session/);
    assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
    assert.match(response.headers.get("set-cookie") ?? "", /Secure/);
    assert.match(response.headers.get("set-cookie") ?? "", /SameSite=Strict/);
    assertSafeHeaders(response);
    assertNoSensitiveLeakage(payload);
  });
});

test("pilot session login returns generic 401 and no cookie for allowlist and DB subject mismatch cases", async () => {
  await withEnv({ NETTOPO_PILOT_SITE_ID: "pilot-site" }, async () => {
    const cases = [
      {
        name: "unknown allowlist",
        findPrincipal: () => undefined,
        loadPilotUser: async () => {
          throw new Error("must not load DB for unknown allowlist");
        },
      },
      {
        name: "missing or disabled DB user",
        findPrincipal: () => principal,
        loadPilotUser: async () => {
          throw new Error("Authentication required.");
        },
      },
      {
        name: "role mismatch",
        findPrincipal: () => principal,
        loadPilotUser: async () => ({ ...pilotUser, role: "boss" }),
      },
      {
        name: "site mismatch",
        findPrincipal: () => principal,
        loadPilotUser: async () => ({ ...pilotUser, siteIds: ["north-1"] }),
      },
    ];

    for (const item of cases) {
      const handler = createPilotSessionPostHandler({
        getPolicy: () => policy,
        assertMutationRequest: () => undefined,
        findPrincipal: item.findPrincipal,
        loadPilotUser: item.loadPilotUser,
        createSessionValue: () => {
          throw new Error("cookie should not be issued");
        },
      });

      const response = await handler(pilotRequest());
      const payload = await body(response);

      assert.equal(response.status, 401, item.name);
      assert.deepEqual(payload, { error: "AUTHENTICATION_REQUIRED", message: "Authentication required." });
      assert.equal(response.headers.get("set-cookie"), null);
      assertSafeHeaders(response);
      assertNoSensitiveLeakage(payload);
    }
  });
});

test("pilot session login maps schema and database availability to safe 503 bodies", () => {
  const unavailable = mapPilotSessionError(new Error("DATABASE_URL is required when NEXT_PUBLIC_TOPOLOGY_STORAGE=server."));
  assert.equal(unavailable.status, 503);
  assert.deepEqual(unavailable.body, {
    error: "DATABASE_UNAVAILABLE",
    message: "Database unavailable.",
    action: "check DB/network/credentials",
  });
  assertNoSensitiveLeakage(unavailable.body);

  const schema = mapPilotSessionError(new PostgresSchemaNotReadyError({
    ready: false,
    state: "outdated",
    requiredVersion: "0004",
    currentVersion: "0003",
    appliedVersions: ["0001", "0002", "0003"],
    missingVersions: ["0004"],
    incompatibleVersions: [],
    checksumMismatches: [],
    checkedAt: "2026-08-20T00:00:00.000Z",
    errorCode: "DATABASE_SCHEMA_OUTDATED",
  }));
  assert.equal(schema.status, 503);
  assert.equal(schema.body.error, "DATABASE_SCHEMA_OUTDATED");
  assertNoSensitiveLeakage(schema.body);
});
