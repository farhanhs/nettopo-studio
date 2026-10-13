import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { upcastProject, validateProjectV2 } from "../app/lib/trusted-network-model.ts";
import { generateInterfaceCandidates } from "../app/lib/trusted-network-interface-candidates.ts";
import { createTrustedChangePlanner, TrustedChangePlanError } from "../app/lib/trusted-network-change-plan.ts";

const owner = { projectScopeId: "synthetic-project", deviceId: "d-a" };
const evidence = { id: "ev-plan", method: "parsed", sourceKind: "json", displayName: "Synthetic interface list" };
const row = (extras = {}) => ({ id: "if-a", deviceId: "d-a", name: "Port A", kind: "physical", aliases: [], ...extras });
const candidate = (value) => ({ interface: value, source: "explicit", evidenceIds: [evidence.id], verification: "unverified" });
const bundle = (rows = [row()]) => ({ deviceId: "d-a", candidates: rows.map(candidate), conflicts: [], evidence: [evidence], missingInfo: [] });
function project(rows = []) {
  const value = upcastProject({ devices: [
    { id: "d-a", name: "Synthetic A", type: "switch", x: 0, y: 0 },
    { id: "d-b", name: "Synthetic B", type: "switch", x: 300, y: 0 },
  ], links: [], groups: [] });
  value.trustedNetwork.interfaces = rows;
  return value;
}
function difference(value, code = "EXISTING_DIFFERENCE") {
  return { ...bundle([]), conflicts: [{ code, proposals: [candidate(value)], existingInterfaceIds: [value.id], evidenceIds: [evidence.id], protected: false }] };
}
function frozen(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
const decision = (prepared, action = "accept-unverified", changes = {}) => ({
  kind: "resolve", resolutions: prepared.preview.proposals.map((p) => ({ proposalId: p.proposalId, action })),
  warningAcknowledged: true, ...changes,
});
async function rejected(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof TrustedChangePlanError);
    assert.equal(error.code, code);
    assert.deepEqual(JSON.parse(JSON.stringify(error)), { code });
    assert.doesNotMatch(JSON.stringify(error), /SENTINEL|postgres:|password|cookie|ciphertext|verifiedBy|stack/);
    return true;
  });
}
async function setup(current = project(), plan = bundle()) {
  const planner = createTrustedChangePlanner();
  const prepared = await planner.prepare({ owner, currentProject: current, candidatePlan: plan });
  return { planner, prepared, current };
}
async function applyAll(current, plan, action = "accept-unverified") {
  const { planner, prepared } = await setup(current, plan);
  await planner.resolve(prepared.handle, decision(prepared, action));
  return planner.apply(prepared.handle, { owner, currentProject: current });
}
const hashValue = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function trust(current, field, fingerprint, verification = "verified") {
  current.trustedNetwork.evidence = [structuredClone(evidence)];
  current.trustedNetwork.fieldTrust = [{ id: "trust-old", entityType: "interface", entityId: "if-a", fieldPath: field,
    valueFingerprint: fingerprint, evidenceIds: [evidence.id], verification,
    ...(verification === "verified" ? { verifiedByUserId: "fixture-reviewer", verifiedAt: "2026-10-10T00:00:00Z" } : {}) }];
  return current;
}

test("PLAN-01 deterministic prepare, frozen inputs, private evidence and unverified snapshot", async () => {
  const current = frozen(project());
  const generated = frozen(await generateInterfaceCandidates(current, { deviceId: "d-a", explicit: [
    { evidence, interfaces: [{ name: " A ", kind: "physical", description: " Original " }] },
  ] }));
  const before = JSON.stringify({ current, generated });
  const { planner, prepared } = await setup(current, generated);
  const second = await planner.prepare({ owner, currentProject: current, candidatePlan: generated });
  assert.deepEqual(prepared.preview, second.preview);
  assert.notEqual(prepared.handle, second.handle);
  assert.equal("evidence" in prepared.preview, false);
  await planner.resolve(prepared.handle, decision(prepared));
  const result = await planner.apply(prepared.handle, { owner, currentProject: current });
  assert.equal(result.project.trustedNetwork.interfaces[0].name, " A ");
  assert.equal(result.project.trustedNetwork.interfaces[0].description, " Original ");
  assert.equal(result.receipt.persistence, "not-performed");
  assert.deepEqual(result.receipt.verified, []);
  assert.ok(result.project.trustedNetwork.fieldTrust.every((t) => t.verification === "unverified" && !t.verifiedByUserId));
  assert.deepEqual(result.project.trustedNetwork.evidence, [evidence]);
  validateProjectV2(result.project);
  assert.equal(JSON.stringify({ current, generated }), before);
  await rejected(planner.apply(prepared.handle, { owner, currentProject: current }), "TRUSTED_PLAN_HANDLE_INVALID");
});

test("PLAN-03 previews, cloned handles and cross-instance handles have no authority", async () => {
  const { planner, prepared, current } = await setup();
  for (const fake of [prepared.preview, {}, { ...prepared.handle }, structuredClone(prepared.handle), JSON.parse(JSON.stringify(prepared.handle))]) {
    await rejected(planner.resolve(fake, decision(prepared)), "TRUSTED_PLAN_HANDLE_INVALID");
  }
  await rejected(createTrustedChangePlanner().resolve(prepared.handle, decision(prepared)), "TRUSTED_PLAN_HANDLE_INVALID");
  prepared.preview.proposals[0].proposedValue.name = "changed public DTO";
  prepared.preview.issues.length = 0;
  prepared.preview.canResolve = true;
  await planner.resolve(prepared.handle, decision(prepared));
  const result = await planner.apply(prepared.handle, { owner, currentProject: current });
  assert.equal(result.project.trustedNetwork.interfaces[0].name, "Port A");
});

test("PLAN-01 cancel zero change, registry capacity and lifetime", async () => {
  const planner = createTrustedChangePlanner();
  const current = project();
  const all = await Promise.all(Array.from({ length: 32 }, () => planner.prepare({ owner, currentProject: current, candidatePlan: bundle() })));
  await rejected(planner.prepare({ owner, currentProject: current, candidatePlan: bundle() }), "TRUSTED_PLAN_CAPACITY_EXCEEDED");
  assert.deepEqual(await planner.resolve(all[0].handle, { kind: "cancel" }), { status: "cancelled" });
  await rejected(planner.resolve(all[0].handle, decision(all[0])), "TRUSTED_PLAN_HANDLE_INVALID");
  await planner.prepare({ owner, currentProject: current, candidatePlan: bundle() });
  assert.deepEqual(current, project());
});

test("PLAN-03 raw Unicode change is stale and failed apply consumes handle", async () => {
  const current = project();
  current.devices[0].name = "Cafe\u0301";
  const { planner, prepared } = await setup(current);
  await planner.resolve(prepared.handle, decision(prepared));
  const changed = structuredClone(current);
  changed.devices[0].name = "Caf\u00e9";
  await rejected(planner.apply(prepared.handle, { owner, currentProject: changed }), "TRUSTED_PLAN_STALE");
  await rejected(planner.apply(prepared.handle, { owner, currentProject: current }), "TRUSTED_PLAN_HANDLE_INVALID");
  const next = await planner.prepare({ owner, currentProject: changed, candidatePlan: bundle() });
  assert.notEqual(next.preview.baseRevision, prepared.preview.baseRevision);
});

test("PLAN-03 scope mismatch and premature apply never return a result", async () => {
  const { planner, prepared, current } = await setup();
  await planner.resolve(prepared.handle, decision(prepared));
  await rejected(planner.apply(prepared.handle, { owner: { ...owner, projectScopeId: "other" }, currentProject: current }), "TRUSTED_PLAN_SCOPE_MISMATCH");
  await rejected(planner.apply(prepared.handle, { owner, currentProject: current }), "TRUSTED_PLAN_HANDLE_INVALID");
  const next = await setup();
  await rejected(next.planner.apply(next.prepared.handle, { owner, currentProject: next.current }), "TRUSTED_PLAN_STATE_INVALID");
});

test("PLAN-02 incomplete/unknown/duplicate/unsupported decisions are correctable", async () => {
  const { planner, prepared } = await setup();
  const id = prepared.preview.proposals[0].proposalId;
  for (const [resolutions, code] of [
    [[], "TRUSTED_DECISION_INCOMPLETE"],
    [[{ proposalId: "unknown", action: "exclude" }], "TRUSTED_DECISION_UNKNOWN"],
    [[{ proposalId: id, action: "exclude" }, { proposalId: id, action: "exclude" }], "TRUSTED_DECISION_DUPLICATE"],
    [[{ proposalId: id, action: "add-alias" }], "TRUSTED_OPERATION_UNSUPPORTED"],
    [[{ proposalId: id, action: "keep-current" }], "TRUSTED_DECISION_INVALID_FOR_OPERATION"],
  ]) await rejected(planner.resolve(prepared.handle, decision(prepared, "exclude", { resolutions })), code);
  await planner.resolve(prepared.handle, decision(prepared, "exclude"));
  await rejected(planner.resolve(prepared.handle, decision(prepared)), "TRUSTED_PLAN_STATE_INVALID");
});

test("PLAN-05 no action or body actor can grant verification", async () => {
  const { planner, prepared, current } = await setup();
  await rejected(planner.resolve(prepared.handle, decision(prepared, "accept-and-verify")), "TRUSTED_ACTOR_REQUIRED");
  await rejected(planner.resolve(prepared.handle, { ...decision(prepared), actor: { role: "boss" } }), "TRUSTED_CANDIDATE_PLAN_INVALID");
  await planner.resolve(prepared.handle, decision(prepared));
  await rejected(planner.apply(prepared.handle, { owner, currentProject: current, actor: { role: "boss" } }), "TRUSTED_CANDIDATE_PLAN_INVALID");
});

test("PLAN-04 verified changed field stays protected even when GEN says otherwise", async () => {
  const current = trust(project([row()]), "name", hashValue("Port A"));
  const plan = difference(row({ name: "New A" }));
  const { planner, prepared } = await setup(current, plan);
  assert.equal(prepared.preview.proposals[0].protected, true);
  await rejected(planner.resolve(prepared.handle, decision(prepared)), "TRUSTED_ACTOR_REQUIRED");
  await planner.resolve(prepared.handle, decision(prepared, "keep-current"));
  const result = await planner.apply(prepared.handle, { owner, currentProject: current });
  assert.deepEqual(result.project, current);
});

test("PLAN-04 stale verified fingerprints including legacy schemes are hard blocks", async () => {
  const current = trust(project([row()]), "name", "a".repeat(64));
  const { planner, prepared } = await setup(current, difference(row({ name: "New A" })));
  assert.equal(prepared.preview.canResolve, false);
  assert.ok(prepared.preview.issues.some((i) => i.code === "TRUSTED_TRUST_FINGERPRINT_STALE"));
  await rejected(planner.resolve(prepared.handle, decision(prepared, "exclude")), "TRUSTED_TRUST_FINGERPRINT_STALE");
  assert.equal(current.trustedNetwork.fieldTrust[0].verification, "verified");
});

test("PLAN-06 omitted optional and default aliases never clear; aliases stable union", async () => {
  const current = project([row({ aliases: ["old"], description: "retain", mac: "aa:bb:cc:dd:ee:ff" })]);
  const noClear = await applyAll(current, difference(row({ kind: "logical" })));
  assert.equal(noClear.project.trustedNetwork.interfaces[0].description, "retain");
  assert.deepEqual(noClear.project.trustedNetwork.interfaces[0].aliases, ["old"]);
  const union = await applyAll(current, difference(row({ aliases: ["new"] })));
  assert.deepEqual(union.project.trustedNetwork.interfaces[0].aliases, ["old", "new"]);
  const ambiguous = await setup(current, difference(row()));
  assert.equal(ambiguous.prepared.preview.canResolve, false);
  await rejected(ambiguous.planner.resolve(ambiguous.prepared.handle, decision(ambiguous.prepared)), "TRUSTED_BLOCKING_ISSUE");
});

test("PLAN-02 warnings require acknowledgement; no-op template removal preserves all", async () => {
  const current = project([row()]);
  const plan = { ...bundle([]), conflicts: [{ code: "TEMPLATE_REMOVED", proposals: [], existingInterfaceIds: ["if-a"], evidenceIds: [evidence.id], protected: false }] };
  const { planner, prepared } = await setup(current, plan);
  await rejected(planner.resolve(prepared.handle, decision(prepared, "exclude", { warningAcknowledged: false })), "TRUSTED_WARNING_ACK_REQUIRED");
  await planner.resolve(prepared.handle, decision(prepared));
  assert.deepEqual((await planner.apply(prepared.handle, { owner, currentProject: current })).project, current);
});

test("PLAN-02 deduped template/existing differences and alternatives cannot double-accept", async () => {
  const current = project([row()]);
  const plan = difference(row({ kind: "logical" }));
  plan.conflicts.push({ ...structuredClone(plan.conflicts[0]), code: "TEMPLATE_CHANGED" });
  const deduped = await setup(current, plan);
  assert.equal(deduped.prepared.preview.proposals.length, 1);
  const alternatives = difference(row({ kind: "logical" }), "SOURCE_DISAGREEMENT");
  alternatives.conflicts[0].proposals.push(candidate(row({ kind: "aggregate" })));
  const { planner, prepared } = await setup(current, alternatives);
  assert.equal(new Set(prepared.preview.proposals.map((p) => p.alternativeGroupId)).size, 1);
  await rejected(planner.resolve(prepared.handle, decision(prepared)), "TRUSTED_ALTERNATIVE_CONFLICT");
  const resolutions = prepared.preview.proposals.map((p, i) => ({ proposalId: p.proposalId, action: i ? "exclude" : "accept-unverified" }));
  await planner.resolve(prepared.handle, decision(prepared, "exclude", { resolutions }));
  validateProjectV2((await planner.apply(prepared.handle, { owner, currentProject: current })).project);
});

test("PLAN-06 parent decisions cannot silently rewrite a child decision", async () => {
  const plan = bundle([row(), row({ id: "if-child", name: "Child", parentInterfaceId: "if-a" })]);
  const { planner, prepared, current } = await setup(project(), plan);
  const resolutions = prepared.preview.proposals.map((p) => ({ proposalId: p.proposalId, action: p.entityId === "if-a" ? "exclude" : "accept-unverified" }));
  await rejected(planner.resolve(prepared.handle, decision(prepared, "exclude", { resolutions })), "TRUSTED_DECISION_DEPENDENCY_CONFLICT");
  await planner.resolve(prepared.handle, decision(prepared, "exclude"));
  assert.deepEqual((await planner.apply(prepared.handle, { owner, currentProject: current })).project, current);
  const success = await applyAll(project(), plan);
  assert.equal(success.project.trustedNetwork.interfaces.length, 2);
});

test("PLAN-06 invalid parent/alias proposals can be explicitly excluded", async () => {
  const current = project([row()]);
  for (const [code, value] of [
    ["PARENT_MISSING", row({ id: "if-child", name: "Child", parentInterfaceId: "absent" })],
    ["ALIAS_COLLISION", row({ id: "if-child", name: "Child", aliases: ["Port A"] })],
  ]) {
    const plan = { ...bundle([]), conflicts: [{ code, proposals: [candidate(value)], existingInterfaceIds: [], evidenceIds: [evidence.id], protected: false }] };
    const { planner, prepared } = await setup(current, plan);
    assert.equal(prepared.preview.canResolve, true);
    await rejected(planner.resolve(prepared.handle, decision(prepared)), "TRUSTED_BLOCKING_ISSUE");
    await planner.resolve(prepared.handle, decision(prepared, "exclude"));
    assert.deepEqual((await planner.apply(prepared.handle, { owner, currentProject: current })).project, current);
  }
});

test("PLAN-04 legacy rename requires visible coupled alias; links untouched", async () => {
  const current = project([row()]);
  current.links = [{ id: "l-a", from: "d-a", to: "d-b", kind: "wired", fromInterfaceId: "if-a", fromPort: "Port A" }];
  const { planner, prepared } = await setup(current, difference(row({ name: "New A" })));
  assert.deepEqual(new Set(prepared.preview.proposals.map((p) => p.fieldPath)), new Set(["name", "aliases"]));
  const resolutions = prepared.preview.proposals.map((p) => ({ proposalId: p.proposalId, action: p.fieldPath === "name" ? "accept-unverified" : "exclude" }));
  await rejected(planner.resolve(prepared.handle, decision(prepared, "exclude", { resolutions })), "TRUSTED_DECISION_DEPENDENCY_CONFLICT");
  await planner.resolve(prepared.handle, decision(prepared));
  const result = await planner.apply(prepared.handle, { owner, currentProject: current });
  assert.deepEqual(result.project.links, current.links);
  assert.deepEqual(result.project.trustedNetwork.interfaces[0].aliases, ["Port A"]);
});

test("PLAN-07 changed unverified trust is replaced, retained fields untouched", async () => {
  const current = trust(project([row()]), "name", "a".repeat(64), "unverified");
  const result = await applyAll(current, difference(row({ name: "New A" })));
  assert.equal(result.project.trustedNetwork.fieldTrust.length, 1);
  assert.equal(result.project.trustedNetwork.fieldTrust[0].valueFingerprint, hashValue("New A"));
  assert.equal(result.project.trustedNetwork.fieldTrust[0].verification, "unverified");
  assert.deepEqual(result.receipt.trustInvalidated, [{ entityType: "interface", entityId: "if-a", fieldPath: "name" }]);
});

test("PLAN-08 unsafe raw input/accessors/unknown operations fail safely without evaluation", async () => {
  for (const mutate of [
    (p) => { p.evidence[0].safeSummary = "password=SENTINEL"; },
    (p) => { p.candidates[0].interface.rawConfig = "SENTINEL"; },
    (p) => { p.operation = "remove"; },
    (p) => { p.candidates[0].verification = "verified"; },
    (p) => { p.candidates[0].interface.deviceId = "d-b"; },
  ]) {
    const plan = structuredClone(bundle()); mutate(plan);
    await rejected(createTrustedChangePlanner().prepare({ owner, currentProject: project(), candidatePlan: plan }), "TRUSTED_CANDIDATE_PLAN_INVALID");
  }
  let reads = 0;
  const plan = bundle();
  Object.defineProperty(plan, "candidates", { enumerable: true, get() { reads++; throw new Error("SENTINEL"); } });
  await rejected(createTrustedChangePlanner().prepare({ owner, currentProject: project(), candidatePlan: plan }), "TRUSTED_CANDIDATE_PLAN_INVALID");
  assert.equal(reads, 0);
});

test("PLAN-01 set-like evidence IDs canonicalize, raw values and alternative groups stay lossless", async () => {
  const plan = bundle();
  const secondEvidence = { ...evidence, id: "ev-second" };
  plan.evidence.push(secondEvidence);
  plan.candidates[0].evidenceIds = ["ev-second", evidence.id, evidence.id];
  const first = await setup(project(), plan);
  plan.candidates[0].evidenceIds = [evidence.id, "ev-second"];
  const second = await setup(project(), plan);
  assert.deepEqual(first.prepared.preview, second.prepared.preview);
  const variants = difference(row({ description: "Cafe\u0301" }), "SOURCE_DISAGREEMENT");
  variants.conflicts[0].proposals.push(candidate(row({ description: "Caf\u00e9" })));
  const one = await setup(project([row()]), variants);
  variants.conflicts[0].proposals.reverse();
  const two = await setup(project([row()]), variants);
  assert.deepEqual(new Set(one.prepared.preview.proposals.map((p) => p.alternativeGroupId)),
    new Set(two.prepared.preview.proposals.map((p) => p.alternativeGroupId)));
  assert.equal(new Set(one.prepared.preview.proposals.map((p) => p.proposedFingerprint)).size, 2);
  assert.deepEqual(new Set(one.prepared.preview.proposals.map((p) => p.proposedValue)), new Set(["Cafe\u0301", "Caf\u00e9"]));
});

test("PLAN-03 prepare owns its source/evidence immediately, not after an async digest", async () => {
  const planner = createTrustedChangePlanner();
  const current = project();
  const plan = structuredClone(bundle());
  const pending = planner.prepare({ owner, currentProject: current, candidatePlan: plan });
  plan.evidence[0].displayName = "changed external source";
  plan.candidates[0].interface.name = "changed external candidate";
  const prepared = await pending;
  await planner.resolve(prepared.handle, decision(prepared));
  const result = await planner.apply(prepared.handle, { owner, currentProject: current });
  assert.equal(result.project.trustedNetwork.evidence[0].displayName, evidence.displayName);
  assert.equal(result.project.trustedNetwork.interfaces[0].name, "Port A");
});

test("PLAN-06 only accepted evidence is merged and conflicting evidence hard-blocks", async () => {
  const current = project();
  const plan = bundle([row(), row({ id: "if-b", name: "Port B" })]);
  plan.evidence.push({ ...evidence, id: "ev-discard" });
  plan.candidates[1].evidenceIds = ["ev-discard"];
  const { planner, prepared } = await setup(current, plan);
  const resolutions = prepared.preview.proposals.map((p) => ({ proposalId: p.proposalId, action: p.entityId === "if-a" ? "accept-unverified" : "exclude" }));
  await planner.resolve(prepared.handle, decision(prepared, "exclude", { resolutions }));
  const result = await planner.apply(prepared.handle, { owner, currentProject: current });
  assert.deepEqual(result.project.trustedNetwork.evidence, [evidence]);
  assert.ok(result.project.trustedNetwork.fieldTrust.every((t) => !t.evidenceIds.includes("ev-discard")));
  const conflicting = bundle();
  conflicting.evidence.push({ ...evidence, displayName: "Different content" });
  const blocked = await setup(current, conflicting);
  assert.equal(blocked.prepared.preview.canResolve, false);
  await rejected(blocked.planner.resolve(blocked.prepared.handle, decision(blocked.prepared, "exclude")), "TRUSTED_BLOCKING_ISSUE");
  const missing = bundle(); missing.evidence = [];
  await rejected(createTrustedChangePlanner().prepare({ owner, currentProject: current, candidatePlan: missing }), "TRUSTED_CANDIDATE_PLAN_INVALID");
});

test("PLAN-02 GEN severity table is explicit, with unknown codes failing closed", async () => {
  for (const code of ["TEMPLATE_AMBIGUOUS", "FUTURE_CONFLICT"]) {
    const plan = { ...bundle([]), conflicts: [{ code, proposals: [], existingInterfaceIds: [], evidenceIds: [], protected: false }] };
    const { planner, prepared } = await setup(project(), plan);
    assert.equal(prepared.preview.canResolve, false);
    await rejected(planner.resolve(prepared.handle, decision(prepared)), "TRUSTED_BLOCKING_ISSUE");
  }
  for (const code of ["NO_SOURCE", "TEMPLATE_NOT_FOUND", "TEMPLATE_IDENTITY_MISSING"]) {
    const plan = { ...bundle([]), evidence: [], missingInfo: [{ code }] };
    const { planner, prepared, current } = await setup(project(), plan);
    assert.equal(prepared.preview.summary.warnings, 1);
    await rejected(planner.resolve(prepared.handle, decision(prepared, "exclude", { warningAcknowledged: false })), "TRUSTED_WARNING_ACK_REQUIRED");
    await planner.resolve(prepared.handle, decision(prepared));
    assert.deepEqual((await planner.apply(prepared.handle, { owner, currentProject: current })).project, current);
  }
  const unknown = await setup(project(), { ...bundle([]), evidence: [], missingInfo: [{ code: "FUTURE_MISSING" }] });
  assert.equal(unknown.prepared.preview.canResolve, false);
});

test("PLAN-06 resolved issue graph clears only after explicit safe decisions", async () => {
  const plan = difference(row({ kind: "aggregate" }), "SOURCE_DISAGREEMENT");
  plan.conflicts[0].proposals.push(candidate(row({ kind: "logical" })));
  const { planner, prepared, current } = await setup(project([row()]), plan);
  const choices = prepared.preview.proposals.map((p, i) => ({ proposalId: p.proposalId, action: i ? "keep-current" : "accept-unverified" }));
  await rejected(planner.resolve(prepared.handle, decision(prepared, "exclude", { resolutions: choices })), "TRUSTED_ALTERNATIVE_CONFLICT");
  const excluded = await planner.resolve(prepared.handle, decision(prepared, "exclude"));
  assert.equal(excluded.preview.summary.blocking, 0);
  assert.equal(excluded.preview.issues.length, 0);
  assert.equal(prepared.preview.summary.blocking, 1);
  assert.deepEqual((await planner.apply(prepared.handle, { owner, currentProject: current })).project, current);
});

test("PLAN-02 keep cannot fabricate an absent optional current value", async () => {
  const { planner, prepared } = await setup(project([row()]), difference(row({ description: "New description" })));
  await rejected(planner.resolve(prepared.handle, decision(prepared, "keep-current")), "TRUSTED_DECISION_INVALID_FOR_OPERATION");
  await planner.resolve(prepared.handle, decision(prepared, "exclude"));
});

test("PLAN-04 mixed protected/unverified differences keep their separate warning requirement", async () => {
  const current = trust(project([row()]), "name", hashValue("Port A"));
  const { planner, prepared } = await setup(current, difference(row({ name: "New A", kind: "logical" })));
  const resolutions = prepared.preview.proposals.map((p) => ({ proposalId: p.proposalId, action: p.protected ? "keep-current" : "accept-unverified" }));
  await rejected(planner.resolve(prepared.handle, decision(prepared, "exclude", { resolutions, warningAcknowledged: false })), "TRUSTED_WARNING_ACK_REQUIRED");
  await planner.resolve(prepared.handle, decision(prepared, "exclude", { resolutions }));
  const result = await planner.apply(prepared.handle, { owner, currentProject: current });
  assert.equal(result.project.trustedNetwork.interfaces[0].name, "Port A");
  assert.equal(result.project.trustedNetwork.interfaces[0].kind, "logical");
  assert.deepEqual(result.project.trustedNetwork.fieldTrust.find((t) => t.fieldPath === "name"), current.trustedNetwork.fieldTrust[0]);
});

test("PLAN-06 genuine GEN parent/alias conflicts cannot be repaired implicitly", async () => {
  const current = project();
  for (const rows of [
    [{ name: "Child", kind: "logical", parentName: "Absent" }],
    [{ name: "A", kind: "logical", parentName: "B" }, { name: "B", kind: "logical", parentName: "A" }],
    [{ name: "A", kind: "physical", aliases: ["collision"] }, { name: "B", kind: "physical", aliases: ["collision"] }],
  ]) {
    const generated = await generateInterfaceCandidates(current, { deviceId: "d-a", explicit: [{ evidence, interfaces: rows }] });
    const { planner, prepared } = await setup(current, generated);
    assert.ok(prepared.preview.proposals.every((p) => p.applicability === "exclude-only"));
    await rejected(planner.resolve(prepared.handle, decision(prepared)), "TRUSTED_BLOCKING_ISSUE");
    await planner.resolve(prepared.handle, decision(prepared, "exclude"));
    assert.deepEqual((await planner.apply(prepared.handle, { owner, currentProject: current })).project, current);
  }
});

test("PLAN-07 result validation fails atomically and consumes handle without weakening CORE", async () => {
  const current = frozen(project([row()]));
  const plan = difference(row({ name: "New A", aliases: ["New A"] }));
  const { planner, prepared } = await setup(current, plan);
  const before = JSON.stringify(current);
  await planner.resolve(prepared.handle, decision(prepared));
  await rejected(planner.apply(prepared.handle, { owner, currentProject: current }), "TRUSTED_RESULT_INVALID");
  assert.equal(JSON.stringify(current), before);
  await rejected(planner.apply(prepared.handle, { owner, currentProject: current }), "TRUSTED_PLAN_HANDLE_INVALID");
});

test("PLAN-08 receipt never contains changed values, raw evidence, actor or Project", async () => {
  const plan = bundle([row({ description: "DESCRIPTION_SENTINEL", mac: "aa:bb:cc:dd:ee:ff" })]);
  plan.evidence = [{ ...evidence, safeSummary: "EVIDENCE_SENTINEL", locator: { file: "SOURCE_SENTINEL", line: 4 } }];
  const result = await applyAll(project(), plan);
  const receipt = JSON.stringify(result.receipt);
  assert.doesNotMatch(receipt, /SENTINEL|aa:bb:cc|sourceKind|description.*DESCRIPTION|actor|role|session|Project|stack/);
  assert.equal(result.project.trustedNetwork.interfaces[0].description, "DESCRIPTION_SENTINEL");
});

test("PLAN-07 cancellation after resolve, failed prepare and duplicate apply are bounded", async () => {
  const { planner, prepared, current } = await setup();
  await planner.resolve(prepared.handle, decision(prepared));
  await planner.resolve(prepared.handle, { kind: "cancel" });
  await rejected(planner.apply(prepared.handle, { owner, currentProject: current }), "TRUSTED_PLAN_HANDLE_INVALID");
  const bad = { owner, currentProject: current, candidatePlan: { ...bundle(), arbitrary: "rejected" } };
  for (let i = 0; i < 33; i++) await rejected(planner.prepare(bad), "TRUSTED_CANDIDATE_PLAN_INVALID");
  const good = await planner.prepare({ owner, currentProject: current, candidatePlan: bundle() });
  await planner.resolve(good.handle, decision(good));
  const results = await Promise.allSettled([
    planner.apply(good.handle, { owner, currentProject: current }),
    planner.apply(good.handle, { owner, currentProject: current }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.find((r) => r.status === "rejected").reason.code, "TRUSTED_PLAN_HANDLE_INVALID");
});

test("PLAN-04 legacy coupled alias supports one selected rename alternative, not both", async () => {
  const current = project([row()]);
  current.links = [{ id: "l-a", from: "d-a", to: "d-b", kind: "wired", fromInterfaceId: "if-a", fromPort: "Port A" }];
  const plan = difference(row({ name: "New A" }), "SOURCE_DISAGREEMENT");
  plan.conflicts[0].proposals.push(candidate(row({ name: "New B" })));
  const { planner, prepared } = await setup(current, plan);
  assert.equal(prepared.preview.proposals.length, 3);
  const resolutions = prepared.preview.proposals.map((p) => ({ proposalId: p.proposalId,
    action: p.proposedValue === "New B" ? "exclude" : "accept-unverified" }));
  await planner.resolve(prepared.handle, decision(prepared, "exclude", { resolutions }));
  const result = await planner.apply(prepared.handle, { owner, currentProject: current });
  assert.equal(result.project.trustedNetwork.interfaces[0].name, "New A");
  assert.deepEqual(result.project.trustedNetwork.interfaces[0].aliases, ["Port A"]);
  assert.deepEqual(result.project.links, current.links);
});

test("PLAN-06 existing parent edit cycles are blocked in preview, not persisted", async () => {
  const current = project([row(), row({ id: "if-b", name: "B" })]);
  const plan = difference(row({ parentInterfaceId: "if-b" }));
  plan.conflicts.push(difference(row({ id: "if-b", name: "B", parentInterfaceId: "if-a" })).conflicts[0]);
  const { planner, prepared } = await setup(current, plan);
  assert.ok(prepared.preview.issues.some((i) => i.code === "PARENT_CYCLE"));
  await rejected(planner.resolve(prepared.handle, decision(prepared)), "TRUSTED_BLOCKING_ISSUE");
  await planner.resolve(prepared.handle, decision(prepared, "exclude"));
  assert.deepEqual((await planner.apply(prepared.handle, { owner, currentProject: current })).project, current);
});

test("PLAN-04 a protected coupled alias cannot be bypassed through a rename", async () => {
  const current = trust(project([row()]), "aliases", hashValue([]));
  current.links = [{ id: "l-a", from: "d-a", to: "d-b", kind: "wired", fromInterfaceId: "if-a", fromPort: "Port A" }];
  const { planner, prepared } = await setup(current, difference(row({ name: "New A" })));
  assert.equal(prepared.preview.proposals.find((p) => p.fieldPath === "aliases").protected, true);
  prepared.preview.proposals.forEach((p) => { p.protected = false; });
  await rejected(planner.resolve(prepared.handle, decision(prepared)), "TRUSTED_ACTOR_REQUIRED");
  await planner.resolve(prepared.handle, decision(prepared, "exclude"));
  assert.deepEqual((await planner.apply(prepared.handle, { owner, currentProject: current })).project, current);
});
