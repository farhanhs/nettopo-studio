import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { assertSentinelPositiveControl, canonicalProjectProjection, safeProjectProjection, scanNamedBuffers } from "./browser-assertions.mjs";
import { extractCsvBundle } from "./full-browser-runner.mjs";

const [modulePath, packageRoot, fixtureRoot, evidenceRoot, browserExecutableArg, nodeExecutableArg] = process.argv.slice(2).map(value => value ? path.resolve(value) : value);
assert.ok(modulePath && packageRoot && fixtureRoot && evidenceRoot);
assert.equal(fs.existsSync(evidenceRoot), false);
fs.mkdirSync(evidenceRoot, { recursive: false });
const imported = await import(pathToFileURL(modulePath).href);
const playwright = imported.chromium ? imported : imported.default;
const profile = path.join(evidenceRoot, "profile");
const downloads = path.join(evidenceRoot, "downloads");
fs.mkdirSync(downloads);
const evidence = { result: "RUNNING", phases: {}, lifecycle: [], console: [], responses: [], cleanup: { contextClosed: false, serverStopped: false } };
let context;

function lifecycle(command) {
  const executable = nodeExecutableArg ?? process.execPath;
  const result = spawnSync(executable, [`runtime/tools/${command}.mjs`], { cwd: packageRoot, encoding: "utf8", windowsHide: true, timeout: 30000,
    env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, PATH: path.dirname(executable), BTA_PROFILE: "local-beta" } });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  evidence.lifecycle.push({ command, status: result.status, output });
  assert.equal(result.status, 0, `${command} lifecycle failed: ${output}`);
  return output;
}

async function snapshot(page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const out = [];
    for (const info of dbs) {
      if (!info.name) continue;
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open(info.name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const stores = {};
      for (const store of [...db.objectStoreNames]) stores[store] = await new Promise((resolve, reject) => { const request = db.transaction(store).objectStore(store).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      db.close(); out.push({ name: info.name, version: info.version, stores });
    }
    return out;
  });
}

async function openPage() {
  context = await playwright.chromium.launchPersistentContext(profile, { ...(browserExecutableArg ? { executablePath: browserExecutableArg } : { channel: "chrome" }), headless: true, acceptDownloads: true, viewport: { width: 1280, height: 900 }, serviceWorkers: "block", args: ["--disable-background-networking", "--no-first-run"] });
  const page = context.pages()[0] ?? await context.newPage();
  page.on("console", message => evidence.console.push({ type: message.type(), text: message.text().slice(0, 1000) }));
  page.on("response", response => {
    if (!response.url().startsWith("http://127.0.0.1:4317")) return;
    const item = { path: new URL(response.url()).pathname, status: response.status(), body: "" };
    evidence.responses.push(item);
    void response.text().then(body => { item.body = body.slice(0, 1000); }).catch(() => {});
  });
  await page.goto("http://127.0.0.1:4317", { waitUntil: "domcontentloaded" });
  await page.locator('[data-local-beta="true"]').waitFor();
  return page;
}

async function setFiles(page, files) {
  await page.getByRole("button", { name: "匯入", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(files);
  await page.locator(".import-options select").waitFor();
}

async function applyNew(page, name) {
  await page.locator(".import-options select").selectOption("new");
  await page.locator(".import-options input").fill(name);
  const ack = page.locator(".import-warning-ack input");
  if (await ack.count()) await ack.check();
  await page.getByRole("button", { name: "確認寫入", exact: true }).click();
  await page.getByText(/匯入完成/).waitFor();
}

async function download(page, name, target, confirm = false) {
  const pending = page.waitForEvent("download");
  if (confirm) page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name, exact: true }).click();
  const item = await pending; await item.saveAs(target);
  assert.ok(fs.statSync(target).size > 0);
}

async function exportAll(page, prefix) {
  await page.getByRole("button", { name: "匯出", exact: true }).click();
  const files = {
    fullJson: path.join(downloads, `${prefix}-full.json`), safeJson: path.join(downloads, `${prefix}-safe.json`),
    fullCsv: path.join(downloads, `${prefix}-full.zip`), safeCsv: path.join(downloads, `${prefix}-safe.zip`),
  };
  await download(page, "下載完整 JSON", files.fullJson, true);
  await download(page, "下載安全 JSON", files.safeJson);
  await download(page, "完整 CSV", files.fullCsv, true);
  await download(page, "安全 CSV", files.safeCsv);
  await page.getByRole("button", { name: "關閉", exact: true }).click();
  return files;
}

async function importAndExportJson(page, files, name) {
  await setFiles(page, files); await applyNew(page, name);
  await page.reload(); await page.locator("#topology-select").waitFor();
  await page.getByRole("button", { name: "匯出", exact: true }).click();
  const target = path.join(downloads, `${name}.json`);
  await download(page, "下載完整 JSON", target, true);
  await page.getByRole("button", { name: "關閉", exact: true }).click();
  return JSON.parse(fs.readFileSync(target, "utf8")).project;
}

try {
  lifecycle("start");
  let page = await openPage();
  const canonical = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "canonical-project.json"), "utf8"));
  await setFiles(page, [path.join(fixtureRoot, "canonical-project.json")]);
  await applyNew(page, "QA Canonical Source");
  const exported = await exportAll(page, "canonical");
  const fullEnvelope = JSON.parse(fs.readFileSync(exported.fullJson, "utf8"));
  const safeEnvelope = JSON.parse(fs.readFileSync(exported.safeJson, "utf8"));
  assert.deepEqual(canonicalProjectProjection(fullEnvelope.project), canonicalProjectProjection(canonical));
  assert.deepEqual(canonicalProjectProjection(safeEnvelope.project), safeProjectProjection(canonical));
  const fullCsv = extractCsvBundle(exported.fullCsv, path.join(downloads, "full-csv"));
  const safeCsv = extractCsvBundle(exported.safeCsv, path.join(downloads, "safe-csv"));
  assert.deepEqual(canonicalProjectProjection(await importAndExportJson(page, [exported.fullJson], "QA Full JSON")), canonicalProjectProjection(canonical));
  assert.deepEqual(canonicalProjectProjection(await importAndExportJson(page, [exported.safeJson], "QA Safe JSON")), safeProjectProjection(canonical));
  assert.deepEqual(canonicalProjectProjection(await importAndExportJson(page, fullCsv, "QA Full CSV")), canonicalProjectProjection(canonical));
  assert.deepEqual(canonicalProjectProjection(await importAndExportJson(page, safeCsv, "QA Safe CSV")), safeProjectProjection(canonical));
  evidence.phases.A06 = "PASS_FOUR_BROWSER_ROUNDTRIPS";

  const beforeNegative = await snapshot(page);
  const blockingFiles = ["devices.csv", "links.csv", "groups.csv", "credentials.masked.csv", "missing-info.csv"].map(name => path.join(fixtureRoot, "blocking-v2", name));
  await setFiles(page, blockingFiles);
  assert.equal(await page.getByRole("button", { name: "確認寫入", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "缺失資料", exact: true }).click();
  const exclude = page.getByRole("button", { name: "排除此項", exact: true });
  assert.ok(await exclude.count()); await exclude.first().click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  assert.deepEqual(await snapshot(page), beforeNegative);
  await setFiles(page, [path.join(fixtureRoot, "synthetic-topology.json")]);
  const ack = page.locator(".import-warning-ack input");
  assert.ok(await ack.count(), "warning acknowledgement must be shown");
  assert.equal(await page.getByRole("button", { name: "確認寫入", exact: true }).isDisabled(), true);
  await ack.check(); assert.equal(await page.getByRole("button", { name: "確認寫入", exact: true }).isEnabled(), true);
  await page.getByRole("button", { name: "取消", exact: true }).click(); assert.deepEqual(await snapshot(page), beforeNegative);
  evidence.phases.A07 = "PASS_BLOCK_WARNING_EXCLUDE_CANCEL";

  const catalog = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "sentinel-catalog.json"), "utf8"));
  const sentinels = Object.values(catalog.values); assertSentinelPositiveControl(sentinels);
  const sentinelFiles = ["devices.csv", "links.csv", "groups.csv", "credentials.masked.csv", "missing-info.csv"].map(name => path.join(fixtureRoot, "sentinel-v2", name));
  await setFiles(page, sentinelFiles);
  assert.equal(await page.getByRole("button", { name: "確認寫入", exact: true }).isDisabled(), true);
  const exportedAndExtracted = {};
  for (const file of [exported.fullJson, exported.safeJson, ...fullCsv, ...safeCsv]) exportedAndExtracted[path.relative(downloads, file)] = fs.readFileSync(file);
  const packageBuffers = {};
  const visit = directory => { for (const item of fs.readdirSync(directory, { withFileTypes: true })) { const full = path.join(directory, item.name); if (item.isDirectory()) visit(full); else packageBuffers[`package:${path.relative(packageRoot, full)}`] = fs.readFileSync(full); } };
  visit(packageRoot);
  const scans = scanNamedBuffers({ dom: await page.locator("body").innerText(), storage: await snapshot(page), console: evidence.console, network: evidence.responses, ...exportedAndExtracted, ...packageBuffers }, sentinels);
  assert.deepEqual(scans, []);
  await page.getByRole("button", { name: "取消", exact: true }).click(); assert.deepEqual(await snapshot(page), beforeNegative);
  evidence.phases.A09 = "PASS_POSITIVE_CONTROL_DOM_DEXIE_CONSOLE_NETWORK_JSON_UNPACKED_CSV_PACKAGE";

  await setFiles(page, [path.join(fixtureRoot, "future-project.json")]);
  assert.equal(await page.getByRole("button", { name: "確認寫入", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "取消", exact: true }).click(); assert.deepEqual(await snapshot(page), beforeNegative);
  await setFiles(page, [path.join(fixtureRoot, "malformed-project.json")]);
  assert.equal(await page.getByRole("button", { name: "確認寫入", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "取消", exact: true }).click(); assert.deepEqual(await snapshot(page), beforeNegative);
  await page.getByRole("button", { name: "匯入", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(path.join(packageRoot, "samples", "synthetic-topology-csv-bundle.zip"));
  await page.locator(".import-options select").waitFor();
  assert.match(await page.getByRole("dialog", { name: "匯入拓樸資料" }).innerText(), /ZIP 匯入尚未支援/);
  await page.getByRole("button", { name: "取消", exact: true }).click();
  assert.deepEqual(await snapshot(page), beforeNegative);
  evidence.phases.A10 = "PASS_LEGACY_FUTURE_MALFORMED_ZIP";

  const beforeRestart = await snapshot(page);
  await context.close(); context = undefined; evidence.cleanup.contextClosed = true;
  lifecycle("stop"); lifecycle("start");
  page = await openPage();
  assert.deepEqual(await snapshot(page), beforeRestart);
  evidence.phases.A05 = "PASS_CLOSE_STOP_START_SAME_PROFILE";
  evidence.result = "PASS";
} catch (error) {
  evidence.result = "FAIL"; evidence.failure = String(error?.message ?? error).slice(0, 2000); throw error;
} finally {
  if (context) { await context.close(); evidence.cleanup.contextClosed = true; }
  try { lifecycle("stop"); evidence.cleanup.serverStopped = true; } catch {}
  fs.writeFileSync(path.join(evidenceRoot, "deep-result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
}
