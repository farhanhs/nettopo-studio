import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";

const ticket = "QA_PIL_004";
const host = "127.0.0.1";
const port = process.env.QA_PIL_004_PORT ?? "4404";
const baseUrl = `http://${host}:${port}`;
const screenshotsDir = resolve("docs/dev測試紀錄/screenshots");
const summaryPath = resolve("docs/dev測試紀錄/qa-pil-004-topology-site-summary.json");
const topologyName = `QA PIL 004 未指定拓樸 ${Date.now()}`;
const deviceName = "QA PIL 004 Router";
const candidateFiles = [
  "app/page.tsx",
  "app/globals.css",
  "app/lib/topology-store.ts",
  "docs/engineerticket/active/DEV_PIL_002.md",
];

const evidence = {
  ticket,
  result: "IN_PROGRESS",
  mode: "browser-local / Playwright Chromium / loopback preview",
  baseUrl,
  startedAt: new Date().toISOString(),
  candidateHashes: {},
  durationMs: 0,
  screenshots: [],
  network: [],
  localEmptySites: {},
  persistence: {},
  responsive: {},
  guardCoverage: {},
  cleanup: {},
  failure: undefined,
};

function qaEnv() {
  return {
    ...process.env,
    HOST: host,
    PORT: port,
    NEXT_PUBLIC_TOPOLOGY_STORAGE: "local",
    NETTOPO_RUNTIME_PROFILE: "development",
    NETTOPO_AUTH_MODE: "demo",
    NETTOPO_ENABLE_DEV_IDENTITY_HEADER: "0",
    NETTOPO_ENABLE_DEMO_SEED: "0",
    NETTOPO_PILOT_ALLOW_FULL_EXPORT: "0",
  };
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const isWindowsCommandShim = process.platform === "win32" && /\.cmd$/i.test(command);
    const child = isWindowsCommandShim ? spawn("cmd.exe", ["/d", "/s", "/c", [command, ...args].join(" ")], {
      stdio: "inherit",
      shell: false,
      ...options,
    }) : spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    });
    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} ${args.join(" ")} exited with ${code ?? signal}`));
    });
  });
}

function startPreview() {
  const child = spawn(
    "node",
    ["--env-file-if-exists=.env.local", "--env-file-if-exists=.env", "scripts/preview-server.mjs"],
    {
      env: qaEnv(),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => {
    const text = String(chunk);
    if (text.includes("NetTopo preview running")) process.stdout.write(text);
  });
  child.stderr.on("data", (chunk) => {
    const text = String(chunk);
    if (!/password|secret|token|cookie|DATABASE_URL/i.test(text)) process.stderr.write(text);
  });
  return child;
}

async function stopPreview(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolveStop) => {
    const timer = setTimeout(resolveStop, 3_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolveStop();
    });
  });
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.status < 500) return;
    } catch {
      // keep polling
    }
    await new Promise((resolvePoll) => setTimeout(resolvePoll, 500));
  }
  throw new Error(`Preview server did not become ready at ${baseUrl}`);
}

async function screenshot(page, name) {
  const path = resolve(screenshotsDir, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  evidence.screenshots.push(path);
  return path;
}

async function hashCandidateFiles() {
  return Object.fromEntries(await Promise.all(candidateFiles.map(async (path) => {
    const bytes = await readFile(resolve(path));
    return [path, createHash("sha256").update(bytes).digest("hex").toUpperCase()];
  })));
}

async function idbSnapshot(page) {
  return await page.evaluate(async () => {
    const db = await new Promise((resolveOpen, rejectOpen) => {
      const request = indexedDB.open("nettopo-studio-db");
      request.onerror = () => rejectOpen(request.error);
      request.onsuccess = () => resolveOpen(request.result);
    });
    try {
      const readAll = (storeName) => new Promise((resolveRead, rejectRead) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).getAll();
        request.onerror = () => rejectRead(request.error);
        request.onsuccess = () => resolveRead(request.result);
      });
      const [customers, topologies, meta] = await Promise.all([
        readAll("customers"),
        readAll("topologies"),
        readAll("meta"),
      ]);
      return { customers, topologies, meta };
    } finally {
      db.close();
    }
  });
}

async function loginDemo(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const demoButton = page.getByRole("button", { name: "進入本機 Demo" });
  await demoButton.waitFor({ state: "visible", timeout: 15_000 });
  await demoButton.click();
  await page.getByText("資訊欄位").waitFor({ timeout: 20_000 });
}

async function openCreateTopologyModal(page) {
  const topologySwitcher = page.locator(".switcher-field").filter({ hasText: "拓樸" }).first();
  await topologySwitcher.getByRole("button", { name: "新增" }).click();
  const dialog = page.getByRole("dialog", { name: "新增拓樸" });
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  return dialog;
}

async function createUnspecifiedTopology(page) {
  const dialog = await openCreateTopologyModal(page);
  const siteSelect = dialog.locator("select[name='siteId']");
  await siteSelect.waitFor({ state: "visible", timeout: 5_000 });
  assert.equal(await siteSelect.inputValue(), "", "empty browser-local site select should submit an empty value");
  const optionText = await siteSelect.locator("option").first().innerText();
  assert.equal(optionText.trim(), "未指定");
  const disabled = await siteSelect.isDisabled();
  assert.equal(disabled, false, "browser-local empty site select should not disable topology creation");
  const required = await siteSelect.evaluate((node) => node.required);
  assert.equal(required, false, "browser-local unspecified site must not be required");

  await dialog.locator("input[name='name']").fill(topologyName);
  await dialog.getByRole("button", { name: "建立拓樸" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 10_000 });
  await page.getByText(`已建立拓樸：${topologyName}`).waitFor({ timeout: 10_000 });
}

async function addDeviceAndWaitForSave(page) {
  await page.getByRole("button", { name: "+ 新增設備" }).click();
  const dialog = page.getByRole("dialog", { name: "新增設備" });
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  await dialog.locator("input[name='name']").fill(deviceName);
  await dialog.locator("input[name='ip']").fill("10.40.4.1");
  await dialog.getByRole("button", { name: "確認新增" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 10_000 });
  await page.locator(".device-list").getByText(deviceName).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
}

async function measureOpenTopologyModal(page, scenario, { width, height, cssZoom = 1, stressLongText = false } = {}) {
  await page.setViewportSize({ width, height });
  await page.evaluate((zoom) => {
    document.documentElement.style.zoom = String(zoom);
  }, cssZoom);
  const dialog = await openCreateTopologyModal(page);
  if (stressLongText) {
    const longText = "QA_PIL_004_超長站點或錯誤提示文字_stress_" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".repeat(4);
    await dialog.locator("input[name='name']").fill(longText);
    await dialog.evaluate((node, text) => {
      const fieldNote = node.querySelector(".field-note");
      const option = node.querySelector("select[name='siteId'] option");
      if (fieldNote) fieldNote.textContent = text;
      if (option) option.textContent = text;
    }, longText);
  }
  await dialog.locator("input[name='name']").focus();
  const focusAudit = await dialog.evaluate((node) => {
    const focusables = Array.from(node.querySelectorAll("input, select, button")).filter((element) => {
      const htmlElement = element;
      return !htmlElement.disabled && htmlElement.offsetParent !== null;
    });
    return focusables.map((element) => ({
      tag: element.tagName.toLowerCase(),
      name: element.getAttribute("name") ?? element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
      type: element.getAttribute("type") ?? "",
    }));
  });
  const measurements = await page.evaluate(() => {
    const modal = document.querySelector(".modal")?.getBoundingClientRect();
    const form = document.querySelector(".modal .form-grid");
    const actions = document.querySelector(".modal .form-actions")?.getBoundingClientRect();
    const fieldNote = document.querySelector(".modal .field-note")?.getBoundingClientRect();
    const siteSelect = document.querySelector(".modal select[name='siteId']")?.getBoundingClientRect();
    const style = form ? getComputedStyle(form) : undefined;
    const fieldNoteElement = document.querySelector(".modal .field-note");
    const fieldNoteStyle = fieldNoteElement ? getComputedStyle(fieldNoteElement) : undefined;
    return {
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      modalWidth: modal?.width ?? 0,
      gridColumns: style?.gridTemplateColumns ?? "",
      actionsBottom: actions?.bottom ?? 0,
      actionsTop: actions?.top ?? 0,
      fieldNoteWidth: fieldNote?.width ?? 0,
      siteSelectWidth: siteSelect?.width ?? 0,
      fieldNoteOverflowWrap: fieldNoteStyle?.overflowWrap ?? "",
      innerHeight,
    };
  });
  assert.ok(measurements.scrollWidth <= measurements.innerWidth + 1, `${scenario} should not create horizontal overflow`);
  assert.ok(measurements.modalWidth <= measurements.innerWidth, `${scenario} modal must fit inside viewport`);
  if (width <= 640 || height <= 520) {
    assert.equal(measurements.gridColumns.trim().split(" ").length, 1, `${scenario} modal should be single-column`);
  }
  assert.ok(measurements.actionsTop < measurements.innerHeight, `${scenario} footer actions should be reachable`);
  assert.ok(focusAudit.some((item) => item.name === "siteId"), `${scenario} site select must be keyboard focusable`);
  assert.ok(focusAudit.some((item) => item.name.includes("建立拓樸")), `${scenario} submit button must be keyboard reachable`);
  await screenshot(page, `qa-pil-004-responsive-${scenario}`);
  await dialog.getByLabel("關閉").click();
  await dialog.waitFor({ state: "hidden", timeout: 10_000 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  return { scenario, viewport: { width, height }, cssZoom, stressLongText, focusAudit, measurements };
}

async function verifyResponsiveModal(page) {
  const matrix = [];
  matrix.push(await measureOpenTopologyModal(page, "360x520", { width: 360, height: 520 }));
  matrix.push(await measureOpenTopologyModal(page, "768x720", { width: 768, height: 720 }));
  matrix.push(await measureOpenTopologyModal(page, "1280x850", { width: 1280, height: 850 }));
  matrix.push(await measureOpenTopologyModal(page, "short-height-720x420", { width: 720, height: 420 }));
  matrix.push(await measureOpenTopologyModal(page, "long-text-360x520", { width: 360, height: 520, stressLongText: true }));
  evidence.responsive = {
    method: "viewport matrix with direct DOM measurements; 200% zoom is covered by a separate Playwright context using deviceScaleFactor=2",
    matrix,
  };
  await page.setViewportSize({ width: 1280, height: 850 });
}

async function verifyDeviceScaleZoom(browser) {
  const context = await browser.newContext({ viewport: { width: 360, height: 520 }, deviceScaleFactor: 2 });
  try {
    const page = await context.newPage();
    await loginDemo(page);
    const measurement = await measureOpenTopologyModal(page, "device-scale-2-360x520", { width: 360, height: 520 });
    evidence.responsive.deviceScaleFactor2 = {
      method: "Playwright browser context deviceScaleFactor=2, representing 200% display scaling without modifying product code",
      measurement,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const started = Date.now();
  let browser;
  let preview;
  try {
    await mkdir(screenshotsDir, { recursive: true });
    evidence.candidateHashes = await hashCandidateFiles();
    await run("npm.cmd", ["run", "build:local"], { env: qaEnv() });
    preview = startPreview();
    await waitForServer();

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, acceptDownloads: true });
    const page = await context.newPage();
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin !== baseUrl || !url.pathname.startsWith("/api/")) return;
      evidence.network.push({
        path: url.pathname,
        status: response.status(),
        cacheControl: response.headers()["cache-control"] ?? "",
        xContentTypeOptions: response.headers()["x-content-type-options"] ?? "",
      });
    });

    await loginDemo(page);
    await page.getByText("未指定站點").waitFor({ timeout: 10_000 });
    await screenshot(page, "qa-pil-004-local-empty-initial");
    await verifyResponsiveModal(page);
    await verifyDeviceScaleZoom(browser);
    await createUnspecifiedTopology(page);
    await screenshot(page, "qa-pil-004-created-unspecified-topology");
    await addDeviceAndWaitForSave(page);
    await screenshot(page, "qa-pil-004-device-persist-before-reload");

    const beforeReload = await idbSnapshot(page);
    const createdBeforeReload = beforeReload.topologies.find((topology) => topology.name === topologyName);
    assert.ok(createdBeforeReload, "created topology must be present in IndexedDB before reload");
    assert.equal(createdBeforeReload.siteId, undefined, "browser-local empty-site topology must persist siteId as undefined");
    assert.ok(!["unspecified", "none", "local", "default-site", ""].includes(String(createdBeforeReload.siteId ?? "__undefined__")), "siteId must not be a fake sentinel id");
    assert.equal(createdBeforeReload.project.devices.some((device) => device.name === deviceName), true, "device edit must persist before reload");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText("資訊欄位").waitFor({ timeout: 20_000 });
    await page.locator(".switcher-field").filter({ hasText: "拓樸" }).locator("option", { hasText: topologyName }).waitFor({ state: "attached", timeout: 10_000 });
    await page.locator(".local-note").getByText(topologyName).waitFor({ timeout: 10_000 });
    await page.locator(".local-note").getByText("未指定站點").waitFor({ timeout: 10_000 });
    await page.locator(".device-list").getByText(deviceName).waitFor({ timeout: 10_000 });
    await screenshot(page, "qa-pil-004-reload-persisted-unspecified");

    const afterReload = await idbSnapshot(page);
    const createdAfterReload = afterReload.topologies.find((topology) => topology.name === topologyName);
    assert.ok(createdAfterReload, "created topology must be present in IndexedDB after reload");
    assert.equal(createdAfterReload.siteId, undefined, "created topology must still have undefined siteId after reload");
    assert.equal(createdAfterReload.project.devices.some((device) => device.name === deviceName), true, "device edit must persist after reload");

    evidence.localEmptySites = {
      optionText: "未指定",
      selectDisabled: false,
      selectRequired: false,
      createdTopologyName: topologyName,
      renderedSiteText: "未指定站點",
    };
    evidence.persistence = {
      customerCount: afterReload.customers.length,
      topologyCount: afterReload.topologies.length,
      createdSiteId: createdAfterReload.siteId ?? null,
      fakeSiteIdDetected: false,
      devicePersistedAfterReload: true,
    };
    evidence.guardCoverage = {
      serverPilotEmptySites: "covered by tests/dev-pil-002-topology-site.test.mjs and tests/pilot-checkpoint.test.mjs; not asserted as browser evidence in this script",
      browserLocalWithSites: "not representable in current Dexie schema because local durable DB has customers/topologies/meta only and app returns sites=[] in local mode",
      activeTopologySiteInheritance: "covered by tests/dev-pil-002-topology-site.test.mjs source guard and this browser-local persisted undefined siteId check",
    };
    evidence.cleanup = {
      storage: "ephemeral Playwright browser context closed; no persistent QA DB fixture created by this local-mode UAT",
      postgresFixtureCounts: "not applicable",
    };
    evidence.result = "PASS";
    await context.close();
  } catch (error) {
    evidence.result = "FAIL";
    evidence.failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopPreview(preview);
    evidence.durationMs = Date.now() - started;
    await mkdir(resolve("docs/dev測試紀錄"), { recursive: true });
    await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    console.log(`[${ticket}] ${evidence.result}; summary=${summaryPath}`);
  }
}

await main();
