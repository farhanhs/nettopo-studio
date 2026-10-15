import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureRoot = new URL("./fixtures/qa-ntm-004/", import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, fixtureRoot), "utf8"));

test("QA_NTM_004 preparation covers PROJ-01 through PROJ-08 without product PASS", async () => {
  const fixture = await readJson("projection-vectors.json");
  const covered = new Set(fixture.vectors.flatMap(({ covers }) => covers));
  assert.deepEqual([...covered].sort(), Array.from({ length: 8 }, (_, index) => `PROJ-0${index + 1}`));
  assert.equal(fixture.formalResult, "NOT_RUN");
  assert.equal(fixture.contractStatus, "PENDING_DSG_SECTION_5");
});

test("QA_NTM_004 oracle prohibits a second durable graph and legacy interface invention", async () => {
  const { vectors } = await readJson("projection-vectors.json");
  const dual = vectors.find(({ id }) => id === "same-snapshot-dual-projection");
  const legacy = vectors.find(({ id }) => id === "stable-id-and-legacy-unknown-endpoint");
  assert.equal(dual.expected.durableGraphCopies, 0);
  assert.equal(dual.expected.writes, 0);
  assert.equal(legacy.expected.missingInterfaceState, "unknown");
  assert.equal(legacy.expected.canvasAnchorIsInterface, false);
  assert.equal(legacy.expected.inventedInterfaceCount, 0);
});

test("QA_NTM_004 oracle fixes verified-only closure and safe fallback truths", async () => {
  const { vectors } = await readJson("projection-vectors.json");
  const closure = vectors.find(({ id }) => id === "verified-only-closure-and-reason");
  const navigation = vectors.find(({ id }) => id === "navigation-selection-fallback");
  assert.equal(closure.expected.verifiedRequiresRelationAndEndpointClosure, true);
  assert.equal(closure.expected.staleTrustAccepted, false);
  assert.equal(closure.expected.claimsDisconnected, false);
  assert.equal(closure.expected.claimsHealthy, false);
  assert.equal(navigation.expected.fallbackIsExplicit, true);
  assert.equal(navigation.expected.collapseMutatesPhysicalLinks, false);
});

test("QA_NTM_004 hidden data and secret sentinels stay negative acceptance inputs", async () => {
  const fixture = await readJson("projection-vectors.json");
  const boundary = fixture.vectors.find(({ id }) => id === "authorization-and-hidden-data-boundary");
  assert.equal(fixture.classification, "synthetic-qa-only");
  assert.equal(fixture.sentinels.every((value) => /QA_NTM_004|qa_ntm_004/i.test(value)), true);
  assert.equal(boundary.expected.authorizationBeforeProjection, true);
  assert.equal(boundary.expected.hiddenIdsLoadedByClient, false);
  assert.equal(boundary.expected.clientAreaGrantsAccess, false);
  assert.equal(boundary.expected.safeErrorEcho, false);
});

test("QA_NTM_004 Browser matrix is isolated and remains NOT RUN", async () => {
  const browser = await readJson("browser-matrix.json");
  assert.equal(browser.formalResult, "NOT_RUN");
  assert.equal(browser.executionPrerequisites.productServerStartedDuringPreparation, false);
  assert.equal(browser.isolation.bind, "127.0.0.1");
  assert.equal(browser.isolation.port, "owned-random-non-5432");
  assert.equal(browser.isolation.environment, "explicit-no-current-env-allowlist-plus-sanitized-project-root");
  assert.equal(browser.isolation.database, "not-required-not-started");
  assert.equal(browser.isolation.docker, "not-required-not-started");
  assert.deepEqual(browser.isolation.cleanup, ["server-pid-stopped", "port-closed", "profile-removed", "downloads-removed", "sanitized-project-mirror-removed", "temp-fixtures-removed"]);
});

test("QA_NTM_004 Browser and performance matrices preserve required observations without inventing a threshold", async () => {
  const fixture = await readJson("projection-vectors.json");
  const browser = fixture.vectors.find(({ id }) => id === "browser-interaction-and-responsive-a11y");
  const performance = fixture.vectors.find(({ id }) => id === "synthetic-performance-observation");
  assert.deepEqual(browser.viewports.map(({ width }) => width), [360, 768, 1024, 1280, 700]);
  assert.equal(browser.expected.nonColorTrustCue, true);
  assert.equal(browser.expected.pageHorizontalOverflow, false);
  assert.equal(performance.expected.recordMachine, true);
  assert.equal(performance.expected.recordElapsed, true);
  assert.equal(performance.expected.newProductThresholdClaim, false);
  assert.equal(performance.expected.anonymousRealCaseClaim, false);
});
