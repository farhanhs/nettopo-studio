import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { canonicalTrustedValue, fingerprintTrustedValue } from "../app/lib/trusted-network-digest.ts";
import { upcastProject } from "../app/lib/trusted-network-model.ts";
import { createTrustedChangePlanner } from "../app/lib/trusted-network-change-plan.ts";
const { planOracle: oracle } = JSON.parse(readFileSync(new URL("./fixtures/dev-ntm-004/projection-vectors.json", import.meta.url)));

test("NTM004 digest preserves committed PLAN canonical bytes and SHA-256", async () => {
  const value = { z: undefined, a: " Raw ", nested: { z: 3, a: "e\u0301" }, aliases: ["z", "a"], blank: null };
  const expected = '{"a":" Raw ","aliases":["z","a"],"blank":null,"nested":{"a":"e\u0301","z":3}}';
  assert.equal(canonicalTrustedValue(value), expected);
  assert.equal(await fingerprintTrustedValue(value), createHash("sha256").update(expected).digest("hex"));
  assert.notEqual(await fingerprintTrustedValue(["a", "z"]), await fingerprintTrustedValue(["z", "a"]));
});
test("NTM004 PLAN public ID/revision/proposals/field fingerprints match frozen 5903393 oracle", async () => {
  const { owner, project: currentProject, candidatePlan } = structuredClone(oracle);
  const planner = createTrustedChangePlanner();
  const prepared = await planner.prepare({ owner, currentProject, candidatePlan });
  assert.deepEqual(prepared.preview, oracle.preview);
  await planner.resolve(prepared.handle, { kind: "resolve", warningAcknowledged: true, resolutions: prepared.preview.proposals.map((p) => ({ proposalId: p.proposalId, action: "accept-unverified" })) });
  assert.deepEqual(await planner.apply(prepared.handle, { owner, currentProject }), oracle.result);
});
test("NTM004 CORE legacy unverified IDs and fingerprints remain byte-identical", () => {
  const { devices, links, groups } = oracle.project;
  const legacy = { devices, links: links.map((link) => { const l = { ...link }; delete l.fromInterfaceId; delete l.toInterfaceId; return l; }), groups };
  assert.deepEqual(upcastProject(legacy), oracle.project);
});
