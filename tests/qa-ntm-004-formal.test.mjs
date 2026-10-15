import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { canonicalTrustedValue, fingerprintTrustedValue } from "../app/lib/trusted-network-digest.ts";
import { inspectTrustedField, upcastProject, validateProjectV2 } from "../app/lib/trusted-network-model.ts";
import { projectTrustedNetworkView } from "../app/lib/trusted-network-projection.ts";

const fixtureRoot = new URL("./fixtures/qa-ntm-004/", import.meta.url);
const contract = JSON.parse(await readFile(new URL("section5-r1-1-contract-vectors.json", fixtureRoot), "utf8"));

function legacyProject() {
  return {
    devices: [
      { id: "qa-device-a", name: "QA A", type: "switch", x: 0, y: 0 },
      { id: "qa-device-b", name: "QA B", type: "server", x: 320, y: 0 },
    ],
    links: [
      { id: "qa-link-port", from: "qa-device-a", to: "qa-device-b", kind: "wired", fromPort: " Gi0/1 ", toPort: "" },
      { id: "qa-link-blank", from: "qa-device-b", to: "qa-device-a", kind: "wired" },
    ],
    groups: [],
  };
}

async function trustedFixture() {
  const project = upcastProject({ devices: legacyProject().devices, links: [], groups: [] });
  const model = project.trustedNetwork;
  model.areas = [
    { id: "qa-region", kind: "region", name: "QA Region" },
    { id: "qa-site", kind: "site", name: "QA Site", parentAreaId: "qa-region" },
  ];
  project.devices[0].networkAreaId = "qa-site";
  model.interfaces = [
    { id: "qa-if-a", deviceId: "qa-device-a", name: "Gi0/1", kind: "physical", aliases: [] },
    { id: "qa-if-b", deviceId: "qa-device-b", name: "Gi0/2", kind: "physical", aliases: [] },
  ];
  model.vlans = [{ id: "qa-vlan", vlanNumber: 10, name: "QA VLAN", areaId: "qa-site" }];
  model.subnets = [{ id: "qa-subnet", cidr: "10.10.0.0/24", areaId: "qa-site", vlanId: "qa-vlan" }];
  model.interfaceVlans = [{ id: "qa-if-vlan", interfaceId: "qa-if-a", vlanId: "qa-vlan", mode: "access" }];
  model.interfaceSubnets = [{ id: "qa-if-subnet", interfaceId: "qa-if-a", subnetId: "qa-subnet", role: "member" }];
  project.links = [
    {
      id: "qa-link-structured-a", from: "qa-device-a", to: "qa-device-b", kind: "wired",
      fromInterfaceId: "qa-if-a", toInterfaceId: "qa-if-b",
    },
    {
      id: "qa-link-structured-b", from: "qa-device-b", to: "qa-device-a", kind: "wired",
      fromInterfaceId: "qa-if-b", toInterfaceId: "qa-if-a",
    },
  ];
  model.resiliencyRelations = [{ id: "qa-resiliency", kind: "candidate", memberLinkIds: ["qa-link-structured-a", "qa-link-structured-b"] }];
  model.evidence = [{ id: "qa-evidence", method: "human", sourceKind: "manual", displayName: "QA synthetic review", safeSummary: "QA-only evidence" }];
  const rows = [
    ["device", project.devices], ["link", project.links], ["area", model.areas], ["interface", model.interfaces],
    ["vlan", model.vlans], ["subnet", model.subnets], ["interface-vlan", model.interfaceVlans],
    ["interface-subnet", model.interfaceSubnets], ["resiliency", model.resiliencyRelations],
  ];
  for (const [entityType, records] of rows) {
    for (const record of records) {
      model.fieldTrust.push({
        id: `qa-trust-${record.id}`, entityType, entityId: record.id, fieldPath: "$record",
        valueFingerprint: await fingerprintTrustedValue(record), evidenceIds: ["qa-evidence"],
        verification: "verified", verifiedByUserId: "QA_PRIVATE_ACTOR", verifiedAt: "2026-10-14T00:00:00Z",
      });
    }
  }
  validateProjectV2(project);
  return project;
}

async function projectView(project, overrides = {}) {
  const outcome = await projectTrustedNetworkView({ authorizedProject: project, view: "physical", mode: "all", ...overrides });
  assert.equal(outcome.ok, true, JSON.stringify(outcome));
  return outcome.result;
}

test("PROJ-01 shared digest matches the independent canonical byte vectors", async () => {
  for (const vector of contract.digestVectors) {
    const canonical = Buffer.from(vector.canonicalUtf8Hex, "hex").toString("utf8");
    assert.equal(await fingerprintTrustedValue(JSON.parse(canonical)), vector.sha256, vector.id);
    assert.equal(canonicalTrustedValue(JSON.parse(canonical)), canonical, vector.id);
  }
});

test("PROJ-01/02 legacy upcast is immutable, deterministic, and preserves unverified fingerprint bytes", async () => {
  const legacy = legacyProject();
  const before = structuredClone(legacy);
  const first = upcastProject(legacy);
  const second = upcastProject(structuredClone(legacy));
  assert.deepEqual(first, second);
  assert.deepEqual(legacy, before);
  const trustBefore = first.trustedNetwork.fieldTrust.map(({ id, valueFingerprint, verification }) => ({ id, valueFingerprint, verification }));
  await projectView(first);
  assert.deepEqual(first.trustedNetwork.fieldTrust.map(({ id, valueFingerprint, verification }) => ({ id, valueFingerprint, verification })), trustBefore);
  assert.equal(trustBefore.every(({ verification }) => verification === "unverified"), true);
});

test("PROJ-02 legacy blank ports stay device endpoints and never invent interfaces", async () => {
  const project = upcastProject(legacyProject());
  assert.equal(project.trustedNetwork.interfaces.length, 1);
  const result = await projectView(project);
  const blank = result.relations.find(({ ref }) => ref.id === "qa-link-blank");
  assert.deepEqual([blank.from.type, blank.to.type], ["device", "device"]);
  assert.ok(result.issues.some(({ code, count }) => code === "LEGACY_INTERFACE_UNKNOWN" && count >= 2));
  const verified = await projectView(project, { mode: "verified-only" });
  assert.equal(verified.relations.length, 0);
});

test("PROJ-03 complete record optional changes become stale without record/field promotion", async () => {
  const project = await trustedFixture();
  const recordKey = { entityType: "interface", entityId: "qa-if-a", fieldPath: "$record" };
  assert.equal((await inspectTrustedField(project, recordKey)).state, "verified");
  project.trustedNetwork.interfaces[0].description = "QA changed optional value";
  assert.equal((await inspectTrustedField(project, recordKey)).state, "stale");
  project.trustedNetwork.fieldTrust.push({
    id: "qa-trust-leaf-name", entityType: "interface", entityId: "qa-if-a", fieldPath: "name",
    valueFingerprint: await fingerprintTrustedValue("Gi0/1"), evidenceIds: ["qa-evidence"],
    verification: "verified", verifiedByUserId: "QA_PRIVATE_ACTOR", verifiedAt: "2026-10-14T00:00:00Z",
  });
  assert.equal((await inspectTrustedField(project, recordKey)).state, "stale");
  assert.equal((await inspectTrustedField(project, { ...recordKey, fieldPath: "name" })).state, "verified");
});

test("PROJ-03 verified-only closure emits no dangling relations and exposes no stale value or actor", async () => {
  const project = await trustedFixture();
  project.trustedNetwork.interfaces[0].description = "QA_STALE_SECRET_VALUE";
  for (const view of ["physical", "logical"]) {
    const result = await projectView(project, { view, mode: "verified-only" });
    const items = new Set(result.items.map(({ ref }) => `${ref.type}:${ref.id}`));
    for (const relation of result.relations) {
      assert.ok(items.has(`${relation.from.type}:${relation.from.id}`));
      assert.ok(items.has(`${relation.to.type}:${relation.to.id}`));
    }
    assert.doesNotMatch(JSON.stringify(result), /QA_STALE_SECRET_VALUE|QA_PRIVATE_ACTOR|valueFingerprint/);
    assert.ok(result.issues.some(({ code }) => code === "STALE_TRUST_RECORD_IGNORED"));
  }
});

test("PROJ-01/04 permutation including NFC-equal raw IDs is deterministic", async () => {
  const project = await trustedFixture();
  project.devices.push(
    { id: "if-caf\u00e9", name: "NFC pair", type: "client", x: 0, y: 0 },
    { id: "if-cafe\u0301", name: "NFC pair", type: "client", x: 0, y: 0 },
  );
  const first = await projectView(project, { view: "logical", selection: { type: "interface", id: "qa-if-a" } });
  const permuted = structuredClone(project);
  permuted.devices.reverse();
  permuted.links.reverse();
  for (const value of Object.values(permuted.trustedNetwork)) if (Array.isArray(value)) value.reverse();
  const second = await projectView(permuted, { view: "logical", selection: { type: "interface", id: "qa-if-a" } });
  assert.deepEqual(second, first);
  assert.deepEqual(first.items.filter(({ label }) => label === "NFC pair").map(({ ref }) => ref.id), ["if-cafe\u0301", "if-caf\u00e9"]);
});

test("PROJ-04/05 unknown selection and focus never echo or persist the caller ID", async () => {
  const project = await trustedFixture();
  const before = structuredClone(project);
  const result = await projectView(project, {
    selection: { type: "device", id: "QA_UNKNOWN_SECRET_ID" },
    focusAreaId: "QA_UNKNOWN_SECRET_ID",
    collapsedAreaIds: ["QA_UNKNOWN_SECRET_ID"],
  });
  assert.doesNotMatch(JSON.stringify(result), /QA_UNKNOWN_SECRET_ID|QA_PRIVATE_ACTOR/);
  assert.ok(result.issues.some(({ code }) => code === "SELECTION_NOT_VISIBLE"));
  assert.ok(result.issues.some(({ code }) => code === "FOCUS_AREA_NOT_VISIBLE"));
  assert.deepEqual(project, before);
});

test("PROJ-05 safe evidence never exposes full paths, fingerprints, actors, or raw errors", async () => {
  const project = await trustedFixture();
  project.trustedNetwork.evidence[0].displayName = "C:/qa/private/source.txt";
  project.trustedNetwork.evidence[0].safeSummary = "/home/qa/private/raw.txt";
  const result = await projectView(project);
  assert.doesNotMatch(JSON.stringify(result), /C:\/qa|\/home\/qa|QA_PRIVATE_ACTOR|valueFingerprint/);

  const invalid = structuredClone(project);
  invalid.devices[0].password = "QA_RAW_SECRET";
  const outcome = await projectTrustedNetworkView({ authorizedProject: invalid, view: "physical", mode: "all" });
  assert.deepEqual(outcome, { ok: false, error: { code: "INVALID_PROJECT", safeMessage: "Unable to display this topology projection.", issueCount: 1 } });
  assert.doesNotMatch(JSON.stringify(outcome), /QA_RAW_SECRET|password|stack|path/i);
});

test("PROJ-01 async request snapshot cannot be replaced by caller mutation", async () => {
  const project = await trustedFixture();
  const request = {
    authorizedProject: project, view: "physical", mode: "all",
    selection: { type: "interface", id: "qa-if-a" }, collapsedAreaIds: [],
  };
  const pending = projectTrustedNetworkView(request);
  request.mode = "verified-only";
  request.selection.id = "QA_UNKNOWN_SECRET_ID";
  project.devices[0].name = "QA_CALLER_MUTATION";
  const outcome = await pending;
  assert.equal(outcome.ok, true);
  assert.equal(outcome.result.mode, "all");
  assert.deepEqual(outcome.result.requestedSelection, { type: "interface", id: "qa-if-a" });
  assert.doesNotMatch(JSON.stringify(outcome), /QA_UNKNOWN_SECRET_ID|QA_CALLER_MUTATION/);
});
