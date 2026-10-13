import { randomBytes } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { isolatedEnvironment, policy } from "./environment.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const postgresBin = path.join(repoRoot, policy.nativePostgresRelativePath.replace(/postgres\.exe$/, ""));
const runRoot = path.join(repoRoot, ".local", "ops-env-001-runs");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  if (port === 5432) return reservePort();
  return port;
}

async function waitForReady(isReady, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isReady()) return true;
    await sleep(50);
  }
  const error = new Error("Owned native PostgreSQL readiness timed out.");
  throw error;
}

async function portClosed(port) {
  return await new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const finish = (closed) => { socket.destroy(); resolve(closed); };
    socket.setTimeout(400, () => finish(true));
    socket.once("connect", () => finish(false));
    socket.once("error", () => finish(true));
  });
}

async function stopOwned(child, expectedPid, dataDir) {
  if (!child) return;
  if (child.pid !== expectedPid) throw new Error("Owned native PostgreSQL PID changed; cleanup refused.");
  if (child.exitCode === null && child.signalCode === null) {
    await execFileAsync(path.join(postgresBin, "pg_ctl.exe"), ["-D", dataDir, "stop", "-m", "immediate", "-w", "-t", "5"], { cwd: repoRoot, env: isolatedEnvironment(), windowsHide: true, timeout: 7000, maxBuffer: 4096 }).catch(() => undefined);
  }
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), sleep(5000)]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), sleep(5000)]);
  if (child.exitCode === null && child.signalCode === null) throw new Error("Owned native PostgreSQL did not exit.");
}

export async function runNativeLifecycle(scenario = "normal") {
  if (!["normal", "failure", "timeout"].includes(scenario)) throw new Error("Unknown native lifecycle scenario.");
  const runId = `ops-env-001-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const directory = path.join(runRoot, runId);
  const dataDir = path.join(directory, "postgres-data");
  const port = await reservePort();
  const report = { ticket: "OPS_ENV_001", phase: "native-lifecycle", runId, scenario, port, dataDir, expectedPid: null, status: "FAILED", cleanup: "pending", portsClosed: false, directoryRemoved: false, failureCode: null };
  let child;
  const stderr = [];
  try {
    await mkdir(directory, { recursive: true });
    await execFileAsync(path.join(postgresBin, "initdb.exe"), ["-D", dataDir, "--auth=trust", "--username=postgres", "--encoding=UTF8", "--locale=C", "--no-instructions"], { cwd: repoRoot, env: isolatedEnvironment(), windowsHide: true, timeout: 15000 });
    child = spawn(path.join(postgresBin, "postgres.exe"), ["-D", dataDir, "-p", String(port), "-h", "127.0.0.1"], { cwd: repoRoot, env: isolatedEnvironment(), windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    child.stderr.on("data", (chunk) => stderr.push(String(chunk)));
    report.expectedPid = child.pid;
    if (scenario === "timeout") {
      try { await waitForReady(() => stderr.join("").includes("database system is ready to accept connections"), 1); } catch { report.failureCode = "READINESS_TIMEOUT"; }
      if (!report.failureCode) throw new Error("Timeout scenario unexpectedly became ready.");
    } else {
      await waitForReady(() => stderr.join("").includes("database system is ready to accept connections"), 15000);
      if (scenario === "failure") { report.failureCode = "CONTROLLED_INIT_FAILURE"; throw Object.assign(new Error("Controlled fixture failure."), { code: report.failureCode }); }
      report.status = "PASS";
    }
  } catch (error) {
    report.failureCode ??= error?.code ?? (scenario === "timeout" ? "READINESS_TIMEOUT" : "FIXTURE_FAILURE");
    report.failureMessage = String(error?.message ?? "fixture failed").split(/\r?\n/, 1)[0].slice(0, 240);
    if (stderr.length) report.postgresLog = stderr.join("").split(/\r?\n/).filter(Boolean).slice(-3).join(" | ").slice(0, 600);
  } finally {
    try { await stopOwned(child, report.expectedPid, dataDir); } catch (error) { report.cleanupError = error?.message ?? "stop failed"; }
    report.portsClosed = await portClosed(port);
    let removeError;
    for (let attempt = 0; attempt < 20 && existsSync(directory); attempt += 1) {
      try { await rm(directory, { recursive: true, force: false }); } catch (error) { removeError = error; }
      if (existsSync(directory)) await sleep(100);
    }
    if (existsSync(directory) && removeError) report.cleanupError ??= removeError.message ?? "remove failed";
    report.directoryRemoved = !existsSync(directory);
    report.cleanup = !report.cleanupError && report.portsClosed && report.directoryRemoved ? "complete" : "failed";
    if (report.cleanup !== "complete") report.status = "FAILED";
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runNativeLifecycle(process.argv[2] ?? "normal");
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "PASS" || (result.scenario !== "normal" && result.cleanup === "complete") ? 0 : 1;
}
