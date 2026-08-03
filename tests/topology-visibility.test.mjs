import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCanvasProject,
  collapsedGroupNodeId,
  deviceQuantity,
} from "../app/lib/topology-visibility.ts";

const project = {
  groups: [
    { id: "store", name: "Store", kind: "site", color: "#526cf5", collapsed: true },
  ],
  devices: [
    { id: "switch", name: "Core", type: "switch", x: 0, y: 0 },
    { id: "pos", name: "POS", type: "pos", quantity: 5, x: 200, y: 100, groupId: "store" },
    { id: "camera", name: "Cameras", type: "camera", quantity: 5, x: 400, y: 300, groupId: "store" },
  ],
  links: [
    { id: "external-pos", from: "switch", to: "pos", kind: "wired", speed: "1 Gbps" },
    { id: "external-camera", from: "switch", to: "camera", kind: "wired", speed: "1 Gbps" },
    { id: "internal", from: "pos", to: "camera", kind: "wired" },
  ],
};

test("collapsed groups become one quantity summary node", () => {
  const canvas = buildCanvasProject(project);
  const summary = canvas.devices.find((device) => device.id === collapsedGroupNodeId("store"));

  assert.equal(canvas.devices.length, 2);
  assert.equal(summary?.memberCount, 2);
  assert.equal(summary?.totalQuantity, 10);
  assert.equal(summary?.x, 300);
  assert.equal(summary?.y, 200);
});

test("collapsed group links hide internal links and aggregate duplicate external paths", () => {
  const canvas = buildCanvasProject(project);

  assert.equal(canvas.links.length, 1);
  assert.equal(canvas.links[0].from, "switch");
  assert.equal(canvas.links[0].to, collapsedGroupNodeId("store"));
  assert.equal(canvas.links[0].aggregateCount, 2);
  assert.deepEqual(canvas.links[0].sourceLinkIds, ["external-pos", "external-camera"]);
});

test("expanded projects preserve every device and link", () => {
  const expanded = {
    ...project,
    groups: project.groups.map((group) => ({ ...group, collapsed: false })),
  };
  const canvas = buildCanvasProject(expanded);

  assert.deepEqual(canvas.devices.map(({ id }) => id), project.devices.map(({ id }) => id));
  assert.deepEqual(canvas.links.map(({ id }) => id), project.links.map(({ id }) => id));
  assert.equal(deviceQuantity({}), 1);
});
