import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync("app/page.tsx", "utf8");
const cssSource = readFileSync("app/globals.css", "utf8");

test("DEV_UIX_004 renders session profile inside the topbar save-state flow", () => {
  const topbarStart = pageSource.indexOf('<header className="topbar">');
  const workspaceStart = pageSource.indexOf("{!panelLayoutReady || !ready");
  const sessionProfile = pageSource.indexOf('className="session-profile"');

  assert.notEqual(topbarStart, -1);
  assert.notEqual(workspaceStart, -1);
  assert.notEqual(sessionProfile, -1);
  assert.ok(sessionProfile > topbarStart && sessionProfile < workspaceStart);
  assert.match(pageSource, /<div className="save-state">[\s\S]*className="session-profile"/);
  assert.match(pageSource, /aria-label="登入者資料"/);
  assert.match(pageSource, /aria-label=\{`登出 \$\{currentUser\.name\}`\}/);
});

test("DEV_UIX_004 session profile is not a fixed bottom-right overlay", () => {
  const sessionBlock = cssSource.match(/\.session-profile\s*\{(?<body>[\s\S]*?)\n\}/)?.groups?.body ?? "";

  assert.ok(sessionBlock, "session-profile CSS block should exist");
  assert.doesNotMatch(sessionBlock, /position\s*:\s*fixed/);
  assert.doesNotMatch(sessionBlock, /\bright\s*:/);
  assert.doesNotMatch(sessionBlock, /\bbottom\s*:/);
  assert.doesNotMatch(sessionBlock, /\bz-index\s*:/);
  assert.doesNotMatch(sessionBlock, /pointer-events\s*:\s*none/);
  assert.doesNotMatch(cssSource, /\.session-profile\s*\{[^}]*position\s*:\s*fixed/s);
});

test("DEV_UIX_004 gives the session profile a non-overlapping responsive topbar row", () => {
  assert.match(cssSource, /@media \(max-width: 1500px\)[\s\S]*grid-template-areas:\s*\n\s*"brand actions"\s*\n\s*"switcher switcher"/);
  assert.match(cssSource, /\.project-switcher \{ grid-area: switcher; \}/);
  assert.match(cssSource, /\.top-actions \{ grid-area: actions; justify-content: flex-end; \}/);
  assert.match(cssSource, /\.workspace \{ height: calc\(100vh - 150px\); \}/);
});
