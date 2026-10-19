import test from "node:test";
import assert from "node:assert/strict";

import { buildOfflineChannelLedger, classifySyntheticProbe, classifyUnexpectedConsole, normalizePlaywrightModule, offlineChannels, requiredBrowserPhases, validateFullBrowserOptions } from "../scripts/qa-bta/full-browser-runner.mjs";

test("QA Beta full Browser runner keeps every required acceptance phase", () => {
  assert.deepEqual(requiredBrowserPhases, [
    "entry-security",
    "responsive",
    "crud-layout",
    "persistence-restart",
    "failed-write-zero-mutation",
    "json-roundtrip",
    "csv-five-file-roundtrip",
    "import-preview-strategies",
    "offline-observation",
    "sentinel-sinks",
  ]);
});

test("QA Beta synthetic external probe distinguishes route abort from product CSP", () => {
  assert.deepEqual(classifySyntheticProbe({ rejected: true, routeObserved: true, consoleEntries: [] }), { rejected: true, enforcement: "qa-route-abort" });
  assert.deepEqual(classifySyntheticProbe({ rejected: true, routeObserved: false, consoleEntries: [{ type: "error", text: "violates Content Security Policy connect-src 'self'" }] }), { rejected: true, enforcement: "product-csp-before-route" });
  assert.throws(() => classifySyntheticProbe({ rejected: false, routeObserved: false, consoleEntries: [] }), /must be rejected/);
});

test("QA Beta full Browser runner requires fresh owned profiles and fixed loopback", () => {
  const options = validateFullBrowserOptions({
    origin: "http://127.0.0.1:4317",
    channel: "chrome",
    evidenceRoot: "C:/qa/nonexistent",
    artifactRoot: "C:/artifact",
    viewports: [{ width: 360, height: 640 }, { width: 768, height: 900 }, { width: 1024, height: 700 }, { width: 1280, height: 900 }],
    sentinels: ["QA_SYNTHETIC_SECRET"],
    dryRun: true,
  });
  assert.equal(options.headless, true);
  assert.equal(options.profileMode, "new-owned-persistent-context");
  assert.equal(options.externalNetworkPolicy, "observe-and-abort-non-loopback-not-os-firewall");
});

test("QA Beta full Browser runner rejects mutable or under-scoped plans", () => {
  assert.throws(() => validateFullBrowserOptions({ origin: "http://localhost:4317", channel: "chrome", dryRun: true }), /BTA_PROFILE_INVALID/);
  assert.throws(() => validateFullBrowserOptions({ origin: "http://127.0.0.1:4317", channel: "chromium", dryRun: true }), /Unsupported/);
});

test("QA Beta offline evidence never promotes an unobserved channel", () => {
  assert.deepEqual(offlineChannels, ["page-navigation", "subresource", "dedicated-worker", "service-worker", "websocket", "node-launcher", "node-server"]);
  const ledger = buildOfflineChannelLedger({
    requestTypes: ["document", "script", "stylesheet"],
    workers: [],
    serviceWorkers: [],
    websockets: [],
    syntheticProbeBlocked: true,
    loopbackNavigationPassed: true,
  });
  assert.equal(ledger["page-navigation"].result, "PASS");
  assert.equal(ledger.subresource.result, "PASS");
  assert.equal(ledger["dedicated-worker"].result, "NOT_RUN_UNOBSERVED");
  assert.equal(ledger["service-worker"].result, "NOT_RUN_UNOBSERVED");
  assert.equal(ledger.websocket.result, "NOT_RUN_UNOBSERVED");
  assert.equal(ledger["node-launcher"].result, "NOT_RUN_REQUIRES_SEPARATE_PROCESS_NETWORK_FIXTURE");
  assert.equal(ledger["node-server"].result, "NOT_RUN_REQUIRES_SEPARATE_PROCESS_NETWORK_FIXTURE");
});

test("QA Beta runner accepts isolated Playwright CommonJS-shaped ESM import", () => {
  const api = { chromium: { launchPersistentContext() {} } };
  assert.equal(normalizePlaywrightModule({ default: api }), api);
  assert.equal(normalizePlaywrightModule(api), api);
  assert.throws(() => normalizePlaywrightModule({ default: {} }), /Playwright chromium API/);
});

test("QA Beta runner only tolerates generic 404 console when an expected local deny response was observed", () => {
  const generic404 = { type: "error", text: "Failed to load resource: the server responded with a status of 404 (Not Found)" };
  assert.deepEqual(classifyUnexpectedConsole([generic404], [{ path: "/api/credentials", status: 404 }]), []);
  assert.deepEqual(classifyUnexpectedConsole([generic404], [{ path: "/unknown", status: 404 }]), [generic404]);
  assert.deepEqual(classifyUnexpectedConsole([{ type: "error", text: "boom" }], [{ path: "/api/credentials", status: 404 }]), [{ type: "error", text: "boom" }]);
});
