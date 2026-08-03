import assert from "node:assert/strict";
import test from "node:test";

import { validateProject } from "../app/lib/topology-validation.ts";

const validProject = {
  groups: [{ id: "site-1", name: " Main site ", kind: "site", color: "#AABBCC", collapsed: true }],
  devices: [
    { id: "router-1", name: " Router ", type: "router", quantity: 5, x: 10, y: 20, groupId: "site-1" },
    { id: "switch-1", name: "Switch", type: "mesh-node", x: 30, y: 40 },
  ],
  links: [{ id: "link-1", from: "router-1", to: "switch-1", kind: "wired" }],
};

test("validateProject accepts and normalizes a valid project", () => {
  const project = validateProject(validProject);

  assert.equal(project.groups[0].name, "Main site");
  assert.equal(project.groups[0].color, "#aabbcc");
  assert.equal(project.devices[0].name, "Router");
  assert.equal(project.devices[0].quantity, 5);
  assert.equal(project.devices[1].type, "mesh-node");
  assert.equal(project.groups[0].collapsed, true);
});

test("validateProject rejects duplicate IDs and broken relationships", () => {
  assert.throws(
    () => validateProject({ ...validProject, devices: [validProject.devices[0], validProject.devices[0]] }),
    /duplicate device id/,
  );
  assert.throws(
    () => validateProject({ ...validProject, links: [{ ...validProject.links[0], to: "missing" }] }),
    /missing target device/,
  );
  assert.throws(
    () => validateProject({ ...validProject, devices: [{ ...validProject.devices[0], groupId: "missing" }] }),
    /missing group/,
  );
});

test("validateProject rejects self-links, invalid coordinates, and plaintext credentials", () => {
  assert.throws(
    () => validateProject({ ...validProject, links: [{ ...validProject.links[0], to: "router-1" }] }),
    /cannot connect a device to itself/,
  );
  assert.throws(
    () => validateProject({ ...validProject, devices: [{ ...validProject.devices[0], x: Number.NaN }] }),
    /Invalid project/,
  );
  assert.throws(
    () => validateProject({ ...validProject, devices: [{ ...validProject.devices[0], quantity: 0 }] }),
    /Invalid project/,
  );
  assert.throws(
    () => validateProject({ ...validProject, devices: [{ ...validProject.devices[0], password: "secret" }] }),
    /credentials API/,
  );
});
