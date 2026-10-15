import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createHash, randomUUID } from "node:crypto";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const owned = path.join(root, ".local", `ntm004-${randomUUID()}`);
fs.mkdirSync(owned, { recursive: false });
const mirror = path.join(owned, "project");
fs.mkdirSync(mirror);
const manifest = {};
const safeEnv = Object.fromEntries(["SystemRoot", "WINDIR", "PATH", "Path", "PATHEXT", "ComSpec", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA", "APPDATA"].filter((name) => process.env[name]).map((name) => [name, process.env[name]]));
function copy(relative) {
  const source = path.join(root, relative);
  if (!fs.existsSync(source)) return;
  const stat = fs.lstatSync(source);
  assert.equal(stat.isSymbolicLink(), false, `Source symlink prohibited: ${relative}`);
  assert.doesNotMatch(path.basename(relative), /^\.env(?:\.|$)/);
  if (stat.isDirectory()) {
    fs.mkdirSync(path.join(mirror, relative), { recursive: true });
    for (const name of fs.readdirSync(source)) copy(path.join(relative, name));
  } else {
    const bytes = fs.readFileSync(source);
    manifest[relative.replaceAll("\\", "/")] = createHash("sha256").update(bytes).digest("hex");
    fs.mkdirSync(path.dirname(path.join(mirror, relative)), { recursive: true });
    fs.writeFileSync(path.join(mirror, relative), bytes);
  }
}
for (const source of ["app", "db", "build", "worker", "public", "examples/sean-sie-spine-leaf-demo.json", "package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts", "next.config.ts", "vite.config.ts", "postcss.config.mjs", "scripts/build-local.mjs", "scripts/preview-server.mjs", "scripts/validate-runtime-policy.mjs"]) copy(source);
assert.equal(Object.keys(manifest).some((p) => /(^|\/)\.env(?:\.|$)/.test(p)), false);
// The only junction is dependencies. No source, config or env path points back to the worktree.
fs.symlinkSync(path.join(root, "node_modules"), path.join(mirror, "node_modules"), "junction");
const guard = path.join(owned, "deny-dotenv.cjs");
fs.writeFileSync(guard, `const fs=require('node:fs');const path=require('node:path');const {fileURLToPath}=require('node:url');
function check(p){if(p instanceof URL)p=fileURLToPath(p);if(typeof p==='string'&&/^\\.env(?:\\.|$)/.test(path.basename(p)))throw new Error('NTM004 dotenv read prohibited');}
for(const name of ['readFileSync','readFile','openSync','open','createReadStream']){const original=fs[name];fs[name]=function(p,...args){check(p);return original.call(this,p,...args);};}
for(const name of ['readFile','open']){const original=fs.promises[name];fs.promises[name]=function(p,...args){check(p);return original.call(this,p,...args);};}
require('node:module').syncBuiltinESMExports();
`);
const env = { ...safeEnv, NODE_OPTIONS: `--require="${guard.replaceAll("\\", "/")}"`, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", NETTOPO_RUNTIME: "node", NETTOPO_RUNTIME_PROFILE: "test", NETTOPO_AUTH_MODE: "demo", NETTOPO_ENABLE_DEMO_SEED: "0", NETTOPO_ENABLE_DEV_IDENTITY_HEADER: "0", NEXT_PUBLIC_TOPOLOGY_STORAGE: "local", HOST: "127.0.0.1", NETTOPO_DEV_SESSION_SECRET: randomUUID() + randomUUID() };
const evidence = { candidate: manifest, mirror, envIsolation: { sourceAllowlist: true, noEnvCopied: true, dotenvReadGuard: true, shellEnvAllowlisted: true, dependencyJunctionOnly: true }, build: "NOT RUN", browser: "NOT RUN", cleanup: "NOT RUN", viewports: [] };
fs.writeFileSync(path.join(owned, "candidate.json"), JSON.stringify(evidence, null, 2));
function run(args, logName) {
  return new Promise((resolve, reject) => {
    const log = fs.openSync(path.join(owned, logName), "w");
    const child = spawn(process.execPath, args, { cwd: mirror, env, windowsHide: true, stdio: ["ignore", log, log] });
    child.once("error", reject);
    child.once("exit", (code) => { fs.closeSync(log); if (code === 0) resolve(); else reject(new Error(`${logName}: exit ${code}`)); });
  });
}
let server;
let browser;
let port;
let serverLog;
let page;
try {
  await run(["-e", "const assert=require('node:assert/strict');assert.throws(()=>require('node:fs').readFileSync('.env.ntm004-deny-probe'),/NTM004 dotenv read prohibited/);"], "dotenv-guard.log");
  await run(["scripts/validate-runtime-policy.mjs"], "policy.log");
  await run(["scripts/build-local.mjs"], "build.log");
  evidence.build = "PASS";
  const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
  port = reservation.address().port; assert.notEqual(port, 5432); await new Promise((resolve) => reservation.close(resolve));
  serverLog = fs.openSync(path.join(owned, "preview.log"), "w");
  server = spawn(process.execPath, ["scripts/preview-server.mjs"], { cwd: mirror, env: { ...env, PORT: String(port) }, windowsHide: true, stdio: ["ignore", serverLog, serverLog] });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 160; i++) { try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* owned preview starting */ } await new Promise((r) => setTimeout(r, 250)); }
  assert.ok(ready, "Owned preview did not start");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: false });
  page = await context.newPage();
  evidence.browser = "RUNNING";
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  const oracle = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/dev-ntm-004/projection-vectors.json"))).planOracle;
  const legacy = { devices: oracle.project.devices, links: oracle.project.links.map((l) => { const value = { ...l }; delete value.fromInterfaceId; delete value.toInterfaceId; return value; }), groups: [] };
  await page.evaluate(async (project) => {
    const open = indexedDB.open("nettopo-studio-db", 10);
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const [name, keyPath, indexes] of [["customers", "id", ["name", "updatedAt"]], ["topologies", "id", ["customerId", "name", "updatedAt"]], ["meta", "key", []]]) {
        if (!db.objectStoreNames.contains(name)) { const store = db.createObjectStore(name, { keyPath }); for (const index of indexes) store.createIndex(index, index); }
      }
    };
    const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    const tx = db.transaction(["customers", "topologies", "meta"], "readwrite");
    const now = "2026-10-14T00:00:00Z";
    tx.objectStore("customers").put({ id: "reader-c", name: "Synthetic customer", createdAt: now, updatedAt: now });
    tx.objectStore("topologies").put({ id: "reader-t", customerId: "reader-c", name: "Synthetic physical", project, createdAt: now, updatedAt: now });
    tx.objectStore("topologies").put({ id: "reader-other", customerId: "reader-c", name: "Synthetic other", project: { devices: [{ id: "other", name: "Other topology device", type: "switch", x: 0, y: 0 }], links: [], groups: [] }, createdAt: now, updatedAt: now });
    tx.objectStore("meta").put({ key: "activeCustomerId", value: "reader-c" }); tx.objectStore("meta").put({ key: "activeTopologyId", value: "reader-t" });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close();
  }, legacy);
  await page.getByRole("button", { name: "進入本機 Demo", exact: true }).click();
  await page.getByRole("button", { name: "唯讀檢視", exact: true }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent === "唯讀檢視" && !b.disabled));
  const database = () => page.evaluate(async () => {
    const open = indexedDB.open("nettopo-studio-db"); const db = await new Promise((resolve) => { open.onsuccess = () => resolve(open.result); });
    const request = db.transaction("topologies").objectStore("topologies").getAll();
    const data = await new Promise((resolve) => { request.onsuccess = () => resolve(request.result); }); db.close(); return data;
  });
  const before = await database();
  const mutations = []; page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/") && r.method() !== "GET") mutations.push(r.method()); });
  await page.getByRole("button", { name: "唯讀檢視", exact: true }).click();
  const reader = page.getByRole("region", { name: "可信網路唯讀檢視" });
  await reader.getByRole("heading", { name: /^項目/, level: 2 }).waitFor();
  await reader.locator('[data-entity-type="interface"]').click();
  await reader.getByText("舊資料／未核實 · legacy-project", { exact: true }).waitFor();
  await reader.getByRole("button", { name: "邏輯", exact: true }).click();
  await reader.getByText("未記錄結構化邏輯關係", { exact: true }).waitFor();
  await reader.getByRole("checkbox", { name: "僅顯示已核實" }).focus();
  await page.keyboard.press("Space");
  await reader.getByRole("button", { name: "重設篩選" }).waitFor();
  await reader.getByRole("button", { name: "重設篩選" }).click();
  await reader.getByRole("button", { name: "實體", exact: true }).click();
  for (const [width, height] of [[1280, 900], [1024, 900], [768, 900], [360, 800], [700, 520]]) {
    await page.setViewportSize({ width, height });
    await reader.getByRole("heading", { name: /^項目/, level: 2 }).waitFor();
    const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(metrics.scroll <= metrics.width + 1, `Horizontal overflow at ${width}: ${JSON.stringify(metrics)}`);
    const controls = await reader.locator("button").evaluateAll((buttons) => buttons.filter((b) => !b.closest(".react-flow__controls") && b.getBoundingClientRect().width > 0).map((b) => b.getBoundingClientRect().height));
    assert.ok(controls.every((h) => h >= 44), "Reader touch target under 44px");
    await page.screenshot({ path: path.join(owned, `reader-${width}x${height}.png`), fullPage: true });
    const detail = reader.getByRole("heading", { name: "詳細資料", exact: true });
    await detail.scrollIntoViewIfNeeded();
    const detailBox = await detail.boundingBox();
    assert.ok(detailBox && detailBox.y >= 0 && detailBox.y + detailBox.height <= height, `Inspector unreachable at ${width}x${height}`);
    if (width === 360) await page.screenshot({ path: path.join(owned, "reader-360-detail.png"), fullPage: true });
    await reader.evaluate((element) => { element.scrollTop = 0; });
    evidence.viewports.push({ width, height, ...metrics });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await reader.getByRole("searchbox").fill("Synthetic A");
  assert.equal(await reader.locator('[data-entity-type="device"]').count(), 1);
  await reader.getByRole("searchbox").fill("");
  await reader.getByRole("button", { name: "實體", exact: true }).focus();
  await page.keyboard.press("Tab");
  assert.equal(await reader.getByRole("button", { name: "邏輯", exact: true }).evaluate((b) => b === document.activeElement), true);
  await page.keyboard.press("Shift+Tab");
  assert.equal(await reader.getByRole("button", { name: "實體", exact: true }).evaluate((b) => b === document.activeElement), true);
  await reader.getByRole("button", { name: "邏輯", exact: true }).focus(); await page.keyboard.press("Enter");
  await reader.getByText("未記錄結構化邏輯關係", { exact: true }).waitFor();
  assert.deepEqual(await database(), before); assert.deepEqual(mutations, []);
  await reader.getByRole("button", { name: "返回編輯器", exact: true }).click();
  await page.locator('.flow-shell .react-flow__node').first().waitFor();
  await page.getByRole("button", { name: "唯讀檢視", exact: true }).click();
  await reader.getByRole("heading", { name: /^項目/, level: 2 }).waitFor();
  await page.locator("#topology-select").selectOption("reader-other");
  assert.equal(await reader.count(), 0);
  await page.getByRole("button", { name: "唯讀檢視", exact: true }).click();
  await reader.getByRole("heading", { name: /^項目/, level: 2 }).waitFor();
  assert.equal(await reader.getByText("Synthetic A", { exact: true }).count(), 0);
  await page.route("**/api/dev/session", (route) => route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"AUTHENTICATION_REQUIRED"}' }));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByText("無法確認目前的閱讀權限。", { exact: true }).waitFor();
  assert.equal(await reader.count(), 0);
  assert.deepEqual(errors, []);
  evidence.browser = "PASS (V1 product only; V2 persistence NOT RUN)";
  await context.close();
} catch (error) {
  if (evidence.browser === "RUNNING") evidence.browser = "FAIL";
  if (page) await page.screenshot({ path: path.join(owned, "failure.png"), fullPage: true }).catch(() => undefined);
  evidence.failure = error instanceof Error ? error.message : "Unknown test failure";
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) { const stopped = once(server, "exit"); server.kill(); await stopped; }
  if (serverLog !== undefined) fs.closeSync(serverLog);
  evidence.cleanup = "owned browser/context and preview process closed; sanitized mirror retained for evidence";
  evidence.unchanged = Object.entries(manifest).every(([relative, hash]) => createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex") === hash);
  fs.writeFileSync(path.join(owned, "result.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ evidence: owned, build: evidence.build, browser: evidence.browser, failure: evidence.failure, unchanged: evidence.unchanged }));
}
