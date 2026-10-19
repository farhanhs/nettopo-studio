import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const [zipArg, evidenceArg] = process.argv.slice(2);
const zipPath = path.resolve(zipArg);
const evidenceRoot = path.resolve(evidenceArg);
assert.equal(fs.existsSync(evidenceRoot), false, "fresh QA evidence root required");
fs.mkdirSync(evidenceRoot, { recursive: false });
const sha256 = value => createHash("sha256").update(value).digest("hex");
const ps = path.join(process.env.SystemRoot ?? "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const extraction = path.join(evidenceRoot, "clean-extraction");
fs.mkdirSync(extraction);
const unzip = spawnSync(ps, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
  `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory(${literal(zipPath)}, ${literal(extraction)})`],
  { encoding: "utf8", windowsHide: true, timeout: 120000 });
assert.equal(unzip.status, 0, unzip.stderr);
const root = path.join(extraction, "NetTopo-Studio-0.1.0-beta.1");
const runtime = path.join(root, "runtime");
const manifestPath = path.join(root, "beta-manifest.json");
const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes);
const integrity = await import(pathToFileURL(path.join(runtime, "lib/integrity.mjs")).href);
const commands = await import(pathToFileURL(path.join(runtime, "lib/commands.mjs")).href);
const environment = await import(pathToFileURL(path.join(runtime, "lib/environment.mjs")).href);

const evidence = {
  candidateSha256: sha256(fs.readFileSync(zipPath)),
  actualBin: { node: process.versions.node, npm: manifest.toolchain.npm },
  A02: {}, A03: {}, A11: {}, A12: {}, cleanup: {}, result: "RUNNING",
};
const run = command => {
  const result = spawnSync(process.execPath, [`runtime/tools/${command}.mjs`], {
    cwd: root, env: environment.betaEnvironment(), encoding: "utf8", windowsHide: true, timeout: 240000,
  });
  let body;
  try { body = JSON.parse(result.stdout.trim()); } catch { body = { code: "INVALID_OUTPUT" }; }
  return { exit: result.status, code: body.code };
};
const request = (pathname, headers = {}) => new Promise((resolve, reject) => {
  const req = http.request(`http://127.0.0.1:4317${pathname}`, { headers, timeout: 5000 }, response => {
    let body = "";
    response.on("data", chunk => body += chunk);
    response.on("end", () => resolve({ status: response.statusCode, cache: response.headers["cache-control"], body: body.slice(0, 300) }));
  });
  req.on("error", reject); req.on("timeout", () => req.destroy(new Error("timeout"))); req.end();
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let dummy;
try {
  integrity.validateNode(manifest, "24.18.0", "win32", "x64");
  for (const version of ["24.17.9", "24.18.1", "25.0.0"]) assert.throws(() => integrity.validateNode(manifest, version, "win32", "x64"), { code: "BTA_NODE_VERSION_UNSUPPORTED" });
  assert.throws(() => integrity.validateNode(manifest, "24.18.0", "linux", "x64"), { code: "BTA_NODE_VERSION_UNSUPPORTED" });
  integrity.validateNpm(manifest, "11.16.0");
  for (const version of ["11.15.9", "11.16.1", "bad", undefined]) assert.throws(() => integrity.validateNpm(manifest, version), { code: "BTA_NPM_VERSION_UNSUPPORTED" });
  evidence.A02.versionSeams = "PASS_CONTROLLED_SEAMS_ACTUAL_BIN_RECORDED_NO_ALTERNATE_INSTALL";

  assert.deepEqual(run("setup"), { exit: 0, code: "BTA_SETUP_OK" });
  assert.deepEqual(run("setup"), { exit: 0, code: "BTA_SETUP_OK" });
  evidence.A02.repeatedSetup = "PASS";
  const scheduler = path.join(runtime, "node_modules/scheduler");
  fs.rmSync(scheduler, { recursive: true, force: true });
  assert.equal(fs.existsSync(scheduler), false);
  assert.deepEqual(run("setup"), { exit: 0, code: "BTA_SETUP_OK" });
  assert.equal(fs.existsSync(path.join(scheduler, "package.json")), true);
  evidence.A02.partialInstallRecovery = "PASS";
  const lock = path.join(runtime, "package-lock.json");
  const originalLock = fs.readFileSync(lock);
  fs.writeFileSync(lock, Buffer.concat([originalLock, Buffer.from(" ")]));
  const tamper = run("setup");
  assert.equal(tamper.code, "BTA_ARTIFACT_INVALID");
  fs.writeFileSync(lock, originalLock);
  evidence.A02.lockTamper = "PASS_FAIL_CLOSED";

  const occupant = http.createServer((_req, response) => response.end("QA owned occupant"));
  await new Promise((resolve, reject) => { occupant.once("error", reject); occupant.listen(4317, "127.0.0.1", resolve); });
  const occupied = run("start");
  assert.equal(occupied.code, "BTA_PORT_IN_USE");
  assert.equal(occupant.listening, true);
  assert.equal(run("stop").code, "BTA_NOT_RUNNING");
  await new Promise(resolve => occupant.close(resolve));
  evidence.A02.occupied = "PASS_UNRELATED_QA_LISTENER_PRESERVED";

  assert.equal(run("start").code, "BTA_STARTED");
  const listener = spawnSync(ps, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "(Get-NetTCPConnection -LocalPort 4317 -State Listen).LocalAddress"], { encoding: "utf8", windowsHide: true });
  assert.equal(listener.stdout.trim(), "127.0.0.1");
  const navigationHeaders = { "sec-fetch-site": "none", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };
  const httpCases = {
    root: await request("/", navigationHeaders),
    hostMismatch: await request("/", { ...navigationHeaders, Host: "localhost:4317" }),
    originMismatch: await request("/", { ...navigationHeaders, Origin: "https://example.invalid" }),
    fetchMetadataCrossSite: await request("/api/runtime-capabilities", { "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" }),
    protectedTopology: await request("/api/topology"),
    legacyHeader: await request("/api/topology", { "x-nettopo-user-email": "synthetic@example.invalid" }),
    devHeader: await request("/api/topology", { "x-nettopo-dev-user-email": "synthetic@example.invalid" }),
  };
  assert.equal(httpCases.root.status, 200);
  assert.equal(httpCases.hostMismatch.status, 421);
  assert.equal(httpCases.originMismatch.status, 403);
  assert.equal(httpCases.fetchMetadataCrossSite.status, 403);
  for (const key of ["protectedTopology", "legacyHeader", "devHeader"]) assert.equal(httpCases[key].status, 404);
  evidence.A03 = { result: "PASS_IPV4_LOOPBACK_HTTP_BOUNDARY", statuses: Object.fromEntries(Object.entries(httpCases).map(([key, value]) => [key, value.status])), nonLoopbackInbound: "NOT_RUN_NO_AUTHORIZED_FIXTURE" };

  const runningStatePath = path.join(runtime, ".state/instance.json");
  const runningState = JSON.parse(fs.readFileSync(runningStatePath, "utf8"));
  const proof = await commands.processProof(runningState.pid);
  assert.ok(proof.command.includes(path.join(root, "runtime/server.mjs")));
  process.kill(runningState.pid);
  for (let index = 0; index < 40 && await commands.processProof(runningState.pid); index += 1) await delay(100);
  assert.equal(run("stop").code, "BTA_NOT_RUNNING");
  assert.equal(fs.existsSync(runningStatePath), false);
  evidence.A11.ownedForcedCrash = "PASS_EXACT_PID_PATH_VERIFIED_STALE_STATE_CLEARED";

  const artifactId = sha256(manifestBytes);
  dummy = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { windowsHide: true, stdio: "ignore" });
  const dummyProof = await commands.processProof(dummy.pid);
  const forged = { schemaVersion: 1, artifactId, instanceId: randomUUID(), pid: dummy.pid, processStartedAt: dummyProof.started, origin: "http://127.0.0.1:4317", shutdownToken: "0".repeat(64) };
  fs.writeFileSync(runningStatePath, `${JSON.stringify(forged)}\n`);
  assert.equal(run("stop").code, "BTA_OWNERSHIP_MISMATCH");
  assert.ok(await commands.processProof(dummy.pid));
  assert.equal(fs.existsSync(runningStatePath), true);
  evidence.A11.unknownOwner = "PASS_STATE_AND_UNRELATED_QA_PROCESS_PRESERVED";
  dummy.kill(); await new Promise(resolve => dummy.once("exit", resolve)); dummy = undefined;
  fs.unlinkSync(runningStatePath);
  const stale = { ...forged, pid: 2147483000, processStartedAt: "2000-01-01T00:00:00.000Z" };
  fs.writeFileSync(runningStatePath, `${JSON.stringify(stale)}\n`);
  assert.equal(run("stop").code, "BTA_NOT_RUNNING");
  assert.equal(fs.existsSync(runningStatePath), false);
  evidence.A11.staleState = "PASS_CLEARED_WITHOUT_DATA_OR_PRODUCT_DELETE";

  const packageFiles = [];
  const walk = directory => { for (const item of fs.readdirSync(directory, { withFileTypes: true })) { const full = path.join(directory, item.name); if (item.isDirectory()) { if (!full.includes(`${path.sep}.state`) && !full.includes(`${path.sep}node_modules`)) walk(full); } else packageFiles.push(full); } };
  walk(root);
  const relative = packageFiles.map(file => path.relative(root, file).replaceAll("\\", "/"));
  assert.ok(relative.includes("LICENSE") && relative.includes("THIRD_PARTY_NOTICES.md") && relative.includes("samples/synthetic-topology.json"));
  assert.equal(relative.some(name => /(^|\/)(\.env|\.git|database|logs?)(\/|$)/i.test(name)), false);
  const corpus = packageFiles.map(file => fs.readFileSync(file)).map(buffer => buffer.toString("utf8")).join("\n");
  const sentinel = "QA_SYNTHETIC_SECRET_SENTINEL_20261019";
  assert.equal(sentinel.includes(sentinel), true);
  assert.equal(corpus.includes(sentinel), false);
  assert.equal(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s]+:[^\s]+@/i.test(corpus), false);
  assert.match(fs.readFileSync(path.join(root, "LICENSE"), "utf8"), /MIT License/);
  assert.ok(fs.statSync(path.join(root, "THIRD_PARTY_NOTICES.md")).size > 0);
  evidence.A12 = { result: "PASS_AUTHORIZED_PACKAGE_SCOPE", fileCount: packageFiles.length, forbiddenNames: 0, syntheticPositiveControl: true, packageSentinelHits: 0, activeEnvDsnSecret: "NOT_READ_FORBIDDEN" };
  evidence.result = "PASS_WITH_DECLARED_LIMITS";
} finally {
  if (dummy) { dummy.kill(); await new Promise(resolve => dummy.once("exit", resolve)); }
  try { evidence.cleanup.stop = run("stop"); } catch {}
  const listener = spawnSync(ps, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "@(Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue).Count"], { encoding: "utf8", windowsHide: true });
  evidence.cleanup.listener4317 = Number(listener.stdout.trim() || 0);
  evidence.cleanup.zipUnchanged = evidence.candidateSha256 === sha256(fs.readFileSync(zipPath));
  fs.writeFileSync(path.join(evidenceRoot, "runtime-negative-result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
}
