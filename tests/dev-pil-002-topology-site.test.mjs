import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const storeSource = readFileSync(new URL("../app/lib/topology-store.ts", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function functionBlock(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, nextFunction === -1 ? undefined : nextFunction);
}

function asyncFunctionBlock(source, name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  const end = source.indexOf(`async function ${nextName}`, start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return source.slice(start, end);
}

test("DEV_PIL_002 create topology omits siteId instead of inheriting the active topology site", () => {
  const block = asyncFunctionBlock(pageSource, "addTopology", "prepareImport");

  assert.doesNotMatch(block, /activeTopology\?\.siteId/, "createTopology submit must not inherit active topology site");
  assert.match(block, /const selectedSiteId = clean\(data\.get\("siteId"\)\) \|\| undefined;/);
  assert.match(block, /await createTopology\(name, copyCurrent, selectedSiteId\);/);
});

test("DEV_PIL_002 unspecified topology site is browser-local only and fail-closed otherwise", () => {
  assert.match(pageSource, /const canUseUnspecifiedSite = !USE_SERVER_STORAGE && ready && availableSites\.length === 0;/);
  assert.match(pageSource, /const canSubmitSiteScopedCreate = canCreateWithSelectedSite \|\| canUseUnspecifiedSite;/);

  const block = asyncFunctionBlock(pageSource, "addTopology", "prepareImport");
  assert.match(block, /if \(!selectedSiteId && !canUseUnspecifiedSite\)/);
  assert.match(block, /USE_SERVER_STORAGE \? "目前帳號沒有可建立拓樸的站點。"/);
});

test("DEV_PIL_002 site field renders an explicit unspecified display state without fake ids", () => {
  const block = functionBlock(pageSource, "SiteField");

  assert.match(block, /allowUnspecified = false/);
  assert.match(block, /required=\{hasSites && !allowUnspecified\}/);
  assert.match(block, /value="">\{showUnspecified \? "未指定" : "無可用站點"\}/);
  assert.doesNotMatch(block, /value="unspecified"|value="none"|value="default-site"/);
});

test("DEV_PIL_002 local store persists selected siteId and preserves undefined for unspecified", () => {
  const createCustomerStart = storeSource.indexOf("createCustomer: async");
  const createTopologyStart = storeSource.indexOf("createTopology: async");
  const importProjectStart = storeSource.indexOf("importProject: async");
  assert.notEqual(createCustomerStart, -1);
  assert.notEqual(createTopologyStart, -1);
  assert.notEqual(importProjectStart, -1);

  const createCustomerBlock = storeSource.slice(createCustomerStart, createTopologyStart);
  const createTopologyBlock = storeSource.slice(createTopologyStart, importProjectStart);
  assert.match(createCustomerBlock, /siteId: siteId \|\| undefined,/);
  assert.match(createTopologyBlock, /siteId: siteId \|\| undefined,/);
});

test("DEV_PIL_002 modal keeps existing structure responsive and keyboard-accessible", () => {
  const modalBlock = functionBlock(pageSource, "Modal");
  assert.match(modalBlock, /role="dialog"/);
  assert.match(modalBlock, /aria-modal="true"/);
  assert.match(modalBlock, /aria-labelledby=\{titleId\}/);
  assert.match(modalBlock, /aria-label="關閉"/);

  assert.match(cssSource, /\.modal\s*\{[^}]*100dvw[^}]*100dvh/s);
  assert.match(cssSource, /\.modal > \.form-grid, \.modal > \.transfer-panel, \.modal > \.confirm-panel\s*\{[^}]*overflow: auto/s);
  assert.match(cssSource, /@media \(max-width: 640px\), \(max-height: 520px\)/);
  assert.match(cssSource, /\.form-grid\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/s);
  assert.match(cssSource, /\.field-note\s*\{[^}]*overflow-wrap: anywhere/s);
});
