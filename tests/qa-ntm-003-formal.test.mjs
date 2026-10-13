import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { createTrustedChangePlanner, TrustedChangePlanError } from "../app/lib/trusted-network-change-plan.ts";
import { upcastProject, validateProjectV2 } from "../app/lib/trusted-network-model.ts";

const owner = { projectScopeId: "qa-ntm-003-scope", deviceId: "qa-device-a" };
const evidence = {
  id: "qa-ntm-003-evidence",
  method: "parsed",
  sourceKind: "json",
  displayName: "QA synthetic interface evidence",
};

const interfaceRow = (extra = {}) => ({
  id: "qa-interface-a",
  deviceId: owner.deviceId,
  name: "Ethernet A",
  kind: "physical",
  aliases: [],
  ...extra,
});

const candidate = (row) => ({
  interface: row,
  source: "explicit",
  evidenceIds: [evidence.id],
  verification: "unverified",
});

const candidatePlan = (rows = [interfaceRow()]) => ({
  deviceId: owner.deviceId,
  candidates: rows.map(candidate),
  conflicts: [],
  evidence: [evidence],
  missingInfo: [],
});

function project(interfaces = []) {
  const value = upcastProject({
    devices: [
      { id: owner.deviceId, name: "QA device A", type: "switch", x: 0, y: 0 },
      { id: "qa-device-b", name: "QA device B", type: "switch", x: 400, y: 0 },
    ],
    links: [],
    groups: [],
  });
  value.trustedNetwork.interfaces = structuredClone(interfaces);
  return value;
}

function difference(row, code = "EXISTING_DIFFERENCE") {
  return {
    ...candidatePlan([]),
    conflicts: [{
      code,
      proposals: [candidate(row)],
      existingInterfaceIds: [row.id],
      evidenceIds: [evidence.id],
      protected: false,
    }],
  };
}

function resolution(prepared, action = "accept-unverified", extra = {}) {
  return {
    kind: "resolve",
    resolutions: prepared.preview.proposals.map(({ proposalId }) => ({ proposalId, action })),
    warningAcknowledged: true,
    ...extra,
  };
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof TrustedChangePlanError);
    assert.equal(error.code, code);
    assert.deepEqual(JSON.parse(JSON.stringify(error)), { code });
    assert.doesNotMatch(JSON.stringify(error), /QA_NTM_003_SECRET|password|cookie|token|postgres(?:ql)?:|verifiedByUserId|stack/i);
    return true;
  });
}

const rawFingerprint = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("PLAN-01 deterministic preview, immutable inputs, private evidence, cancel and capacity", async () => {
  const current = project();
  const plan = candidatePlan();
  const before = structuredClone({ current, plan });
  const planner = createTrustedChangePlanner();
  const first = await planner.prepare({ owner, currentProject: current, candidatePlan: plan });
  const second = await planner.prepare({ owner, currentProject: current, candidatePlan: plan });
  assert.deepEqual(first.preview, second.preview);
  assert.notEqual(first.handle, second.handle);
  assert.equal("evidence" in first.preview, false);
  assert.deepEqual({ current, plan }, before);
  assert.deepEqual(await planner.resolve(first.handle, { kind: "cancel" }), { status: "cancelled" });
  await expectCode(planner.apply(first.handle, { owner, currentProject: current }), "TRUSTED_PLAN_HANDLE_INVALID");

  const bounded = createTrustedChangePlanner();
  await Promise.all(Array.from({ length: 32 }, () => bounded.prepare({ owner, currentProject: current, candidatePlan: plan })));
  await expectCode(bounded.prepare({ owner, currentProject: current, candidatePlan: plan }), "TRUSTED_PLAN_CAPACITY_EXCEEDED");
});

test("PLAN-02 malformed, unknown, duplicate, incomplete and warning decisions fail without result", async () => {
  const current = project();
  for (const [makeDecision, code] of [
    [(prepared) => ({ ...resolution(prepared), resolutions: [] }), "TRUSTED_DECISION_INCOMPLETE"],
    [(prepared) => ({ ...resolution(prepared), resolutions: [{ proposalId: "unknown", action: "exclude" }] }), "TRUSTED_DECISION_UNKNOWN"],
    [(prepared) => ({ ...resolution(prepared), resolutions: [
      { proposalId: prepared.preview.proposals[0].proposalId, action: "exclude" },
      { proposalId: prepared.preview.proposals[0].proposalId, action: "exclude" },
    ] }), "TRUSTED_DECISION_DUPLICATE"],
    [(prepared) => ({ ...resolution(prepared), resolutions: [{ proposalId: prepared.preview.proposals[0].proposalId, action: "add-alias" }] }), "TRUSTED_OPERATION_UNSUPPORTED"],
  ]) {
    const planner = createTrustedChangePlanner();
    const prepared = await planner.prepare({ owner, currentProject: current, candidatePlan: candidatePlan() });
    await expectCode(planner.resolve(prepared.handle, makeDecision(prepared)), code);
    assert.deepEqual(current, project());
  }

  const warningPlan = difference(interfaceRow({ kind: "logical" }));
  const warningPlanner = createTrustedChangePlanner();
  const warningPrepared = await warningPlanner.prepare({ owner, currentProject: project([interfaceRow()]), candidatePlan: warningPlan });
  await expectCode(
    warningPlanner.resolve(warningPrepared.handle, resolution(warningPrepared, "accept-unverified", { warningAcknowledged: false })),
    "TRUSTED_WARNING_ACK_REQUIRED",
  );
});

test("PLAN-03 only same-instance handle executes; public DTO, clones, cross-instance, scope and stale fail closed", async () => {
  const current = project();
  const planner = createTrustedChangePlanner();
  const prepared = await planner.prepare({ owner, currentProject: current, candidatePlan: candidatePlan() });
  for (const fake of [prepared.preview, {}, { ...prepared.handle }, structuredClone(prepared.handle), JSON.parse(JSON.stringify(prepared.handle))]) {
    await expectCode(planner.resolve(fake, resolution(prepared)), "TRUSTED_PLAN_HANDLE_INVALID");
  }
  await expectCode(createTrustedChangePlanner().resolve(prepared.handle, resolution(prepared)), "TRUSTED_PLAN_HANDLE_INVALID");
  prepared.preview.canResolve = true;
  prepared.preview.proposals[0].proposedValue.name = "tampered-display-only";
  await planner.resolve(prepared.handle, resolution(prepared));
  const wrongScope = { ...owner, projectScopeId: "other-scope" };
  await expectCode(planner.apply(prepared.handle, { owner: wrongScope, currentProject: current }), "TRUSTED_PLAN_SCOPE_MISMATCH");
  await expectCode(planner.apply(prepared.handle, { owner, currentProject: current }), "TRUSTED_PLAN_HANDLE_INVALID");

  const unicodeCurrent = project();
  unicodeCurrent.devices[0].name = "Cafe\u0301";
  const unicodePlanner = createTrustedChangePlanner();
  const unicodePrepared = await unicodePlanner.prepare({ owner, currentProject: unicodeCurrent, candidatePlan: candidatePlan() });
  await unicodePlanner.resolve(unicodePrepared.handle, resolution(unicodePrepared));
  const changed = structuredClone(unicodeCurrent);
  changed.devices[0].name = "Caf\u00e9";
  await expectCode(unicodePlanner.apply(unicodePrepared.handle, { owner, currentProject: changed }), "TRUSTED_PLAN_STALE");
  assert.equal(unicodeCurrent.devices[0].name, "Cafe\u0301");
});

test("PLAN-04 verified changes and stale trust remain protected; keep preserves exact trust", async () => {
  const current = project([interfaceRow()]);
  current.trustedNetwork.evidence = [structuredClone(evidence)];
  current.trustedNetwork.fieldTrust = [{
    id: "qa-trust-name",
    entityType: "interface",
    entityId: "qa-interface-a",
    fieldPath: "name",
    valueFingerprint: rawFingerprint("Ethernet A"),
    evidenceIds: [evidence.id],
    verification: "verified",
    verifiedByUserId: "qa-fixture-reviewer",
    verifiedAt: "2026-10-10T00:00:00Z",
  }];
  const planner = createTrustedChangePlanner();
  const prepared = await planner.prepare({ owner, currentProject: current, candidatePlan: difference(interfaceRow({ name: "Ethernet New" })) });
  assert.equal(prepared.preview.proposals.find(({ fieldPath }) => fieldPath === "name").protected, true);
  await expectCode(planner.resolve(prepared.handle, resolution(prepared)), "TRUSTED_ACTOR_REQUIRED");
  await planner.resolve(prepared.handle, resolution(prepared, "keep-current"));
  const kept = await planner.apply(prepared.handle, { owner, currentProject: current });
  assert.deepEqual(kept.project, current);

  const stale = structuredClone(current);
  stale.trustedNetwork.fieldTrust[0].valueFingerprint = "0".repeat(64);
  const stalePlanner = createTrustedChangePlanner();
  const stalePrepared = await stalePlanner.prepare({ owner, currentProject: stale, candidatePlan: difference(interfaceRow({ name: "Ethernet New" })) });
  assert.equal(stalePrepared.preview.canResolve, false);
  await expectCode(stalePlanner.resolve(stalePrepared.handle, resolution(stalePrepared, "exclude")), "TRUSTED_TRUST_FINGERPRINT_STALE");
});

test("PLAN-04 legacy port rename requires coupled alias and never edits the link", async () => {
  const current = project([interfaceRow()]);
  current.links = [{
    id: "qa-link",
    from: owner.deviceId,
    to: "qa-device-b",
    kind: "wired",
    fromInterfaceId: "qa-interface-a",
    fromPort: "Ethernet A",
  }];
  const planner = createTrustedChangePlanner();
  const prepared = await planner.prepare({ owner, currentProject: current, candidatePlan: difference(interfaceRow({ name: "Uplink" })) });
  assert.deepEqual(new Set(prepared.preview.proposals.map(({ fieldPath }) => fieldPath)), new Set(["name", "aliases"]));
  const conflicting = prepared.preview.proposals.map(({ proposalId, fieldPath }) => ({
    proposalId,
    action: fieldPath === "name" ? "accept-unverified" : "exclude",
  }));
  await expectCode(
    planner.resolve(prepared.handle, { kind: "resolve", resolutions: conflicting, warningAcknowledged: true }),
    "TRUSTED_DECISION_DEPENDENCY_CONFLICT",
  );
  await planner.resolve(prepared.handle, resolution(prepared));
  const result = await planner.apply(prepared.handle, { owner, currentProject: current });
  assert.deepEqual(result.project.links, current.links);
  assert.deepEqual(result.project.trustedNetwork.interfaces[0].aliases, ["Ethernet A"]);
});

test("PLAN-05 actor-like body data and accept-and-verify cannot create verified trust", async () => {
  const current = project();
  const planner = createTrustedChangePlanner();
  const prepared = await planner.prepare({ owner, currentProject: current, candidatePlan: candidatePlan() });
  await expectCode(planner.resolve(prepared.handle, resolution(prepared, "accept-and-verify")), "TRUSTED_ACTOR_REQUIRED");
  await expectCode(
    planner.resolve(prepared.handle, { ...resolution(prepared), actor: { role: "boss", userId: "fake" } }),
    "TRUSTED_CANDIDATE_PLAN_INVALID",
  );
  await planner.resolve(prepared.handle, resolution(prepared));
  await expectCode(
    planner.apply(prepared.handle, { owner, currentProject: current, actor: { role: "boss" } }),
    "TRUSTED_CANDIDATE_PLAN_INVALID",
  );
});

test("PLAN-06 absent optional fields and aliases default preserve current values", async () => {
  const current = project([interfaceRow({ aliases: ["existing"], description: "keep-description", mac: "aa:bb:cc:dd:ee:ff" })]);
  const planner = createTrustedChangePlanner();
  const prepared = await planner.prepare({
    owner,
    currentProject: current,
    candidatePlan: difference(interfaceRow({ kind: "logical" })),
  });
  await planner.resolve(prepared.handle, resolution(prepared));
  const result = await planner.apply(prepared.handle, { owner, currentProject: current });
  const changed = result.project.trustedNetwork.interfaces[0];
  assert.equal(changed.kind, "logical");
  assert.deepEqual(changed.aliases, ["existing"]);
  assert.equal(changed.description, "keep-description");
  assert.equal(changed.mac, "aa:bb:cc:dd:ee:ff");
});

test("PLAN-06 parent exclusion plus child acceptance rejects, explicit closure succeeds with no evidence residue", async () => {
  const parent = interfaceRow();
  const child = interfaceRow({ id: "qa-interface-child", name: "Child", parentInterfaceId: parent.id });
  const current = project();
  const planner = createTrustedChangePlanner();
  const prepared = await planner.prepare({ owner, currentProject: current, candidatePlan: candidatePlan([parent, child]) });
  const contradictory = prepared.preview.proposals.map(({ proposalId, entityId }) => ({
    proposalId,
    action: entityId === parent.id ? "exclude" : "accept-unverified",
  }));
  await expectCode(
    planner.resolve(prepared.handle, { kind: "resolve", resolutions: contradictory, warningAcknowledged: true }),
    "TRUSTED_DECISION_DEPENDENCY_CONFLICT",
  );
  await planner.resolve(prepared.handle, resolution(prepared, "exclude"));
  const result = await planner.apply(prepared.handle, { owner, currentProject: current });
  assert.deepEqual(result.project, current);
  assert.deepEqual(result.project.trustedNetwork.evidence, []);
});

test("PLAN-07 successful apply returns one valid detached snapshot and safe non-persistence receipt", async () => {
  const current = project();
  const before = structuredClone(current);
  const planner = createTrustedChangePlanner();
  const prepared = await planner.prepare({ owner, currentProject: current, candidatePlan: candidatePlan() });
  await planner.resolve(prepared.handle, resolution(prepared));
  const result = await planner.apply(prepared.handle, { owner, currentProject: current });
  validateProjectV2(result.project);
  assert.notEqual(result.project, current);
  assert.deepEqual(current, before);
  assert.equal(result.receipt.persistence, "not-performed");
  assert.deepEqual(result.receipt.verified, []);
  assert.deepEqual(Object.keys(result.receipt).sort(), [
    "acceptedProposalIds",
    "afterRevision",
    "beforeRevision",
    "excludedProposalIds",
    "persistence",
    "planId",
    "trustInvalidated",
    "verified",
  ]);
});

test("PLAN-08 prohibited raw/secret fields and accessors reject safely without evaluation or echo", async () => {
  for (const mutate of [
    (plan) => { plan.evidence[0].safeSummary = "QA_NTM_003_SECRET password"; },
    (plan) => { plan.candidates[0].interface.rawConfig = "QA_NTM_003_SECRET"; },
    (plan) => { plan.candidates[0].verification = "verified"; },
    (plan) => { plan.operation = "remove"; },
  ]) {
    const plan = structuredClone(candidatePlan());
    mutate(plan);
    await expectCode(
      createTrustedChangePlanner().prepare({ owner, currentProject: project(), candidatePlan: plan }),
      "TRUSTED_CANDIDATE_PLAN_INVALID",
    );
  }

  let reads = 0;
  const accessorPlan = candidatePlan();
  Object.defineProperty(accessorPlan, "candidates", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("QA_NTM_003_SECRET");
    },
  });
  await expectCode(
    createTrustedChangePlanner().prepare({ owner, currentProject: project(), candidatePlan: accessorPlan }),
    "TRUSTED_CANDIDATE_PLAN_INVALID",
  );
  assert.equal(reads, 0);
});
