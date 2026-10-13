import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureRoot = new URL("./fixtures/qa-ntm-002/", import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, fixtureRoot), "utf8"));

test("QA_NTM_002 preparation covers GEN-01 through GEN-07 without claiming product execution", async () => {
  const fixture = await readJson("generation-vectors.json");
  const secretFixture = await readJson("secret-rejection.json");
  const covered = new Set([...fixture.vectors.flatMap(({ covers }) => covers), ...secretFixture.covers]);
  assert.deepEqual([...covered].sort(), Array.from({ length: 7 }, (_, index) => `GEN-0${index + 1}`));
  assert.equal(fixture.formalResult, "NOT_RUN");
  assert.deepEqual(fixture.sourcePriority, ["explicit", "trusted-template", "manual"]);
});

test("QA_NTM_002 vectors preserve safe text and separate source from verification", async () => {
  const fixture = await readJson("generation-vectors.json");
  const explicit = fixture.vectors.find(({ id }) => id === "explicit-preserves-safe-text");
  assert.equal(explicit.explicit[0].name, " Gi0/1 ");
  assert.equal(explicit.explicit[0].aliases[0], " UPLINK-A ");
  assert.equal(fixture.vectors.filter(({ expected }) => expected.verification).every(({ expected }) => expected.verification === "unverified"), true);
});

test("QA_NTM_002 template and manual vectors require exact trust and finite non-eval numbering", async () => {
  const fixture = await readJson("generation-vectors.json");
  const template = fixture.vectors.find(({ id }) => id === "trusted-template-exact-match-only");
  const manual = fixture.vectors.find(({ id }) => id === "manual-finite-numbering");
  assert.match(template.templates[0].fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(template.expected.exactMatchRequired, true);
  assert.deepEqual(manual.expected.names, ["Gi0/1", "Gi0/2", "Gi0/3", "Gi0/4"]);
  assert.equal(Object.hasOwn(manual.manual, "regex"), false);
  assert.equal(Object.hasOwn(manual.manual, "expression"), false);
  assert.equal(fixture.invalidClasses.includes("manual-over-resource-limit"), true);
});

test("QA_NTM_002 conflict vectors prohibit overwrite and protect verified records", async () => {
  const fixture = await readJson("generation-vectors.json");
  const collision = fixture.vectors.find(({ id }) => id === "cross-source-collision");
  const verified = fixture.vectors.find(({ id }) => id === "verified-existing-protected");
  assert.deepEqual(collision.expected, { conflict: true, silentOverwrite: false, normalizationForComparisonOnly: true });
  assert.equal(verified.expected.existingUnchanged, true);
  assert.equal(verified.expected.noDowngrade, true);
});

test("QA_NTM_002 secret fixture is synthetic and fixes typed safe zero-side-effect expectations", async () => {
  const fixture = await readJson("secret-rejection.json");
  assert.equal(fixture.classification, "synthetic-qa-only");
  assert.equal(fixture.sentinels.every((value) => /QA_NTM_002|qa_ntm_002/i.test(value)), true);
  assert.deepEqual(fixture.expected, { typedReject: true, errorEcho: false, inputMutation: false, sideEffects: false });
});
