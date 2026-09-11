import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("DEV_PIL_003 selects exactly one logout endpoint from the active runtime profile", () => {
  const logoutBody = pageSource.match(/async function logoutFromWorkspace\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.match(logoutBody, /runtimeCapabilities\?\.profile === "pilot"/);
  assert.match(logoutBody, /const logoutEndpoint = isPilotRuntime \? "\/api\/pilot\/session" : "\/api\/dev\/session"/);
  assert.match(logoutBody, /await fetch\(logoutEndpoint/);
  assert.doesNotMatch(logoutBody, /await fetch\("\/api\/dev\/session"[\s\S]*await fetch\("\/api\/pilot\/session"/);
});

test("DEV_PIL_003 preserves JSON mutation headers only for Pilot logout", () => {
  const logoutBody = pageSource.match(/async function logoutFromWorkspace\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.match(logoutBody, /headers: isPilotRuntime \? \{ "Content-Type": "application\/json" \} : undefined/);
});
