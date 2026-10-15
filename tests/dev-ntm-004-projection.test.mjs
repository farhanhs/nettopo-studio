import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { upcastProject } from "../app/lib/trusted-network-model.ts";
import { fingerprintTrustedValue } from "../app/lib/trusted-network-digest.ts";
import { projectTrustedNetworkView } from "../app/lib/trusted-network-projection.ts";

const legacy = () => ({ devices: [{ id: "a", name: "A", type: "switch", x: 0, y: 0 }, { id: "b", name: "B", type: "server", x: 300, y: 200 }], links: [{ id: "l", from: "a", to: "b", kind: "wired", fromPort: "P1", vlan: "10" }], groups: [] });
const run = async (p, overrides = {}) => {
  const outcome = await projectTrustedNetworkView({ authorizedProject: p, view: "physical", mode: "all", ...overrides });
  assert.equal(outcome.ok, true, JSON.stringify(outcome));
  return outcome.result;
};
async function fixture() {
  const p = upcastProject({ ...legacy(), links: [] });
  const m = p.trustedNetwork;
  m.areas = [{ id: "region", kind: "region", name: "Region" }, { id: "site", kind: "site", name: "Site", parentAreaId: "region" }];
  p.devices[0].networkAreaId = "site";
  m.interfaces = [{ id: "ia", deviceId: "a", name: "P1", kind: "physical", aliases: [] }, { id: "ib", deviceId: "b", name: "P2", kind: "physical", aliases: [] }];
  m.vlans = [{ id: "v", vlanNumber: 10, areaId: "site" }];
  m.subnets = [{ id: "s", cidr: "10.0.0.0/24", vlanId: "v" }];
  m.interfaceVlans = [{ id: "iv", interfaceId: "ia", vlanId: "v", mode: "access" }];
  m.interfaceSubnets = [{ id: "is", interfaceId: "ia", subnetId: "s", role: "member" }];
  p.links = [{ id: "l1", from: "a", to: "b", kind: "wired", fromInterfaceId: "ia", toInterfaceId: "ib" }, { id: "l2", from: "a", to: "b", kind: "wireless", fromInterfaceId: "ia", toInterfaceId: "ib" }];
  m.resiliencyRelations = [{ id: "res", kind: "primary-backup", memberLinkIds: ["l1", "l2"], primaryLinkId: "l1" }];
  m.evidence = [{ id: "ev", method: "human", sourceKind: "manual", displayName: "Synthetic review" }];
  for (const [type, rows] of [["device", p.devices], ["link", p.links], ["area", m.areas], ["interface", m.interfaces], ["vlan", m.vlans], ["subnet", m.subnets], ["interface-vlan", m.interfaceVlans], ["interface-subnet", m.interfaceSubnets], ["resiliency", m.resiliencyRelations]]) {
    for (const row of rows) m.fieldTrust.push({ id: `t-${row.id}`, entityType: type, entityId: row.id, fieldPath: "$record", valueFingerprint: await fingerprintTrustedValue(row), verification: "verified", verifiedAt: "2026-10-14T00:00:00Z", verifiedByUserId: "PRIVATE-ACTOR", evidenceIds: ["ev"] });
  }
  return p;
}
test("PROJ01/02 legacy physical and logical inventory, blank endpoints never invented", async () => {
  const p = upcastProject(legacy()); const before = JSON.stringify(p);
  const physical = await run(p);
  assert.equal(physical.relations[0].from.type, "interface"); assert.equal(physical.relations[0].to.type, "device");
  assert.equal(physical.issues.find((i) => i.code === "LEGACY_INTERFACE_UNKNOWN").count, 1);
  const logical = await run(p, { view: "logical" });
  assert.equal(logical.items.length, 3); assert.equal(logical.relations.length, 0);
  assert.ok(logical.issues.some((i) => i.code === "LEGACY_LOGICAL_RELATION_UNSTRUCTURED"));
  const verified = await run(p, { mode: "verified-only" });
  assert.equal(verified.items.length, 0); assert.equal(verified.hidden.unverifiedRelations, 1);
  assert.equal(JSON.stringify(p), before);
});
test("PROJ01 permutations, NFC collisions and code-point order are deterministic", async () => {
  const p = await fixture();
  p.devices.push({ id: "e\u0301", name: "same", type: "client", x: 0, y: 0 }, { id: "é", name: "same", type: "client", x: 0, y: 0 });
  const first = await run(p, { view: "logical", selection: { type: "physical-link", id: "l2" } });
  const reversed = structuredClone(p);
  for (const array of [reversed.devices, reversed.links, ...Object.values(reversed.trustedNetwork).filter(Array.isArray)]) array.reverse();
  assert.deepEqual(await run(reversed, { view: "logical", selection: { type: "physical-link", id: "l2" } }), first);
  assert.deepEqual(first.items.filter((i) => i.label === "same").map((i) => i.ref.id), ["e\u0301", "é"]);
});
test("PROJ03 complete reference closure, stale fields and no dangling relation", async () => {
  const p = await fixture();
  assert.equal((await run(p, { mode: "verified-only" })).relations.length, 2);
  assert.equal((await run(p, { view: "logical", mode: "verified-only" })).summaries.length, 1);
  p.trustedNetwork.interfaces[0].description = "Changed";
  const physical = await run(p, { mode: "verified-only" });
  assert.equal(physical.relations.length, 0);
  const logical = await run(p, { view: "logical", mode: "verified-only" });
  assert.equal(logical.relations.length, 0); assert.equal(logical.summaries.length, 0);
  assert.ok(logical.items.some((i) => i.ref.id === "v"));
  assert.ok(logical.issues.some((i) => i.code === "STALE_TRUST_RECORD_IGNORED"));
  assert.doesNotMatch(JSON.stringify(logical), /PRIVATE-ACTOR|Changed|valueFingerprint/);
});
test("PROJ03 every closure dependency fails closed, while inventory remains independent", async () => {
  for (const id of ["region", "site", "a", "ia", "v", "s", "iv", "is", "l1", "res"]) {
    const p = await fixture(); p.trustedNetwork.fieldTrust.find((t) => t.entityId === id).valueFingerprint = "0".repeat(64);
    for (const view of ["physical", "logical"]) {
      const result = await run(p, { view, mode: "verified-only" });
      const itemIds = new Set(result.items.map((i) => `${i.ref.type}:${i.ref.id}`));
      for (const r of result.relations) { assert.ok(itemIds.has(`${r.from.type}:${r.from.id}`)); assert.ok(itemIds.has(`${r.to.type}:${r.to.id}`)); }
      assert.equal([...result.items, ...result.relations, ...result.summaries].some((i) => i.ref.id === id), false);
    }
  }
});
test("PROJ04 selection restore, typed fallback, breadcrumbs, collapse zero mutation", async () => {
  const p = await fixture(); const before = JSON.stringify(p);
  const selection = { type: "interface", id: "ia" };
  const collapsed = await run(p, { selection, collapsedAreaIds: ["region", "NOT-AUTHORIZED"] });
  assert.deepEqual(collapsed.breadcrumb.map((i) => i.ref.id), ["region", "site", "a", "ia"]);
  assert.ok(collapsed.items.find((i) => i.ref.id === "region").hiddenChildCounts.interface > 0);
  assert.equal(JSON.stringify(p), before);
  p.trustedNetwork.fieldTrust.find((t) => t.entityId === "ia").valueFingerprint = "0".repeat(64);
  const filtered = await run(p, { selection, mode: "verified-only" });
  assert.deepEqual(filtered.requestedSelection, selection); assert.equal(filtered.effectiveSelection.id, "a");
  assert.deepEqual((await run(p, { selection })).effectiveSelection, selection);
});
test("PROJ05 unknown selectors and invalid data never echo caller IDs or raw errors", async () => {
  const p = await fixture();
  const r = await run(p, { selection: { type: "device", id: "SECRET-SENTINEL" }, focusAreaId: "SECRET-SENTINEL", collapsedAreaIds: ["SECRET-SENTINEL"] });
  assert.doesNotMatch(JSON.stringify(r), /SECRET-SENTINEL|PRIVATE-ACTOR/);
  const bad = structuredClone(p); bad.devices[0].password = "SECRET-SENTINEL";
  assert.deepEqual(await projectTrustedNetworkView({ authorizedProject: bad, view: "physical", mode: "all" }), { ok: false, error: { code: "INVALID_PROJECT", safeMessage: "Unable to display this topology projection.", issueCount: 1 } });
  p.devices.push({ ...p.devices[0] });
  assert.equal((await projectTrustedNetworkView({ authorizedProject: p, view: "physical", mode: "all" })).error.code, "DUPLICATE_ENTITY_ID");
});
test("PROJ07 measured synthetic projection (observation, not a new SLA)", async (t) => {
  const p = upcastProject({ devices: Array.from({ length: 60 }, (_, i) => ({ id: `d-${i}`, name: `Device ${i}`, type: "switch", x: i * 100, y: 0 })), links: [], groups: [] });
  const start = performance.now(); const r = await run(p);
  assert.equal(r.items.length, 60);
  t.diagnostic(`60 devices / 0 relations / ${process.platform} / ${process.version}: ${(performance.now() - start).toFixed(2)} ms`);
});

test("PROJ05 safe evidence omits full paths and stale leaf trust never echoes field values", async () => {
  const p = await fixture();
  p.trustedNetwork.evidence[0].displayName = "C:/Users/private/review.txt";
  p.trustedNetwork.evidence[0].safeSummary = "Review from /home/private/document.txt";
  p.trustedNetwork.fieldTrust.push({ ...p.trustedNetwork.fieldTrust[0], id: "leaf", fieldPath: "name", valueFingerprint: "0".repeat(64) });
  const result = await run(p);
  assert.ok(result.issues.some((i) => i.code === "STALE_TRUST_RECORD_IGNORED"));
  assert.doesNotMatch(JSON.stringify(result), /C:\/Users|\/home\/private|PRIVATE-ACTOR/);
});
test("PROJ01 async boundary snapshots caller selection and options", async () => {
  const p = await fixture();
  const request = { authorizedProject: p, view: "physical", mode: "all", selection: { type: "interface", id: "ia" }, collapsedAreaIds: [] };
  const pending = projectTrustedNetworkView(request);
  request.selection.id = "SECRET-SENTINEL"; request.mode = "verified-only";
  const outcome = await pending;
  assert.equal(outcome.ok, true); assert.equal(outcome.result.mode, "all");
  assert.equal(outcome.result.requestedSelection.id, "ia");
});
