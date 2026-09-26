import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import net from "node:net";
import test from "node:test";
import { chromium } from "@playwright/test";

const root = new URL("../", import.meta.url);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });
}
async function waitReady(url, child) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error("owned preview exited before ready");
    try { if ((await fetch(url)).ok) return; } catch {}
    await sleep(100);
  }
  throw new Error("owned preview readiness timeout");
}
async function stopPreview(child, port) {
  if (child.exitCode === null) child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), sleep(5_000)]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), sleep(2_000)]);
  }
  assert.equal(child.exitCode !== null || child.signalCode !== null, true, "owned preview must exit");
  const closed = await new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => resolve(true));
  });
  assert.equal(closed, true, "owned preview port must close");
}

test("Phase A real bundled worker computes off-thread and terminates without late reply", async () => {
  const workerAssets = (await readdir(new URL("../dist/client/assets/", import.meta.url))).filter((name) => /^topology-layout-worker-.*\.js$/.test(name));
  assert.equal(workerAssets.length, 1, "candidate build must contain exactly one layout worker bundle");
  const port = await freePort();
  const env = Object.fromEntries(["PATH", "Path", "SystemRoot", "TEMP", "TMP", "LOCALAPPDATA", "APPDATA", "USERPROFILE"].filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
  Object.assign(env, { HOST: "127.0.0.1", PORT: String(port), NETTOPO_RUNTIME_PROFILE: "test", NETTOPO_AUTH_MODE: "disabled", NEXT_PUBLIC_TOPOLOGY_STORAGE: "local" });
  const preview = spawn(process.execPath, ["scripts/preview-server.mjs"], { cwd: root, env, stdio: "ignore", windowsHide: true });
  let browser;
  try {
    const baseUrl = `http://127.0.0.1:${port}/`;
    await waitReady(baseUrl, preview);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    const evidence = await page.evaluate(async ({ workerAsset }) => {
      const project = { devices: Array.from({ length: 30 }, (_, index) => ({ id: `d${index}`, name: `d${index}`, type: index < 2 ? "switch" : "server", x: index * 15, y: index * 9 })), links: [], groups: [] };
      const requestId = "qa-browser-worker";
      const input = { requestId, topologyId: "qa-topology", project, request: { requestId, topologyId: "qa-topology", track: "quick", requestedMode: "three-tier", objective: "balanced", pinnedDeviceIds: [], preserveGroups: true } };
      let ticks = 0;
      const timer = setInterval(() => { ticks++; }, 0);
      const worker = new Worker(`/assets/${workerAsset}`, { type: "module", name: "qa-layout-worker" });
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("worker timeout")), 10_000);
        worker.onmessage = (event) => { clearTimeout(timeout); resolve(event.data); };
        worker.onerror = () => { clearTimeout(timeout); reject(new Error("worker error")); };
        worker.postMessage(input);
      });
      worker.terminate(); clearInterval(timer);
      let lateReplies = 0;
      const cancelled = new Worker(`/assets/${workerAsset}`, { type: "module", name: "qa-layout-worker-cancel" });
      cancelled.onmessage = () => { lateReplies++; };
      cancelled.postMessage({ ...input, requestId: "qa-cancel", request: { ...input.request, requestId: "qa-cancel" } });
      cancelled.terminate();
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { ok: response.ok === true, sameRequest: response.requestId === requestId, candidateCount: response.selection?.candidates?.length ?? 0, ticks, lateReplies };
    }, { workerAsset: workerAssets[0] });
    assert.equal(evidence.ok, true);
    assert.equal(evidence.sameRequest, true);
    assert.equal(evidence.candidateCount, 2);
    assert.ok(evidence.ticks > 0, "UI event loop must remain responsive while worker computes");
    assert.equal(evidence.lateReplies, 0);
  } finally {
    await browser?.close();
    await stopPreview(preview, port);
  }
});
