import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightPath = path.resolve(".local/qa-bta-001-20261019/tools/node_modules/playwright/index.js");
const chromePath = path.resolve(".local/qa-bta-a08-r4-20261020/browsers/chrome/chrome.exe");

test("real Browser CDP request-stage interception blocks redirect continuation", async () => {
  let sinkHits = 0;
  const sink = http.createServer((request, response) => {
    sinkHits += 1;
    response.writeHead(204).end();
  });
  const source = http.createServer((request, response) => {
    response.writeHead(302, { location: `http://127.0.0.1:${sink.address().port}/sink` }).end();
  });
  await new Promise(resolve => sink.listen(0, "127.0.0.1", resolve));
  await new Promise(resolve => source.listen(0, "127.0.0.1", resolve));
  const startUrl = `http://127.0.0.1:${source.address().port}/start`;

  const namespace = await import(pathToFileURL(playwrightPath).href);
  const playwright = namespace.chromium ? namespace : namespace.default;
  const browser = await playwright.chromium.launch({ executablePath: chromePath, headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
    cdp.on("Fetch.requestPaused", async event => {
      if (event.request.url !== startUrl) {
        await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" });
      } else {
        await cdp.send("Fetch.continueRequest", { requestId: event.requestId });
      }
    });
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 5000 }).catch(() => {});
    assert.equal(sinkHits, 0, "the redirect sink must not be reached with the reviewed CDP strategy");
    await cdp.send("Fetch.disable");
    await context.close();
  } finally {
    await browser.close();
    await new Promise(resolve => source.close(resolve));
    await new Promise(resolve => sink.close(resolve));
  }
});
