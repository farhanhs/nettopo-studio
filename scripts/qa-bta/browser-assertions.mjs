import assert from "node:assert/strict";
import fs from "node:fs";

const REQUIRED_PHASES = ["A04", "A05", "A06", "A07", "A09", "A10"];
const DEVICE_SAFE_OMIT = new Set(["ip", "mac", "url", "location"]);

function stableObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)));
}

function sortEntities(items) {
  return items.map(stableObject).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export function canonicalProjectProjection(project) {
  assert.ok(project && Array.isArray(project.devices) && Array.isArray(project.links) && Array.isArray(project.groups), "project arrays are required");
  return {
    devices: sortEntities(project.devices),
    groups: sortEntities(project.groups),
    links: sortEntities(project.links),
  };
}

export function safeProjectProjection(project) {
  const canonical = canonicalProjectProjection(project);
  return {
    ...canonical,
    devices: canonical.devices.map(device => stableObject(Object.fromEntries(Object.entries(device).filter(([key]) => !DEVICE_SAFE_OMIT.has(key))))),
  };
}

export function scanNamedBuffers(namedBuffers, sentinels) {
  const hits = [];
  for (const [sink, value] of Object.entries(namedBuffers)) {
    const text = Buffer.isBuffer(value) ? value.toString("utf8") : JSON.stringify(value);
    for (const sentinel of sentinels) if (text.includes(sentinel)) hits.push({ sink, sentinel });
  }
  return hits;
}

export function assertSentinelPositiveControl(sentinels) {
  assert.ok(Array.isArray(sentinels) && sentinels.length > 0, "sentinel catalog is required");
  const control = scanNamedBuffers({ positiveControl: sentinels.join("\n") }, sentinels);
  assert.equal(control.length, sentinels.length, "scanner must detect every positive-control sentinel");
  return control;
}

export function assertPhaseMatrixComplete(matrix) {
  assert.equal(matrix.contract, "LOCAL-FEEDBACK-BETA-V1@R1.1");
  const ids = matrix.phases.map(phase => phase.id).sort();
  assert.deepEqual(ids, [...REQUIRED_PHASES].sort());
  for (const phase of matrix.phases) {
    assert.ok(Array.isArray(phase.steps) && phase.steps.length > 0, `${phase.id} steps required`);
    assert.ok(Array.isArray(phase.expected), `${phase.id} expected required`);
    assert.ok(Array.isArray(phase.evidence), `${phase.id} evidence required`);
    assert.ok(Array.isArray(phase.stopConditions), `${phase.id} stop conditions required`);
  }
  return REQUIRED_PHASES;
}

export function assertFiveFileFixture(directory) {
  const expected = ["credentials.masked.csv", "devices.csv", "groups.csv", "links.csv", "missing-info.csv"];
  const names = fs.readdirSync(directory).sort();
  assert.deepEqual(names, expected, "fixture must contain exactly the canonical five CSV members");
  const envelopes = [];
  for (const name of names) {
    const lines = fs.readFileSync(new URL(name, directory), "utf8").replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/);
    assert.match(lines[0], /^schemaVersion,sharing,/, `${name} must use canonical v2 envelope columns`);
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const [schemaVersion, sharing] = line.split(",", 2);
      envelopes.push({ schemaVersion, sharing });
    }
  }
  assert.ok(envelopes.length > 0, "fixture must contain at least one data row");
  assert.equal(new Set(envelopes.map(item => item.schemaVersion)).size, 1, "schemaVersion must be consistent");
  assert.equal(new Set(envelopes.map(item => item.sharing)).size, 1, "sharing must be consistent");
  return envelopes[0];
}

export function assertProjectUnchanged(before, after) {
  assert.deepEqual(canonicalProjectProjection(after), canonicalProjectProjection(before), "operation must be zero mutation");
  return true;
}

export function assertGroupEditTransition(before, after, groupId) {
  const left = canonicalProjectProjection(before);
  const right = canonicalProjectProjection(after);
  assert.deepEqual(right.devices, left.devices, "group edit must preserve every device and membership");
  assert.deepEqual(right.links, left.links, "group edit must preserve every link");
  const oldGroup = left.groups.find(group => group.id === groupId);
  const newGroup = right.groups.find(group => group.id === groupId);
  assert.ok(oldGroup && newGroup, "edited group must retain its identity");
  assert.equal(newGroup.id, oldGroup.id);
  assert.equal(newGroup.collapsed, oldGroup.collapsed);
  assert.deepEqual(right.groups.filter(group => group.id !== groupId), left.groups.filter(group => group.id !== groupId), "unrelated groups must not change");
  assert.deepEqual(after.devices, before.devices, "group edit must preserve device order and values exactly");
  assert.deepEqual(after.links, before.links, "group edit must preserve link order and values exactly");
  assert.deepEqual(after.groups.map(group => group.id), before.groups.map(group => group.id), "group edit must preserve group order");
  for (const key of Object.keys(newGroup)) assert.ok(["id", "collapsed", "name", "kind", "color"].includes(key), `unexpected group field changed: ${key}`);
  return after;
}

export function assertGroupDeleteTransition(before, after, groupId) {
  const left = canonicalProjectProjection(before);
  const right = canonicalProjectProjection(after);
  assert.ok(left.groups.some(group => group.id === groupId), "target group must exist before delete");
  assert.equal(right.groups.some(group => group.id === groupId), false, "target group must be removed");
  assert.deepEqual(right.groups, left.groups.filter(group => group.id !== groupId), "unrelated groups must be preserved");
  assert.deepEqual(right.links, left.links, "all links and endpoints must be preserved");
  const expectedDevices = left.devices.map(device => device.groupId === groupId ? stableObject(Object.fromEntries(Object.entries(device).filter(([key]) => key !== "groupId"))) : device);
  assert.deepEqual(right.devices, expectedDevices, "target members must become unclassified without any other device change");
  const expectedRawDevices = before.devices.map(device => device.groupId === groupId ? Object.fromEntries(Object.entries(device).filter(([key]) => key !== "groupId")) : device);
  const withoutMembership = devices => devices.map(device => Object.fromEntries(Object.entries(device).filter(([key]) => key !== "groupId")));
  assert.deepEqual(withoutMembership(after.devices), withoutMembership(expectedRawDevices), "device order and all non-membership values must be preserved");
  for (let index = 0; index < before.devices.length; index += 1) {
    if (before.devices[index].groupId === groupId) assert.equal(after.devices[index].groupId, undefined, "deleted group members must become unclassified");
    else assert.equal(after.devices[index].groupId, before.devices[index].groupId, "unrelated membership must be preserved");
  }
  assert.deepEqual(after.links, before.links, "link order, endpoints, and fields must be preserved");
  assert.deepEqual(after.groups, before.groups.filter(group => group.id !== groupId), "other group order and values must be preserved");
  return after;
}

