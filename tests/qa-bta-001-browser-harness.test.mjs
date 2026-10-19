import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { canonicalOrigin, classifyBrowserEvidence, validateBrowserOptions } from "../scripts/qa-bta/browser-runner.mjs";

const fixtureRoot = path.resolve(import.meta.dirname, "fixtures", "qa-bta-001");
const contract = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "browser-contract.json"), "utf8"));

test("QA Beta Browser runner fixes Chrome/Edge, canonical origin and required viewports", () => {
  const base = { origin: contract.origin, channel: "chrome", evidenceRoot: path.join(fixtureRoot, "never-created-evidence"), viewports: contract.viewports };
  assert.equal(validateBrowserOptions(base), base);
  assert.equal(canonicalOrigin, "http://127.0.0.1:4317");
  assert.throws(() => validateBrowserOptions({ ...base, origin: "http://localhost:4317" }), /BTA_PROFILE_INVALID/);
  assert.throws(() => validateBrowserOptions({ ...base, channel: "chromium" }), /Unsupported/);
  assert.deepEqual(contract.channels, ["chrome", "msedge"]);
  assert.equal(contract.bannerSelector, '[data-local-beta="true"]');
  assert.deepEqual(contract.control, { statusPath: "/__local_beta/status", shutdownPath: "/__local_beta/shutdown", tokenHeader: "x-nettopo-beta-control" });
  assert.equal(contract.formalResult, "NOT_RUN");
});

test("QA Beta Browser evidence makes external requests, sentinels, console and page errors blocking", () => {
  const safe = { urls: [`${canonicalOrigin}/`, `${canonicalOrigin}/app.js`], dom: "safe", console: [], pageErrors: [], responses: [], storage: [] };
  assert.deepEqual(classifyBrowserEvidence(safe, ["QA_BETA_SECRET_SENTINEL"]), { externalRequests: [], secretHits: [], unexpectedConsoleErrors: [], pageErrors: [] });
  const unsafe = classifyBrowserEvidence({ ...safe, urls: [...safe.urls, "https://example.com/track"], dom: "QA_BETA_SECRET_SENTINEL", console: [{ type: "error", text: "boom" }], pageErrors: ["broken"] }, ["QA_BETA_SECRET_SENTINEL"]);
  assert.deepEqual(unsafe.externalRequests, ["https://example.com/track"]);
  assert.deepEqual(unsafe.secretHits, [{ name: "dom", sentinel: "QA_BETA_SECRET_SENTINEL" }]);
  assert.equal(unsafe.unexpectedConsoleErrors.length, 1);
  assert.deepEqual(unsafe.pageErrors, ["broken"]);
});
