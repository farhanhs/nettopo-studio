import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const selection = JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", "qa-bta-001", "test-selection.json"), "utf8"));

test("QA_BTA_001 uses only explicit preparation files and separate formal stages", () => {
  assert.equal(selection.wildcardsAllowed, false);
  assert.equal(selection.formalProductResult, "NOT_RUN");
  assert.equal(selection.preparationAllowlist.every((entry) => !entry.includes("*") && fs.existsSync(path.join(root, entry))), true);
  assert.deepEqual(selection.formalStages, ["scripts/qa-bta/package-runner.mjs", "scripts/qa-bta/browser-runner.mjs"]);
  assert.equal(selection.formalStages.every((entry) => fs.existsSync(path.join(root, entry))), true);
  assert.ok(selection.forbidden.includes("tests/*.test.mjs"));
});

test("QA_BTA_001 preparation test sources do not import DB, Docker or dotenv loaders", () => {
  const forbidden = /postgres|pg_ctl|initdb|docker|dotenv/i;
  for (const relative of selection.preparationAllowlist) {
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
    assert.equal(imports.some((specifier) => forbidden.test(specifier)), false, `${relative} imports a prohibited preparation dependency`);
  }
});

test("QA_BTA_001 formal start remains gated on fixed package and writer stop", () => {
  assert.deepEqual(selection.formalPrerequisites, [
    "DEV_BTA_001-003 READY_FOR_QA",
    "writer stopped",
    "fixed source/tool/dependency manifest",
    "fixed ZIP and outer SHA-256",
    "QA-owned extraction/profile/download/evidence roots",
  ]);
});
