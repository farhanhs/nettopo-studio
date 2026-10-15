import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { validateProject } from "../app/lib/topology-validation.ts";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(root, "docs", "dev開發紀錄", "2026-10-14-dev-ntm-004-proj-r1-manifest.json");
const summaryPath = path.join(root, "docs", "dev測試紀錄", "qa-ntm-004-browser-summary.json");
const historyPath = path.join(root, "docs", "dev測試紀錄", "qa-ntm-004-browser-history.json");
const screenshotRoot = path.join(root, "docs", "dev測試紀錄", "screenshots");
const runId = `qa-ntm-004-${randomUUID()}`;
const ownedRoot = path.join(root, ".local", runId);
const mirror = path.join(ownedRoot, "project");
const ownedFontRoot = path.join(mirror, ".vinext", "fonts");
const manifestSha = createHash("sha256").update(fs.readFileSync(manifestPath)).digest("hex");
assert.equal(manifestSha, "ba766b4e68c1dd621a9e6ea2322eb67cd80a2021492221b638f2dcb02ee86c31");

const locked = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(locked.writerStopped, true);
for (const [relative, expected] of Object.entries(locked.fileHashes)) {
  const actual = createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex");
  assert.equal(actual, expected, `Candidate changed before Browser QA: ${relative}`);
}

const sourceV2Fixture = JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", "qa-ntm-001", "valid-project-v2.json"), "utf8"));
const sourceProject = {
  devices: sourceV2Fixture.devices.map(({ id, name, type, ip, mac, model, location, url, quantity, x, y, groupId }) => ({ id, name, type, ip, mac, model, location, url, quantity, x, y, groupId })),
  links: sourceV2Fixture.links.map(({ id, from, to, kind, fromPort, toPort, vlan, speed }) => ({ id, from, to, kind, fromPort, toPort, vlan, speed })),
  groups: sourceV2Fixture.groups,
};
const otherProject = {
  devices: [{ id: "other-device", name: "QA_NTM_004_HIDDEN_OTHER_TOPOLOGY", type: "switch", quantity: 1, x: 40, y: 40 }],
  links: [], groups: [],
};
validateProject(sourceProject);
validateProject(otherProject);
const fixtureTimestamp = "2026-10-14T00:00:00.000Z";
const topologyRecords = [
  { id: "qa-ntm-004-main", customerId: "qa-ntm-004-c", name: "QA trusted projection", project: sourceProject, createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp },
  { id: "qa-ntm-004-other", customerId: "qa-ntm-004-c", name: "QA other topology", project: otherProject, createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp },
];
for (const record of topologyRecords) assert.deepEqual(Object.keys(record).sort(), ["createdAt", "customerId", "id", "name", "project", "updatedAt"]);

fs.mkdirSync(mirror, { recursive: true });
fs.mkdirSync(screenshotRoot, { recursive: true });
const copiedHashes = {};
function copy(relative) {
  const source = path.join(root, relative);
  if (!fs.existsSync(source)) return;
  const stat = fs.lstatSync(source);
  assert.equal(stat.isSymbolicLink(), false, `Source symlink prohibited: ${relative}`);
  assert.doesNotMatch(path.basename(relative), /^\.env(?:\.|$)/i, `dotenv prohibited: ${relative}`);
  if (stat.isDirectory()) {
    fs.mkdirSync(path.join(mirror, relative), { recursive: true });
    for (const child of fs.readdirSync(source)) copy(path.join(relative, child));
    return;
  }
  const bytes = fs.readFileSync(source);
  copiedHashes[relative.replaceAll("\\", "/")] = createHash("sha256").update(bytes).digest("hex");
  fs.mkdirSync(path.dirname(path.join(mirror, relative)), { recursive: true });
  fs.writeFileSync(path.join(mirror, relative), bytes);
}

for (const relative of [
  "app", "db", "build", "worker", "public", "examples/sean-sie-spine-leaf-demo.json", "package.json", "package-lock.json", "tsconfig.json",
  "next-env.d.ts", "next.config.ts", "vite.config.ts", "postcss.config.mjs", "scripts/build-local.mjs",
  "scripts/preview-server.mjs", "scripts/validate-runtime-policy.mjs",
]) copy(relative);
assert.equal(Object.keys(copiedHashes).some((entry) => /(^|\/)\.env(?:\.|$)/i.test(entry)), false);

const dotenvGuard = path.join(ownedRoot, "deny-dotenv.cjs");
fs.writeFileSync(dotenvGuard, `const fs=require('node:fs');const path=require('node:path');const {fileURLToPath}=require('node:url');
function deny(p){if(p instanceof URL)p=fileURLToPath(p);if(typeof p==='string'&&/^\\.env(?:\\.|$)/i.test(path.basename(p)))throw new Error('QA_NTM_004_DOTENV_READ_DENIED');}
for(const n of ['readFileSync','readFile','openSync','open','createReadStream']){const f=fs[n];fs[n]=function(p,...a){deny(p);return f.call(this,p,...a);};}
for(const n of ['readFile','open']){const f=fs.promises[n];fs.promises[n]=function(p,...a){deny(p);return f.call(this,p,...a);};}
require('node:module').syncBuiltinESMExports();
`);

const passEnv = ["SystemRoot", "WINDIR", "PATH", "Path", "PATHEXT", "ComSpec", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA", "APPDATA"];
const safeEnv = Object.fromEntries(passEnv.filter((name) => process.env[name]).map((name) => [name, process.env[name]]));
const env = {
  ...safeEnv,
  NODE_OPTIONS: `--require="${dotenvGuard.replaceAll("\\", "/")}"`,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  NETTOPO_RUNTIME: "node",
  NETTOPO_RUNTIME_PROFILE: "test",
  NETTOPO_AUTH_MODE: "demo",
  NETTOPO_ENABLE_DEMO_SEED: "0",
  NETTOPO_ENABLE_DEV_IDENTITY_HEADER: "0",
  NEXT_PUBLIC_TOPOLOGY_STORAGE: "local",
  HOST: "127.0.0.1",
  NETTOPO_DEV_SESSION_SECRET: `${randomUUID()}${randomUUID()}`,
};

const summary = {
  ticket: "QA_NTM_004",
  runId,
  candidateManifestSha256: manifestSha,
  result: "NOT_RUN",
  phase: "PROJ-R1 V1 Browser",
  isolation: {
    sanitizedMirror: true,
    dotenvCopied: false,
    dotenvReadGuard: true,
    environmentAllowlist: true,
    bind: "127.0.0.1",
    freshBrowserContext: true,
    database: "NOT_STARTED",
    docker: "NOT_STARTED",
  },
  gates: {},
  viewports: [],
  screenshots: [],
  observations: [],
  cleanup: {},
  limitations: ["V2 persistence and area/focus breadcrumb Browser NOT RUN", "real DB/RBAC Browser NOT RUN", "anonymous UAT NOT RUN"],
};
summary.gates.v1SeedStrictSchemaAndRecordPreflight = "PASS";

function isOwnedMirrorFontPath(raw) {
  try {
    let candidate;
    if (raw.startsWith("file:")) candidate = fileURLToPath(new URL(raw));
    else {
      const decoded = decodeURIComponent(raw);
      candidate = /^[\\/][a-z]:[\\/]/i.test(decoded) ? decoded.slice(1) : decoded;
    }
    const absolute = path.resolve(path.normalize(candidate.replaceAll("/", path.sep)));
    const relative = path.relative(ownedFontRoot, absolute);
    return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative) && path.extname(absolute).toLowerCase() === ".woff2";
  } catch {
    return false;
  }
}
assert.equal(isOwnedMirrorFontPath(new URL(`file:///${path.join(ownedFontRoot, "probe.woff2").replaceAll("\\", "/")}`).href), true);
assert.equal(isOwnedMirrorFontPath(path.join(root, ".vinext", "fonts", "outside.woff2")), false);
assert.equal(isOwnedMirrorFontPath(`${ownedFontRoot.replaceAll("\\", "/")}/%2e%2e/%2e%2e/outside.woff2`), false);
summary.gates.ownedFontClassifierPreflight = "PASS";

function runNode(args, logName) {
  return new Promise((resolve, reject) => {
    const log = fs.openSync(path.join(ownedRoot, logName), "w");
    const child = spawn(process.execPath, args, { cwd: mirror, env, windowsHide: true, stdio: ["ignore", log, log] });
    child.once("error", reject);
    child.once("exit", (code) => {
      fs.closeSync(log);
      if (code === 0) resolve();
      else {
        const raw = fs.readFileSync(path.join(ownedRoot, logName), "utf8").slice(-4000);
        const safe = raw
          .replaceAll(root, "[WORKTREE]")
          .replaceAll(mirror, "[SANITIZED_MIRROR]")
          .replaceAll(env.NETTOPO_DEV_SESSION_SECRET, "[REDACTED_SESSION_SECRET]");
        summary.toolDiagnostics ??= {};
        summary.toolDiagnostics[logName] = safe;
        reject(new Error(`${logName} exited ${code}`));
      }
    });
  });
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]));
  return value;
}

async function snapshotTopologies(page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("nettopo-studio-db");
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const read = db.transaction("topologies", "readonly").objectStore("topologies").getAll();
    const rows = await new Promise((resolve, reject) => { read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error); });
    db.close();
    return rows;
  });
}

let browser;
let context;
let page;
let server;
let serverLog;
let port;
let contextClosed = false;
let browserClosed = false;
let previewStopped = false;
let portReleased = false;
try {
  fs.symlinkSync(path.join(root, "node_modules"), path.join(mirror, "node_modules"), "junction");
  await runNode(["-e", "require('node:fs').readFileSync('.env.qa-ntm-004')"], "dotenv-probe.log")
    .then(() => assert.fail("dotenv guard did not block"), (error) => assert.match(error.message, /dotenv-probe\.log exited/));
  await runNode(["scripts/validate-runtime-policy.mjs"], "policy.log");
  await runNode(["scripts/build-local.mjs"], "build.log");
  summary.gates.sanitizedBuild = "PASS";

  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  port = reservation.address().port;
  assert.notEqual(port, 5432);
  await new Promise((resolve) => reservation.close(resolve));

  serverLog = fs.openSync(path.join(ownedRoot, "preview.log"), "w");
  server = spawn(process.execPath, ["scripts/preview-server.mjs"], {
    cwd: mirror,
    env: { ...env, PORT: String(port) },
    windowsHide: true,
    stdio: ["ignore", serverLog, serverLog],
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  summary.resources = { previewPid: server.pid, port };
  let ready = false;
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      if ((await fetch(baseUrl, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; }
    } catch { /* owned preview is starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(ready, true, "Owned preview did not become ready");
  summary.gates.ownedLoopbackPreview = "PASS";

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: false, hasTouch: true });
  page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const mutationRequests = [];
  const responseBodies = [];
  page.on("console", (entry) => { if (entry.type() === "error") consoleErrors.push(entry.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${new URL(request.url()).pathname}`));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === baseUrl && url.pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) mutationRequests.push(`${request.method()} ${url.pathname}`);
  });
  page.on("response", async (response) => {
    const url = new URL(response.url());
    if (url.origin !== baseUrl || !url.pathname.startsWith("/api/")) return;
    try { responseBodies.push(await response.text()); } catch { /* response may have been disposed */ }
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ records, now }) => {
    const open = indexedDB.open("nettopo-studio-db", 10);
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const [name, keyPath, indexes] of [["customers", "id", ["name", "updatedAt"]], ["topologies", "id", ["customerId", "name", "updatedAt"]], ["meta", "key", []]]) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath });
          for (const index of indexes) store.createIndex(index, index);
        }
      }
    };
    const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    const tx = db.transaction(["customers", "topologies", "meta"], "readwrite");
    tx.objectStore("customers").put({ id: "qa-ntm-004-c", name: "QA synthetic customer", createdAt: now, updatedAt: now });
    for (const record of records) tx.objectStore("topologies").put(record);
    tx.objectStore("meta").put({ key: "activeCustomerId", value: "qa-ntm-004-c" });
    tx.objectStore("meta").put({ key: "activeTopologyId", value: "qa-ntm-004-main" });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    db.close();
  }, { records: topologyRecords, now: fixtureTimestamp });

  await page.getByRole("button", { name: "進入本機 Demo", exact: true }).click();
  const entry = page.getByRole("button", { name: "唯讀檢視", exact: true });
  await entry.waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => button.textContent === "唯讀檢視" && !button.disabled));
  await page.evaluate(() => {
    window.__qaNtm004Writes = [];
    for (const method of ["add", "put", "delete", "clear"]) {
      const original = IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method] = function (...args) {
        window.__qaNtm004Writes.push({ store: this.name, method });
        return original.apply(this, args);
      };
    }
  });
  const before = canonical(await snapshotTopologies(page));
  mutationRequests.length = 0;

  await entry.click();
  const reader = page.getByRole("region", { name: "可信網路唯讀檢視" });
  await reader.getByRole("heading", { name: /^項目/, level: 2 }).waitFor();
  assert.equal(await page.getByText("QA_NTM_004_HIDDEN_OTHER_TOPOLOGY", { exact: true }).count(), 0);
  assert.ok(await reader.locator('[data-entity-type="device"]').count() >= 2);
  assert.equal(await reader.locator('[data-entity-type="interface"]').count(), 4);
  assert.ok(await reader.locator('[data-entity-type="physical-link"]').count() >= 2);
  await reader.getByText(/未核實/).first().waitFor();
  await reader.locator('[data-entity-type="interface"]').first().click();
  await reader.getByRole("heading", { name: "來源", exact: true }).waitFor();
  await reader.getByText("舊資料／未核實 · legacy-project", { exact: true }).waitFor();
  summary.gates.entryInventorySourceTrust = "PASS";

  await reader.getByRole("button", { name: "邏輯", exact: true }).tap();
  await reader.getByText("未記錄結構化邏輯關係", { exact: true }).waitFor();
  assert.equal(await reader.locator('[data-entity-type="interface-vlan"]').count(), 0);
  assert.equal(await reader.locator('[data-entity-type="interface-subnet"]').count(), 0);
  summary.gates.physicalLogicalSwitch = "PASS";

  const verifiedOnly = reader.getByRole("checkbox", { name: "僅顯示已核實" });
  await verifiedOnly.tap();
  await reader.getByRole("button", { name: "重設篩選" }).waitFor();
  await reader.getByText(/隱藏 \d+ 個項目/).waitFor();
  await reader.getByRole("button", { name: "重設篩選" }).tap();
  summary.gates.verifiedOnlyEmptyAndReset = "PASS";

  await reader.getByRole("button", { name: "實體", exact: true }).click();
  const search = reader.getByRole("searchbox");
  await search.fill("Switch");
  assert.equal(await reader.locator('[data-entity-type="device"]').count(), 1);
  await reader.locator('[data-entity-type="device"]').tap();
  await reader.getByRole("heading", { name: "Switch", exact: true }).waitFor();
  await search.fill("");
  const breadcrumb = reader.getByRole("navigation", { name: "網路路徑" });
  await breadcrumb.getByRole("button", { name: "拓樸", exact: true }).waitFor();
  await breadcrumb.getByRole("button", { name: "拓樸", exact: true }).click();
  summary.gates.searchListSelectionRootBreadcrumb = "PASS";
  summary.gates.simulatedTouchViewFilterList = "PASS";

  const physicalButton = reader.getByRole("button", { name: "實體", exact: true });
  const logicalButton = reader.getByRole("button", { name: "邏輯", exact: true });
  await physicalButton.focus();
  await page.keyboard.press("Tab");
  assert.equal(await logicalButton.evaluate((element) => element === document.activeElement), true);
  await page.keyboard.press("Shift+Tab");
  assert.equal(await physicalButton.evaluate((element) => element === document.activeElement), true);
  await logicalButton.focus();
  await page.keyboard.press("Enter");
  assert.equal(await logicalButton.getAttribute("aria-pressed"), "true");
  summary.gates.keyboardNavigation = "PASS";

  for (const [width, height] of [[1280, 900], [1024, 700], [768, 900], [360, 640], [700, 520]]) {
    await page.setViewportSize({ width, height });
    await reader.getByRole("heading", { name: /^項目/, level: 2 }).waitFor();
    const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.client + 1, `Horizontal overflow at ${width}x${height}`);
    const targets = await reader.locator("button, input").evaluateAll((elements) => elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && !element.closest(".react-flow__controls");
    }).map((element) => {
      const effective = element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)
        ? element.closest("label") ?? element
        : element;
      return { tag: element.tagName, type: element instanceof HTMLInputElement ? element.type : undefined, height: effective.getBoundingClientRect().height };
    }));
    assert.ok(targets.every((target) => target.height >= 44), `Touch target below 44px at ${width}x${height}: ${JSON.stringify(targets)}`);
    const inspector = reader.getByRole("heading", { name: "詳細資料", exact: true });
    await inspector.scrollIntoViewIfNeeded();
    const box = await inspector.boundingBox();
    assert.ok(box && box.y >= 0 && box.y + box.height <= height, `Inspector unreachable at ${width}x${height}`);
    summary.viewports.push({ width, height, horizontalOverflow: false, touchTargetsAtLeast44: true, inspectorReachable: true });
  }
  const screenshot = path.join(screenshotRoot, "qa-ntm-004-reader-360x640.png");
  await page.setViewportSize({ width: 360, height: 640 });
  await page.screenshot({ path: screenshot, fullPage: true });
  summary.screenshots.push(path.relative(root, screenshot).replaceAll("\\", "/"));
  summary.gates.responsiveAccessibility = "PASS";

  const afterReader = canonical(await snapshotTopologies(page));
  assert.deepEqual(afterReader, before, "Reader changed durable topology rows");
  assert.deepEqual(await page.evaluate(() => window.__qaNtm004Writes), [], "Reader issued IndexedDB writes");
  assert.deepEqual(mutationRequests, [], "Reader issued mutation API requests");
  summary.gates.zeroWrite = "PASS";

  const domText = await page.locator("body").innerText();
  const networkText = responseBodies.join("\n");
  const consoleText = consoleErrors.join("\n");
  for (const forbidden of ["QA_NTM_004_PASSWORD_SENTINEL", "postgresql://", "ciphertext", "nonce"]) {
    assert.equal(domText.includes(forbidden), false, `DOM leaked ${forbidden}`);
    assert.equal(networkText.includes(forbidden), false, `Network leaked ${forbidden}`);
    assert.equal(consoleText.includes(forbidden), false, `Console leaked ${forbidden}`);
  }
  const unsafeKeys = await page.evaluate(() => {
    const hits = [];
    const walk = (value, at = "$") => {
      if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${at}[${index}]`));
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (["username", "password", "secret", "ciphertext", "nonce", "token", "dsn"].includes(key.toLowerCase())) hits.push(`${at}.${key}`);
        walk(child, `${at}.${key}`);
      }
    };
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("nettopo-studio-db");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction("topologies", "readonly").objectStore("topologies").getAll();
        read.onerror = () => reject(read.error);
        read.onsuccess = () => { walk(read.result); db.close(); resolve(hits); };
      };
    });
  });
  assert.deepEqual(unsafeKeys, []);
  const knownPreviewFontErrors = consoleErrors.filter((message) => {
    const prefix = "Not allowed to load local resource: ";
    return message.startsWith(prefix) && isOwnedMirrorFontPath(message.slice(prefix.length));
  });
  const unexpectedConsoleErrors = consoleErrors.filter((message) => !knownPreviewFontErrors.includes(message));
  assert.deepEqual(unexpectedConsoleErrors, []);
  if (knownPreviewFontErrors.length > 0) summary.observations.push({ id: "VINEXT_LOCAL_FONT_URL", blocking: false, count: knownPreviewFontErrors.length, detail: "Sanitized preview emitted local .vinext font URL errors; no product data or secret was present." });
  const knownPreviewFontFailures = failedRequests.filter((request) => request.startsWith("GET ") && isOwnedMirrorFontPath(request.slice(4)));
  const unexpectedFailedRequests = failedRequests.filter((request) => !knownPreviewFontFailures.includes(request));
  assert.deepEqual(unexpectedFailedRequests, []);
  if (knownPreviewFontFailures.length > 0) summary.observations.push({ id: "VINEXT_LOCAL_FONT_REQUEST_FAILURE", blocking: false, count: knownPreviewFontFailures.length, detail: "Only the matching sanitized preview font requests failed." });
  assert.deepEqual(pageErrors, []);
  summary.gates.secretConsoleNetworkStorage = "PASS";

  await page.setViewportSize({ width: 1280, height: 900 });
  await reader.getByRole("button", { name: "返回編輯器", exact: true }).click();
  const editorCanvas = page.locator(".flow-shell .react-flow").first();
  await editorCanvas.waitFor();
  const canvasBox = await editorCanvas.boundingBox();
  assert.ok(canvasBox && canvasBox.width > 0 && canvasBox.height > 0, "Returned editor canvas has no usable size");
  const editorNode = page.locator(".flow-shell .react-flow__node").first();
  await editorNode.click();
  await page.waitForFunction(() => document.querySelector(".flow-shell .react-flow__node.selected") !== null);
  summary.gates.returnEditorCanvasInteraction = "PASS";
  await page.getByRole("button", { name: "唯讀檢視", exact: true }).click();
  await reader.getByRole("heading", { name: /^項目/, level: 2 }).waitFor();
  await page.locator("#topology-select").selectOption("qa-ntm-004-other");
  assert.equal(await reader.count(), 0, "Reader survived topology switch with stale projection");
  await page.getByRole("button", { name: "唯讀檢視", exact: true }).click();
  await reader.getByRole("heading", { name: "QA_NTM_004_HIDDEN_OTHER_TOPOLOGY", exact: true }).waitFor();
  assert.equal(await reader.getByText("Switch", { exact: true }).count(), 0, "Old topology projection remained visible");
  summary.gates.exitAndTopologySwitchIsolation = "PASS";

  await page.route("**/api/dev/session", (route) => route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"AUTHENTICATION_REQUIRED"}' }));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByText("無法確認目前的閱讀權限。", { exact: true }).waitFor();
  assert.equal(await reader.count(), 0);
  summary.gates.sessionRevocationRemovesProjection = "PASS";

  await context.close();
  contextClosed = true;
  context = undefined;
  summary.result = "QA_PASSED";
} catch (error) {
  summary.result = "QA_FAILED";
  summary.failure = error instanceof Error ? error.message : "Unknown Browser QA failure";
  if (page) {
    const failureShot = path.join(screenshotRoot, "qa-ntm-004-browser-failure.png");
    await page.screenshot({ path: failureShot, fullPage: true }).catch(() => undefined);
    if (fs.existsSync(failureShot)) summary.screenshots.push(path.relative(root, failureShot).replaceAll("\\", "/"));
  }
  process.exitCode = 1;
} finally {
  if (context) {
    try { await context.close(); contextClosed = true; }
    catch (error) { summary.cleanup.contextCloseError = error instanceof Error ? error.name : "Unknown"; }
  }
  if (browser) {
    try { await browser.close(); browserClosed = true; }
    catch (error) { summary.cleanup.browserCloseError = error instanceof Error ? error.name : "Unknown"; }
  } else {
    browserClosed = true;
  }
  if (server) {
    if (server.exitCode === null) {
      const stopped = once(server, "exit");
      server.kill();
      await stopped;
    }
    previewStopped = server.exitCode !== null || server.signalCode !== null;
    summary.resources.previewExit = { exitCode: server.exitCode, signalCode: server.signalCode };
  } else {
    previewStopped = true;
  }
  if (serverLog !== undefined) fs.closeSync(serverLog);
  if (port) {
    const probe = createServer();
    const probeResult = await new Promise((resolve) => {
      probe.once("error", (error) => resolve({ ok: false, code: error && typeof error === "object" && "code" in error ? error.code : "UNKNOWN" }));
      probe.listen(port, "127.0.0.1", () => probe.close(() => resolve({ ok: true })));
    });
    portReleased = probeResult.ok;
    if (!probeResult.ok) summary.cleanup.portProbeError = probeResult.code;
  } else {
    portReleased = true;
  }
  summary.cleanup.browserContextClosed = contextClosed;
  summary.cleanup.browserProcessClosed = browserClosed;
  summary.cleanup.previewStopped = previewStopped;
  summary.cleanup.portReleased = portReleased;
  summary.cleanup.downloadsRetained = 0;
  summary.candidateUnchanged = Object.entries(locked.fileHashes).every(([relative, expected]) => {
    const actual = createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex");
    return actual === expected;
  });
  fs.rmSync(ownedRoot, { recursive: true, force: true });
  summary.cleanup.sanitizedMirrorRemoved = !fs.existsSync(ownedRoot);
  const cleanupOk = summary.cleanup.browserContextClosed
    && summary.cleanup.browserProcessClosed
    && summary.cleanup.previewStopped
    && summary.cleanup.portReleased
    && summary.cleanup.sanitizedMirrorRemoved
    && summary.cleanup.downloadsRetained === 0;
  if (!cleanupOk || !summary.candidateUnchanged) {
    summary.result = "QA_FAILED";
    summary.failure ??= !cleanupOk ? "Owned resource cleanup verification failed" : "Candidate changed during Browser QA";
  }
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  const history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, "utf8")) : { ticket: "QA_NTM_004", runs: [] };
  history.runs.push({ runId, result: summary.result, failure: summary.failure, gates: summary.gates, cleanup: summary.cleanup, candidateUnchanged: summary.candidateUnchanged, observations: summary.observations });
  fs.writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`);
  process.exitCode = summary.result === "QA_PASSED" ? 0 : 1;
  console.log(JSON.stringify({ ticket: summary.ticket, runId, result: summary.result, gates: summary.gates, cleanup: summary.cleanup, candidateUnchanged: summary.candidateUnchanged, failure: summary.failure }));
}
