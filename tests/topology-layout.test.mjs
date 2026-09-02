import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  orderLayersByConnectivity,
  resolveLayoutMode,
} from "../app/lib/topology-layout.ts";
import { ProjectExportSchema } from "../app/lib/topology-transfer.ts";

function device(id, type, name = id) {
  return { id, name, type, x: 0, y: 0 };
}

test("auto detection distinguishes three-tier, spine-leaf, and irregular topologies", () => {
  const threeTier = {
    devices: [
      device("wan", "modem"),
      device("edge", "firewall"),
      device("core", "switch"),
    ],
    links: [
      { id: "l1", from: "wan", to: "edge", kind: "wired" },
      { id: "l2", from: "edge", to: "core", kind: "wired" },
    ],
    groups: [],
  };
  const spineLeaf = {
    devices: [
      device("spine", "switch"),
      device("leaf-a", "switch"),
      device("leaf-b", "switch"),
      device("server-a", "server"),
      device("server-b", "server"),
    ],
    links: [
      { id: "l1", from: "spine", to: "leaf-a", kind: "wired" },
      { id: "l2", from: "spine", to: "leaf-b", kind: "wired" },
      { id: "l3", from: "leaf-a", to: "server-a", kind: "wired" },
      { id: "l4", from: "leaf-b", to: "server-b", kind: "wired" },
    ],
    groups: [],
  };
  const irregular = {
    devices: [device("router", "router"), device("client", "client")],
    links: [{ id: "l1", from: "router", to: "client", kind: "wireless" }],
    groups: [],
  };

  assert.equal(resolveLayoutMode(threeTier, "auto-detect"), "three-tier");
  assert.equal(resolveLayoutMode(spineLeaf, "auto-detect"), "spine-leaf");
  assert.equal(resolveLayoutMode(irregular, "auto-detect"), "layered");
  assert.equal(resolveLayoutMode(threeTier, "layered"), "layered");
});

test("sean.sie dual-spine server-leaf demo imports and auto-detects like explicit spine-leaf", async () => {
  const source = await readFile(new URL("../examples/sean-sie-spine-leaf-demo.json", import.meta.url), "utf8");
  const fixture = JSON.parse(source);
  const parsed = ProjectExportSchema.parse(fixture);

  assert.equal(fixture.ownerAccount, "sean.sie");
  assert.equal(parsed.project.devices.filter((device) => device.type === "router").length, 1);
  assert.equal(parsed.project.devices.filter((device) => device.type === "switch").length, 2);
  assert.equal(parsed.project.devices.filter((device) => device.name.startsWith("Main Server")).length, 3);
  assert.equal(parsed.project.devices.filter((device) => device.name.startsWith("Node Server")).length, 8);
  assert.equal(parsed.project.links.length, 24);
  assert.equal(resolveLayoutMode(parsed.project, "auto-detect"), "spine-leaf");
  assert.equal(resolveLayoutMode(parsed.project, "spine-leaf"), "spine-leaf");
});

test("connectivity ordering puts linked nodes near their upstream neighbor", () => {
  const upstreamA = device("a", "switch", "A");
  const upstreamB = device("b", "switch", "B");
  const downstreamX = device("x", "server", "X");
  const downstreamY = device("y", "server", "Y");
  const project = {
    devices: [upstreamA, upstreamB, downstreamX, downstreamY],
    links: [
      { id: "a-x", from: "a", to: "x", kind: "wired" },
      { id: "b-y", from: "b", to: "y", kind: "wired" },
    ],
    groups: [],
  };

  const ordered = orderLayersByConnectivity(
    [[upstreamA, upstreamB], [downstreamY, downstreamX]],
    project,
  );

  assert.deepEqual(ordered[0].map(({ id }) => id), ["a", "b"]);
  assert.deepEqual(ordered[1].map(({ id }) => id), ["x", "y"]);
});
