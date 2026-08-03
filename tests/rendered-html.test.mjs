import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

let workerPromise;

function loadWorker() {
  workerPromise ??= import(
    new URL(`../dist/server/index.js?test=${process.pid}-${Date.now()}`, import.meta.url).href
  ).then(({ default: worker }) => worker);
  return workerPromise;
}

function workerEnv() {
  return {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  };
}

function executionContext() {
  return {
    waitUntil() {},
    passThroughOnException() {},
  };
}

async function fetchWorker(path, init) {
  const worker = await loadWorker();
  const request = new Request(`http://localhost${path}`, init);
  return typeof worker === "function"
    ? worker(request)
    : worker.fetch(request, workerEnv(), executionContext());
}

test("renders development preview metadata", async () => {
  const response = await fetchWorker("/", {
    headers: { accept: "text/html" },
  });

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("renders login guidance on the root path without a URL suffix", async () => {
  const response = await fetchWorker("/", {
    headers: { accept: "text/html" },
  });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /數位聯合服務網路設備拓樸工具/);
  assert.match(html, /登入工作平台/);
  assert.match(html, /帳號/);
  assert.match(html, /密碼/);
  assert.doesNotMatch(html, /action=["'][^"']+/i);
  assert.match(html, /<form[^>]*class=["'][^"']*login-card/i);
  assert.match(html, /<button[^>]*type=["']submit["'][^>]*>登入系統/i);
  assert.doesNotMatch(html, /\/login\b/i);
  assert.doesNotMatch(html, /sean002002dus/);
});

test("topology API rejects unsupported actions", async () => {
  const response = await fetchWorker("/api/topology", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "unknown" }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Unsupported topology action.",
  });
});

test("topology API validates required text fields", async () => {
  const response = await fetchWorker("/api/topology", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "renameTopology", topologyId: " ", name: "New name" }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "topologyId is required." });
});

test("topology API validates project structure before storage access", async () => {
  const response = await fetchWorker("/api/topology", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "createTopology",
      customerId: "customer-1",
      name: "Branch office",
      project: { devices: [], links: [] },
    }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid project: groups: Invalid input" });
});

test("topology API returns a client error for malformed JSON", async () => {
  const response = await fetchWorker("/api/topology", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /json|unexpected|position/i);
});

test("storage-backed endpoints report missing database configuration", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    for (const path of [
      "/api/topology",
      "/api/session",
      "/api/credentials?topologyId=topology-1",
      "/api/audit-logs",
    ]) {
      const response = await fetchWorker(path, {
        headers: { "x-nettopo-user-email": "engineer@company.local" },
      });
      assert.equal(response.status, 503, path);
      assert.deepEqual(await response.json(), {
        error: "DATABASE_URL is required when NEXT_PUBLIC_TOPOLOGY_STORAGE=server.",
      });
    }
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});
