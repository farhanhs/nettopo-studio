import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureRoot = new URL("./fixtures/qa-ntm-003/", import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, fixtureRoot), "utf8"));

test("QA_NTM_003 preparation covers PLAN-01 through PLAN-08 without product PASS", async () => {
  const plan = await readJson("plan-vectors.json");
  const boundary = await readJson("secret-and-actor-boundary.json");
  const covered = new Set([...plan.vectors.flatMap(({ covers }) => covers), ...boundary.covers]);
  assert.deepEqual([...covered].sort(), Array.from({ length: 8 }, (_, index) => `PLAN-0${index + 1}`));
  assert.equal(plan.formalResult, "NOT_RUN");
});

test("QA_NTM_003 cancel keep and exclude vectors preserve zero-effect and dependency integrity truths", async () => {
  const { vectors } = await readJson("plan-vectors.json");
  const cancel = vectors.find(({ id }) => id === "prepare-cancel-zero-effect");
  const keep = vectors.find(({ id }) => id === "keep-protected-current");
  const exclude = vectors.find(({ id }) => id === "exclude-dependent-closure");
  assert.deepEqual(cancel.expected, { deterministicPlan: true, inputMutation: false, outputProject: false, writes: 0 });
  assert.equal(keep.expected.verification, "verified");
  assert.equal(keep.expected.fingerprint, keep.current.fingerprint);
  assert.equal(exclude.expected.noOrphans, true);
  assert.equal(exclude.expected.noPartialResult, true);
});

test("QA_NTM_003 protected change and verification vectors never reuse stale trust or client actor metadata", async () => {
  const { vectors } = await readJson("plan-vectors.json");
  const changed = vectors.find(({ id }) => id === "accept-change-invalidates-old-trust");
  const verify = vectors.find(({ id }) => id === "accept-and-verify-needs-trusted-actor");
  assert.equal(changed.expected.oldTrustRetained, false);
  assert.equal(changed.expected.autoVerified, false);
  assert.equal(verify.trustedContext, null);
  assert.equal(verify.expected.clientMetadataIgnoredForAuthorization, true);
  assert.equal(verify.expected.typedReject, true);
});

test("QA_NTM_003 stale tamper scope decisions and blocking gates are all-or-none typed failures", async () => {
  const { vectors } = await readJson("plan-vectors.json");
  const stale = vectors.find(({ id }) => id === "stale-tamper-wrong-scope");
  const gates = vectors.find(({ id }) => id === "warning-and-blocking-gates");
  assert.deepEqual(stale.negativeClasses, ["base-revision-stale", "current-fingerprint-stale", "plan-tampered", "wrong-project-scope", "unknown-decision", "duplicate-decision", "conflicting-decision"]);
  assert.equal(stale.expected.allOrNone, true);
  assert.equal(stale.expected.writes, 0);
  assert.equal(gates.expected.revalidateAfterDecision, true);
  assert.equal(gates.expected.noPartialResult, true);
});

test("QA_NTM_003 secret and actor fixture is synthetic, safe, and makes no storage/auth claim", async () => {
  const fixture = await readJson("secret-and-actor-boundary.json");
  assert.equal(fixture.classification, "synthetic-qa-only");
  assert.equal(fixture.sentinels.every((value) => /QA_NTM_003|qa_ntm_003/i.test(value)), true);
  assert.deepEqual(fixture.actorBoundary, { clientSuppliedActorIsTrusted: false, missingTrustedActorFailsClosed: true, wrongScopeFailsClosed: true, fingerprintIsAuthorization: false });
  assert.deepEqual(fixture.expected, { typedReject: true, errorEcho: false, inputMutation: false, writes: 0 });
});

test("QA_NTM_003 preparation explicitly separates pure snapshot evidence from real transaction evidence", async () => {
  const { vectors } = await readJson("plan-vectors.json");
  const safety = vectors.find(({ id }) => id === "safe-error-and-no-persistence-claim");
  assert.equal(safety.expected.pureSnapshotOnly, true);
  assert.equal(safety.expected.databaseTransactionClaim, false);
});

test("QA_NTM_003 vectors align to the focused addendum public seam and pure-phase actor boundary", async () => {
  const contract = await readJson("contract-alignment.json");
  assert.equal(contract.addendumSha256, "e612bc77309a64b7b12326a5e11e82b2197462dc42fa1cd4403d6dc141ab5255");
  assert.equal(contract.parentSha256, "0bb2145fb2b1844d576449e55c6f3e040ce9ae14175891c21716d963334dbf63");
  assert.equal(contract.factory, "createTrustedChangePlanner");
  assert.deepEqual(contract.publicOperations, ["prepare", "resolve", "apply"]);
  assert.deepEqual(contract.supportedProposal.operations, ["add", "replace"]);
  assert.deepEqual(contract.resolutionActions, ["accept-unverified", "accept-and-verify", "keep-current", "exclude"]);
  assert.equal(contract.phase.persistenceReceipt, "not-performed");
  assert.equal(contract.phase.actorAdapterAvailable, false);
  assert.equal(contract.phase.actorBackedVerification, "NOT_RUN");
  assert.equal(contract.purePhaseActorTruth.acceptAndVerifyError, "TRUSTED_ACTOR_REQUIRED");
  assert.equal(contract.purePhaseActorTruth.protectedChangeError, "TRUSTED_ACTOR_REQUIRED");
  assert.deepEqual(contract.safeErrorFields, ["code", "safePath", "proposalId"]);
});

test("QA_NTM_003 fixes the final R1.1 truths while keeping product acceptance NOT RUN", async () => {
  const contract = await readJson("r1-1-contract-vectors.json");
  assert.equal(contract.addendumSha256, "e612bc77309a64b7b12326a5e11e82b2197462dc42fa1cd4403d6dc141ab5255");
  assert.equal(contract.parentSha256, "0bb2145fb2b1844d576449e55c6f3e040ce9ae14175891c21716d963334dbf63");
  assert.equal(contract.contractStatus, "FIXED_FOR_DEV_IMPLEMENTATION");
  assert.equal(contract.formalResult, "NOT_RUN");
  assert.deepEqual(
    contract.vectors.map(({ id }) => id),
    [
      "same-instance-private-plan-lifecycle",
      "raw-nfc-nfd-change-is-stale",
      "field-presence-never-implies-clear",
      "stale-verified-trust-hard-block",
      "interface-rename-revalidates-legacy-ports",
      "gen-severity-and-parent-child-decision",
      "safe-snapshot-result-boundary",
    ],
  );

  const lifecycle = contract.vectors.find(({ id }) => id === "same-instance-private-plan-lifecycle");
  const unicode = contract.vectors.find(({ id }) => id === "raw-nfc-nfd-change-is-stale");
  const presence = contract.vectors.find(({ id }) => id === "field-presence-never-implies-clear");
  const trust = contract.vectors.find(({ id }) => id === "stale-verified-trust-hard-block");
  const links = contract.vectors.find(({ id }) => id === "interface-rename-revalidates-legacy-ports");
  const decisions = contract.vectors.find(({ id }) => id === "gen-severity-and-parent-child-decision");
  const boundary = contract.vectors.find(({ id }) => id === "safe-snapshot-result-boundary");

  assert.equal(lifecycle.requiredTruth.cloneRejected, "TRUSTED_PLAN_HANDLE_INVALID");
  assert.equal(lifecycle.requiredTruth.jsonRoundTripRejected, "TRUSTED_PLAN_HANDLE_INVALID");
  assert.equal(lifecycle.requiredTruth.crossInstanceRejected, "TRUSTED_PLAN_HANDLE_INVALID");
  assert.equal(lifecycle.requiredTruth.privateEvidenceClosure, true);
  assert.equal(unicode.currentRaw.normalize("NFC"), unicode.changedRaw.normalize("NFC"));
  assert.notEqual(unicode.currentRaw, unicode.changedRaw);
  assert.equal(unicode.requiredTruth.staleError, "TRUSTED_PLAN_STALE");
  assert.equal(unicode.requiredTruth.rewriteRawText, false);
  assert.equal(presence.requiredTruth.aliasesDefaultEmptyPreservesCurrent, true);
  assert.equal(presence.requiredTruth.absentOptionalPreservesCurrent, true);
  assert.equal(trust.requiredTruth.downgradeToUnprotected, false);
  assert.equal(links.requiredTruth.silentLinkMutation, false);
  assert.equal(links.requiredTruth.incompatibleError, "TRUSTED_LEGACY_PORT_INCOMPATIBLE");
  assert.equal(decisions.requiredTruth.parentExcludedChildAcceptedError, "TRUSTED_DECISION_DEPENDENCY_CONFLICT");
  assert.equal(decisions.requiredTruth.silentDecisionOverride, false);
  assert.equal(boundary.requiredTruth.receiptPersistence, "not-performed");
  assert.equal(boundary.requiredTruth.actorBackedVerification, "NOT_RUN");
});
