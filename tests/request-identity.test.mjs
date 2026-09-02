import assert from "node:assert/strict";
import test from "node:test";

import {
  DEV_SESSION_COOKIE,
  RequestIdentityError,
  createDevSessionValue,
  requireRequestIdentity,
} from "../app/lib/server/request-identity.ts";
import { PILOT_SESSION_COOKIE, createPilotSessionValue } from "../app/lib/server/pilot-session.ts";

function withEnv(env, fn) {
  const previous = {
    NETTOPO_RUNTIME_PROFILE: process.env.NETTOPO_RUNTIME_PROFILE,
    NETTOPO_AUTH_MODE: process.env.NETTOPO_AUTH_MODE,
    NETTOPO_ENABLE_DEV_IDENTITY_HEADER: process.env.NETTOPO_ENABLE_DEV_IDENTITY_HEADER,
    NETTOPO_ENABLE_DEMO_SEED: process.env.NETTOPO_ENABLE_DEMO_SEED,
    NETTOPO_DEV_SESSION_SECRET: process.env.NETTOPO_DEV_SESSION_SECRET,
    NETTOPO_PILOT_SESSION_SECRET: process.env.NETTOPO_PILOT_SESSION_SECRET,
    NETTOPO_PILOT_USERS: process.env.NETTOPO_PILOT_USERS,
    NETTOPO_PILOT_SITE_ID: process.env.NETTOPO_PILOT_SITE_ID,
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

function request(headers = {}) {
  return new Request("http://127.0.0.1/api/topology", { headers });
}

test("protected APIs fail closed when auth mode is disabled", () => {
  withEnv({ NETTOPO_RUNTIME_PROFILE: "production", NETTOPO_AUTH_MODE: "disabled" }, () => {
    assert.throws(() => requireRequestIdentity(request()), RequestIdentityError);
  });
});

test("legacy identity header is ignored and cannot authenticate", () => {
  withEnv({ NETTOPO_RUNTIME_PROFILE: "development", NETTOPO_AUTH_MODE: "demo" }, () => {
    assert.throws(() => requireRequestIdentity(request({
      "x-nettopo-user-email": "manner@company.local",
    })), /Authentication required/i);
  });
});

test("dev override requires gate, active dev session, and allowlisted email", () => {
  withEnv({
    NETTOPO_RUNTIME_PROFILE: "development",
    NETTOPO_AUTH_MODE: "demo",
    NETTOPO_ENABLE_DEV_IDENTITY_HEADER: "1",
    NETTOPO_DEV_SESSION_SECRET: "test-secret",
  }, () => {
    const cookie = `${DEV_SESSION_COOKIE}=${createDevSessionValue("sean.sie@dus.local")}`;
    const identity = requireRequestIdentity(request({
      cookie,
      "x-nettopo-dev-user-email": "engineer@company.local",
    }));
    assert.deepEqual(identity, { email: "engineer@company.local", source: "dev-override" });

    assert.throws(() => requireRequestIdentity(request({
      cookie,
      "x-nettopo-dev-user-email": "attacker@example.com",
    })), /not allowed/i);
  });
});

test("production rejects the dev identity header", () => {
  withEnv({ NETTOPO_RUNTIME_PROFILE: "production", NETTOPO_AUTH_MODE: "oidc" }, () => {
    assert.throws(() => requireRequestIdentity(request({
      "x-nettopo-dev-user-email": "engineer@company.local",
    })), /forbidden/i);
  });
});

test("pilot session uses allowlist and rejects development identity headers", () => {
  const secret = "pilot-test-secret-at-least-thirty-two-characters";
  withEnv({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_USERS: "pilot.engineer@dus.local:engineer:1,pilot.admin@dus.local:admin:1",
    NETTOPO_PILOT_SITE_ID: "pilot-site",
  }, () => {
    const cookie = `${PILOT_SESSION_COOKIE}=${createPilotSessionValue("pilot.engineer@dus.local")}`;
    assert.deepEqual(requireRequestIdentity(request({ cookie })), {
      email: "pilot.engineer@dus.local",
      source: "pilot-session",
      pilot: { email: "pilot.engineer@dus.local", pilotRole: "engineer", version: "1" },
    });
    assert.throws(() => requireRequestIdentity(request({
      cookie,
      "x-nettopo-dev-user-email": "manner@company.local",
    })), /forbidden/i);
  });
});

test("pilot sessions fail closed after allowlist revocation or version change", () => {
  const secret = "pilot-test-secret-at-least-thirty-two-characters";
  let cookie = "";
  withEnv({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_USERS: "pilot.engineer@dus.local:engineer:1",
    NETTOPO_PILOT_SITE_ID: "pilot-site",
  }, () => {
    cookie = `${PILOT_SESSION_COOKIE}=${createPilotSessionValue("pilot.engineer@dus.local")}`;
  });
  withEnv({
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_PILOT_SESSION_SECRET: secret,
    NETTOPO_PILOT_USERS: "pilot.engineer@dus.local:engineer:2",
    NETTOPO_PILOT_SITE_ID: "pilot-site",
  }, () => {
    assert.throws(() => requireRequestIdentity(request({ cookie })), /Authentication required/i);
  });
});
