import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SEAN_SPINE_LEAF_PROJECT,
  SEAN_SPINE_LEAF_TOPOLOGY_ID,
  SEAN_SPINE_LEAF_TOPOLOGY_NAME,
} from "../app/lib/demo-topologies.ts";
import { resolveLayoutMode } from "../app/lib/topology-layout.ts";

test("persistent sean.sie demo has the requested spine-leaf inventory", () => {
  assert.equal(SEAN_SPINE_LEAF_TOPOLOGY_ID, "topology-sean-spine-leaf-demo");
  assert.equal(SEAN_SPINE_LEAF_TOPOLOGY_NAME, "Sean Spine-Leaf 示範拓樸");
  assert.equal(SEAN_SPINE_LEAF_PROJECT.devices.filter((device) => device.type === "router").length, 1);
  assert.equal(SEAN_SPINE_LEAF_PROJECT.devices.filter((device) => device.type === "switch").length, 2);
  assert.equal(SEAN_SPINE_LEAF_PROJECT.devices.filter((device) => device.name.startsWith("Main Server")).length, 3);
  assert.equal(SEAN_SPINE_LEAF_PROJECT.devices.filter((device) => device.name.startsWith("Node Server")).length, 8);
  assert.equal(SEAN_SPINE_LEAF_PROJECT.links.length, 24);
  assert.equal(resolveLayoutMode(SEAN_SPINE_LEAF_PROJECT, "auto-detect"), "spine-leaf");
});

test("local and PostgreSQL repositories keep demo seed behind explicit gates", async () => {
  const [localSource, postgresSource] = await Promise.all([
    readFile(new URL("../app/lib/topology-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/topology-postgres.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(localSource, /^import .*demo-topologies/m);
  assert.match(localSource, /readRuntimeCapabilities/);
  assert.match(localSource, /ensureSeanSpineLeafDemo/);
  assert.match(localSource, /runtime\.demoSeed/);
  assert.match(localSource, /ownerUserId: LOCAL_ADMIN_USER\.id/);
  assert.match(postgresSource, /seedSeanSpineLeafDemo/);
  assert.match(postgresSource, /seedDemoDatabase/);
  assert.match(postgresSource, /user-sean-sie/);
  assert.match(postgresSource, /on conflict \(id\) do nothing/i);
});
