import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { auditObservedUrls, scanBuffersForSentinels } from "./harness.mjs";

export const canonicalOrigin = "http://127.0.0.1:4317";

export function validateBrowserOptions(options) {
  assert.equal(options.origin, canonicalOrigin, "BTA_PROFILE_INVALID:origin");
  assert.ok(["chrome", "msedge"].includes(options.channel), "Unsupported QA browser channel");
  assert.equal(fs.existsSync(options.evidenceRoot), false, "QA evidence root must not pre-exist");
  assert.ok(Array.isArray(options.viewports) && options.viewports.length >= 4);
  for (const viewport of options.viewports) {
    assert.ok(Number.isInteger(viewport.width) && viewport.width >= 360);
    assert.ok(Number.isInteger(viewport.height) && viewport.height >= 520);
  }
  return options;
}

export function classifyBrowserEvidence(evidence, sentinels) {
  const externalRequests = auditObservedUrls(evidence.urls);
  const secretHits = scanBuffersForSentinels({
    dom: evidence.dom,
    console: evidence.console.map((entry) => entry.text).join("\n"),
    network: evidence.responses.join("\n"),
    storage: JSON.stringify(evidence.storage),
  }, sentinels);
  return {
    externalRequests,
    secretHits,
    unexpectedConsoleErrors: evidence.console.filter((entry) => entry.type === "error"),
    pageErrors: evidence.pageErrors,
  };
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) values[argv[index].replace(/^--/, "")] = argv[index + 1];
  return values;
}

export async function runBrowserSmoke(options, playwright) {
  validateBrowserOptions(options);
  fs.mkdirSync(options.evidenceRoot, { recursive: false });
  const profile = path.join(options.evidenceRoot, "profile");
  const screenshots = path.join(options.evidenceRoot, "screenshots");
  fs.mkdirSync(screenshots);
  const evidence = { channel: options.channel, urls: [], responses: [], console: [], pageErrors: [], storage: [], viewports: [], result: "RUNNING" };
  let context;
  try {
    context = await playwright.chromium.launchPersistentContext(profile, { channel: options.channel, headless: true, acceptDownloads: true, viewport: options.viewports[0] });
    const page = context.pages()[0] ?? await context.newPage();
    page.on("request", (request) => evidence.urls.push(request.url()));
    page.on("response", async (response) => {
      if (!response.url().startsWith(canonicalOrigin)) return;
      if (!new URL(response.url()).pathname.startsWith("/api/")) return;
      try { evidence.responses.push(await response.text()); } catch { /* disposed response */ }
    });
    page.on("console", (message) => evidence.console.push({ type: message.type(), text: message.text() }));
    page.on("pageerror", (error) => evidence.pageErrors.push(error.message));
    await page.goto(options.origin, { waitUntil: "domcontentloaded" });
    const banner = page.locator(options.bannerSelector);
    await banner.waitFor();
    assert.equal((await banner.innerText()).trim(), options.banner);
    assert.equal(await page.locator('input[type="password"]').count(), 0);
    assert.equal(await page.getByText(/公司登入|測試身分|本機 Demo/).count(), 0);
    for (const viewport of options.viewports) {
      await page.setViewportSize(viewport);
      const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(dimensions.scroll <= dimensions.client + 1, `Horizontal overflow at ${viewport.width}x${viewport.height}`);
      evidence.viewports.push({ ...viewport, horizontalOverflow: false });
    }
    evidence.dom = await page.locator("body").innerText();
    evidence.storage = await page.evaluate(async () => {
      const databases = typeof indexedDB.databases === "function" ? await indexedDB.databases() : [];
      return databases.map(({ name, version }) => ({ name, version }));
    });
    await page.screenshot({ path: path.join(screenshots, `${options.channel}-entry.png`), fullPage: true });
    const classified = classifyBrowserEvidence(evidence, options.sentinels);
    assert.deepEqual(classified.externalRequests, []);
    assert.deepEqual(classified.secretHits, []);
    assert.deepEqual(classified.unexpectedConsoleErrors, []);
    assert.deepEqual(classified.pageErrors, []);
    evidence.result = "PASS_SMOKE_ONLY";
  } catch (error) {
    evidence.result = "FAIL";
    evidence.failure = error instanceof Error ? error.message : "Unknown Browser harness failure";
    throw error;
  } finally {
    let contextClosed = false;
    if (context) { await context.close(); contextClosed = true; }
    evidence.cleanup = { contextClosed };
    fs.writeFileSync(path.join(options.evidenceRoot, "browser-smoke.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  }
  return evidence;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const contract = JSON.parse(fs.readFileSync(args.contract, "utf8"));
  const sentinelCatalog = JSON.parse(fs.readFileSync(args.sentinels, "utf8"));
  const playwright = await import("playwright");
  await runBrowserSmoke({ origin: contract.origin, channel: args.channel, evidenceRoot: path.resolve(args.evidence), viewports: contract.viewports, banner: contract.banner, bannerSelector: contract.bannerSelector, sentinels: Object.values(sentinelCatalog.values) }, playwright);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
