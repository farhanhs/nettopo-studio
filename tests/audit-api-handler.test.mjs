import assert from "node:assert/strict";
import test from "node:test";

import {
  AuditApiError,
  createAuditLogsGetHandler,
  mapAuditApiError,
  parseAuditLimit,
} from "../app/api/audit-logs/route.ts";
import { RequestIdentityError } from "../app/lib/server/request-identity.ts";
import { PostgresSchemaNotReadyError } from "../db/postgres-schema-check.ts";

const safeHeaderNames = [
  "cache-control",
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
];

function request(path = "/api/audit-logs") {
  return new Request(`http://localhost${path}`);
}

function identity(email = "boss@company.local") {
  return { email, source: "dev-session" };
}

async function json(response) {
  return await response.json();
}

function assertSafeHeaders(response) {
  for (const header of safeHeaderNames) {
    assert.ok(response.headers.get(header), `${header} missing`);
  }
  assert.equal(response.headers.get("cache-control"), "no-store");
}

function assertNoLeakage(body) {
  assert.doesNotMatch(
    JSON.stringify(body),
    /stack|DATABASE_URL|postgres:\/\/|select\s|insert\s|password|secret|ciphertext|nonce|cookie|token|expectedChecksum|actualChecksum|x-nettopo/i,
  );
}

test("parseAuditLimit accepts absent, boundary, and encoded integer values", () => {
  assert.equal(parseAuditLimit("http://localhost/api/audit-logs"), 100);
  assert.equal(parseAuditLimit("http://localhost/api/audit-logs?limit=1"), 1);
  assert.equal(parseAuditLimit("http://localhost/api/audit-logs?limit=100"), 100);
  assert.equal(parseAuditLimit("http://localhost/api/audit-logs?limit=200"), 200);
  assert.equal(parseAuditLimit("http://localhost/api/audit-logs?limit=%31%30"), 10);
});

test("parseAuditLimit rejects invalid strict values", () => {
  for (const value of ["0", "-1", "201", "1.5", "NaN", "Infinity", "abc", "", "%2D1"]) {
    assert.throws(
      () => parseAuditLimit(`http://localhost/api/audit-logs?limit=${value}`),
      (error) => error instanceof AuditApiError && error.code === "INVALID_LIMIT" && error.status === 400,
      value,
    );
  }
  assert.throws(
    () => parseAuditLimit("http://localhost/api/audit-logs?limit=10&limit=20"),
    (error) => error instanceof AuditApiError && error.code === "INVALID_LIMIT" && error.status === 400,
  );
});

test("unauthenticated requests fail before parsing query or calling repository", async () => {
  let parseCalls = 0;
  let repositoryCalls = 0;
  const handler = createAuditLogsGetHandler({
    authenticate: () => {
      throw new RequestIdentityError("Authentication required.");
    },
    parseLimit: () => {
      parseCalls += 1;
      throw new Error("parse should not run");
    },
    readAuditLogs: async () => {
      repositoryCalls += 1;
      return [];
    },
  });

  const response = await handler(request("/api/audit-logs?limit=bad"));
  const body = await json(response);

  assert.equal(response.status, 401);
  assert.deepEqual(body, { error: "AUTHENTICATION_REQUIRED", message: "Authentication required." });
  assert.equal(parseCalls, 0);
  assert.equal(repositoryCalls, 0);
  assertSafeHeaders(response);
  assertNoLeakage(body);
});

test("unauthenticated valid limit still fails before repository access", async () => {
  let repositoryCalls = 0;
  const handler = createAuditLogsGetHandler({
    authenticate: () => {
      throw new RequestIdentityError("Authentication required.");
    },
    readAuditLogs: async () => {
      repositoryCalls += 1;
      return [];
    },
  });

  const response = await handler(request("/api/audit-logs?limit=10"));
  const body = await json(response);

  assert.equal(response.status, 401);
  assert.deepEqual(body, { error: "AUTHENTICATION_REQUIRED", message: "Authentication required." });
  assert.equal(repositoryCalls, 0);
  assertSafeHeaders(response);
  assertNoLeakage(body);
});

test("authenticated invalid limits return INVALID_LIMIT before repository access", async () => {
  let repositoryCalls = 0;
  const handler = createAuditLogsGetHandler({
    authenticate: () => identity(),
    readAuditLogs: async () => {
      repositoryCalls += 1;
      return [];
    },
  });

  const response = await handler(request("/api/audit-logs?limit=201"));
  const body = await json(response);

  assert.equal(response.status, 400);
  assert.deepEqual(body, { error: "INVALID_LIMIT", message: "limit must be an integer between 1 and 200." });
  assert.equal(repositoryCalls, 0);
  assertSafeHeaders(response);
  assertNoLeakage(body);
});

test("authenticated valid limits call repository exactly once with email and validated limit", async () => {
  const calls = [];
  const handler = createAuditLogsGetHandler({
    authenticate: () => identity("manner@company.local"),
    readAuditLogs: async (email, limit) => {
      calls.push({ email, limit });
      return [{
        id: "audit-1",
        action: "topology.save",
        entityType: "topology",
        createdAt: "2026-08-20T00:00:00.000Z",
      }];
    },
  });

  const response = await handler(request("/api/audit-logs?limit=%32%30%30"));
  const body = await json(response);

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ email: "manner@company.local", limit: 200 }]);
  assert.equal(body.auditLogs.length, 1);
  assertSafeHeaders(response);
  assertNoLeakage(body);
});

test("repository authorization failure maps to safe AUDIT_FORBIDDEN", async () => {
  const handler = createAuditLogsGetHandler({
    authenticate: () => identity("engineer@company.local"),
    readAuditLogs: async () => {
      throw new Error("Permission denied: this role cannot read audit logs.");
    },
  });

  const response = await handler(request("/api/audit-logs?limit=10"));
  const body = await json(response);

  assert.equal(response.status, 403);
  assert.deepEqual(body, { error: "AUDIT_FORBIDDEN", message: "Permission denied." });
  assertSafeHeaders(response);
  assertNoLeakage(body);
});

test("schema not ready maps to the safe schema response", async () => {
  const handler = createAuditLogsGetHandler({
    authenticate: () => identity(),
    readAuditLogs: async () => {
      throw new PostgresSchemaNotReadyError({
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
      });
    },
  });

  const response = await handler(request("/api/audit-logs?limit=10"));
  const body = await json(response);

  assert.equal(response.status, 503);
  assert.equal(body.error, "DATABASE_SCHEMA_OUTDATED");
  assert.equal(body.requiredVersion, "0004");
  assert.equal(body.currentVersion, "0003");
  assertSafeHeaders(response);
  assertNoLeakage(body);
});

test("schema unavailable, uninitialized, too-new, and checksum mismatch map to safe 503 responses", async () => {
  const cases = [
    {
      state: "unavailable",
      errorCode: "DATABASE_UNAVAILABLE",
    },
    {
      state: "uninitialized",
      errorCode: "DATABASE_SCHEMA_UNINITIALIZED",
    },
    {
      state: "too_new",
      errorCode: "DATABASE_SCHEMA_TOO_NEW",
      currentVersion: "9999",
    },
    {
      state: "checksum_mismatch",
      errorCode: "DATABASE_SCHEMA_CHECKSUM_MISMATCH",
      currentVersion: "0004",
      checksumMismatches: [{ version: "0004", expectedChecksum: "expected", actualChecksum: "actual" }],
    },
  ];

  for (const item of cases) {
    const handler = createAuditLogsGetHandler({
      authenticate: () => identity(),
      readAuditLogs: async () => {
        throw new PostgresSchemaNotReadyError({
          ready: false,
          state: item.state,
          requiredVersion: "0004",
          currentVersion: item.currentVersion,
          appliedVersions: item.currentVersion ? [item.currentVersion] : [],
          missingVersions: item.state === "uninitialized" ? ["0001", "0002", "0003", "0004"] : [],
          incompatibleVersions: item.state === "too_new" ? ["9999"] : [],
          checksumMismatches: item.checksumMismatches ?? [],
          checkedAt: "2026-08-20T00:00:00.000Z",
          errorCode: item.errorCode,
        });
      },
    });

    const response = await handler(request("/api/audit-logs?limit=10"));
    const body = await json(response);

    assert.equal(response.status, 503, item.errorCode);
    assert.equal(body.error, item.errorCode);
    assertSafeHeaders(response);
    assertNoLeakage(body);
  }
});

test("database unavailable and unknown failures return safe errors", async () => {
  const unavailable = mapAuditApiError(new Error("DATABASE_URL is required when NEXT_PUBLIC_TOPOLOGY_STORAGE=server."));
  assert.equal(unavailable.status, 503);
  assert.deepEqual(unavailable.body, {
    error: "DATABASE_UNAVAILABLE",
    message: "Database unavailable.",
    action: "check DB/network/credentials",
  });
  assertNoLeakage(unavailable.body);

  const unknown = mapAuditApiError(new Error("select * from users with password secret token"));
  assert.equal(unknown.status, 500);
  assert.deepEqual(unknown.body, { error: "AUDIT_API_ERROR", message: "Audit API error." });
  assertNoLeakage(unknown.body);
});
