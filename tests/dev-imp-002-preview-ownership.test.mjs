import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const modalSource = readFileSync(new URL("../app/components/import/ImportPreviewModal.tsx", import.meta.url), "utf8");
const issueListSource = readFileSync(new URL("../app/components/import/ImportIssueList.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function importModalBlock() {
  const start = pageSource.indexOf('{showTransfer === "import"');
  const end = pageSource.indexOf('{showTransfer === "export"', start);
  assert.notEqual(start, -1, "import transfer modal block must exist");
  assert.notEqual(end, -1, "export transfer modal block must follow import block");
  return pageSource.slice(start, end);
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

test("DEV_IMP_002 Preview ownership lives in a single ImportPreviewModal", () => {
  const block = importModalBlock();

  assert.equal(count(block, /<FileDropZone\b/g), 1, "import modal should keep one file drop zone");
  assert.equal(count(block, /<ImportPreviewModal\b/g), 1, "import modal should mount one preview modal");
  assert.equal(count(block, /<select\b/g), 0, "page import block must not render legacy strategy selects");
  assert.equal(count(block, /確認匯入/g), 0, "page import block must not render legacy confirm action");
  assert.equal(count(block, /className="import-options"/g), 0, "page import block must not own import options");
  assert.equal(count(block, /className="import-issues"/g), 0, "page import block must not duplicate issues");
  assert.equal(count(block, /className="import-summary"/g), 0, "page import block must not duplicate summary");
  assert.equal(count(block, /className="replace-warning"/g), 0, "page import block must not duplicate replace warning");
});

test("DEV_IMP_002 ImportPreviewModal owns exactly one strategy select and one confirm action", () => {
  assert.equal(count(modalSource, /<select\b/g), 1);
  assert.equal(count(modalSource, /確認寫入/g), 1);
  assert.equal(count(modalSource, /<ImportSummary\b/g), 1);
  assert.equal(count(modalSource, /<ImportIssueList\b/g), 1);
  assert.match(issueListSource, /issue\.severity === "info"/);
});

test("DEV_IMP_002 CSS no longer hides legacy preview controls as a workaround", () => {
  assert.doesNotMatch(cssSource, /transfer-panel\s*>\s*\.import-options/);
  assert.doesNotMatch(cssSource, /transfer-panel\s*>\s*\.import-issues/);
  assert.doesNotMatch(cssSource, /legacy-transfer/);
});
