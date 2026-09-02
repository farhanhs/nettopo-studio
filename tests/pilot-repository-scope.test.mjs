import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPilotRepositorySubject,
  isPilotOnlyCustomerScope,
} from "../db/topology-postgres.ts";

const pilotPrincipal = { email: "pilot.engineer@dus.local", pilotRole: "engineer", version: "1" };
const pilotContext = { identitySource: "pilot-session", pilotPrincipal };

function withPilotSite(fn) {
  const previous = process.env.NETTOPO_PILOT_SITE_ID;
  process.env.NETTOPO_PILOT_SITE_ID = "pilot-site";
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.NETTOPO_PILOT_SITE_ID;
    else process.env.NETTOPO_PILOT_SITE_ID = previous;
  }
}

function user(overrides = {}) {
  return {
    id: "user-engineer",
    email: pilotPrincipal.email,
    name: "Pilot Engineer",
    role: "engineer",
    siteIds: ["pilot-site"],
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

test("pilot repository subject guard fails closed when DB binding changes after route auth", () => {
  withPilotSite(() => {
    assert.doesNotThrow(() => assertPilotRepositorySubject(user(), pilotContext));
    assert.throws(() => assertPilotRepositorySubject(user({ role: "boss" }), pilotContext), /Authentication required/);
    assert.throws(() => assertPilotRepositorySubject(user({ role: "engineer", siteIds: ["north-1"] }), pilotContext), /Authentication required/);
    assert.throws(() => assertPilotRepositorySubject(user(), { identitySource: "pilot-session" }), /Authentication required/);
    assert.doesNotThrow(() => assertPilotRepositorySubject(user({ role: "boss", siteIds: [] }), { identitySource: "oidc" }));
  });
});

test("pilot-only customer scope requires pilot topology and no non-pilot topology", () => {
  assert.equal(isPilotOnlyCustomerScope(["pilot-site"], "pilot-site"), true);
  assert.equal(isPilotOnlyCustomerScope(["pilot-site", "pilot-site"], "pilot-site"), true);
  assert.equal(isPilotOnlyCustomerScope(["pilot-site", "north-1"], "pilot-site"), false);
  assert.equal(isPilotOnlyCustomerScope(["pilot-site", null], "pilot-site"), false);
  assert.equal(isPilotOnlyCustomerScope(["north-1"], "pilot-site"), false);
  assert.equal(isPilotOnlyCustomerScope([], "pilot-site"), false);
});

test("transaction seam checks binding before customer mutation side effects", () => {
  withPilotSite(() => {
    const writes = [];
    function simulatePilotCustomerMutation(txUser, siteIds) {
      assertPilotRepositorySubject(txUser, pilotContext);
      if (!isPilotOnlyCustomerScope(siteIds, "pilot-site")) throw new Error("Resource not found.");
      writes.push("write");
    }

    assert.throws(() => simulatePilotCustomerMutation(user({ role: "boss" }), ["pilot-site"]), /Authentication required/);
    assert.equal(writes.length, 0);

    assert.throws(() => simulatePilotCustomerMutation(user(), ["pilot-site", "north-1"]), /Resource not found/);
    assert.equal(writes.length, 0);

    assert.doesNotThrow(() => simulatePilotCustomerMutation(user(), ["pilot-site"]));
    assert.deepEqual(writes, ["write"]);
  });
});
