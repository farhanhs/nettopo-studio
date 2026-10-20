import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const PHASES = new Set(["pre-success", "during-deny", "post-success"]);
const SHA = /^[0-9a-f]{64}$/;

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    assert.match(argv[i] ?? "", /^--[a-z-]+$/);
    assert.ok(argv[i + 1], `missing value for ${argv[i]}`);
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

export function validateRunnerConfig(config) {
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.candidate.zipSha256, "4c04dc3de0efb121932ff601ab2afb03a6b2b82e60958643e388fe807bd9195a");
  assert.equal(config.externalControl.host, "example.com");
  assert.equal(config.externalControl.port, 443);
  assert.equal(config.externalControl.scheme, "https");
  assert.equal(config.externalControl.path, "/");
  assert.equal(config.externalControl.method, "HEAD");
  assert.equal(config.externalControl.timeoutMs <= 5000, true);
  assert.equal(config.externalControl.maxAttemptsPerExecutablePerPhase, 1);
  assert.equal(config.externalControl.allowRedirects, false);
  assert.equal(config.externalControl.rejectPrivateOrLinkLocalDns, true);
  assert.equal(config.externalControl.credentials, false);
  for (const item of Object.values(config.fixture.executables)) assert.match(item.sha256, SHA);
  return config;
}

const sha256 = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const safeRunId = value => assert.match(value, /^[a-z0-9][a-z0-9-]{0,63}$/);

function resolveOwned(root, relative) {
  const target = path.resolve(root, relative);
  assert.equal(path.relative(root, target).startsWith(".."), false, `path escapes fixture: ${relative}`);
  return target;
}

function startObserver() {
  const events = [];
  const server = http.createServer((request, response) => {
    events.push({ kind: "http", path: request.url, method: request.method });
    if (request.url === "/page") { response.setHeader("content-type", "text/html; charset=utf-8"); return response.end("<!doctype html><title>QA A08 observer</title>"); }
    if (request.url === "/worker.js") { response.setHeader("content-type", "application/javascript; charset=utf-8"); return response.end("fetch('/worker-hit').then(()=>postMessage('worker-ok'))"); }
    if (request.url === "/sw.js") { response.setHeader("content-type", "application/javascript; charset=utf-8"); return response.end("self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',()=>{});"); }
    if (request.url === "/pixel") { response.writeHead(204); return response.end(); }
    response.setHeader("content-type", "text/plain"); response.end("ok");
  });
  server.on("upgrade", (request, socket) => {
    const key = request.headers["sec-websocket-key"];
    const accept = crypto.createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    events.push({ kind: "websocket", path: request.url }); socket.end();
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ server, events, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function positiveControl(playwright, executablePath, profile, origin) {
  const context = await playwright.chromium.launchPersistentContext(profile, { executablePath, headless: true, serviceWorkers: "allow",
    proxy: { server: "direct://" },
    args: ["--disable-background-networking", "--no-first-run", "--no-proxy-server", "--proxy-bypass-list=*"] });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(`${origin}/page`, { waitUntil: "domcontentloaded" });
    const result = await page.evaluate(async base => {
      await fetch(`${base}/subresource`);
      await new Promise((resolve, reject) => { const worker = new Worker(`${base}/worker.js`); worker.onmessage = resolve; worker.onerror = reject; });
      const registration = await navigator.serviceWorker.register(`${base}/sw.js`); await navigator.serviceWorker.ready; await fetch(`${base}/pixel`); await registration.unregister();
      await new Promise((resolve, reject) => { const ws = new WebSocket(base.replace("http", "ws") + "/socket"); ws.onopen = () => { ws.close(); resolve(); }; ws.onerror = reject; });
      return true;
    }, origin);
    assert.equal(result, true);
  } finally { await context.close(); }
}

async function runDailyOracle({ node, browser, playwright, packageRoot, fixtureRoot, evidenceRoot }) {
  const integrity = await import(pathToFileURL(path.join(packageRoot, "runtime/lib/integrity.mjs")).href);
  await integrity.verifySetup(packageRoot);
  const runner = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1")), "r3-deep-runner.mjs");
  const result = spawnSync(node, [runner, playwright, packageRoot, fixtureRoot, evidenceRoot, browser, node], {
    encoding: "utf8", windowsHide: true, timeout: 300000,
    env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, PATH: path.dirname(node) },
  });
  assert.equal(result.status, 0, `daily oracle failed: ${(result.stderr || result.stdout).slice(0, 1000)}`);
  return JSON.parse(fs.readFileSync(path.join(evidenceRoot, "deep-result.json"), "utf8"));
}

export async function run(options) {
  const phase = options.phase; assert.ok(PHASES.has(phase)); safeRunId(options.runId);
  const configPath = path.resolve(options.config); const workspace = path.resolve(path.dirname(configPath), "../..");
  const config = validateRunnerConfig(JSON.parse(fs.readFileSync(configPath, "utf8")));
  const evidenceRoot = path.resolve(options.evidenceRoot); assert.equal(fs.existsSync(evidenceRoot), false); fs.mkdirSync(evidenceRoot, { recursive: false });
  const fixtureRoot = resolveOwned(workspace, config.fixture.relativeRoot);
  const packageRoot = resolveOwned(fixtureRoot, config.fixture.packageRelativeRoot);
  const executables = Object.fromEntries(Object.entries(config.fixture.executables).map(([id, item]) => {
    const file = resolveOwned(fixtureRoot, item.relativePath); assert.equal(sha256(file), item.sha256, `${id} hash mismatch`); return [id, file];
  }));
  const playwrightModule = await import(pathToFileURL(path.resolve(options.playwright)).href);
  const playwright = playwrightModule.chromium ? playwrightModule : playwrightModule.default;
  const observer = await startObserver();
  const evidence = { schemaVersion: 1, status: "RUNNING", phase, runId: options.runId, candidate: config.candidate,
    observer: { origin: observer.origin, nodeFixtureSanity: false, events: [], chrome: false, edge: false }, dailyFlow: { status: "NOT_RUN", reason: "only required during active-rule phase" }, cleanup: {} };
  try {
    const sanity = await fetch(`${observer.origin}/fixture-sanity`);
    assert.equal(sanity.status, 200, "QA loopback fixture failed before Browser launch");
    evidence.observer.nodeFixtureSanity = true;
    for (const id of ["chrome", "edge"]) {
      await positiveControl(playwright, executables[id], path.join(evidenceRoot, `${id}-profile`), observer.origin);
      evidence.observer[id] = true;
    }
    evidence.observer.events = observer.events;
    const required = ["/page", "/subresource", "/worker.js", "/worker-hit", "/sw.js", "/pixel"];
    for (const item of required) assert.ok(observer.events.some(event => event.path === item), `observer missing ${item}`);
    assert.ok(observer.events.some(event => event.kind === "websocket"));
    if (phase === "during-deny") {
      const outcomes = {};
      for (const id of ["chrome", "edge"]) outcomes[id] = await runDailyOracle({ node: executables.node, browser: executables[id], playwright: path.resolve(options.playwright), packageRoot,
        fixtureRoot: path.resolve(options.fixtureRoot), evidenceRoot: path.join(evidenceRoot, `daily-${id}`) });
      evidence.dailyFlow = { status: "PASS", oracle: "r3-deep-runner", outcomes };
    }
    evidence.status = "QA_CHANNEL_RUNNER_PASS_NOT_A08_ACCEPTANCE";
    return evidence;
  } catch (error) {
    evidence.status = "QA_CHANNEL_RUNNER_FAIL";
    evidence.failure = String(error?.stack ?? error).slice(0, 4000);
    throw error;
  } finally {
    await new Promise(resolve => observer.server.close(resolve)); evidence.cleanup.observerClosed = true;
    fs.writeFileSync(path.join(evidenceRoot, "qa-channel-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const name of ["config", "phase", "run-id", "evidence-root", "playwright", "fixture-root"]) assert.ok(args[name], `--${name} is required`);
  await run({ config: args.config, phase: args.phase, runId: args["run-id"], evidenceRoot: args["evidence-root"], playwright: args.playwright, fixtureRoot: args["fixture-root"] });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
