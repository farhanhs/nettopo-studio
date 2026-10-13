import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const prepOnly = process.env.QA_NTM_PREP_ONLY === "1";
const fixtureRoot = new URL("./fixtures/qa-ntm-001/", import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, fixtureRoot), "utf8"));
const deepCopy = (value) => structuredClone(value);

async function api(requiredNames) {
  const coreApi = await import("../app/lib/trusted-network-model.ts");
  for (const name of requiredNames) {
    assert.equal(typeof coreApi[name], "function", `CORE-R1 public seam must export ${name}()`);
  }
  return coreApi;
}

function mutation(project, edit) {
  const value = deepCopy(project);
  edit(value);
  return value;
}

async function assertTypedReject(operation, code, sentinels = []) {
  let caught;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `expected typed rejection ${code}`);
  const serialized = JSON.stringify({ name: caught.name, message: caught.message, issues: caught.issues });
  assert.match(serialized, new RegExp(code));
  for (const sentinel of sentinels) assert.equal(serialized.includes(sentinel), false, `safe error leaked ${sentinel}`);
  return caught;
}

test("QA_NTM_001 preparation fixtures are synthetic, deterministic, and secret-free", async () => {
  const legacy = await readJson("legacy-project.json");
  const v2 = await readJson("valid-project-v2.json");
  assert.deepEqual(Object.keys(legacy).sort(), ["devices", "groups", "links"]);
  assert.equal(v2.projectSchemaVersion, 2);
  assert.equal(v2.trustedNetwork.modelVersion, 1);
  assert.doesNotMatch(JSON.stringify({ legacy, v2 }), /password|secret|token|cookie|ciphertext|nonce|postgres(?:ql)?:\/\//i);
});

test("NTM-C01 legacy upcast is deterministic, lossless, and never fabricates or verifies ports", { skip: prepOnly }, async () => {
  const { upcastProject } = await api(["upcastProject"]);
  const legacy = await readJson("legacy-project.json");
  const original = deepCopy(legacy);
  const first = upcastProject(legacy);
  const second = upcastProject(deepCopy(legacy));
  assert.deepEqual(first, second);
  assert.deepEqual(legacy, original, "upcast must not mutate legacy input");
  assert.equal(first.projectSchemaVersion, 2);
  assert.deepEqual(first.devices.map(({ id, quantity, x, y, groupId }) => ({ id, quantity, x, y, groupId })), legacy.devices.map(({ id, quantity, x, y, groupId }) => ({ id, quantity, x, y, groupId })));
  for (const legacyLink of legacy.links) {
    const upcastLink = first.links.find((link) => link.id === legacyLink.id);
    for (const [key, value] of Object.entries(legacyLink)) assert.deepEqual(upcastLink[key], value, `legacy link field changed: ${legacyLink.id}.${key}`);
  }
  assert.deepEqual(first.groups, legacy.groups);
  const labelled = first.links.find((link) => link.id === "link-labelled");
  const missing = first.links.find((link) => link.id === "link-missing-port");
  assert.match(labelled.fromInterfaceId, /^if-/);
  assert.match(labelled.toInterfaceId, /^if-/);
  assert.equal(missing.fromInterfaceId, undefined);
  assert.equal(missing.toInterfaceId, undefined);
  assert.equal(first.trustedNetwork.interfaces.length, 2);
  assert.equal(first.trustedNetwork.evidence.every((item) => item.method === "legacy-upcast"), true);
  assert.equal(first.trustedNetwork.fieldTrust.every((item) => item.verification === "unverified"), true);
});

test("NTM-C02 strict V2 parse rejects versions, IDs, references, owners, aliases, and cycles", { skip: prepOnly }, async () => {
  const { validateProjectV2 } = await api(["validateProjectV2"]);
  const valid = await readJson("valid-project-v2.json");
  assert.deepEqual(validateProjectV2(valid), valid);
  const cases = [
    [/VERSION/i, (p) => { p.projectSchemaVersion = 3; }],
    [/DUPLICATE|ID_COLLISION/i, (p) => { p.trustedNetwork.interfaces[1].id = p.trustedNetwork.interfaces[0].id; }],
    [/MISSING_REFERENCE|INTERFACE_OWNER_MISSING/i, (p) => { p.trustedNetwork.interfaces[0].deviceId = "missing"; }],
    [/INVALID_REFERENCE_OWNER|LINK_INTERFACE_OWNER_MISMATCH/i, (p) => { p.links[0].fromInterfaceId = "if-switch-24"; }],
    [/ALIAS_COLLISION|INTERFACE_NAME_COLLISION/i, (p) => { p.trustedNetwork.interfaces[1].aliases = [" gi0/1 "]; }],
    [/RELATION_CYCLE|INTERFACE_PARENT_INVALID/i, (p) => { p.trustedNetwork.interfaces[4].parentInterfaceId = "if-switch-vlan10"; }],
    [/RELATION_CYCLE|AREA_CYCLE/i, (p) => { p.trustedNetwork.areas[0].parentAreaId = "area-site"; }],
    [/INVALID_PROJECT_SCHEMA|UNKNOWN|UNRECOGNIZED|STRICT/i, (p) => { p.trustedNetwork.unapproved = true; }],
  ];
  for (const [code, edit] of cases) await assertTypedReject(() => validateProjectV2(mutation(valid, edit)), code);
});

test("NTM-C03 validates VLAN/CIDR/logical/resiliency/trust invariants", { skip: prepOnly }, async () => {
  const { validateProjectV2 } = await api(["validateProjectV2"]);
  const valid = await readJson("valid-project-v2.json");
  const upper = mutation(valid, (p) => { p.trustedNetwork.vlans[0].vlanNumber = 4094; });
  assert.equal(validateProjectV2(upper).trustedNetwork.vlans[0].vlanNumber, 4094);
  const cases = [
    [/VLAN/i, (p) => { p.trustedNetwork.vlans[0].vlanNumber = 0; }],
    [/VLAN/i, (p) => { p.trustedNetwork.vlans[0].vlanNumber = 4095; }],
    [/CIDR/i, (p) => { p.trustedNetwork.subnets[0].cidr = "10.10.0.999/99"; }],
    [/MISSING_REFERENCE|VLAN_REFERENCE_MISSING/i, (p) => { p.trustedNetwork.interfaceVlans[0].vlanId = "missing"; }],
    [/MISSING_REFERENCE|SUBNET_REFERENCE_MISSING/i, (p) => { p.trustedNetwork.interfaceSubnets[0].subnetId = "missing"; }],
    [/RESILIENCY/i, (p) => { p.trustedNetwork.resiliencyRelations[0].primaryLinkId = "missing"; }],
    [/INVALID_TRUST_RECORD|MISSING_REFERENCE|TRUST_EVIDENCE_MISSING/i, (p) => { p.trustedNetwork.fieldTrust[0].evidenceIds = ["missing"]; }],
    [/TRUST/i, (p) => { p.trustedNetwork.fieldTrust[0].entityId = "missing"; }],
  ];
  for (const [code, edit] of cases) await assertTypedReject(() => validateProjectV2(mutation(valid, edit)), code);
});

test("NTM-C04 clone and canonicalization are pure, deep, deterministic, and do not verify", { skip: prepOnly }, async () => {
  const { canonicalProjectV2, cloneProjectV2 } = await api(["canonicalProjectV2", "cloneProjectV2"]);
  const valid = await readJson("valid-project-v2.json");
  const original = deepCopy(valid);
  const clone = cloneProjectV2(valid);
  clone.trustedNetwork.interfaces[0].aliases.push("MUTATED");
  clone.trustedNetwork.evidence[0].safeSummary = "changed";
  assert.deepEqual(valid, original);
  assert.equal(valid.trustedNetwork.interfaces[0].aliases.includes("MUTATED"), false);
  assert.deepEqual(canonicalProjectV2(valid), canonicalProjectV2(deepCopy(valid)));
  assert.equal(canonicalProjectV2(valid).trustedNetwork.fieldTrust[0].verification, "unverified");
});

test("NTM-C05 downcast succeeds only when lossless and never mutates V2", { skip: prepOnly }, async () => {
  const { downcastProjectV2, upcastProject } = await api(["downcastProjectV2", "upcastProject"]);
  const legacy = await readJson("legacy-project.json");
  const upcast = upcastProject(legacy);
  assert.deepEqual(downcastProjectV2(upcast), legacy);
  const enhanced = await readJson("valid-project-v2.json");
  const original = deepCopy(enhanced);
  await assertTypedReject(() => downcastProjectV2(enhanced), "DOWNCAST_WOULD_LOSE_DATA");
  assert.deepEqual(enhanced, original);
});

test("NTM-C06 rejects secret/raw/unknown input with safe typed errors and exposes no verify operation", { skip: prepOnly }, async () => {
  const coreApi = await api(["validateProjectV2"]);
  const valid = await readJson("valid-project-v2.json");
  const sentinels = ["qa-password-sentinel", "qa-token-sentinel", "postgres://qa-secret-dsn"];
  const malicious = mutation(valid, (p) => {
    p.trustedNetwork.evidence[0].rawConfig = sentinels.join("|");
  });
  await assertTypedReject(() => coreApi.validateProjectV2(malicious), /INVALID_PROJECT_SCHEMA|UNKNOWN|UNRECOGNIZED|STRICT/i, sentinels);
  assert.equal(Object.keys(coreApi).some((name) => /^(verify|applyTrusted|acceptAndVerify)/i.test(name)), false);
});

test("NTM-C07 core source has no product integration imports or persistence side effects", { skip: prepOnly }, async () => {
  const source = await readFile(new URL("../app/lib/trusted-network-model.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /(?:from|import\s*\()\s*["'][^"']*(?:topology-store|topology-transfer|postgres|app\/api|components\/)|\b(?:Dexie|indexedDB|localStorage|sessionStorage)\b|\bfetch\s*\(/i);
  assert.doesNotMatch(source, /export\s+(?:async\s+)?(?:function|const)\s+(?:prepareTrustedTopologyChange|applyTrustedTopologyChange|verify)/i);
  assert.match(source, /upcastProject/);
  assert.match(source, /DOWNCAST_WOULD_LOSE_DATA/);
});
