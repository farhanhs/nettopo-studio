import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  ApplyLayoutRequestSchema, ApplyLayoutResponseSchema, LayoutProposalResponseSchema, LayoutContractError, LayoutIntentSchema, LayoutProposalRequestSchema,
  LayoutRequestSchema, ProviderGraphSchema, canonicalProject, immutable,
  validateIntent, validateLayoutPositions, validateLayoutProject, validatePins,
} from "../app/lib/topology-layout-contract.ts";
import { BASE_LAYOUT_GEOMETRY, assertBaseGeometry } from "../app/lib/topology-geometry.ts";
import { deviceRoutingRect, TOPOLOGY_NODE_WIDTH, TOPOLOGY_NODE_HEIGHT } from "../app/lib/topology-routing.ts";
import { captureLayoutSnapshot } from "../app/lib/topology-layout-core.ts";

const d = (id, x = 0) => ({ id, name: id, type: "switch", x, y: 0 });
const project = () => ({ devices: [d("b", 400), d("a")], links: [{ id: "l", from: "a", to: "b", kind: "wired" }], groups: [] });
const rev = "a".repeat(64);
const wire = () => ({ requestId: "request-1", topologyId: "topology-1", baseRevision: rev });
const refMap = () => ({ graphRef: "opaque-request-graph", nodeByRef: { n001: "a", n002: "b" }, linkByRef: { l001: "l" }, groupByRef: {} });
const intent = () => ({ strategy: "layered", warnings: [], layers: [{ nodeRefs: ["n001"] }, { nodeRefs: ["n002"] }] });

test("R1 proposal defaults and strict wire shape exclude graph, identity and ineffective toggles", () => {
  const parsed = LayoutProposalRequestSchema.parse(wire());
  assert.equal(parsed.objective, "balanced");
  assert.equal(parsed.requestedMode, "auto-detect");
  assert.deepEqual(parsed.pinnedDeviceIds, []);
  for (const [key, value] of Object.entries({ project: project(), geometryVersion: BASE_LAYOUT_GEOMETRY, role: "boss", preserveRelativePositions: false, preserveGroups: true, endpoint: "unused" })) {
    assert.equal(LayoutProposalRequestSchema.safeParse({ ...wire(), [key]: value }).success, false, key);
  }
  for (const patch of [{ requestId: "" }, { requestId: "x".repeat(81) }, { topologyId: "x".repeat(129) }, { baseRevision: rev.toUpperCase() }, { baseRevision: "invalid" }, { pinnedDeviceIds: ["a", "a"] }]) {
    assert.equal(LayoutProposalRequestSchema.safeParse({ ...wire(), ...patch }).success, false);
  }
  assert.equal(LayoutProposalRequestSchema.safeParse({ ...wire(), pinnedDeviceIds: Array.from({ length: 61 }, (_, i) => `d${i}`) }).success, false);
});

test("internal request and apply schemas are strict at every geometry/position boundary", () => {
  const request = { ...wire(), track: "quick", graphHash: rev, geometryVersion: BASE_LAYOUT_GEOMETRY };
  assert.equal(LayoutRequestSchema.safeParse(request).success, true);
  for (const patch of [{ preserveGroups: false }, { preserveRelativePositions: false }, { geometryVersion: { ...BASE_LAYOUT_GEOMETRY, code: "anything" } }]) {
    assert.equal(LayoutRequestSchema.safeParse({ ...request, ...patch }).success, false);
  }
  const apply = { action: "applyLayout", requestId: "r", topologyId: "t", expectedRevision: rev, positions: [{ deviceId: "a", x: 0, y: 0 }] };
  assert.equal(ApplyLayoutRequestSchema.safeParse(apply).success, true);
  assert.equal(ApplyLayoutRequestSchema.safeParse({ ...apply, positions: [{ ...apply.positions[0], name: "renamed" }] }).success, false);
  assert.equal(ApplyLayoutRequestSchema.safeParse({ ...apply, role: "boss" }).success, false);
});

test("shared response schemas enforce R1 proposal shape and saved undo context", () => {
  const proposal = { ...wire(), ok: true, contractVersion: 1, intent: intent(), refMap: refMap(), geometryVersion: BASE_LAYOUT_GEOMETRY };
  assert.equal(LayoutProposalResponseSchema.safeParse(proposal).success, true);
  assert.equal(LayoutProposalResponseSchema.safeParse({ ...proposal, rawProviderBody: "sentinel" }).success, false);
  const positions = [{ deviceId: "a", x: 0, y: 0 }];
  const response = { ok: true, topologyId: "t", previousRevision: rev, currentRevision: rev, movedDevices: 0, saveState: "saved",
    undo: { topologyId: "t", appliedRevision: rev, beforePositions: positions, afterPositions: positions, expiresAt: "2026-09-13T00:05:00.000Z" } };
  assert.equal(ApplyLayoutResponseSchema.safeParse(response).success, true);
  for (const patch of [{ saveState: "pending" }, { undo: { ...response.undo, topologyId: "other" } },
    { undo: { ...response.undo, afterPositions: [{ deviceId: "b", x: 0, y: 0 }] } }]) {
    assert.equal(ApplyLayoutResponseSchema.safeParse({ ...response, ...patch }).success, false);
  }
  const failure = { ok: false, error: { code: "STALE_LAYOUT", message: "Rebuild proposal", requestId: "r" } };
  assert.equal(ApplyLayoutResponseSchema.safeParse(failure).success, true);
  assert.equal(ApplyLayoutResponseSchema.safeParse({ ...failure, error: { ...failure.error, sql: "no" } }).success, false);
});

test("complete positions, finite range, duplicate/unknown IDs, and pins fail closed", () => {
  const p = project();
  const ps = p.devices.map(({ id: deviceId, x, y }) => ({ deviceId, x, y }));
  assert.deepEqual(validateLayoutPositions(p, ps).map((v) => v.deviceId), ["a", "b"]);
  for (const positions of [[], ps.slice(1), [...ps, ps[0]], [ps[0], ps[0]], [ps[0], { ...ps[1], deviceId: "unknown" }]]) {
    assert.throws(() => validateLayoutPositions(p, positions), LayoutContractError);
  }
  for (const x of [NaN, Infinity, -Infinity, 1_000_001, -1_000_001]) {
    assert.throws(() => validateLayoutPositions(p, [{ ...ps[0], x }, ps[1]]), LayoutContractError);
  }
  assert.throws(() => validateLayoutPositions(p, [{ ...ps[0], x: 50 }, ps[1]], ["b"]), LayoutContractError);
  assert.throws(() => validatePins(p, ["a", "a"]), LayoutContractError);
  assert.throws(() => validatePins(p, ["missing"]), LayoutContractError);
  assert.deepEqual(validatePins(p, ["b", "a"]), ["a", "b"]);
});

test("strict Project rejects credentials, unknown fields, invalid refs and ambiguous whitespace IDs", () => {
  for (const extra of [{ password: "SENTINEL-NOT-A-REAL-SECRET" }, { username: "sentinel-user" }, { secret: "sentinel" }, { route: [] }, { selected: true }]) {
    const p = project(); Object.assign(p.devices[0], extra);
    assert.throws(() => validateLayoutProject(p), (error) => error.message === "INVALID_LAYOUT_REQUEST");
  }
  const bad = project(); bad.links[0].to = "missing";
  assert.throws(() => validateLayoutProject(bad), LayoutContractError);
  const duplicate = project(); duplicate.devices.push(duplicate.devices[0]);
  assert.throws(() => validateLayoutProject(duplicate), LayoutContractError);
  const whitespace = { devices: [d(" a ")], links: [], groups: [] };
  assert.throws(() => validateLayoutProject(whitespace), LayoutContractError);
  assert.throws(() => validateLayoutProject({ ...project(), selection: "a" }), LayoutContractError);
});

test("revision is canonical SHA256 of ALL durable fields, not just geometry", async () => {
  const p = project();
  p.groups.push({ id: "g", name: " Group ", color: "#ABCDEF", kind: "site", collapsed: false });
  Object.assign(p.devices[0], { groupId: "g", ip: "synthetic", name: " raw name ", quantity: 2 });
  const baseline = structuredClone(p);
  const context = { topologyId: "t", capturedAt: "2026-09-13T00:00:00.000Z" };
  const snapshot = await captureLayoutSnapshot(immutable(p), context);
  assert.equal(snapshot.baseRevision, createHash("sha256").update(canonicalProject(p), "utf8").digest("hex"));
  assert.deepEqual(snapshot.project, baseline); // Existing schema's trims/lowercase must not mutate durable fields.
  const permutation = { groups: [...p.groups].reverse(), links: [...p.links].reverse(), devices: [...p.devices].reverse().map((item) => Object.fromEntries(Object.entries(item).reverse())) };
  assert.equal((await captureLayoutSnapshot(permutation, context)).baseRevision, snapshot.baseRevision);
  assert.equal((await captureLayoutSnapshot(permutation, context)).graphHash, snapshot.graphHash);
  const mutate = [
    (v) => { v.devices[0].x++; }, (v) => { v.devices[0].name += " "; },
    (v) => { v.devices[0].ip += "changed"; }, (v) => { v.devices[0].quantity++; },
    (v) => { v.groups[0].collapsed = true; }, (v) => { v.groups[0].color = "#abcdef"; },
    (v) => { v.links[0].speed = "10 Gbps"; },
  ];
  for (const change of mutate) {
    const changed = structuredClone(baseline); change(changed);
    assert.notEqual((await captureLayoutSnapshot(changed, context)).baseRevision, snapshot.baseRevision);
  }
  assert.equal(canonicalProject({ devices: [d("a", -0)], links: [], groups: [] }), canonicalProject({ devices: [d("a", 0)], links: [], groups: [] }));
  assert.ok(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.project.devices[0]));
});

test("geometry derives dimensions/margin from router and rejects unintegrated AST or client geometry", () => {
  const r = deviceRoutingRect(d("a"));
  assert.equal(BASE_LAYOUT_GEOMETRY.nodeWidth, TOPOLOGY_NODE_WIDTH);
  assert.equal(BASE_LAYOUT_GEOMETRY.nodeHeight, TOPOLOGY_NODE_HEIGHT);
  assert.equal(BASE_LAYOUT_GEOMETRY.routingRectMargin, -r.left);
  for (const geometry of [{ ...BASE_LAYOUT_GEOMETRY, nodeWidth: 192 }, { ...BASE_LAYOUT_GEOMETRY, routingRectMargin: 0 }, { ...BASE_LAYOUT_GEOMETRY, source: "asset-registry-v1", astContractVersion: "1" }]) {
    assert.throws(() => assertBaseGeometry(geometry), LayoutContractError);
  }
});

test("provider intent refs require a complete bijection, exact layer coverage, bounded strict enums", () => {
  assert.equal(validateIntent(intent(), refMap(), project()).intent.strategy, "layered");
  const invalid = [
    { ...intent(), options: { algorithm: "anything" } },
    { ...intent(), strategy: "execute-code" },
    { ...intent(), layers: [{ nodeRefs: ["n001"] }] },
    { ...intent(), layers: [{ nodeRefs: ["n001", "n001"] }, { nodeRefs: ["n002"] }] },
    { ...intent(), layers: [{ nodeRefs: ["n001", "n999"] }] },
    { ...intent(), emphasisRefs: ["n999"] },
    { ...intent(), groupOrder: ["g001"] },
    { ...intent(), warnings: [{ code: "ambiguous-role", message: "x".repeat(161) }] },
    { ...intent(), warnings: [{ code: "ambiguous-role", message: "ok", refs: ["n999"] }] },
    { ...intent(), warnings: Array.from({ length: 13 }, () => ({ code: "insufficient-signal", message: "ok" })) },
    { ...intent(), layers: [{ nodeRefs: ["n001", "n002"], label: "x".repeat(81) }] },
  ];
  for (const value of invalid) assert.throws(() => validateIntent(value, refMap(), project()), (e) => e.code === "INVALID_LAYOUT_PROPOSAL");
  for (const patch of [{ nodeByRef: { n001: "a", n002: "a" } }, { nodeByRef: { n001: "a", n002: "missing" } }, { linkByRef: {} }, { groupByRef: { g001: "missing" } }]) {
    assert.throws(() => validateIntent(intent(), { ...refMap(), ...patch }, project()), LayoutContractError);
  }
  assert.equal(LayoutIntentSchema.safeParse({ ...intent(), layers: [{ nodeRefs: Array.from({ length: 61 }, (_, i) => `n${String(i).padStart(3, "0")}`) }] }).success, false);
});

test("provider graph strict shape rejects raw identifiers and inconsistent graph counts", () => {
  const g = { requestId: "opaque-r", graphRef: "opaque-g", objective: "balanced", requestedMode: "layered",
    nodes: [{ ref: "n001", deviceType: "switch", degree: 1, groupRef: "g001" }, { ref: "n002", deviceType: "server", degree: 1 }],
    links: [{ ref: "l001", fromRef: "n001", toRef: "n002", kind: "wired" }],
    groups: [{ ref: "g001", kind: "site", size: 1 }],
    constraints: { onlyMoveExistingDevices: true, preserveLinks: true, preserveGroups: true, noCredentials: true, noRawNamesOrNetworkIdentifiers: true },
  };
  assert.equal(ProviderGraphSchema.safeParse(g).success, true);
  for (const change of [
    (v) => { v.nodes[0].name = "raw"; }, (v) => { v.nodes[0].ip = "sentinel"; },
    (v) => { v.nodes[0].degree = 0; }, (v) => { v.groups[0].size = 2; },
    (v) => { v.links[0].toRef = "n999"; }, (v) => { v.nodes.push(v.nodes[0]); },
    (v) => { v.nodes[0].groupRef = "g999"; },
  ]) {
    const changed = structuredClone(g); change(changed);
    assert.equal(ProviderGraphSchema.safeParse(changed).success, false);
  }
});
