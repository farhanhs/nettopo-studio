import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_PROJECT,
  SAMPLE_PROJECT,
  cloneProject,
} from "../app/lib/topology-types.ts";

test("cloneProject creates independent project and record collections", () => {
  const source = {
    devices: [{ id: "device-1", name: "Router", type: "router", x: 10, y: 20 }],
    links: [{ id: "link-1", from: "device-1", to: "device-2", kind: "wired" }],
    groups: [{ id: "group-1", name: "HQ", kind: "site", color: "#123456" }],
  };

  const clone = cloneProject(source);

  assert.deepEqual(clone, source);
  assert.notStrictEqual(clone, source);
  assert.notStrictEqual(clone.devices, source.devices);
  assert.notStrictEqual(clone.devices[0], source.devices[0]);
  assert.notStrictEqual(clone.links, source.links);
  assert.notStrictEqual(clone.links[0], source.links[0]);
  assert.notStrictEqual(clone.groups, source.groups);
  assert.notStrictEqual(clone.groups[0], source.groups[0]);

  clone.devices[0].name = "Changed";
  clone.links[0].fromPort = "WAN1";
  clone.groups[0].color = "#ffffff";

  assert.equal(source.devices[0].name, "Router");
  assert.equal(source.links[0].fromPort, undefined);
  assert.equal(source.groups[0].color, "#123456");
});

test("empty and sample projects can be cloned without sharing records", () => {
  const emptyClone = cloneProject(EMPTY_PROJECT);
  const sampleClone = cloneProject(SAMPLE_PROJECT);

  assert.deepEqual(emptyClone, EMPTY_PROJECT);
  assert.notStrictEqual(emptyClone.devices, EMPTY_PROJECT.devices);
  assert.deepEqual(sampleClone, SAMPLE_PROJECT);
  assert.notStrictEqual(sampleClone.devices[0], SAMPLE_PROJECT.devices[0]);
  assert.notStrictEqual(sampleClone.links[0], SAMPLE_PROJECT.links[0]);
  assert.notStrictEqual(sampleClone.groups[0], SAMPLE_PROJECT.groups[0]);
});
