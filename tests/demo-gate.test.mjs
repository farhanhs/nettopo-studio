import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("client-facing login and store code do not contain the retired demo password", async () => {
  const [loginSource, pageSource, storeSource] = await Promise.all([
    readFile(new URL("../app/lib/login-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/topology-store.ts", import.meta.url), "utf8"),
  ]);
  const bundleSource = `${loginSource}\n${pageSource}\n${storeSource}`;

  assert.doesNotMatch(bundleSource, /sean002002dus|LOGIN_PASSWORD|validateLogin/);
  assert.doesNotMatch(bundleSource, /x-nettopo-user-email/);
  assert.match(bundleSource, /x-nettopo-dev-user-email/);
});

test("local and PostgreSQL demo seed paths are gated behind runtime capabilities", async () => {
  const [storeSource, postgresSource, seedScriptSource] = await Promise.all([
    readFile(new URL("../app/lib/topology-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/topology-postgres.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/seed-demo.mjs", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(storeSource, /^import .*demo-topologies/m);
  assert.match(storeSource, /readRuntimeCapabilities/);
  assert.match(storeSource, /ensureSeanSpineLeafDemo\(activeCustomerId \?\? customers\[0\]\.id, runtime\.demoSeed\)/);
  const withReadySql = postgresSource.slice(
    postgresSource.indexOf("async function withReadySql"),
    postgresSource.indexOf("export async function seedDemoDatabase"),
  );
  assert.doesNotMatch(withReadySql, /seedIfEmpty|seedSeanSpineLeafDemo/);
  assert.match(seedScriptSource, /policy\.capabilities\.demoSeed/);
});
