import assert from "node:assert/strict";
import test from "node:test";

import { generateInterfaceCandidates, InterfaceCandidateError, INTERFACE_CANDIDATE_LIMITS } from "../app/lib/trusted-network-interface-candidates.ts";
import { upcastProject, validateProjectV2 } from "../app/lib/trusted-network-model.ts";

const row = (name, extras = {}) => ({ name, kind: "physical", ...extras });
const evidence = (id) => ({ id, method: "parsed", sourceKind: "json", displayName: "QA synthetic interface list" });
const source = (id, interfaces) => ({ evidence: evidence(id), interfaces });
const explicitInput = (interfaces, extras = {}) => ({ deviceId: "qa-device-a", explicit: [source("qa-evidence-a", interfaces)], ...extras });
const manualInput = (manual) => ({ deviceId: "qa-device-a", manual: { quantity: 3, start: 1, pattern: "{n}", prefix: "Gi0/", kind: "physical", ...manual } });
const trustedTemplate = (version, fingerprint, interfaces) => ({
  templateId: "qa-template", version, vendor: "QA Vendor", modelMatch: "QA Model",
  fingerprint, reviewedAt: "2026-10-09T00:00:00Z", interfaces,
});

function project() {
  return upcastProject({
    devices: [
      { id: "qa-device-a", name: "QA Switch A", type: "switch", quantity: 48, model: "Do not infer 48 ports", x: 0, y: 0 },
      { id: "qa-device-b", name: "QA Switch B", type: "switch", x: 300, y: 0 },
    ],
    links: [{ id: "qa-link", from: "qa-device-a", to: "qa-device-b", kind: "wired", fromPort: "Observed Port" }],
    groups: [],
  });
}

async function typedReject(current, input, templates = [], expectedCode) {
  const before = structuredClone({ current, input, templates });
  let caught;
  try { await generateInterfaceCandidates(current, input, templates); } catch (error) { caught = error; }
  assert.ok(caught instanceof InterfaceCandidateError);
  if (expectedCode) assert.equal(caught.code, expectedCode);
  assert.equal(caught.message, "Interface candidate input was rejected.");
  assert.deepEqual({ current, input, templates }, before);
  return caught;
}

test("GEN-01/02 explicit priority is deterministic, preserves safe text, and templates only fill missing fields", async () => {
  const current = project();
  const input = {
    deviceId: "qa-device-a", vendor: " qa VENDOR ", model: "QA MODEL",
    explicit: [source("qa-evidence-explicit", [row(" Gi0/1 ", { aliases: [" UPLINK-A "], description: " explicit " })])],
  };
  const templates = [trustedTemplate("1", "a".repeat(64), [row(" Gi0/1 ", { aliases: [" UPLINK-A "] }), row("Gi0/2")])];
  const before = structuredClone({ current, input, templates });
  const first = await generateInterfaceCandidates(current, input, templates);
  const second = await generateInterfaceCandidates(current, input, templates);
  assert.deepEqual(first, second);
  assert.deepEqual({ current, input, templates }, before);
  assert.deepEqual(first.candidates.map(({ interface: item }) => item.name), [" Gi0/1 ", "Gi0/2"]);
  assert.deepEqual(first.candidates[0].interface.aliases, [" UPLINK-A "]);
  assert.equal(first.candidates[0].source, "explicit");
  assert.equal(first.candidates[1].source, "template");
  assert.equal(first.candidates.every(({ verification }) => verification === "unverified"), true);
  assert.equal(first.candidates.every(({ interface: item }) => /^if-gen-v1-[0-9a-f]{64}$/.test(item.id)), true);
});

test("GEN-02 exact trusted template selection rejects fuzzy and ambiguous matching", async () => {
  const templates = [
    trustedTemplate("1", "a".repeat(64), [row("Gi0/1")]),
    trustedTemplate("2", "b".repeat(64), [row("Gi0/2")]),
  ];
  const fuzzy = await generateInterfaceCandidates(project(), { deviceId: "qa-device-a", vendor: "QA Vendor", model: "QA" }, templates);
  assert.equal(fuzzy.candidates.length, 0);
  assert.ok(fuzzy.missingInfo.some(({ code }) => code === "TEMPLATE_NOT_FOUND"));
  const ambiguous = await generateInterfaceCandidates(project(), { deviceId: "qa-device-a", vendor: "QA Vendor", model: "QA Model" }, templates);
  assert.equal(ambiguous.candidates.length, 0);
  assert.ok(ambiguous.conflicts.some(({ code }) => code === "TEMPLATE_AMBIGUOUS"));
  const selected = await generateInterfaceCandidates(project(), {
    deviceId: "qa-device-a", vendor: "QA Vendor", model: "QA Model",
    templateSelection: { templateId: "qa-template", version: "2", fingerprint: "b".repeat(64) },
  }, templates);
  assert.deepEqual(selected.candidates.map(({ interface: item }) => item.name), ["Gi0/2"]);
});

test("GEN-03 manual numbering observes exact finite syntax and all documented boundaries", async () => {
  assert.equal(INTERFACE_CANDIDATE_LIMITS.quantity, 512);
  assert.equal(INTERFACE_CANDIDATE_LIMITS.maxIndex, 999999);
  assert.equal(INTERFACE_CANDIDATE_LIMITS.sources, 32);
  assert.equal(INTERFACE_CANDIDATE_LIMITS.templates, 32);
  assert.equal(INTERFACE_CANDIDATE_LIMITS.rowsPerSource, 512);
  assert.equal(INTERFACE_CANDIDATE_LIMITS.totalRows, 4096);
  const plan = await generateInterfaceCandidates(project(), manualInput({ quantity: 3, start: 7, pattern: "{n:03}", prefix: " Gi1/0/", suffix: " " }));
  assert.deepEqual(plan.candidates.map(({ interface: item }) => item.name), [" Gi1/0/007 ", " Gi1/0/008 ", " Gi1/0/009 "]);
  for (const quantity of [0, -1, 1.5, 513]) await typedReject(project(), manualInput({ quantity }));
  await typedReject(project(), manualInput({ quantity: 2, start: 999999 }), [], "INPUT_LIMIT_EXCEEDED");
  for (const pattern of ["{n+1}", "{n:01}", "{n:07}", "(.*)", "{n}{n}"]) await typedReject(project(), manualInput({ pattern }), [], "INVALID_MANUAL_FORMAT");
  const noSource = await generateInterfaceCandidates(project(), { deviceId: "qa-device-a" });
  assert.deepEqual(noSource.candidates, []);
  assert.deepEqual(noSource.missingInfo, [{ code: "NO_SOURCE" }]);
});

test("GEN-04 collisions and parent errors are blocking and retain each source's original request", async () => {
  const disagreement = await generateInterfaceCandidates(project(), {
    deviceId: "qa-device-a",
    explicit: [source("qa-evidence-a", [row("Port 1", { kind: "logical", parentName: " Parent A " })])],
    manual: { quantity: 1, start: 1, pattern: "{n}", prefix: "Port ", kind: "physical" },
  });
  assert.equal(disagreement.candidates.length, 0);
  assert.ok(disagreement.conflicts.some(({ code, proposals }) => code === "SOURCE_DISAGREEMENT" && proposals.some(({ parentName }) => parentName === " Parent A ")));
  const alias = await generateInterfaceCandidates(project(), explicitInput([row("A", { aliases: [" Cafe\u0301 "] }), row("CAFÉ")]));
  assert.equal(alias.candidates.length, 0);
  assert.ok(alias.conflicts.some(({ code }) => code === "ALIAS_COLLISION"));
  const cycle = await generateInterfaceCandidates(project(), explicitInput([row("Parent", { parentName: "Child" }), row("Child", { parentName: "Parent" })]));
  assert.equal(cycle.candidates.length, 0);
  assert.ok(cycle.conflicts.some(({ code }) => code === "PARENT_CYCLE"));
});

test("GEN-05/07 verified existing facts are unchanged and repeated generation is idempotent", async () => {
  const current = project();
  current.trustedNetwork.interfaces.push({ id: "if-existing", deviceId: "qa-device-a", name: "Gi0/1", kind: "physical", aliases: [] });
  current.trustedNetwork.evidence.push({ id: "ev-existing", method: "human", sourceKind: "manual", displayName: "QA verified fact" });
  current.trustedNetwork.fieldTrust.push({
    id: "trust-existing", entityType: "interface", entityId: "if-existing", fieldPath: "name",
    valueFingerprint: "c".repeat(64), evidenceIds: ["ev-existing"], verification: "verified",
    verifiedByUserId: "qa-reviewer", verifiedAt: "2026-10-09T00:00:00Z",
  });
  validateProjectV2(current);
  const before = structuredClone(current);
  const matching = await generateInterfaceCandidates(current, explicitInput([row("Gi0/1")]));
  assert.equal(matching.candidates.length, 0);
  assert.deepEqual(current, before);
  const changed = await generateInterfaceCandidates(current, explicitInput([row("Gi0/1", { description: "proposed" })]));
  assert.equal(changed.candidates.length, 0);
  assert.ok(changed.conflicts.some(({ protected: protectedValue }) => protectedValue));
  assert.deepEqual(current, before);
  const otherDevice = await generateInterfaceCandidates(project(), { deviceId: "qa-device-b", manual: { quantity: 1, start: 1, pattern: "{n}", prefix: "Gi0/", kind: "physical" } });
  assert.equal(otherDevice.candidates[0].interface.deviceId, "qa-device-b");
});

test("GEN-06 strict secret/raw/unknown inputs reject safely with zero mutation or echo", async () => {
  const sentinels = ["QA_NTM_002_PASSWORD_SENTINEL_NOT_REAL", "QA_NTM_002_TOKEN_SENTINEL_NOT_REAL", "postgresql://qa_ntm_002_sentinel.invalid/never-connect"];
  const malicious = explicitInput([row("Gi0/1")]);
  malicious.explicit[0].evidence.rawConfig = sentinels.join("|");
  const error = await typedReject(project(), malicious);
  const safe = JSON.stringify({ name: error.name, code: error.code, message: error.message });
  for (const sentinel of sentinels) assert.equal(safe.includes(sentinel), false);
  const unknown = manualInput({}); unknown.clientActor = { role: "boss" };
  await typedReject(project(), unknown, [], "INVALID_INPUT");
  const getter = {}; Object.defineProperty(getter, "deviceId", { enumerable: true, get() { throw new Error("getter executed"); } });
  await assert.rejects(generateInterfaceCandidates(project(), getter), (caught) => caught instanceof InterfaceCandidateError && caught.code === "INVALID_INPUT");
});

test("GEN-07 safe additions validate under CORE-R2 and repeated insertion produces no duplicates", async () => {
  const current = project();
  const input = explicitInput([row("Gi0/1"), row("Gi0/2", { parentName: "Gi0/1" })]);
  const first = await generateInterfaceCandidates(current, input);
  const preview = structuredClone(current);
  preview.trustedNetwork.interfaces.push(...structuredClone(first.candidates.map(({ interface: item }) => item)));
  preview.trustedNetwork.evidence.push(...structuredClone(first.evidence));
  validateProjectV2(preview);
  const repeated = await generateInterfaceCandidates(preview, input);
  assert.deepEqual(repeated.candidates, []);
  assert.equal(repeated.conflicts.length, 0);
});
