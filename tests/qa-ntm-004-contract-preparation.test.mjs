import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureRoot = new URL("./fixtures/qa-ntm-004/", import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, fixtureRoot), "utf8"));

test("QA_NTM_004 runner preparation is aligned to fixed SECTION5-R1.1", async () => {
  const fixture = await readJson("section5-r1-1-contract-vectors.json");
  assert.deepEqual(fixture.contract, {
    revision: "SECTION5-R1.1",
    sha256: "d87640d787533de697b405f433843c132da38294bcea69d656778c0fc4b6bb34",
    status: "FIXED_FOR_RUNNER_PREPARATION",
  });
  assert.equal(fixture.formalProductResult, "NOT_RUN");
});

test("QA_NTM_004 digest oracle fixes exact canonical bytes and SHA-256 outputs", async () => {
  const fixture = await readJson("section5-r1-1-contract-vectors.json");
  for (const vector of fixture.digestVectors) {
    const bytes = Buffer.from(vector.canonicalUtf8Hex, "hex");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), vector.sha256, vector.id);
  }
  const present = fixture.digestVectors.find(({ id }) => id === "interface-record-optional-present");
  const removed = fixture.digestVectors.find(({ id }) => id === "interface-record-optional-removed");
  assert.notEqual(present.canonicalUtf8Hex, removed.canonicalUtf8Hex);
  assert.notEqual(present.sha256, removed.sha256);
});

test("QA_NTM_004 fixed oracle preserves legacy fingerprints and forbids dual digest guessing", async () => {
  const { fixedTruths } = await readJson("section5-r1-1-contract-vectors.json");
  assert.equal(fixedTruths.sharedPlanDigest.dualAlgorithmAcceptance, false);
  assert.equal(fixedTruths.legacy.rewriteExistingFingerprint, false);
  assert.equal(fixedTruths.legacy.unverifiedShortCircuitsDigest, true);
  assert.equal(fixedTruths.legacy.blankPortInventsInterface, false);
  assert.equal(fixedTruths.legacy.linkVlanCreatesLogicalEntity, false);
});

test("QA_NTM_004 record oracle requires complete records and no field-record trust promotion", async () => {
  const { fixedTruths } = await readJson("section5-r1-1-contract-vectors.json");
  assert.equal(fixedTruths.recordTrust.key, "$record");
  assert.equal(fixedTruths.recordTrust.aggregateLeafFields, false);
  assert.equal(fixedTruths.recordTrust.optionalAddedRemovedOrChangedIsStale, true);
  assert.equal(fixedTruths.recordTrust.fieldVerificationUpgradesRecord, false);
  assert.equal(fixedTruths.recordTrust.recordVerificationUpgradesFields, false);
});

test("QA_NTM_004 selection oracle never copies or echoes an unknown requested ID", async () => {
  const { fixedTruths } = await readJson("section5-r1-1-contract-vectors.json");
  assert.equal(fixedTruths.selection.unknownRequestedRefCopied, false);
  assert.equal(fixedTruths.selection.unknownRequestedIdEchoed, false);
  assert.equal(fixedTruths.selection.unknownIssue, "SELECTION_NOT_VISIBLE");
  assert.equal(fixedTruths.selection.fallbackUsesFixedRankAndStableId, true);
});

test("QA_NTM_004 formal runner case list includes the fixed compatibility gates", async () => {
  const fixture = await readJson("section5-r1-1-contract-vectors.json");
  assert.deepEqual(fixture.formalRunnerCases, [
    "shared-digest-byte-equivalence",
    "plan-id-revision-field-fingerprint-unchanged",
    "legacy-unverified-fingerprint-byte-preserved",
    "verified-authoritative-digest-current-versus-stale",
    "record-complete-optional-field-stale",
    "record-and-field-no-automatic-upgrade",
    "blank-port-and-legacy-vlan-mapping",
    "unknown-selection-no-echo",
    "nfc-equivalent-raw-id-tie-break-permutations",
  ]);
});

test("QA_NTM_004 fixed ordering uses raw code-point tie-break after equal NFC keys", async () => {
  const fixture = await readJson("section5-r1-1-contract-vectors.json");
  const vector = fixture.orderingVectors.find(({ id }) => id === "nfc-equivalent-raw-id-tie-break");
  assert.equal(vector.permutations[0][0].normalize("NFC"), vector.permutations[0][1].normalize("NFC"));
  assert.deepEqual(vector.expectedRawCodePointOrder, ["if-cafe\u0301", "if-caf\u00e9"]);
  for (const permutation of vector.permutations) {
    const ordered = [...permutation].sort((left, right) => {
      const normalized = left.normalize("NFC").localeCompare(right.normalize("NFC"), "en-US");
      if (normalized !== 0) return normalized;
      return left < right ? -1 : left > right ? 1 : 0;
    });
    assert.deepEqual(ordered, vector.expectedRawCodePointOrder);
  }
  assert.equal(vector.rewriteEntityIds, false);
});

test("QA_NTM_004 validator correction keeps the V2 writer boundary fail closed", async () => {
  const { validatorCorrection } = await readJson("section5-r1-1-contract-vectors.json");
  assert.equal(validatorCorrection.v1ValidatorRejectsUnknownTopLevelFields, true);
  assert.equal(validatorCorrection.specificTopLevelCleanerMayRebuildOnlyDevicesLinksGroups, true);
  assert.equal(validatorCorrection.relaxesProjectionSafety, false);
  assert.equal(validatorCorrection.v2MayEnterExistingWriter, false);
});

test("QA_NTM_004 Browser preparation blocks automatic dotenv discovery", async () => {
  const browser = await readJson("browser-matrix.json");
  assert.equal(browser.formalResult, "NOT_RUN");
  assert.equal(browser.isolation.dotenvIsolation.legacyWrapperAllowed, false);
  assert.equal(browser.isolation.dotenvIsolation.strategy, "qa-owned-sanitized-project-mirror");
  assert.ok(browser.isolation.dotenvIsolation.exclude.includes(".env.local"));
  assert.ok(browser.isolation.dotenvIsolation.verifyBeforeSpawn.includes("no-env-file-cli-flags"));
  assert.match(browser.isolation.dotenvIsolation.reason, /Vite\/vinext\/Next/);
  assert.ok(browser.isolation.cleanup.includes("sanitized-project-mirror-removed"));
});
