import assert from "node:assert/strict";
import { lstat, realpath } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test from "node:test";

import { isolatedEnvironment, repoRoot } from "../scripts/qa-env/environment.mjs";
import { runNativeLifecycle } from "../scripts/qa-env/native-lifecycle.mjs";

const candidatePaths = [
  "scripts/qa-env/cli.mjs",
  "scripts/qa-env/environment.mjs",
  "scripts/qa-env/native-lifecycle.mjs",
  "scripts/qa-env/policy.json",
  "tests/ops-env-001-guardrails.test.mjs",
  "tests/ops-env-001-native-lifecycle.test.mjs",
  "package.json",
  "package-lock.json",
];

async function isPortClosed(port) {
  return await new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const finish = (closed) => {
      socket.destroy();
      resolve(closed);
    };
    socket.setTimeout(500, () => finish(true));
    socket.once("connect", () => finish(false));
    socket.once("error", () => finish(true));
  });
}

function isPidStopped(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error?.code === "ESRCH" || error?.code === "EINVAL";
  }
}

test("QA_ENV_001 candidate paths are contained regular files without reparse traversal", async () => {
  const root = await realpath(repoRoot);
  for (const relative of candidatePaths) {
    const absolute = path.join(root, relative);
    const resolved = await realpath(absolute);
    const stat = await lstat(absolute);
    assert.equal(resolved.startsWith(`${root}${path.sep}`), true, relative);
    assert.equal(stat.isFile(), true, relative);
    assert.equal(stat.isSymbolicLink(), false, relative);
  }
});

test("QA_ENV_001 OS allowlist drops DB, auth, proxy, preload, Docker and arbitrary sentinels", () => {
  const sentinel = "QA_ENV_001_SECRET_SENTINEL";
  const source = Object.freeze({
    Path: "qa-os-path",
    SystemRoot: "qa-system-root",
    TEMP: "qa-temp",
    DATABASE_URL: sentinel,
    MIGRATION_DATABASE_URL: sentinel,
    DUS_AUTH_CLIENT_SECRET: sentinel,
    NODE_OPTIONS: `--require ${sentinel}`,
    PGHOST: sentinel,
    PGPASSFILE: sentinel,
    DOCKER_HOST: sentinel,
    COMPOSE_FILE: sentinel,
    HTTP_PROXY: sentinel,
    HTTPS_PROXY: sentinel,
    HOME: sentinel,
    USERPROFILE: sentinel,
    NETTOPO_RUNTIME_PROFILE: sentinel,
    QA_UNRELATED_SECRET: sentinel,
  });
  const isolated = isolatedEnvironment(source);
  assert.deepEqual(isolated, {
    Path: "qa-os-path",
    SystemRoot: "qa-system-root",
    TEMP: "qa-temp",
    TZ: "UTC",
    LANG: "C",
    LC_ALL: "C",
    NO_COLOR: "1",
  });
  assert.equal(JSON.stringify(isolated).includes(sentinel), false);
  assert.equal(source.DATABASE_URL, sentinel);
});

for (const scenario of ["normal", "failure", "timeout"]) {
  test(`QA_ENV_001 ENV-06 ${scenario} independently proves owned cleanup and recovery`, async () => {
    const report = await runNativeLifecycle(scenario);
    assert.equal(report.ticket, "OPS_ENV_001");
    assert.match(report.runId, /^ops-env-001-\d+-[a-f0-9]{8}$/);
    assert.equal(report.scenario, scenario);
    assert.equal(report.port === 5432, false);
    assert.equal(report.port > 0 && report.port < 65536, true);
    assert.equal(Number.isInteger(report.expectedPid), true);
    assert.equal(report.cleanup, "complete");
    assert.equal(report.portsClosed, true);
    assert.equal(report.directoryRemoved, true);
    assert.equal(await isPortClosed(report.port), true);
    assert.equal(isPidStopped(report.expectedPid), true);
    await assert.rejects(lstat(report.dataDir), (error) => error?.code === "ENOENT");

    if (scenario === "normal") {
      assert.equal(report.status, "PASS");
      assert.equal(report.failureCode, null);
    } else if (scenario === "failure") {
      assert.equal(report.status, "FAILED");
      assert.equal(report.failureCode, "CONTROLLED_INIT_FAILURE");
      assert.equal(report.failureMessage, "Controlled fixture failure.");
      assert.match(report.postgresLog, /database system is ready to accept connections/);
    } else {
      assert.equal(report.status, "FAILED");
      assert.equal(report.failureCode, "READINESS_TIMEOUT");
      assert.equal(report.failureMessage, undefined);
    }

    const serialized = JSON.stringify(report);
    assert.doesNotMatch(serialized, /password|secret|token|cookie|database_url|postgres(?:ql)?:\/\//i);
    console.log(JSON.stringify({
      scenario,
      runId: report.runId,
      port: report.port,
      expectedPid: report.expectedPid,
      status: report.status,
      failureCode: report.failureCode,
      cleanup: report.cleanup,
      portsClosed: report.portsClosed,
      directoryRemoved: report.directoryRemoved,
    }));
  });
}
