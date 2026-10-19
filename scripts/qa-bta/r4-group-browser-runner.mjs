import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

import {
  assertGroupDeleteTransition,
  assertGroupEditTransition,
  assertProjectUnchanged,
} from "./browser-assertions.mjs";

const ORIGIN = "http://127.0.0.1:4317";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const [zipPath, playwrightPath, evidenceRoot, fixturePath] = process.argv.slice(2).map(value => path.resolve(value));
assert.ok(zipPath && playwrightPath && evidenceRoot && fixturePath, "zip, isolated Playwright, evidence root and fixture are required");
assert.equal(fs.existsSync(evidenceRoot), false, "evidence root must be new");
fs.mkdirSync(evidenceRoot, { recursive: false });

const ps = path.join(process.env.SystemRoot ?? "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const unzip = spawnSync(ps, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
  `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory(${literal(zipPath)}, ${literal(evidenceRoot)})`],
  { encoding: "utf8", windowsHide: true, timeout: 120000 });
assert.equal(unzip.status, 0, unzip.stderr);
const artifactRoot = path.join(evidenceRoot, "NetTopo-Studio-0.1.0-beta.1");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const envelope = {
  schemaVersion: 1,
  kind: "nettopo-project",
  sharing: "full",
  exportedAt: "2026-10-19T00:00:00.000Z",
  topologyName: "QA R4 Group Oracle",
  project: fixture.base,
};
const importPath = path.join(evidenceRoot, "qa-group-oracle.json");
fs.writeFileSync(importPath, `${JSON.stringify(envelope, null, 2)}\n`);

const runLifecycle = command => {
  const result = spawnSync(process.execPath, [`runtime/tools/${command}.mjs`], {
    cwd: artifactRoot,
    env: { ...process.env, BTA_PROFILE: "local-beta" },
    encoding: "utf8",
    windowsHide: true,
    timeout: 180000,
  });
  const output = result.stdout.trim();
  let body;
  try { body = JSON.parse(output); } catch { body = { code: "INVALID_JSON", output: output.slice(0, 500), stderr: result.stderr.slice(0, 500) }; }
  return { exit: result.status, ...body };
};

const playwrightModule = await import(pathToFileURL(playwrightPath).href);
const playwright = playwrightModule.chromium ? playwrightModule : playwrightModule.default;
assert.equal(typeof playwright?.chromium?.launchPersistentContext, "function");

const snapshot = page => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open("nettopo-studio-db");
  request.onerror = () => reject(new Error("IndexedDB unavailable"));
  request.onsuccess = () => {
    const db = request.result;
    const tx = db.transaction(["topologies", "meta"], "readonly");
    const rows = tx.objectStore("topologies").getAll();
    const active = tx.objectStore("meta").get("activeTopologyId");
    tx.oncomplete = () => { db.close(); resolve({ rows: rows.result, active: active.result?.value }); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  };
}));
const projectOf = state => state.rows.find(row => row.id === state.active)?.project;
const importFixture = async page => {
  await page.getByRole("button", { name: "匯入", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(importPath);
  await page.locator(".import-options select").selectOption("replace");
  const ack = page.locator(".import-warning-ack input");
  if (await ack.count()) await ack.check();
  await page.getByRole("button", { name: "確認寫入", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
};

const evidence = {
  candidateSha256: hash(fs.readFileSync(zipPath)),
  fixtureSha256: hash(fs.readFileSync(fixturePath)),
  playwrightPath,
  results: [],
  lifecycle: {},
  cleanup: { contextsClosed: false, listenerAfter: null, zipUnchanged: false },
  result: "RUNNING",
};
const contexts = [];
try {
  evidence.lifecycle.setup = runLifecycle("setup");
  assert.equal(evidence.lifecycle.setup.code, "BTA_SETUP_OK");
  evidence.lifecycle.start = runLifecycle("start");
  assert.equal(evidence.lifecycle.start.code, "BTA_STARTED");
  for (const channel of ["chrome", "msedge"]) {
    const context = await playwright.chromium.launchPersistentContext(path.join(evidenceRoot, `${channel}-profile`), {
      channel, headless: true, viewport: { width: 1280, height: 900 }, serviceWorkers: "block",
      args: ["--disable-background-networking", "--no-first-run"],
    });
    contexts.push(context);
    const unexpected = [];
    await context.route("**/*", route => {
      const url = route.request().url();
      if (url === ORIGIN || url.startsWith(`${ORIGIN}/`)) return route.continue();
      unexpected.push(url); return route.abort("blockedbyclient");
    });
    const page = context.pages()[0] ?? await context.newPage();
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
    await page.locator('[data-local-beta="true"]').waitFor();
    await importFixture(page);
    await page.locator(".tabs").getByRole("button", { name: "容器", exact: true }).click();
    const baselineState = await snapshot(page);
    const baseline = structuredClone(projectOf(baselineState));
    const dialog = page.getByRole("dialog");
    const edit = name => page.getByRole("button", { name: `編輯容器 ${name}`, exact: true });
    const remove = name => page.getByRole("button", { name: `刪除容器 ${name}`, exact: true });
    const widths = [];
    for (const width of [360, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: width === 360 ? 640 : 900 });
      await edit("Target Group").click({ trial: true });
      await edit("Target Group").click();
      await dialog.getByRole("button", { name: "取消", exact: true }).click();
      await remove("Target Group").click({ trial: true });
      await remove("Target Group").click();
      assert.match(await dialog.innerText(), /成員設備：2 個節點/);
      assert.match(await dialog.innerText(), /設備與連線會保留/);
      await dialog.getByRole("button", { name: "取消", exact: true }).click();
      assertProjectUnchanged(baseline, projectOf(await snapshot(page)));
      const viewport = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(viewport.scroll <= viewport.client + 1, `horizontal overflow at ${width}`);
      await page.screenshot({ path: path.join(evidenceRoot, `${channel}-${width}.png`), fullPage: true });
      widths.push(width);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await edit("Target Group").click();
    await dialog.getByLabel("容器名稱", { exact: true }).fill("Edited Target");
    await dialog.getByRole("combobox", { name: /^分類/ }).selectOption("vlan");
    await dialog.getByLabel("識別色", { exact: true }).fill("#112233");
    await dialog.getByRole("button", { name: "儲存變更", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    const edited = projectOf(await snapshot(page));
    assertGroupEditTransition(baseline, edited, fixture.targetGroupId);
    assert.deepEqual(edited, fixture.edited);
    await page.reload();
    await page.locator('[data-local-beta="true"]').waitFor();
    assert.deepEqual(projectOf(await snapshot(page)), fixture.edited);
    await page.locator(".tabs").getByRole("button", { name: "容器", exact: true }).click();

    const beforeFailure = structuredClone(projectOf(await snapshot(page)));
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === "topologies") throw new DOMException("QA injected persistence failure", "QuotaExceededError");
        return original.apply(this, args);
      };
    });
    await edit("Edited Target").click();
    await dialog.getByLabel("容器名稱", { exact: true }).fill("Rejected Edit");
    await dialog.getByRole("button", { name: "儲存變更", exact: true }).click();
    assert.match(await dialog.getByRole("alert").innerText(), /原資料已保留/);
    assertProjectUnchanged(beforeFailure, projectOf(await snapshot(page)));
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await page.reload();
    await page.locator('[data-local-beta="true"]').waitFor();
    await page.locator(".tabs").getByRole("button", { name: "容器", exact: true }).click();
    await remove("Edited Target").click();
    await dialog.getByRole("button", { name: "刪除容器", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    const deleted = projectOf(await snapshot(page));
    assertGroupDeleteTransition(fixture.edited, deleted, fixture.targetGroupId);
    assert.deepEqual(JSON.parse(JSON.stringify(deleted)), fixture.deletedNonEmpty);
    await remove("Empty Group").click();
    assert.match(await dialog.innerText(), /成員設備：0 個節點/);
    const beforeEmptyDelete = structuredClone(projectOf(await snapshot(page)));
    await dialog.getByRole("button", { name: "刪除容器", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    const afterEmptyDelete = projectOf(await snapshot(page));
    assertGroupDeleteTransition(beforeEmptyDelete, afterEmptyDelete, fixture.emptyGroupId);
    const finalProject = structuredClone(fixture.deletedNonEmpty);
    finalProject.groups = finalProject.groups.filter(group => group.id !== fixture.emptyGroupId);
    assert.deepEqual(JSON.parse(JSON.stringify(afterEmptyDelete)), finalProject);
    await page.reload();
    await page.locator('[data-local-beta="true"]').waitFor();
    assert.deepEqual(JSON.parse(JSON.stringify(projectOf(await snapshot(page)))), finalProject);

    await page.getByRole("button", { name: "匯出", exact: true }).click();
    page.once("dialog", prompt => prompt.accept());
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "下載完整 JSON", exact: true }).click();
    const exportPath = path.join(evidenceRoot, `${channel}-group-export.json`);
    await (await pending).saveAs(exportPath);
    assert.deepEqual(JSON.parse(fs.readFileSync(exportPath, "utf8")).project, finalProject);
    assert.deepEqual(unexpected, []);
    assert.deepEqual(pageErrors, []);
    evidence.results.push({ channel, browserVersion: context.browser()?.version(), widths, cancelZeroWrite: true,
      editExact: true, persistenceFailureZeroWrite: true, nonEmptyDeleteExact: true, emptyDeleteExact: true,
      reload: true, fullJsonExport: true });
    await context.close();
    contexts.pop();
  }
  evidence.result = "PASS";
} catch (error) {
  evidence.result = "FAIL";
  evidence.failure = String(error?.stack ?? error).slice(0, 4000);
  throw error;
} finally {
  for (const context of contexts.splice(0)) await context.close().catch(() => {});
  evidence.cleanup.contextsClosed = true;
  evidence.lifecycle.stop = runLifecycle("stop");
  const check = spawnSync(ps, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
    "@(Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue).Count"], { encoding: "utf8", windowsHide: true });
  evidence.cleanup.listenerAfter = Number(check.stdout.trim() || 0);
  evidence.cleanup.zipUnchanged = evidence.candidateSha256 === hash(fs.readFileSync(zipPath));
  fs.writeFileSync(path.join(evidenceRoot, "r4-group-result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
}
