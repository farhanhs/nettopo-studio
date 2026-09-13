import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildLayoutDraft, captureLayoutSnapshot, projectWithLayoutPositions, resolveLayoutPlan } from "../app/lib/topology-layout-core.ts";
import { immutable } from "../app/lib/topology-layout-contract.ts";
import { orderLayersByConnectivity } from "../app/lib/topology-layout.ts";

const device = (id, type = "switch", name = id) => ({ id, type, name, x: 15.12345, y: 20.6789 });
const link = (id, from, to, kind = "wired") => ({ id, from, to, kind });
const fixture = () => ({
  devices: [device("wan", "modem"), device("edge", "firewall"), device("core"), device("host", "server")],
  links: [link("a", "wan", "edge"), link("b", "edge", "core"), link("c", "core", "host")], groups: [],
});
const capture = (p) => captureLayoutSnapshot(p, { topologyId: "t", capturedAt: "2026-09-13T00:00:00.000Z" });
const request = (s, mode = "auto-detect", patch = {}) => ({
  requestId: "r", topologyId: s.topologyId, track: "quick", requestedMode: mode,
  objective: "balanced", baseRevision: s.baseRevision, graphHash: s.graphHash,
  geometryVersion: s.geometryVersion, pinnedDeviceIds: [], ...patch,
});
const permutation = (p) => ({ devices: [...p.devices].reverse(), links: [...p.links].reverse(), groups: [...p.groups].reverse() });

test("legacy modes create immutable complete unscored drafts with no Project mutation", async () => {
  for (const mode of ["auto-detect", "three-tier", "spine-leaf", "layered"]) {
    const p = immutable(fixture());
    const before = structuredClone(p), s = await capture(p);
    const draft = await buildLayoutDraft(s, request(s, mode));
    assert.equal(draft.status, "unscored");
    assert.ok(Object.isFrozen(draft.positions[0]));
    assert.deepEqual(draft.positions.map((pos) => pos.deviceId), ["core", "edge", "host", "wan"]);
    const positioned = projectWithLayoutPositions(p, draft.positions);
    const withoutXY = (v) => v.devices.map((d) => Object.fromEntries(Object.entries(d).filter(([key]) => !["x", "y"].includes(key))));
    assert.deepEqual(withoutXY(positioned), withoutXY(p));
    assert.deepEqual(positioned.links, p.links);
    assert.deepEqual(positioned.groups, p.groups);
    assert.deepEqual(p, before);
    assert.equal("safeReasons" in draft, false);
  }
});

test("three-tier/spine-leaf base spacing preserves expected existing grid positions", async () => {
  const s = await capture(fixture());
  const three = await buildLayoutDraft(s, request(s, "three-tier"));
  const byId = new Map(three.positions.map((p) => [p.deviceId, p]));
  for (const [i, id] of ["wan", "edge", "core", "host"].entries()) assert.deepEqual(byId.get(id), { deviceId: id, x: 80 + i * 260, y: 310 });
  const spine = await buildLayoutDraft(s, request(s, "spine-leaf"));
  assert.equal(new Map(spine.positions.map((p) => [p.deviceId, p])).get("core").y, 260);
});

test("pins retain exact original precision; groups, quantity and metadata stay identical", async () => {
  const p = fixture();
  p.groups = [{ id: "g", name: "Group", kind: "vlan", color: "#ABCDEF", collapsed: true }];
  Object.assign(p.devices[0], { name: " raw label ", groupId: "g", quantity: 3, ip: "sentinel", model: " custom " });
  const s = await capture(p);
  const draft = await buildLayoutDraft(s, request(s, "three-tier", { pinnedDeviceIds: ["wan"] }));
  assert.deepEqual(draft.positions.find((v) => v.deviceId === "wan"), { deviceId: "wan", x: p.devices[0].x, y: p.devices[0].y });
  const result = projectWithLayoutPositions(p, draft.positions, ["wan"]);
  assert.deepEqual(result.devices[0], p.devices[0]);
  assert.deepEqual(result.groups, p.groups);
  assert.notEqual(result.groups, p.groups);
});

test("same-name disconnected graphs and reversed device/link inputs produce identical positions", async () => {
  const p = fixture(); p.devices.forEach((d) => { d.name = "same"; });
  p.devices.push(device("unconnected", "switch", "same"));
  const a = await capture(p), b = await capture(permutation(p));
  for (const mode of ["auto-detect", "three-tier", "spine-leaf", "layered"]) {
    assert.deepEqual((await buildLayoutDraft(a, request(a, mode))).positions, (await buildLayoutDraft(b, request(b, mode))).positions);
  }
  const layer = [device("b", "switch", "same"), device("a", "switch", "same")];
  const empty = { devices: layer, links: [], groups: [] };
  assert.deepEqual(orderLayersByConnectivity([layer], empty)[0].map((d) => d.id), ["a", "b"]);
  assert.deepEqual(orderLayersByConnectivity([[...layer].reverse()], empty)[0].map((d) => d.id), ["a", "b"]);
});

test("empty/single/cyclic/mixed wireless graphs produce full finite positions", async () => {
  const graphs = [
    { devices: [], links: [], groups: [] }, { devices: [device("a")], links: [], groups: [] },
    { devices: [device("a"), device("b"), device("c")], links: [link("ab", "a", "b"), link("bc", "b", "c", "wireless"), link("ca", "c", "a")], groups: [] },
  ];
  for (const p of graphs) for (const mode of ["auto-detect", "three-tier", "spine-leaf", "layered"]) {
    const s = await capture(p), draft = await buildLayoutDraft(s, request(s, mode));
    assert.equal(draft.positions.length, p.devices.length);
    assert.ok(draft.positions.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  }
});

test("existing dual-spine fixture remains auto-detected and deterministic", async () => {
  const source = JSON.parse(await readFile(new URL("../examples/sean-sie-spine-leaf-demo.json", import.meta.url), "utf8"));
  const s = await capture(source.project);
  const a = await buildLayoutDraft(s, request(s));
  const b = await buildLayoutDraft(s, request(s, "spine-leaf"));
  assert.equal(a.resolvedMode, "spine-leaf");
  assert.deepEqual(a.positions, b.positions);
});

test("tampered snapshots, wrong revision/topology/cache hash, invalid pins never reach engine", async () => {
  const s = await capture(fixture()); let calls = 0;
  const engine = async () => { calls++; throw new Error("should not execute"); };
  for (const patch of [{ topologyId: "other" }, { baseRevision: "0".repeat(64) }, { graphHash: "0".repeat(64) }, { pinnedDeviceIds: ["missing"] }, { pinnedDeviceIds: ["wan", "wan"] }]) {
    await assert.rejects(buildLayoutDraft(s, request(s, "layered", patch), undefined, engine));
  }
  const tampered = structuredClone(s); tampered.project.devices[0].x++;
  await assert.rejects(buildLayoutDraft(tampered, request(s), undefined, engine), (e) => e.code === "STALE_LAYOUT");
  assert.equal(calls, 0);
});

test("engine errors and missing/duplicate/nonfinite/out-of-range positions fail closed", async () => {
  const s = await capture(fixture());
  const options = request(s, "layered");
  const children = s.project.devices.map((d, i) => ({ id: d.id, x: i * 300, y: 0 }));
  for (const invalid of [
    undefined, { children: [] }, { children: children.slice(1) },
    { children: [...children, children[0]] },
    { children: children.map((n, i) => i === 0 ? { ...n, id: "unknown" } : n) },
    ...[undefined, Infinity, NaN, 1_000_000].map((x) => ({ children: children.map((n, i) => i === 0 ? { ...n, x } : n) })),
  ]) await assert.rejects(buildLayoutDraft(s, options, undefined, async () => invalid));
  await assert.rejects(buildLayoutDraft(s, options, undefined, async () => { throw new Error("private engine detail"); }), (e) => e.message === "NO_SAFE_LAYOUT");
  assert.deepEqual(s.project, fixture());
});

test("request inputs are copied before awaits and engine receives only geometry/refs", async () => {
  const s = await capture(fixture());
  const r = request(s, "layered");
  const promise = buildLayoutDraft(s, r, undefined, async (g) => {
    assert.deepEqual(Object.keys(g.children[0]).sort(), ["height", "id", "width"]);
    assert.ok(!JSON.stringify(g).includes("model"));
    return { id: "root", children: g.children.map((n, i) => ({ ...n, x: i * 300, y: 0 })) };
  });
  r.pinnedDeviceIds.push("missing"); r.topologyId = "changed";
  assert.equal((await promise).topologyId, "t");
});

test("smart fixed intent uses complete validated refs, deterministically lays out nodes, cannot move pins", async () => {
  const p = fixture(); const s = await capture(p), reversed = await capture(permutation(p));
  const map = { graphRef: "opaque", nodeByRef: { n001: "core", n002: "edge", n003: "host", n004: "wan" },
    linkByRef: { l001: "a", l002: "b", l003: "c" }, groupByRef: {} };
  const intent = { strategy: "layered", direction: "top-to-bottom", warnings: [],
    layers: [{ nodeRefs: ["n004", "n002"] }, { nodeRefs: ["n001", "n003"] }] };
  const options = request(s, "layered", { track: "smart", pinnedDeviceIds: ["wan"] });
  const a = await buildLayoutDraft(s, options, { intent, refMap: map });
  const permuted = { ...intent, layers: intent.layers.map((l) => ({ nodeRefs: [...l.nodeRefs].reverse() })) };
  const b = await buildLayoutDraft(reversed, options, { intent: permuted, refMap: map });
  assert.deepEqual(a.positions, b.positions);
  assert.equal(a.positions.find((p) => p.deviceId === "wan").x, p.devices[0].x);
  await assert.rejects(buildLayoutDraft(s, options), (e) => e.code === "INVALID_LAYOUT_PROPOSAL");
  await assert.rejects(buildLayoutDraft(s, request(s), { intent, refMap: map }), (e) => e.code === "INVALID_LAYOUT_PROPOSAL");
});

test("group order, direction, compact spacing and emphasis have deterministic local semantics", async () => {
  const p = fixture();
  p.groups = [{ id: "g1", name: "one", kind: "site", color: "#abcdef" }, { id: "g2", name: "two", kind: "vlan", color: "#abcdef" }];
  p.devices.forEach((d, i) => { d.groupId = i % 2 ? "g1" : "g2"; });
  const s = await capture(p);
  const map = { graphRef: "opaque", nodeByRef: { n001: "core", n002: "edge", n003: "host", n004: "wan" },
    linkByRef: { l001: "a", l002: "b", l003: "c" }, groupByRef: { g001: "g1", g002: "g2" } };
  const options = request(s, "layered", { track: "smart" });
  const intent = { strategy: "grouped", direction: "left-to-right", groupOrder: ["g002", "g001"], warnings: [] };
  const a = await buildLayoutDraft(s, options, { intent, refMap: map });
  const byId = new Map(a.positions.map((p) => [p.deviceId, p]));
  assert.ok(byId.get("core").x < byId.get("edge").x);
  const plan = resolveLayoutPlan(s, options, { intent: { strategy: "layered", layers: [{ nodeRefs: ["n001", "n002", "n003", "n004"] }], emphasisRefs: ["n001"], warnings: [] }, refMap: map });
  assert.equal(plan.layers[0].indexOf("core"), 2);
  const normal = await buildLayoutDraft(s, request(s, "three-tier"));
  const compact = await buildLayoutDraft(s, request(s, "three-tier", { objective: "compact" }));
  assert.ok(Math.max(...compact.positions.map((p) => p.x)) < Math.max(...normal.positions.map((p) => p.x)));
});

test("quick supports > smart limit without imposing a new graph cap", async () => {
  const p = { devices: Array.from({ length: 81 }, (_, i) => device(`d${i}`, "server")), links: [], groups: [] };
  const s = await capture(p);
  const quick = await buildLayoutDraft(s, request(s, "three-tier", { pinnedDeviceIds: p.devices.map((d) => d.id) }));
  assert.equal(quick.positions.length, 81);
  await assert.rejects(buildLayoutDraft(s, request(s, "layered", { track: "smart" })), (e) => e.code === "LIMIT_EXCEEDED");
});

test("overlap/pin conflicts remain explicitly unscored, not misrepresented as safe candidates", async () => {
  const p = fixture(), s = await capture(p);
  const draft = await buildLayoutDraft(s, request(s, "three-tier", { pinnedDeviceIds: p.devices.map((d) => d.id) }));
  assert.equal(draft.status, "unscored");
  assert.ok(draft.positions.every((pos) => pos.x === p.devices[0].x && pos.y === p.devices[0].y));
  assert.equal("metrics" in draft, false);
  assert.equal("canApply" in draft, false);
  // This intentionally unsafe geometry must later be rejected by the scorer. No UI consumes drafts yet.
});
