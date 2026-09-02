import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { assertPilotMutationRequest } from "../app/lib/server/http-security.ts";
import { canPilotEngineerCreateSyntheticCustomer } from "../app/lib/server/pilot-policy.ts";
import { getRuntimePolicy } from "../app/lib/server/runtime-policy.ts";

function withEnv(env, fn) {
  const previous = {
    NETTOPO_RUNTIME_PROFILE: process.env.NETTOPO_RUNTIME_PROFILE,
    NETTOPO_AUTH_MODE: process.env.NETTOPO_AUTH_MODE,
    NETTOPO_PILOT_ALLOW_FULL_EXPORT: process.env.NETTOPO_PILOT_ALLOW_FULL_EXPORT,
  };
  Object.assign(process.env, env);
  for (const key of Object.keys(previous)) {
    if (env[key] === undefined) delete process.env[key];
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("pilot engineer customer creation is limited to synthetic customer on pilot site", () => {
  const engineer = { id: "u-pilot-engineer", role: "engineer", siteIds: ["pilot-site"] };
  const northEngineer = { id: "u-north-engineer", role: "engineer", siteIds: ["north-1"] };
  const siteManager = { id: "u-pilot-manager", role: "site_manager", siteIds: ["pilot-site"] };
  const principal = { email: "pilot.engineer@dus.local", pilotRole: "engineer", version: "1" };
  assert.equal(canPilotEngineerCreateSyntheticCustomer(engineer, principal, "pilot-site"), true);
  assert.equal(canPilotEngineerCreateSyntheticCustomer(northEngineer, principal, "pilot-site"), false);
  assert.equal(canPilotEngineerCreateSyntheticCustomer(siteManager, principal, "pilot-site"), false);
  assert.equal(canPilotEngineerCreateSyntheticCustomer(engineer, { ...principal, pilotRole: "admin" }, "pilot-site"), false);
});

test("pilot full export is disabled unless server flag explicitly enables it", () => {
  withEnv({ NETTOPO_RUNTIME_PROFILE: "pilot", NETTOPO_AUTH_MODE: "pilot" }, () => {
    assert.equal(getRuntimePolicy().capabilities.pilotFullExport, false);
  });
  withEnv({ NETTOPO_RUNTIME_PROFILE: "pilot", NETTOPO_AUTH_MODE: "pilot", NETTOPO_PILOT_ALLOW_FULL_EXPORT: "1" }, () => {
    assert.equal(getRuntimePolicy().capabilities.pilotFullExport, true);
  });
});

test("pilot mutation requests require same-origin JSON requests", () => {
  withEnv({ NETTOPO_RUNTIME_PROFILE: "pilot", NETTOPO_AUTH_MODE: "pilot" }, () => {
    assert.doesNotThrow(() => assertPilotMutationRequest(new Request("https://pilot.local/api/topology", {
      method: "POST",
      headers: { origin: "https://pilot.local", "content-type": "application/json" },
      body: "{}",
    })));
    assert.throws(() => assertPilotMutationRequest(new Request("https://pilot.local/api/topology", {
      method: "POST",
      headers: { origin: "https://evil.local", "content-type": "application/json" },
      body: "{}",
    })), /origin/i);
    assert.throws(() => assertPilotMutationRequest(new Request("https://pilot.local/api/topology", {
      method: "POST",
      headers: { origin: "https://pilot.local", "content-type": "text/plain" },
      body: "{}",
    })), /application\/json/i);
  });
});

test("pilot API boundaries are explicit in route and repository source", async () => {
  const [topologyRoute, credentialsRoute, sessionRoute, auditRoute, postgresSource, pilotPolicy] = await Promise.all([
    readFile(new URL("../app/api/topology/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/credentials/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/audit-logs/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/topology-postgres.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/server/pilot-policy.ts", import.meta.url), "utf8"),
  ]);
  assert.match(topologyRoute, /assertPilotMutationRequest\(request\)/);
  assert.match(topologyRoute, /requirePilotBoundRequestIdentity\(request\)/);
  assert.match(credentialsRoute, /requirePilotBoundRequestIdentity\(request\)/);
  assert.match(sessionRoute, /requirePilotBoundRequestIdentity\(request\)/);
  assert.match(auditRoute, /requirePilotBoundRequestIdentity/);
  assert.match(topologyRoute, /synthetic: identity\.source === "pilot-session"/);
  assert.match(topologyRoute, /pilotPrincipal: identity\.pilot/);
  assert.match(credentialsRoute, /pilotPrincipal: identity\.pilot/);
  assert.match(sessionRoute, /pilotPrincipal: identity\.pilot/);
  assert.match(auditRoute, /pilotPrincipal: identity\.pilot/);
  assert.match(credentialsRoute, /Pilot engineers cannot read credential metadata/);
  assert.match(credentialsRoute, /identity\.pilot\?\.pilotRole === "engineer"/);
  assert.match(postgresSource, /canPilotEngineerCreateSyntheticCustomer/);
  assert.match(postgresSource, /assertPilotRepositorySubject\(txUser, context\)/);
  assert.match(postgresSource, /assertPilotOnlyCustomer\(tx, customerId, context\)/);
  assert.match(postgresSource, /customerIsPilotOnly/);
  assert.match(postgresSource, /is distinct from \$\{pilotSiteId\(\)\}/);
  assert.match(postgresSource, /pilotReadableTopology/);
  assert.match(postgresSource, /pilotWritableTopology/);
  assert.match(postgresSource, /where site_id = \$\{pilotSiteId\(\)\}/);
  assert.match(postgresSource, /customerVisibleInPilotSite/);
  assert.match(pilotPolicy, /source: "internal-pilot"/);
});
