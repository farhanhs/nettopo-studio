import assert from "node:assert/strict";
import test from "node:test";
import { captureLayoutSnapshot, projectWithLayoutPositions } from "../app/lib/topology-layout-core.ts";
import { scoreLayoutCandidate, selectLayoutCandidate } from "../app/lib/topology-layout-quality.ts";
import { runLayoutWorker } from "../app/lib/topology-layout-runner.ts";

const device = (id, x, y, type = "switch") => ({ id, name: id, type, x, y });
const fixture = () => ({
  devices: [device("a", 0, 0), device("b", 320, 0), device("c", 160, 240, "server")],
  links: [
    { id: "wired-ab", from: "a", to: "b", kind: "wired" },
    { id: "wireless-bc", from: "b", to: "c", kind: "wireless" },
  ],
  groups: [{ id: "g", name: "kept", kind: "site", color: "#abcdef" }],
});
const input = () => ({ requestId: "qa-r", topologyId: "qa-t", project: fixture(), request: {
  requestId: "qa-r", topologyId: "qa-t", track: "quick", requestedMode: "auto-detect",
  objective: "balanced", pinnedDeviceIds: [], preserveGroups: true,
} });

test("Phase A scoring preserves graph fields and treats wireless as an explicit routing exception", async () => {
  const project = fixture();
  const snapshot = await captureLayoutSnapshot(project, { topologyId: "qa-t" });
  const positions = project.devices.map(({ id: deviceId, x, y }) => ({ deviceId, x, y }));
  const candidate = scoreLayoutCandidate(snapshot, { positions, pinnedDeviceIds: [] }, "quick", "qa-r");
  const applied = projectWithLayoutPositions(project, candidate.positions);
  assert.deepEqual(applied.links, project.links);
  assert.deepEqual(applied.groups, project.groups);
  const graphFields = (value) => value.devices.map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== "x" && key !== "y")));
  assert.deepEqual(graphFields(applied), graphFields(project));
  assert.equal(candidate.metrics.unresolvedRoutes, 0);
});

test("Phase A selection rejects geometry mismatch and keeps original when no safe improvement exists", async () => {
  const snapshot = await captureLayoutSnapshot(fixture(), { topologyId: "qa-t" });
  const unchanged = snapshot.project.devices.map(({ id: deviceId, x, y }) => ({ deviceId, x, y }));
  const selection = selectLayoutCandidate(snapshot, [
    { source: "original", value: [] },
    { source: "quick", value: { positions: unchanged, pinnedDeviceIds: [] }, requestId: "qa-r" },
  ]);
  assert.equal(selection.recommended, undefined);
  const incompatible = structuredClone(snapshot);
  incompatible.geometryVersion = "unknown-geometry";
  assert.throws(() => scoreLayoutCandidate(incompatible, [], "original"));
});

test("Phase A runner pre-abort terminates without posting", async () => {
  const controller = new AbortController(); controller.abort();
  let posts = 0, terminates = 0;
  const worker = { onmessage: null, onerror: null, postMessage() { posts++; }, terminate() { terminates++; } };
  await assert.rejects(runLayoutWorker(input(), { signal: controller.signal, createWorker: () => worker }), (error) => error.name === "AbortError");
  assert.equal(posts, 0);
  assert.equal(terminates, 1);
  assert.equal(worker.onmessage, null);
  assert.equal(worker.onerror, null);
});

test("Phase A runner ignores mismatched and late replies, then performs bounded cleanup", async () => {
  let terminates = 0;
  const worker = { onmessage: null, onerror: null, terminate() { terminates++; }, postMessage() {
    queueMicrotask(() => worker.onmessage?.({ data: { requestId: "wrong", ok: true, selection: { candidates: [] } } }));
    setTimeout(() => worker.onmessage?.({ data: { requestId: "qa-r", ok: true, selection: { candidates: [] } } }), 50);
  } };
  await assert.rejects(runLayoutWorker(input(), { timeoutMs: 10, createWorker: () => worker }), (error) => error.code === "TIMEOUT");
  assert.equal(terminates, 1);
  assert.equal(worker.onmessage, null);
  assert.equal(worker.onerror, null);
});

test("Phase A runner cleans up when postMessage throws synchronously", async () => {
  let terminates = 0;
  const worker = { onmessage: null, onerror: null, terminate() { terminates++; }, postMessage() { throw new Error("qa-post-failure"); } };
  await assert.rejects(runLayoutWorker(input(), { timeoutMs: 25, createWorker: () => worker }), /qa-post-failure/);
  assert.equal(terminates, 1);
  assert.equal(worker.onmessage, null);
  assert.equal(worker.onerror, null);
});
