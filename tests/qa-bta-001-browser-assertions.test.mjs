import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  assertPhaseMatrixComplete,
  assertFiveFileFixture,
  assertSentinelPositiveControl,
  canonicalProjectProjection,
  safeProjectProjection,
  scanNamedBuffers,
} from "../scripts/qa-bta/browser-assertions.mjs";
import { validateDeepBrowserPlan } from "../scripts/qa-bta/full-browser-runner.mjs";

const fixtureRoot = new URL("./fixtures/qa-bta-001/", import.meta.url);
const matrix = JSON.parse(fs.readFileSync(new URL("formal-browser-matrix.json", fixtureRoot), "utf8"));
const project = JSON.parse(fs.readFileSync(new URL("canonical-project.json", fixtureRoot), "utf8"));
const catalog = JSON.parse(fs.readFileSync(new URL("sentinel-catalog.json", fixtureRoot), "utf8"));

test("QA BTA formal Browser matrix covers the PM-required deep phases", () => {
  assert.deepEqual(assertPhaseMatrixComplete(matrix), ["A04", "A05", "A06", "A07", "A09", "A10"]);
  for (const phase of matrix.phases) {
    assert.ok(phase.expected.length > 0, `${phase.id} must define expected truth`);
    assert.ok(phase.evidence.length > 0, `${phase.id} must define evidence`);
    assert.ok(phase.stopConditions.length > 0, `${phase.id} must define stop conditions`);
  }
});

test("QA BTA canonical projection compares IDs, relations and geometry independent of array order", () => {
  const reversed = {
    devices: [...project.devices].reverse(),
    links: [...project.links].reverse(),
    groups: [...project.groups].reverse(),
  };
  assert.deepEqual(canonicalProjectProjection(reversed), canonicalProjectProjection(project));
  assert.deepEqual(canonicalProjectProjection(project), {
    devices: [
      { groupId: "qa-group-a", id: "qa-device-a", ip: "192.0.2.10", location: "Rack A", model: "QA Router", name: "QA Router A", quantity: 1, type: "router", url: "https://example.invalid/device-a", x: 80, y: 120 },
      { groupId: "qa-group-a", id: "qa-device-b", ip: "198.51.100.20", location: "Rack B", model: "QA Switch", name: "QA Switch B", quantity: 2, type: "switch", x: 360, y: 240 },
    ],
    groups: [{ collapsed: false, color: "#526cf5", id: "qa-group-a", kind: "site", name: "QA Site A" }],
    links: [{ from: "qa-device-a", fromPort: "LAN 1", id: "qa-link-a", kind: "wired", speed: "1 Gbps", to: "qa-device-b", toPort: "Gi0/1", vlan: "100" }],
  });
});

test("QA BTA safe projection strips sensitive network fields but preserves topology identity and geometry", () => {
  const safe = safeProjectProjection(project);
  assert.equal(safe.devices[0].ip, undefined);
  assert.equal(safe.devices[0].url, undefined);
  assert.equal(safe.devices[0].location, undefined);
  assert.equal(safe.devices[0].x, 80);
  assert.equal(safe.links[0].from, "qa-device-a");
  assert.equal(safe.groups[0].id, "qa-group-a");
});

test("QA BTA sentinel scanner proves a positive control before accepting clean sinks", () => {
  const sentinels = Object.values(catalog.values);
  const positive = assertSentinelPositiveControl(sentinels);
  assert.equal(positive.length, sentinels.length);
  assert.deepEqual(scanNamedBuffers({ dom: "clean", zip: Buffer.from("clean") }, sentinels), []);
  assert.deepEqual(scanNamedBuffers({ dom: `prefix ${catalog.values.password}` }, sentinels), [{ sink: "dom", sentinel: catalog.values.password }]);
});

test("QA BTA negative Preview fixtures are exact five-file v2 bundles", () => {
  const blocking = new URL("blocking-v2/", fixtureRoot);
  const sentinel = new URL("sentinel-v2/", fixtureRoot);
  assert.deepEqual(assertFiveFileFixture(blocking), { sharing: "safe", schemaVersion: "2" });
  assert.deepEqual(assertFiveFileFixture(sentinel), { sharing: "safe", schemaVersion: "2" });
  const sentinelHits = scanNamedBuffers(
    Object.fromEntries(fs.readdirSync(sentinel).map(name => [name, fs.readFileSync(new URL(name, sentinel))])),
    Object.values(catalog.values),
  );
  assert.ok(sentinelHits.some(hit => hit.sink === "credentials.masked.csv" && hit.sentinel === catalog.values.username));
  assert.ok(sentinelHits.some(hit => hit.sink === "credentials.masked.csv" && hit.sentinel === catalog.values.password));
});

test("QA BTA deep runner refuses mutable or incomplete formal plans", () => {
  const valid = validateDeepBrowserPlan({
    candidateSha256: "a".repeat(64),
    writerStopped: true,
    matrix,
    fixtures: {
      canonicalProject: "canonical-project.json",
      blockingBundle: "blocking-v2",
      warningDocument: "warning-import.md",
      sentinelBundle: "sentinel-v2",
      legacyProject: "legacy-project.json",
      futureProject: "future-project.json",
      malformedProject: "malformed-project.json"
    }
  });
  assert.equal(valid.phaseCount, 6);
  assert.throws(() => validateDeepBrowserPlan({ ...valid, writerStopped: false }), /writer stop/);
  assert.throws(() => validateDeepBrowserPlan({ candidateSha256: "bad", writerStopped: true, matrix, fixtures: {} }), /SHA-256/);
});
