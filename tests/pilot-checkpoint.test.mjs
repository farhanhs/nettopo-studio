import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { noStoreHeaders, assertPilotMutationRequest } from "../app/lib/server/http-security.ts";
import {
  PILOT_SESSION_COOKIE,
  createPilotSessionValue,
  pilotCookieOptions,
  pilotSessionTtlSeconds,
  readPilotSession,
} from "../app/lib/server/pilot-session.ts";
import { getRuntimePolicy, validateRuntimePolicy } from "../app/lib/server/runtime-policy.ts";
import {
  buildImportPlan,
  createProjectExport,
  materializeImportBundle,
  projectToCsvFiles,
} from "../app/lib/topology-transfer.ts";
import { createMissingInfoItem } from "../app/lib/topology-missing-info.ts";

const secret = "pilot-test-secret-at-least-thirty-two-characters";
const pilotUsers = "pilot.admin@company.local:admin:1,pilot.engineer@company.local:engineer:1";
const pilotSite = "pilot-site";

function withEnv(env, fn) {
  const keys = [
    "NETTOPO_RUNTIME_PROFILE",
    "NETTOPO_AUTH_MODE",
    "NETTOPO_ENABLE_DEV_IDENTITY_HEADER",
    "NETTOPO_ENABLE_DEMO_SEED",
    "NETTOPO_PILOT_ALLOW_FULL_EXPORT",
    "NETTOPO_PILOT_SESSION_SECRET",
    "NETTOPO_PILOT_USERS",
    "NETTOPO_PILOT_SITE_ID",
    "MIGRATION_DATABASE_URL",
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, env);
  try {
    return fn();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function pilotJsonRequest(url, init = {}) {
  return new Request(url, {
    ...init,
    method: "POST",
    headers: {
      origin: new URL(url).origin,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    body: "{}",
  });
}

const project = {
  devices: [
    { id: "router-1", name: "Pilot Router", type: "router", ip: "10.0.0.1", mac: "00:11:22:33:44:55", location: "Pilot rack", url: "https://10.0.0.1", x: 0, y: 0 },
    { id: "switch-1", name: "Pilot Switch", type: "switch", x: 240, y: 0 },
  ],
  links: [{ id: "link-1", from: "router-1", to: "switch-1", kind: "wired", fromPort: "LAN1", toPort: "Port 1" }],
  groups: [],
};

test("pilot runtime policy fails closed for unsafe startup gates", () => {
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "demo",
  }), /pilot cannot enable demo auth/i);
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_ENABLE_DEV_IDENTITY_HEADER: "1",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_USERS: pilotUsers,
    NETTOPO_PILOT_SITE_ID: pilotSite,
  }), /pilot cannot enable demo auth/i);
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_ENABLE_DEMO_SEED: "1",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_USERS: pilotUsers,
    NETTOPO_PILOT_SITE_ID: pilotSite,
  }), /pilot cannot enable demo auth/i);
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_USERS: pilotUsers,
    NETTOPO_PILOT_SITE_ID: pilotSite,
  }), /NETTOPO_PILOT_SESSION_SECRET/i);
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_SITE_ID: pilotSite,
  }), /NETTOPO_PILOT_USERS/i);
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_USERS: pilotUsers,
  }), /NETTOPO_PILOT_SITE_ID/i);
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_SITE_ID: pilotSite,
    NETTOPO_PILOT_USERS: "pilot.admin@company.local:admin:1,pilot.admin@company.local:engineer:1",
  }), /duplicate/i);
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_SITE_ID: pilotSite,
    NETTOPO_PILOT_USERS: "pilot.admin@company.local:owner:1",
  }), /role/i);
  assert.throws(() => validateRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_SITE_ID: pilotSite,
    NETTOPO_PILOT_USERS: "pilot.admin@company.local:admin:",
  }), /version/i);
});

test("pilot full export capability is default-off and production ignores pilot flags", () => {
  assert.equal(getRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_USERS: pilotUsers,
    NETTOPO_PILOT_SITE_ID: pilotSite,
  }).capabilities.pilotFullExport, false);
  assert.equal(getRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_ALLOW_FULL_EXPORT: "1",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_USERS: pilotUsers,
    NETTOPO_PILOT_SITE_ID: pilotSite,
  }).capabilities.pilotFullExport, true);
  assert.deepEqual(getRuntimePolicy({
    NETTOPO_RUNTIME_PROFILE: "production",
    NETTOPO_AUTH_MODE: "disabled",
    NETTOPO_PILOT_ALLOW_FULL_EXPORT: "1",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_USERS: pilotUsers,
    NETTOPO_PILOT_SITE_ID: pilotSite,
  }).capabilities, {
    demoAuth: false,
    devIdentityOverride: false,
    demoSeed: false,
    pilotAuth: false,
    pilotFullExport: false,
  });
});

test("pilot session cookie is host-prefixed, secure, strict, and revocable by allowlist version", () => {
  withEnv({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_USERS: pilotUsers,
    NETTOPO_PILOT_SITE_ID: pilotSite,
  }, () => {
    assert.deepEqual(pilotCookieOptions(), {
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      maxAge: pilotSessionTtlSeconds(),
      path: "/",
    });
    assert.deepEqual(pilotCookieOptions(0), {
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      maxAge: 0,
      path: "/",
    });

    const value = createPilotSessionValue("PILOT.ENGINEER@COMPANY.LOCAL");
    const request = new Request("https://pilot.local/api/session", {
      headers: { cookie: `${PILOT_SESSION_COOKIE}=${value}` },
    });
    assert.deepEqual(readPilotSession(request), {
      email: "pilot.engineer@company.local",
      pilotRole: "engineer",
      version: "1",
    });
    assert.equal(readPilotSession(new Request("https://pilot.local/api/session", {
      headers: { cookie: `${PILOT_SESSION_COOKIE}=${value}tampered` },
    })), undefined);
  });

  withEnv({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_USERS: "pilot.engineer@company.local:engineer:1",
    NETTOPO_PILOT_SITE_ID: pilotSite,
  }, () => {
    const cookie = createPilotSessionValue("pilot.engineer@company.local");
    process.env.NETTOPO_PILOT_USERS = "pilot.engineer@company.local:engineer:2";
    assert.equal(readPilotSession(new Request("https://pilot.local/api/session", {
      headers: { cookie: `${PILOT_SESSION_COOKIE}=${cookie}` },
    })), undefined);
  });
});

test("pilot mutation security requires JSON and same-origin origin or referer", () => {
  withEnv({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_USERS: pilotUsers,
    NETTOPO_PILOT_SITE_ID: pilotSite,
  }, () => {
    assert.doesNotThrow(() => assertPilotMutationRequest(pilotJsonRequest("https://pilot.local/api/topology")));
    assert.doesNotThrow(() => assertPilotMutationRequest(new Request("https://pilot.local/api/topology", {
      method: "POST",
      headers: { referer: "https://pilot.local/workspace", "content-type": "application/json" },
      body: "{}",
    })));
    assert.throws(() => assertPilotMutationRequest(new Request("https://pilot.local/api/topology", {
      method: "GET",
      headers: { origin: "https://pilot.local", "content-type": "application/json" },
    })), /GET/);
    assert.throws(() => assertPilotMutationRequest(new Request("https://pilot.local/api/topology", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })), /origin/i);
    assert.throws(() => assertPilotMutationRequest(pilotJsonRequest("https://pilot.local/api/topology", {
      headers: { origin: "https://evil.local" },
    })), /origin/i);
    assert.throws(() => assertPilotMutationRequest(pilotJsonRequest("https://pilot.local/api/topology", {
      headers: { "content-type": "text/plain" },
    })), /application\/json/i);
  });
});

test("API security headers include no-store and browser hardening headers", () => {
  assert.deepEqual(noStoreHeaders(), {
    "Content-Security-Policy": "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cache-Control": "no-store",
  });
});

test("pilot session route does not expose the session token in response body source", async () => {
  const source = await readFile(new URL("../app/api/pilot/session/route.ts", import.meta.url), "utf8");
  assert.match(source, /"Set-Cookie": pilotSetCookie/);
  assert.match(source, /deps\.createSessionValue\(principal\.email\)/);
  assert.match(source, /pilotCookieOptions\(maxAge\)/);
  assert.doesNotMatch(source, /sessionToken|token|localStorage|sessionStorage/);
});

test("pilot UI exposes pilot login and banner while gating dev identity and full export affordances", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /\/api\/pilot\/session/);
  assert.match(page, /INTERNAL PILOT/);
  assert.match(page, /synthetic test data only/);
  assert.match(page, /do not enter production credentials/);
  assert.match(page, /capabilities\.profile !== "production" && capabilities\.profile !== "pilot"/);
  assert.match(page, /disabled=\{!canUseFullExport\}/);
  assert.match(page, /Internal Pilot 預設禁用完整匯出/);
  assert.match(page, /exportJson\(true\)/);
  assert.match(page, /exportCsvBundle\(true\)/);
});

test("pilot CSV import/export boundary keeps ZIP import unsupported and credentials redacted", () => {
  const zipPlan = buildImportPlan([{ name: "topology-csv-bundle.zip", text: "PK\u0003\u0004" }]);
  assert.equal(zipPlan.canApply, false);
  assert.ok(zipPlan.issues.some((issue) => issue.code === "source.unsupported"));

  const safeExport = createProjectExport({
    ...project,
    devices: [{ ...project.devices[0], username: "admin", password: "secret", secret: "token" }, project.devices[1]],
  });
  const csv = projectToCsvFiles({
    ...project,
    devices: [
      { ...project.devices[0], name: "+SUM(A1:A2)", username: "admin", password: "secret", secret: "token" },
      { ...project.devices[1], name: "@payload" },
    ],
  }, {
    maskedCredentials: [{ projectDeviceId: "router-1", kind: "device_admin", usernameMasked: "a***n", secretMasked: "********" }],
  });
  const joinedCsv = Object.values(csv).join("\n");

  assert.equal(safeExport.sharing, "safe");
  assert.doesNotMatch(JSON.stringify(safeExport), /10\.0\.0\.1|00:11|admin|secret|token|username|password/i);
  assert.match(csv["devices.csv"], /'\+SUM/);
  assert.match(csv["devices.csv"], /'@payload/);
  assert.doesNotMatch(joinedCsv, /,admin,|password|secret,|token/i);
  assert.deepEqual(Object.keys(csv).sort(), [
    "credentials.masked.csv",
    "devices.csv",
    "groups.csv",
    "links.csv",
    "missing-info.csv",
  ]);
});

test("blocking missing info cannot be bypassed by warning acknowledgement alone", () => {
  const blocking = createMissingInfoItem({
    severity: "blocking",
    entityType: "project",
    field: "site",
    code: "pilot.site.required",
    question: "Pilot site scope must be explicit.",
  });
  const csv = projectToCsvFiles(project, { missingInfo: [blocking] });
  const withBlocking = buildImportPlan(Object.entries(csv).map(([name, text]) => ({ name, text })));

  assert.equal(withBlocking.canApply, false);
  assert.equal(withBlocking.summary.missingBlocking, 1);
  assert.throws(() => materializeImportBundle(project, withBlocking, "new"), /blocking errors/);
});
