import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("./fixtures/qa-bta-001/", import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, root), "utf8"));

test("QA_BTA_001 preparation matrix contains BTA-A01 through BTA-A12 and no product PASS", async () => {
  const matrix = await readJson("acceptance-matrix.json");
  assert.deepEqual(matrix.cases.map(({ id }) => id), Array.from({ length: 12 }, (_, index) => `BTA-A${String(index + 1).padStart(2, "0")}`));
  assert.equal(matrix.cases.every(({ formalResult }) => formalResult === "NOT_RUN"), true);
  assert.equal(matrix.clarifications.backupScope, "per-topology-existing-json-and-five-csv-only");
  assert.equal(matrix.clarifications.workspaceSnapshot, false);
  assert.equal(matrix.clarifications.downloadTriggerProvesDiskWrite, false);
  assert.equal(matrix.clarifications.dirtySourceRequiresAllowlistedHashes, true);
  assert.equal(matrix.clarifications.manifestMustBeAcyclic, true);
});

test("QA_BTA_001 anonymous topology fixture has valid internal references and no sensitive fields", async () => {
  const project = await readJson("synthetic-topology.json");
  const deviceIds = new Set(project.devices.map(({ id }) => id));
  const groupIds = new Set(project.groups.map(({ id }) => id));
  assert.equal(project.links.every(({ from, to }) => deviceIds.has(from) && deviceIds.has(to)), true);
  assert.equal(project.devices.every(({ groupId }) => !groupId || groupIds.has(groupId)), true);
  assert.doesNotMatch(JSON.stringify(project), /password|secret|token|cookie|ciphertext|nonce|postgres(?:ql)?:\/\//i);
});

test("QA_BTA_001 sentinel catalog is synthetic and covers every applicable sink", async () => {
  const catalog = await readJson("sentinel-catalog.json");
  assert.equal(catalog.classification, "synthetic-qa-only");
  assert.equal(Object.values(catalog.values).every((value) => /QA[-_]BETA|qa_beta/i.test(value)), true);
  assert.deepEqual(catalog.mustNotAppearIn, ["Project", "Zustand", "Dexie", "DOM", "network-response", "JSON", "CSV", "ZIP", "logs", "public-package"]);
});

test("QA_BTA_001 environment matrix preserves Windows, two-browser, offline-loopback and safety boundaries", async () => {
  const matrix = await readJson("environment-matrix.json");
  assert.equal(matrix.platform, "Windows");
  assert.deepEqual(matrix.browsers, ["Chrome", "Edge"]);
  assert.equal(matrix.paths.includes("中文路徑"), true);
  assert.equal(matrix.networkModes.includes("external-network-blocked-loopback-allowed"), true);
  assert.deepEqual(matrix.requestCases, [
    "originless-same-origin-capability-get",
    "framework-rsc-get",
    "navigation-and-static-assets",
    "owned-status",
    "owned-shutdown-with-instance-token",
    "cross-site-request-denied",
    "protected-api-denied",
  ]);
  assert.equal(Object.values(matrix.constraints).every(Boolean), true);
  assert.equal(Object.values(matrix.ownedLifecycle).every(Boolean), true);
});
