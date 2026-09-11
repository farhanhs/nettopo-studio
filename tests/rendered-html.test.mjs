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

test("renders passwordless login shell without legacy demo password", async () => {
  const response = await fetchWorker("/", {
    headers: { accept: "text/html" },
  });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /DIGITAL UNITED SERVICE|登入工作平台|檢查登入狀態/);
  assert.match(html, /login-card/i);
  assert.doesNotMatch(html, /type=["']password["']/i);
  assert.doesNotMatch(html, /sean002002dus|LOGIN_PASSWORD|validateLogin/);
  assert.doesNotMatch(html, /x-nettopo-user-email/);
});

test("topology API requires authentication before actions are handled", async () => {
  const response = await fetchWorker("/api/topology", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "unknown" }),
  });

  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /Authentication|disabled|required/i);
});

test("topology API authenticates before parsing malformed JSON", async () => {
  const response = await fetchWorker("/api/topology", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });

  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /Authentication|disabled|required/i);
});

test("protected endpoints ignore the legacy identity header and fail closed", async () => {
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
      assert.equal(response.status, 401, path);
      assert.match((await response.json()).error, /Authentication|disabled|required|forbidden/i);
    }
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});
