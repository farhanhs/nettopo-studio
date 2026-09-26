import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { captureLayoutSnapshot, buildLayoutDraft } from "../app/lib/topology-layout-core.ts";
import { scoreLayoutCandidate, selectLayoutCandidate } from "../app/lib/topology-layout-quality.ts";
import { runLayoutWorker } from "../app/lib/topology-layout-runner.ts";

const device = (id, x, y) => ({ id, name: id, type: "switch", x, y });
const project = () => ({ devices: [device("a", 0, 0), device("b", 300, 0), device("c", 150, 220)], links: [
  { id: "ab", from: "a", to: "b", kind: "wired" }, { id: "bc", from: "b", to: "c", kind: "wired" },
], groups: [] });

test("quality hard gates reject overlap and unresolved wired routes", async () => {
  const snapshot = await captureLayoutSnapshot(project(), { topologyId: "t" });
  const overlap = snapshot.project.devices.map((d) => ({ deviceId: d.id, x: 0, y: 0 }));
  const candidate = scoreLayoutCandidate(snapshot, { positions: overlap, pinnedDeviceIds: [] }, "quick", "r");
  assert.equal(candidate.hardGatePassed, false);
  assert.ok(candidate.hardGateReasons.includes("node-overlap"));
  assert.ok(candidate.metrics.unresolvedRoutes > 0);
});

test("candidate selection is deterministic, capped at three, and independent of input order", async () => {
  const snapshot = await captureLayoutSnapshot(project(), { topologyId: "t" });
  const request = { requestId: "r", topologyId: "t", track: "quick", requestedMode: "three-tier", objective: "balanced",
    pinnedDeviceIds: [], preserveGroups: true, baseRevision: snapshot.baseRevision, graphHash: snapshot.graphHash, geometryVersion: snapshot.geometryVersion };
  const draft = await buildLayoutDraft(snapshot, request);
  const values = [{ source: "original", value: [] }, { source: "quick", value: draft, requestId: "r" }];
  const a = selectLayoutCandidate(snapshot, values);
  const b = selectLayoutCandidate(snapshot, [...values].reverse());
  assert.deepEqual(a, b);
  assert.throws(() => selectLayoutCandidate(snapshot, [...values, ...values]), /Too many/);
});

function fakeWorker({ result, delay = 0 }) {
  let terminated = false;
  const worker = { onmessage: null, onerror: null, terminate() { terminated = true; }, postMessage(input) {
    setTimeout(() => worker.onmessage?.({ data: { requestId: input.requestId, ok: true, selection: result } }), delay);
  } };
  return { worker, terminated: () => terminated };
}

test("runner terminates on success, deadline and abort, and ignores late results", async () => {
  const input = { requestId: "r", topologyId: "t", project: project(), request: { requestId: "r", topologyId: "t", track: "quick", requestedMode: "auto-detect", objective: "balanced", pinnedDeviceIds: [], preserveGroups: true } };
  const success = fakeWorker({ result: { candidates: [] } });
  assert.equal((await runLayoutWorker(input, { createWorker: () => success.worker })).ok, true);
  assert.equal(success.terminated(), true);
  const late = fakeWorker({ result: { candidates: [] }, delay: 30 });
  await assert.rejects(runLayoutWorker(input, { timeoutMs: 5, createWorker: () => late.worker }), (e) => e.code === "TIMEOUT");
  assert.equal(late.terminated(), true);
  await new Promise((resolve) => setTimeout(resolve, 40));
  const controller = new AbortController(), cancelled = fakeWorker({ result: { candidates: [] }, delay: 30 });
  const pending = runLayoutWorker(input, { signal: controller.signal, createWorker: () => cancelled.worker });
  controller.abort();
  await assert.rejects(pending, (e) => e.name === "AbortError");
  assert.equal(cancelled.terminated(), true);
});

test("runner cleans up exactly once when postMessage throws synchronously", async () => {
  let terminateCount = 0;
  const worker = {
    onmessage: null,
    onerror: null,
    terminate() { terminateCount += 1; },
    postMessage() { throw new Error("unsafe internal detail"); },
  };
  const input = { requestId: "sync-error", topologyId: "t", project: project(), request: {
    requestId: "sync-error", topologyId: "t", track: "quick", requestedMode: "auto-detect",
    objective: "balanced", pinnedDeviceIds: [], preserveGroups: true,
  } };

  await assert.rejects(runLayoutWorker(input, { timeoutMs: 10, createWorker: () => worker }), /unsafe internal detail/);
  assert.equal(terminateCount, 1);
  assert.equal(worker.onmessage, null);
  assert.equal(worker.onerror, null);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(terminateCount, 1);
});

test("runner cleans up exactly once when structuredClone throws synchronously", async () => {
  let postCount = 0;
  let terminateCount = 0;
  const worker = {
    onmessage: null,
    onerror: null,
    terminate() { terminateCount += 1; },
    postMessage() { postCount += 1; },
  };
  const input = { requestId: "clone-error", topologyId: "t", project: {
    ...project(),
    invalidCloneValue: () => undefined,
  }, request: {
    requestId: "clone-error", topologyId: "t", track: "quick", requestedMode: "auto-detect",
    objective: "balanced", pinnedDeviceIds: [], preserveGroups: true,
  } };

  await assert.rejects(runLayoutWorker(input, { timeoutMs: 10, createWorker: () => worker }), (error) => error.name === "DataCloneError");
  assert.equal(postCount, 0);
  assert.equal(terminateCount, 1);
  assert.equal(worker.onmessage, null);
  assert.equal(worker.onerror, null);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(terminateCount, 1);
});

test("page delegates auto layout to the worker runner and shared apply helper", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /import \{ runQuickLayout \} from "\.\/lib\/topology-layout-runner"/);
  assert.match(source, /await runQuickLayout\(project, activeTopologyId \?\? "local-topology", layoutMode\)/);
  assert.match(source, /setProject\(projectWithLayoutPositions\(project, candidate\.positions\)\)/);
  assert.doesNotMatch(source, /new ELK\s*\(/);
  assert.doesNotMatch(source, /function layoutWithElk\s*\(/);
});
