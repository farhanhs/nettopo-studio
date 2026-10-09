import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cssSource.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"));
  assert.ok(match, `${selector} rule must exist`);
  return match[1];
}

test("DEV_UIX_007 topbar and actions can shrink without horizontal overflow", () => {
  assert.match(cssRule(".app-shell"), /--topbar-height:\s*106px/);
  assert.match(cssRule(".topbar"), /min-width:\s*0/);
  assert.match(cssRule(".topbar"), /height:\s*var\(--topbar-height\)/);
  assert.match(cssRule(".topbar"), /overflow:\s*hidden/);
  assert.match(cssRule(".top-actions"), /min-width:\s*0/);
  assert.match(cssRule(".top-actions"), /max-width:\s*100%/);
  assert.match(cssRule(".top-actions"), /flex-wrap:\s*wrap/);
  assert.match(cssRule(".project-switcher"), /min-width:\s*0/);
  assert.match(cssRule(".switcher-row"), /minmax\(0,\s*1fr\)/);
  assert.match(cssRule(".workspace"), /height:\s*calc\(100vh - var\(--topbar-height\)\)/);
});

test("DEV_UIX_007 keeps identity values accessible while visually compact", () => {
  assert.match(pageSource, /<strong title=\{currentUser\.name\}>/);
  assert.match(pageSource, /<em title=\{`\$\{ROLE_LABELS\[currentUser\.role\]\} · \$\{currentUser\.email\}`\}>/);
  assert.match(pageSource, /<div className="top-actions" aria-label="主要操作">/);
  assert.match(cssRule(".session-profile strong, .session-profile em"), /text-overflow:\s*ellipsis/);
  assert.match(cssRule(".session-profile strong, .session-profile em"), /white-space:\s*nowrap/);
});

test("DEV_UIX_007 has dedicated medium-width, narrow-width, and short-height topbar breakpoints", () => {
  assert.match(cssSource, /@media \(max-width:\s*1280px\)/);
  assert.match(cssSource, /@media \(max-width:\s*900px\)/);
  assert.match(cssSource, /@media \(max-width:\s*700px\), \(max-height:\s*560px\)/);
  assert.match(cssSource, /\.app-shell\s*\{\s*--topbar-height:\s*150px;\s*\}/);
  assert.match(cssSource, /\.app-shell\s*\{\s*--topbar-height:\s*184px;\s*\}/);
  assert.match(cssSource, /\.app-shell\s*\{\s*--topbar-height:\s*238px;\s*\}/);
  assert.match(cssSource, /\.app-shell\s*\{\s*--topbar-height:\s*286px;\s*\}/);
  assert.match(cssSource, /\.identity-picker, \.layout-picker\s*\{[^}]*flex:\s*1 1 190px/s);
  assert.match(cssSource, /\.identity-picker, \.layout-picker\s*\{[^}]*flex:\s*1 1 100%/s);
  assert.match(cssSource, /\.topbar\s*\{[^}]*overflow-y:\s*auto/s);
  assert.doesNotMatch(cssSource, /\.workspace\s*\{\s*height:\s*calc\(100vh - \d+px\)/);
});

test("DEV_UIX_007 makes the full three-row breakpoint vertically reachable", () => {
  assert.match(
    cssSource,
    /@media \(max-width:\s*1280px\)\s*\{\s*\.app-shell\s*\{[^}]*--topbar-height:\s*184px[^}]*\}\s*\.topbar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain/s,
  );
  assert.match(cssSource, /@media \(max-width:\s*900px\)[\s\S]*?--topbar-height:\s*238px/);
  assert.match(cssSource, /@media \(max-width:\s*700px\), \(max-height:\s*560px\)[\s\S]*?--topbar-height:\s*286px/);
  assert.doesNotMatch(cssSource, /@media \(max-width:\s*(?:1280|900|700)px\)[\s\S]*?\.topbar\s*\{[^}]*overflow-y:\s*hidden/);
});

test("DEV_UIX_007 responsive rules remain independent from canvas viewport transforms", () => {
  assert.doesNotMatch(cssSource, /\.react-flow__viewport\s*\{[^}]*transform/s);
  assert.doesNotMatch(cssSource, /\.react-flow__viewport|\.flow-shell\s*\{[^}]*height:\s*100dvh/s);
});
