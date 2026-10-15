import assert from "node:assert/strict";
import test from "node:test";
import { upcastProject, inspectTrustedField } from "../app/lib/trusted-network-model.ts";
import { fingerprintTrustedValue } from "../app/lib/trusted-network-digest.ts";
const key = { entityType: "device", entityId: "a", fieldPath: "$record" };
async function fixture() {
  const p = upcastProject({ devices: [{ id: "a", type: "switch", name: "A", x: 0, y: 0 }], links: [], groups: [] });
  p.trustedNetwork.evidence.push({ id: "ev", method: "human", sourceKind: "manual", displayName: "Synthetic review" });
  p.trustedNetwork.fieldTrust.push({ id: "t", ...key, valueFingerprint: await fingerprintTrustedValue(p.devices[0]), verification: "verified", evidenceIds: ["ev"], verifiedByUserId: "PRIVATE-ACTOR", verifiedAt: "2026-10-14T00:00:00Z" });
  return p;
}
test("NTM004 current complete record verified; optional field changes become stale", async () => {
  const p = await fixture();
  assert.equal((await inspectTrustedField(p, key)).state, "verified");
  p.devices[0].location = "test floor";
  const stale = await inspectTrustedField(p, key);
  assert.equal(stale.state, "stale");
  assert.doesNotMatch(JSON.stringify(stale), /PRIVATE-ACTOR|test floor|valueFingerprint/);
  delete p.devices[0].location;
  assert.equal((await inspectTrustedField(p, key)).state, "verified");
});
test("NTM004 no leaf aggregation, ambiguous trust winner or unknown digest acceptance", async () => {
  const p = await fixture();
  const t = p.trustedNetwork.fieldTrust[0];
  t.fieldPath = "name"; t.valueFingerprint = await fingerprintTrustedValue("A");
  assert.equal((await inspectTrustedField(p, key)).state, "unverified");
  t.fieldPath = "$record"; t.valueFingerprint = "0".repeat(64);
  assert.equal((await inspectTrustedField(p, key)).state, "stale");
  p.trustedNetwork.fieldTrust.push({ ...t, id: "second" });
  assert.equal((await inspectTrustedField(p, key)).state, "unverified");
});
test("NTM004 legacy/PLAN unverified short circuit retains fingerprint; missing evidence cannot verify", async () => {
  const p = await fixture();
  const t = p.trustedNetwork.fieldTrust[0];
  t.verification = "unverified"; delete t.verifiedByUserId; delete t.verifiedAt; t.valueFingerprint = "1".repeat(64);
  const before = JSON.stringify(p);
  assert.equal((await inspectTrustedField(p, key)).state, "unverified");
  assert.equal(JSON.stringify(p), before);
  t.verification = "verified"; t.verifiedByUserId = "reviewer"; t.verifiedAt = "2026-10-14T00:00:00Z";
  p.trustedNetwork.evidence = [];
  assert.equal((await inspectTrustedField(p, key)).state, "unverified");
});
