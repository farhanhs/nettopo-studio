import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { validateA08FormalEvidence, validateA08Matrix, validateA08ToolReview } from "../scripts/qa-bta/a08-assertions.mjs";
import { parseArgs, validateRunnerConfig } from "../scripts/qa-bta/a08-channel-runner.mjs";

const matrix = JSON.parse(fs.readFileSync(new URL("./fixtures/qa-bta-001/a08-channel-matrix.json", import.meta.url), "utf8"));
const absolutePaths = {
  opsRoot: "C:\\qa-owned\\ops",
  evidenceRoot: "C:\\qa-owned\\evidence",
  nodeExecutable: "C:\\qa-owned\\toolchain\\node.exe",
  chromeExecutable: "C:\\qa-owned\\toolchain\\chrome.exe",
  edgeExecutable: "C:\\qa-owned\\toolchain\\msedge.exe",
};

test("QA A08 matrix keeps every required OS/Node/Browser channel and daily flow", () => {
  assert.equal(validateA08Matrix(matrix), matrix);
});

test("QA A08 tool review is fail closed on shared executables, reparse paths, secrets and cleanup", () => {
  const valid = {
    status: "QA_TOOL_REVIEW_PASS", actualRulesApplied: false,
    paths: { ...absolutePaths, commonExecutableUsed: false, personalProfileUsed: false, reparseOrSymlinkAccepted: false },
    environment: { activeEnvRead: false, databaseUsed: false, companyApiUsed: false, lanListenerOpened: false },
    safety: { fixedHashesVerified: true, realpathsVerified: true, ancestorReparseRejected: true, processOwnershipVerified: true,
      ruleOwnershipVerified: true, partialFailureCleanupTested: true, timeoutCleanupTested: true, unknownResourcePreserved: true },
    cleanup: { ownedResourcesRemaining: 0 },
  };
  assert.equal(validateA08ToolReview(valid), valid);
  for (const mutation of [
    value => value.paths.commonExecutableUsed = true,
    value => value.paths.reparseOrSymlinkAccepted = true,
    value => value.environment.activeEnvRead = true,
    value => value.safety.timeoutCleanupTested = false,
    value => value.cleanup.ownedResourcesRemaining = 1,
  ]) {
    const invalid = structuredClone(valid); mutation(invalid);
    assert.throws(() => validateA08ToolReview(invalid));
  }
});

test("QA A08 formal evidence cannot pass with placeholders, route-only denial, missing channel or incomplete cleanup", () => {
  const formal = {
    candidate: { zipSha256: matrix.candidate.zipSha256, packetSha256: matrix.candidate.packetSha256 },
    destination: { host: "example.com", port: 443 },
    external: Object.fromEntries(matrix.externalControl.phases.map(phase => [phase, { destination: "example.com", port: 443, success: phase !== "during-deny", enforcedBy: phase === "during-deny" ? "windows-firewall-owned-rules" : "none" }])),
    loopback: Object.fromEntries(matrix.externalControl.phases.map(phase => [phase, { origin: matrix.loopback.origin, success: true }])),
    networkControl: Object.fromEntries(matrix.networkControlExecutables.map(item => [item.id, { pre: "SUCCESS", during: "DENIED_BY_OWNED_RULE", post: "SUCCESS", executableSha256: "a".repeat(64), ownedExecutable: true }])),
    productChannels: Object.fromEntries(matrix.productChannels.map(item => [item.id, { status: "NOT_USED_WITH_OBSERVER_PROOF", observerPositiveControl: true, observationStartedAt: "2026-10-20T00:00:00Z", observationEndedAt: "2026-10-20T00:01:00Z", events: [] }])),
    dailyFlow: { oracle: "QA_INDEPENDENT", ...Object.fromEntries(matrix.dailyFlow.map(step => [step, "PASS"])) },
    cleanup: { ...Object.fromEntries(matrix.cleanup.map(item => [item, true])), ownedRulesRemaining: 0, ownedProcessesRemaining: 0 },
  };
  assert.equal(validateA08FormalEvidence(matrix, formal), formal);
  for (const mutation of [
    value => value.external["during-deny"].enforcedBy = "playwright-route",
    value => delete value.productChannels["browser-service-worker"],
    value => value.dailyFlow.restore = "NOT_RUN",
    value => value.cleanup["owned-rules-removed"] = false,
  ]) {
    const invalid = structuredClone(formal); mutation(invalid);
    assert.throws(() => validateA08FormalEvidence(matrix, invalid));
  }
});

test("QA A08 formal runner is structurally incapable of emitting A08_QA_PASS", () => {
  const source = fs.readFileSync(new URL("../scripts/qa-bta/a08-formal-runner.mjs", import.meta.url), "utf8");
  assert.match(source, /A08_EVIDENCE_SCHEMA_VALIDATED_NOT_ACCEPTANCE/);
  assert.match(source, /BLOCKED_PENDING_RAW_PROVENANCE_AND_HUMAN_QA_REVIEW/);
  assert.doesNotMatch(source, /status:\s*["']A08_QA_PASS["']/);
});

test("QA channel runner CLI is fixed and its PM-approved external control is fail closed", () => {
  assert.deepEqual(parseArgs(["--config", "a.json", "--phase", "during-deny", "--run-id", "qa-a08"]),
    { config: "a.json", phase: "during-deny", "run-id": "qa-a08" });
  const config = {
    schemaVersion: 1,
    candidate: { zipSha256: matrix.candidate.zipSha256 },
    fixture: { executables: { node: { sha256: "a".repeat(64) }, chrome: { sha256: "b".repeat(64) }, edge: { sha256: "c".repeat(64) } } },
    externalControl: { host: "example.com", port: 443, scheme: "https", path: "/", method: "HEAD", timeoutMs: 5000,
      maxAttemptsPerExecutablePerPhase: 1, allowRedirects: false, rejectPrivateOrLinkLocalDns: true, credentials: false },
  };
  assert.equal(validateRunnerConfig(config), config);
  for (const mutate of [
    value => value.externalControl.host = "localhost",
    value => value.externalControl.timeoutMs = 5001,
    value => value.externalControl.maxAttemptsPerExecutablePerPhase = 2,
    value => value.externalControl.allowRedirects = true,
    value => value.externalControl.credentials = true,
  ]) { const invalid = structuredClone(config); mutate(invalid); assert.throws(() => validateRunnerConfig(invalid)); }
});
