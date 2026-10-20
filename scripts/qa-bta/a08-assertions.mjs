import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SHA = /^[0-9a-f]{64}$/;
const PHASES = ["pre-success", "during-deny", "post-success"];

export function validateA08Matrix(matrix) {
  assert.equal(matrix.contract, "LOCAL-FEEDBACK-BETA-V1@R1.1:A08");
  for (const key of ["zipSha256", "packetSha256", "sourceManifest", "artifactManifest"]) assert.match(matrix.candidate[key], SHA);
  assert.match(matrix.candidate.archivedHead, /^[0-9a-f]{40}$/);
  assert.equal(matrix.externalControl.sameDestinationAndPort, true);
  assert.deepEqual(matrix.externalControl.phases, PHASES);
  assert.equal(matrix.externalControl.destination, "example.com");
  assert.equal(matrix.externalControl.port, 443);
  assert.equal(matrix.externalControl.scheme, "https");
  assert.equal(matrix.externalControl.method, "HEAD");
  assert.equal(matrix.externalControl.timeoutMs <= 5000, true);
  assert.equal(matrix.externalControl.maxAttemptsPerExecutablePerPhase, 1);
  assert.equal(matrix.externalControl.allowRedirects, false);
  assert.equal(matrix.externalControl.credentials, false);
  assert.equal(matrix.externalControl.rejectPrivateOrLinkLocalDns, true);
  assert.match(matrix.loopback.origin, /^http:\/\/127\.0\.0\.1:4317$/);
  assert.equal(matrix.loopback.requiredDuringEveryPhase, true);
  assert.equal(matrix.loopback.lanListenerForbidden, true);
  assert.deepEqual(matrix.networkControlExecutables.map(item => item.id), ["node", "chrome", "edge"]);
  assert.ok(matrix.networkControlExecutables.every(item => item.required === true && item.executableOwner === "ops"));
  assert.deepEqual(matrix.productChannels.map(item => item.id), [
    "node-launcher", "node-server", "browser-page", "browser-subresource",
    "browser-dedicated-worker", "browser-service-worker", "browser-websocket",
  ]);
  assert.ok(matrix.productChannels.every(item => item.required === true && item.observerPositiveControl === "qa-loopback-fixture"));
  assert.deepEqual(matrix.dailyFlow, ["entry", "edit", "save", "reload", "backup", "restore", "exchange"]);
  return matrix;
}

export function validateA08ToolReview(review) {
  assert.equal(review.status, "QA_TOOL_REVIEW_PASS");
  assert.equal(review.actualRulesApplied, false, "tool review must not apply real firewall rules");
  for (const name of ["opsRoot", "evidenceRoot", "nodeExecutable", "chromeExecutable", "edgeExecutable"]) {
    assert.ok(path.isAbsolute(review.paths[name]), `${name} must be absolute`);
  }
  assert.equal(review.paths.commonExecutableUsed, false);
  assert.equal(review.paths.personalProfileUsed, false);
  assert.equal(review.paths.reparseOrSymlinkAccepted, false);
  assert.equal(review.environment.activeEnvRead, false);
  assert.equal(review.environment.databaseUsed, false);
  assert.equal(review.environment.companyApiUsed, false);
  assert.equal(review.environment.lanListenerOpened, false);
  assert.equal(review.safety.fixedHashesVerified, true);
  assert.equal(review.safety.realpathsVerified, true);
  assert.equal(review.safety.ancestorReparseRejected, true);
  assert.equal(review.safety.processOwnershipVerified, true);
  assert.equal(review.safety.ruleOwnershipVerified, true);
  assert.equal(review.safety.partialFailureCleanupTested, true);
  assert.equal(review.safety.timeoutCleanupTested, true);
  assert.equal(review.safety.unknownResourcePreserved, true);
  assert.equal(review.cleanup.ownedResourcesRemaining, 0);
  return review;
}

export function validateA08FormalEvidence(matrix, evidence) {
  validateA08Matrix(matrix);
  assert.equal(evidence.candidate.zipSha256, matrix.candidate.zipSha256);
  assert.equal(evidence.candidate.packetSha256, matrix.candidate.packetSha256);
  assert.match(evidence.destination.host, /^(?!127\.|localhost$|0\.0\.0\.0$).+/i, "positive control must be non-loopback");
  assert.equal(evidence.destination.port, matrix.externalControl.port);
  assert.equal(evidence.destination.host, matrix.externalControl.destination);
  for (const phase of PHASES) {
    assert.equal(evidence.external[phase].destination, evidence.destination.host);
    assert.equal(evidence.external[phase].port, evidence.destination.port);
    assert.equal(evidence.loopback[phase].origin, matrix.loopback.origin);
    assert.equal(evidence.loopback[phase].success, true, `loopback must work during ${phase}`);
  }
  assert.equal(evidence.external["pre-success"].success, true);
  assert.equal(evidence.external["during-deny"].success, false);
  assert.equal(evidence.external["during-deny"].enforcedBy, "windows-firewall-owned-rules");
  assert.equal(evidence.external["post-success"].success, true);
  for (const executable of matrix.networkControlExecutables) {
    const result = evidence.networkControl[executable.id];
    assert.ok(result, `network control missing: ${executable.id}`);
    assert.equal(result.pre, "SUCCESS");
    assert.equal(result.during, "DENIED_BY_OWNED_RULE");
    assert.equal(result.post, "SUCCESS");
    assert.match(result.executableSha256, SHA);
    assert.equal(result.ownedExecutable, true);
  }
  const validProductStatuses = new Set(["OBSERVED_NO_EXTERNAL_EVENT", "OBSERVED_EXTERNAL_DENIED_BY_OWNED_RULE", "NOT_USED_WITH_OBSERVER_PROOF"]);
  for (const channel of matrix.productChannels) {
    const result = evidence.productChannels[channel.id];
    assert.ok(result, `product channel evidence missing: ${channel.id}`);
    assert.ok(validProductStatuses.has(result.status), `invalid product channel status: ${channel.id}`);
    assert.equal(result.observerPositiveControl, true);
    assert.match(result.observationStartedAt, /^\d{4}-\d\d-\d\dT/);
    assert.match(result.observationEndedAt, /^\d{4}-\d\d-\d\dT/);
    assert.ok(Array.isArray(result.events));
    if (result.status === "OBSERVED_EXTERNAL_DENIED_BY_OWNED_RULE") assert.ok(result.events.some(event => event.enforcedBy === "windows-firewall-owned-rules"));
  }
  for (const step of matrix.dailyFlow) assert.equal(evidence.dailyFlow[step], "PASS");
  assert.equal(evidence.dailyFlow.oracle, "QA_INDEPENDENT");
  for (const item of matrix.cleanup) assert.equal(evidence.cleanup[item], true, `cleanup missing: ${item}`);
  assert.equal(evidence.cleanup.ownedRulesRemaining, 0);
  assert.equal(evidence.cleanup.ownedProcessesRemaining, 0);
  return evidence;
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
