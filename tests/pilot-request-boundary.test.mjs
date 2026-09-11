import assert from "node:assert/strict";
import test from "node:test";

import { createPilotBoundIdentityResolver } from "../app/lib/server/pilot-request.ts";
import { RequestIdentityError } from "../app/lib/server/request-identity.ts";

const pilotIdentity = {
  email: "pilot.engineer@company.local",
  source: "pilot-session",
  pilot: { email: "pilot.engineer@company.local", pilotRole: "engineer", version: "1" },
};

const baseUser = {
  id: "user-pilot-engineer",
  email: pilotIdentity.email,
  name: "Pilot Engineer",
  role: "engineer",
  siteIds: ["pilot-site"],
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

async function withPilotSite(fn) {
  const previous = process.env.NETTOPO_PILOT_SITE_ID;
  process.env.NETTOPO_PILOT_SITE_ID = "pilot-site";
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.NETTOPO_PILOT_SITE_ID;
    else process.env.NETTOPO_PILOT_SITE_ID = previous;
  }
}

test("pilot protected request revalidates active DB role and explicit site on every request", async () => {
  await withPilotSite(async () => {
    const cases = [
      { name: "disabled or missing", user: undefined },
      { name: "role changed after login", user: { ...baseUser, role: "boss" } },
      { name: "site revoked after login", user: { ...baseUser, siteIds: ["north-1"] } },
    ];

    for (const item of cases) {
      let businessRepositoryCalls = 0;
      const resolve = createPilotBoundIdentityResolver({
        authenticate: () => pilotIdentity,
        loadPilotUser: async () => item.user,
      });

      await assert.rejects(
        async () => {
          await resolve(new Request("https://pilot.local/api/topology"));
          businessRepositoryCalls += 1;
        },
        (error) => error instanceof RequestIdentityError && error.status === 401 && /Authentication required/.test(error.message),
        item.name,
      );
      assert.equal(businessRepositoryCalls, 0, item.name);
    }
  });
});

test("non-pilot identities keep existing dev-session behavior and do not load DB subject", async () => {
  let loadCalls = 0;
  const resolve = createPilotBoundIdentityResolver({
    authenticate: () => ({ email: "sean.sie@dus.local", source: "dev-session" }),
    loadPilotUser: async () => {
      loadCalls += 1;
      return baseUser;
    },
  });

  assert.deepEqual(await resolve(new Request("http://127.0.0.1/api/topology")), {
    email: "sean.sie@dus.local",
    source: "dev-session",
  });
  assert.equal(loadCalls, 0);
});
