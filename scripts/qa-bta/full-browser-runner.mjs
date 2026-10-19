import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

import { scanBuffersForSentinels } from "./harness.mjs";
import { assertPhaseMatrixComplete } from "./browser-assertions.mjs";

export const requiredBrowserPhases = [
  "entry-security",
  "responsive",
  "crud-layout",
  "persistence-restart",
  "failed-write-zero-mutation",
  "json-roundtrip",
  "csv-five-file-roundtrip",
  "import-preview-strategies",
  "offline-observation",
  "sentinel-sinks",
];

const ORIGIN = "http://127.0.0.1:4317";
const channels = new Set(["chrome", "msedge"]);
export const offlineChannels = ["page-navigation", "subresource", "dedicated-worker", "service-worker", "websocket", "node-launcher", "node-server"];

const REQUIRED_DEEP_FIXTURES = ["canonicalProject", "blockingBundle", "warningDocument", "sentinelBundle", "legacyProject", "futureProject", "malformedProject"];

export function validateDeepBrowserPlan(plan) {
  assert.match(plan.candidateSha256 ?? "", /^[0-9a-f]{64}$/i, "fixed candidate SHA-256 is required");
  assert.equal(plan.writerStopped, true, "DEV writer stop is required before formal Browser QA");
  const phases = assertPhaseMatrixComplete(plan.matrix);
  for (const name of REQUIRED_DEEP_FIXTURES) assert.ok(plan.fixtures?.[name], `deep Browser fixture is required: ${name}`);
  return { ...plan, phaseCount: phases.length };
}

export function normalizePlaywrightModule(moduleNamespace) {
  const api = moduleNamespace?.chromium ? moduleNamespace : moduleNamespace?.default;
  assert.equal(typeof api?.chromium?.launchPersistentContext, "function", "Playwright chromium API is required");
  return api;
}

export function classifyUnexpectedConsole(consoleEntries, responses) {
  const expectedCredentialDeny = responses.some(item => item.path === "/api/credentials" && item.status === 404);
  return consoleEntries.filter(item => {
    if (item.type !== "error") return false;
    if (/Content Security Policy|connect-src 'self'|Fetch API cannot load http:\/\/qa-bta\.invalid/i.test(item.text)) return false;
    if (expectedCredentialDeny && /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/i.test(item.text)) return false;
    return true;
  });
}

export function buildOfflineChannelLedger(observed) {
  const requestTypes = new Set(observed.requestTypes ?? []);
  const browserResult = observed.syntheticProbeBlocked && observed.loopbackNavigationPassed ? "PASS" : "FAIL";
  const seen = list => Array.isArray(list) && list.length > 0;
  return {
    "page-navigation": { result: requestTypes.has("document") ? browserResult : "NOT_RUN_UNOBSERVED", isolation: "Playwright route abort of non-loopback plus successful canonical navigation" },
    subresource: { result: [...requestTypes].some(type => type !== "document") ? browserResult : "NOT_RUN_UNOBSERVED", isolation: "Playwright route abort of non-loopback requests" },
    "dedicated-worker": { result: seen(observed.workers) ? browserResult : "NOT_RUN_UNOBSERVED", observed: observed.workers ?? [] },
    "service-worker": { result: seen(observed.serviceWorkers) ? browserResult : "NOT_RUN_UNOBSERVED", observed: observed.serviceWorkers ?? [], note: "contexts disable service workers; absence is not promoted to PASS" },
    websocket: { result: seen(observed.websockets) ? browserResult : "NOT_RUN_UNOBSERVED", observed: observed.websockets ?? [] },
    "node-launcher": { result: "NOT_RUN_REQUIRES_SEPARATE_PROCESS_NETWORK_FIXTURE", note: "Browser routing cannot observe Node launcher sockets" },
    "node-server": { result: "NOT_RUN_REQUIRES_SEPARATE_PROCESS_NETWORK_FIXTURE", note: "Browser routing cannot prove the Node server made no outbound connections" },
  };
}

export function classifySyntheticProbe({ rejected, routeObserved, consoleEntries }) {
  assert.equal(rejected, true, "synthetic non-loopback probe must be rejected");
  if (routeObserved) return { rejected: true, enforcement: "qa-route-abort" };
  const cspBlocked = (consoleEntries ?? []).some(item => /Content Security Policy|connect-src 'self'/i.test(item.text ?? ""));
  assert.equal(cspBlocked, true, "probe rejection must have route or CSP evidence");
  return { rejected: true, enforcement: "product-csp-before-route" };
}

export function validateFullBrowserOptions(options) {
  assert.equal(options.origin, ORIGIN, "BTA_PROFILE_INVALID:origin");
  assert.ok(channels.has(options.channel), "Unsupported QA browser channel");
  if (!options.dryRun) {
    assert.equal(fs.existsSync(options.evidenceRoot), false, "QA evidence root must not pre-exist");
    assert.ok(fs.existsSync(options.artifactRoot), "Fixed extracted artifact root is required");
  }
  assert.ok(Array.isArray(options.viewports) && [360, 768, 1024, 1280].every(width => options.viewports.some(item => item.width === width)));
  assert.ok(Array.isArray(options.sentinels) && options.sentinels.length > 0);
  return { ...options, headless: true, profileMode: "new-owned-persistent-context", externalNetworkPolicy: "observe-and-abort-non-loopback-not-os-firewall" };
}

const safeText = value => String(value ?? "").slice(0, 1000);

async function snapshotIndexedDb(page) {
  return page.evaluate(async () => {
    const dbs = typeof indexedDB.databases === "function" ? await indexedDB.databases() : [];
    const result = [];
    for (const info of dbs) {
      if (!info.name) continue;
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open(info.name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const stores = {};
      for (const name of [...db.objectStoreNames]) {
        stores[name] = await new Promise((resolve, reject) => { const request = db.transaction(name).objectStore(name).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      }
      db.close(); result.push({ name: info.name, version: info.version, stores });
    }
    return result;
  });
}

async function addDevice(page, name, type = "router") {
  await page.getByRole("button", { name: "+ 新增設備", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新增設備" });
  await dialog.getByLabel("設備名稱", { exact: true }).fill(name);
  await dialog.locator('select[name="type"]').selectOption(type);
  await dialog.locator('button[type="submit"]').click();
  await page.getByText("已自動儲存", { exact: true }).waitFor();
}

async function addGroup(page, name) {
  await page.getByRole("button", { name: "容器", exact: true }).click();
  await page.getByRole("button", { name: "+ 新增容器", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新增架構容器" });
  await dialog.getByLabel("容器名稱", { exact: true }).fill(name);
  await dialog.locator('button[type="submit"]').click();
  await page.getByText("已自動儲存", { exact: true }).waitFor();
}

async function addLink(page, from, to) {
  await page.getByRole("button", { name: "連線", exact: true }).click();
  await page.getByRole("button", { name: "+ 建立連線", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "建立設備連線" });
  await dialog.locator('select[name="from"]').selectOption({ label: from });
  await dialog.locator('select[name="to"]').selectOption({ label: to });
  await dialog.locator('input[name="fromPort"]').fill("qa-port-1");
  await dialog.locator('input[name="toPort"]').fill("qa-port-2");
  await dialog.locator('button[type="submit"]').click();
  await page.getByText("連線已建立", { exact: true }).waitFor();
}

async function downloadByButton(page, buttonName, target) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  const download = await pending;
  await download.saveAs(target);
  assert.ok(fs.statSync(target).size > 0, `${buttonName} must produce a non-empty file`);
}

async function setImportFiles(page, files) {
  await page.getByRole("button", { name: "匯入", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(files);
  await page.locator(".import-options select").waitFor();
}

export async function runExchangeBrowser(options, playwright) {
  const fixed = validateFullBrowserOptions(options);
  assert.ok(fs.existsSync(options.fullJson), "Full JSON fixture is required");
  assert.ok(fs.existsSync(options.csvZip), "CSV ZIP fixture is required");
  fs.mkdirSync(fixed.evidenceRoot, { recursive: false });
  const csvFiles = extractCsvBundle(options.csvZip, path.join(fixed.evidenceRoot, "csv"));
  const evidence = { channel: fixed.channel, mode: "exchange-only", phases: { cancel: "NOT_RUN", new: "NOT_RUN", merge: "NOT_RUN", replace: "NOT_RUN", csv: "NOT_RUN" }, cleanup: { contextClosed: false }, result: "RUNNING" };
  let context;
  try {
    context = await playwright.chromium.launchPersistentContext(path.join(fixed.evidenceRoot, "profile"), { channel: fixed.channel, headless: true, viewport: { width: 1280, height: 900 }, serviceWorkers: "block", args: ["--disable-background-networking", "--no-first-run"] });
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
    await page.locator('[data-local-beta="true"]').waitFor();
    const beforeCancel = await snapshotIndexedDb(page);
    await setImportFiles(page, [options.fullJson]);
    await page.getByRole("button", { name: "取消", exact: true }).click();
    assert.deepEqual(await snapshotIndexedDb(page), beforeCancel); evidence.phases.cancel = "PASS_ZERO_WRITE";
    for (const strategy of ["new", "merge", "replace"]) {
      await setImportFiles(page, [options.fullJson]);
      await page.locator(".import-options select").selectOption(strategy);
      if (strategy === "new") await page.locator(".import-options input").fill(`QA Import ${fixed.channel}`);
      const acknowledge = page.locator(".import-warning-ack input"); if (await acknowledge.count()) await acknowledge.check();
      await page.getByRole("button", { name: "確認寫入", exact: true }).click();
      await page.getByText(/匯入完成/).waitFor(); evidence.phases[strategy] = "PASS";
    }
    await setImportFiles(page, csvFiles);
    await page.locator(".import-options select").selectOption("new");
    await page.locator(".import-options input").fill(`QA CSV Import ${fixed.channel}`);
    const acknowledge = page.locator(".import-warning-ack input"); if (await acknowledge.count()) await acknowledge.check();
    await page.getByRole("button", { name: "確認寫入", exact: true }).click();
    await page.getByText(/匯入完成/).waitFor(); evidence.phases.csv = "PASS_FIVE_FILE_REIMPORT";
    await page.reload(); await page.locator("#topology-select").waitFor();
    assert.match(await page.locator("#topology-select option:checked").textContent(), /QA CSV Import/);
    evidence.result = "PASS";
  } catch (error) { evidence.result = "FAIL"; evidence.failure = safeText(error instanceof Error ? error.message : error); throw error; }
  finally { if (context) { await context.close(); evidence.cleanup.contextClosed = true; } fs.writeFileSync(path.join(fixed.evidenceRoot, "exchange-browser.json"), `${JSON.stringify(evidence, null, 2)}\n`); }
  return evidence;
}

export function extractCsvBundle(zipPath, destination) {
  assert.equal(fs.existsSync(destination), false, "CSV extraction destination must not pre-exist");
  const powershell = path.join(process.env.SystemRoot || "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
  const psLiteral = value => `'${String(value).replaceAll("'", "''")}'`;
  const command = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory(${psLiteral(zipPath)}, ${psLiteral(destination)})`;
  const result = spawnSync(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true, encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, `Safe CSV bundle extraction failed: ${safeText(result.stderr || result.error?.message)}`);
  const expected = ["devices.csv", "links.csv", "groups.csv", "credentials.masked.csv", "missing-info.csv"];
  assert.deepEqual(fs.readdirSync(destination).sort(), [...expected].sort(), "CSV Bundle v2 must contain exactly five files");
  return expected.map(name => path.join(destination, name));
}

export async function runFullBrowser(options, playwright) {
  const fixed = validateFullBrowserOptions(options);
  fs.mkdirSync(fixed.evidenceRoot, { recursive: false });
  const profile = path.join(fixed.evidenceRoot, "profile");
  const downloads = path.join(fixed.evidenceRoot, "downloads");
  fs.mkdirSync(downloads);
  const evidence = { channel: fixed.channel, phases: Object.fromEntries(requiredBrowserPhases.map(name => [name, "NOT_RUN"])), urls: [], requestTypes: [], blockedExternal: [], workers: [], serviceWorkers: [], websockets: [], responses: [], console: [], pageErrors: [], cleanup: { contextClosed: false }, result: "RUNNING" };
  let context;
  try {
    context = await playwright.chromium.launchPersistentContext(profile, { channel: fixed.channel, headless: true, acceptDownloads: true, viewport: fixed.viewports.at(-1), serviceWorkers: "block", args: ["--disable-background-networking", "--no-first-run"] });
    await context.route("**/*", route => {
      const url = route.request().url(); evidence.urls.push(url); evidence.requestTypes.push(route.request().resourceType());
      if (url.startsWith(`${ORIGIN}/`) || url === ORIGIN) return route.continue();
      evidence.blockedExternal.push(url); return route.abort("blockedbyclient");
    });
    const page = context.pages()[0] ?? await context.newPage();
    page.on("worker", worker => evidence.workers.push(worker.url()));
    context.on("serviceworker", worker => evidence.serviceWorkers.push(worker.url()));
    page.on("websocket", socket => evidence.websockets.push(socket.url()));
    page.on("console", message => evidence.console.push({ type: message.type(), text: safeText(message.text()) }));
    page.on("pageerror", error => evidence.pageErrors.push(safeText(error.message)));
    page.on("response", response => {
      if (!response.url().startsWith(ORIGIN) || !new URL(response.url()).pathname.startsWith("/api/")) return;
      const item = { path: new URL(response.url()).pathname, status: response.status(), body: "" };
      evidence.responses.push(item);
      void response.text().then(body => { item.body = safeText(body); }).catch(() => {});
    });

    const navigation = await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
    assert.equal(navigation.status(), 200);
    await page.locator('[data-local-beta="true"]').waitFor();
    assert.equal((await page.locator('[data-local-beta="true"]').innerText()).trim(), "本機試用模式｜資料只保存在此瀏覽器設定檔");
    assert.equal(await page.locator('input[type="password"]').count(), 0);
    assert.equal((await context.cookies()).length, 0);
    evidence.phases["entry-security"] = "PASS";
    const syntheticExternalProbe = "http://qa-bta.invalid/nonloopback-probe";
    const probeRejected = await page.evaluate(async url => { try { await fetch(url, { mode: "no-cors" }); return false; } catch { return true; } }, syntheticExternalProbe);
    evidence.syntheticProbe = classifySyntheticProbe({ rejected: probeRejected, routeObserved: evidence.blockedExternal.includes(syntheticExternalProbe), consoleEntries: evidence.console });

    evidence.viewportInteractions = [];
    for (const viewport of fixed.viewports) {
      await page.setViewportSize(viewport);
      const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(widths.scroll <= widths.client + 1, `horizontal overflow ${viewport.width}`);
      let entryHitTest = "PASS";
      try { await page.getByRole("button", { name: "+ 新增設備", exact: true }).click({ trial: true, timeout: 5000 }); }
      catch (error) { entryHitTest = `FAIL:${safeText(error instanceof Error ? error.message : error)}`; }
      evidence.viewportInteractions.push({ ...viewport, horizontalOverflow: false, addDeviceHitTest: entryHitTest });
    }
    evidence.phases.responsive = evidence.viewportInteractions.every(item => item.addDeviceHitTest === "PASS") ? "PASS" : "FAIL_ENTRY_HIT_TEST";
    await page.setViewportSize(fixed.viewports.find(item => item.width === 1280));

    const suffix = `${fixed.channel}-${Date.now()}`;
    const first = `QA Router ${suffix}`, second = `QA Switch ${suffix}`, group = `QA Group ${suffix}`;
    await addDevice(page, first, "router"); await addDevice(page, second, "switch"); await addGroup(page, group); await addLink(page, first, second);
    await page.getByRole("button", { name: "自動整理", exact: true }).click();
    await page.getByText(/整理完成/).waitFor();
    evidence.phases["crud-layout"] = "PASS";
    const durableBefore = await snapshotIndexedDb(page);
    await page.reload(); await page.getByText(first, { exact: true }).first().waitFor(); await page.getByText(second, { exact: true }).first().waitFor();
    assert.deepEqual(await snapshotIndexedDb(page), durableBefore);
    evidence.phases["persistence-restart"] = "PASS_LOCAL_RELOAD";

    await page.evaluate(() => { const original = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (this.name === "topologies") throw new DOMException("QA synthetic write failure", "QuotaExceededError"); return original.apply(this, args); }; });
    await addDevice(page, `Rejected ${suffix}`, "server").catch(() => {});
    await page.getByText("本機儲存失敗，原資料已保留。", { exact: true }).waitFor();
    assert.equal(await page.getByText(`Rejected ${suffix}`, { exact: true }).count(), 0);
    assert.deepEqual(await snapshotIndexedDb(page), durableBefore);
    evidence.phases["failed-write-zero-mutation"] = "PASS";
    await page.reload(); await page.getByText(first, { exact: true }).first().waitFor();

    await page.getByRole("button", { name: "匯出", exact: true }).click();
    page.once("dialog", dialog => dialog.accept());
    const fullJson = path.join(downloads, `${fixed.channel}-full.json`);
    await downloadByButton(page, "下載完整 JSON", fullJson);
    const safeJson = path.join(downloads, `${fixed.channel}-safe.json`);
    await downloadByButton(page, "下載安全 JSON", safeJson);
    evidence.phases["json-roundtrip"] = "PASS_EXPORT_PENDING_REIMPORT";
    const csvZip = path.join(downloads, `${fixed.channel}-safe-csv.zip`);
    await downloadByButton(page, "安全 CSV", csvZip);
    const csvFiles = extractCsvBundle(csvZip, path.join(downloads, `${fixed.channel}-safe-csv`));
    await page.getByRole("button", { name: "關閉", exact: true }).click();

    const beforeCancel = await snapshotIndexedDb(page);
    await setImportFiles(page, [fullJson]);
    await page.getByRole("button", { name: "取消", exact: true }).click();
    assert.deepEqual(await snapshotIndexedDb(page), beforeCancel);
    for (const strategy of ["new", "merge", "replace"]) {
      await setImportFiles(page, [fullJson]);
      await page.locator(".import-options select").selectOption(strategy);
      if (strategy === "new") await page.locator(".import-options input").fill(`QA Import ${suffix}`);
      const acknowledge = page.locator(".import-warning-ack input"); if (await acknowledge.count()) await acknowledge.check();
      await page.getByRole("button", { name: "確認寫入", exact: true }).click();
      await page.getByText(/匯入完成/).waitFor();
    }
    evidence.phases["import-preview-strategies"] = "PASS_JSON";
    evidence.phases["json-roundtrip"] = "PASS";
    await setImportFiles(page, csvFiles);
    await page.locator(".import-options select").selectOption("new");
    await page.locator(".import-options input").fill(`QA CSV Import ${suffix}`);
    const csvAcknowledge = page.locator(".import-warning-ack input"); if (await csvAcknowledge.count()) await csvAcknowledge.check();
    await page.getByRole("button", { name: "確認寫入", exact: true }).click();
    await page.getByText(/匯入完成/).waitFor();
    evidence.phases["csv-five-file-roundtrip"] = "PASS";

    evidence.offlineChannels = buildOfflineChannelLedger({ ...evidence, syntheticProbeBlocked: true, loopbackNavigationPassed: true });
    const observedBrowserChannels = Object.entries(evidence.offlineChannels).filter(([, item]) => item.result === "PASS").map(([name]) => name);
    evidence.phases["offline-observation"] = `PARTIAL_PASS:${observedBrowserChannels.join(",")};UNOBSERVED_REMAIN_NOT_RUN`;
    const storage = await snapshotIndexedDb(page);
    const scans = scanBuffersForSentinels({ dom: await page.locator("body").innerText(), console: JSON.stringify(evidence.console), network: JSON.stringify(evidence.responses), storage: JSON.stringify(storage), json: fs.readFileSync(fullJson), safeJson: fs.readFileSync(safeJson), csvZip: fs.readFileSync(csvZip) }, fixed.sentinels);
    assert.deepEqual(scans, []);
    evidence.phases["sentinel-sinks"] = "PASS_OBSERVED_SINKS";
    assert.deepEqual(evidence.pageErrors, []);
    const unexpectedConsole = classifyUnexpectedConsole(evidence.console, evidence.responses);
    assert.deepEqual(unexpectedConsole, []);
    evidence.result = "PASS_WITH_DECLARED_CHANNEL_LIMITS";
  } catch (error) {
    evidence.result = "FAIL"; evidence.failure = safeText(error instanceof Error ? error.message : error); throw error;
  } finally {
    if (context) { await context.close(); evidence.cleanup.contextClosed = true; }
    fs.writeFileSync(path.join(fixed.evidenceRoot, "full-browser.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  }
  return evidence;
}

function parseArgs(argv) { const out = {}; for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, "")] = argv[i + 1]; return out; }
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const contract = JSON.parse(fs.readFileSync(args.contract, "utf8"));
  const sentinels = JSON.parse(fs.readFileSync(args.sentinels, "utf8"));
  assert.ok(args.playwright && fs.existsSync(args.playwright), "Isolated Playwright module path is required");
  const playwright = normalizePlaywrightModule(await import(pathToFileURL(path.resolve(args.playwright)).href));
  if (args.mode === "exchange") {
    await runExchangeBrowser({ origin: contract.origin, channel: args.channel, evidenceRoot: path.resolve(args.evidence), artifactRoot: path.resolve(args.artifact), viewports: contract.viewports, sentinels: Object.values(sentinels.values), fullJson: path.resolve(args["full-json"]), csvZip: path.resolve(args["csv-zip"]) }, playwright);
    return;
  }
  await runFullBrowser({ origin: contract.origin, channel: args.channel, evidenceRoot: path.resolve(args.evidence), artifactRoot: path.resolve(args.artifact), viewports: contract.viewports, sentinels: Object.values(sentinels.values) }, playwright);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
