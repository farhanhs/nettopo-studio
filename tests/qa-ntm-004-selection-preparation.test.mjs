import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)));
const fixtureUrl = new URL("./fixtures/qa-ntm-004/test-selection-r1.json", import.meta.url);
const selection = JSON.parse(await readFile(fixtureUrl, "utf8"));
const forbiddenImports = new Set(["node:child_process", "child_process", "postgres", "playwright", "@playwright/test"]);
const importPattern = /(?:from\s+|import\s*\()(["'])([^"']+)\1/g;

async function resolveRelativeImport(fromPath, specifier) {
  if (!specifier.startsWith(".")) return undefined;
  const base = path.resolve(path.dirname(fromPath), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next resolution form without evaluating the module.
    }
  }
  throw new Error(`Unresolved local import: ${path.relative(projectRoot, fromPath)} -> ${specifier}`);
}

async function scanClosure(entryPaths) {
  const queue = entryPaths.map((entry) => path.resolve(projectRoot, entry));
  const visited = new Set();
  const findings = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    const source = await readFile(current, "utf8");
    const relative = path.relative(projectRoot, current).replaceAll("\\", "/");
    if (/\bprocess\.env\b/.test(source) && !selection.envReadExceptions.some(({ path: allowed }) => allowed === relative)) {
      findings.push({ path: relative, kind: "environment-read" });
    }
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[2];
      if (forbiddenImports.has(specifier)) findings.push({ path: relative, kind: "forbidden-import", specifier });
      const resolved = await resolveRelativeImport(current, specifier);
      if (resolved && resolved.startsWith(projectRoot)) queue.push(resolved);
    }
  }
  return { visited: [...visited].map((value) => path.relative(projectRoot, value).replaceAll("\\", "/")).sort(), findings };
}

test("QA_NTM_004 selection uses explicit disjoint positive allowlists and no wildcard", () => {
  assert.equal(selection.classification, "qa-only-positive-allowlist");
  assert.equal(selection.formalProductResult, "NOT_RUN");
  assert.equal(selection.wildcardsAllowed, false);
  assert.equal(new Set(selection.moduleAllowlist).size, selection.moduleAllowlist.length);
  assert.equal(new Set(selection.browserAllowlist).size, selection.browserAllowlist.length);
  assert.deepEqual(selection.moduleAllowlist.filter((path) => selection.browserAllowlist.includes(path)), []);
  assert.equal(selection.moduleAllowlist.some((path) => /[*?]/.test(path)), false);
  assert.equal(selection.browserAllowlist.some((path) => /[*?]/.test(path)), false);
});

test("QA_NTM_004 module allowlist source closure has no child process, Browser, DB client, or unapproved environment read", async () => {
  const result = await scanClosure(selection.moduleAllowlist);
  assert.equal(result.visited.length > selection.moduleAllowlist.length, true);
  assert.deepEqual(result.findings, []);
});

test("QA_NTM_004 classifies the observed PostgreSQL lifecycle test as blocked rather than full-suite coverage", () => {
  const db = selection.blockedClasses.find(({ id }) => id === "real-db-or-db-fixture");
  const full = selection.blockedClasses.find(({ id }) => id === "full-glob");
  assert.equal(db.status, "BLOCKED_NO_AUTHORIZATION");
  assert.ok(db.examples.includes("tests/qa-pil-006-postgres-lifecycle.test.mjs"));
  assert.equal(full.status, "PROHIBITED_FOR_QA_NTM_004");
  assert.ok(full.examples.includes("tests/*.test.mjs"));
});

test("QA_NTM_004 Browser entry remains a separate owned-resource gate", () => {
  assert.deepEqual(selection.browserAllowlist, ["tests/qa-ntm-004-browser.mjs"]);
  const browser = selection.blockedClasses.find(({ id }) => id === "browser-child-process");
  assert.equal(browser.status, "SEPARATE_OWNED_BROWSER_GATE");
  assert.deepEqual(browser.examples, selection.browserAllowlist);
});

test("QA_NTM_004 formal prerequisites require fixed hashes, sanitized env, and explicit cleanup", () => {
  assert.ok(selection.requiredBeforeFormalModule.includes("candidate-manifest-and-full-import-closure-fixed"));
  assert.ok(selection.requiredBeforeFormalModule.includes("explicit-sanitized-process-environment"));
  assert.ok(selection.requiredBeforeFormalBrowser.includes("sanitized-project-mirror-created-without-dotenv"));
  assert.ok(selection.requiredBeforeFormalBrowser.includes("cleanup-recovery-plan-recorded"));
});
