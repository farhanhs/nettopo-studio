import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [modulePath, evidenceRoot, channel = "chrome"] = process.argv.slice(2);
assert.ok(modulePath && evidenceRoot);
assert.equal(fs.existsSync(evidenceRoot), false);
fs.mkdirSync(evidenceRoot, { recursive: false });
const imported = await import(pathToFileURL(path.resolve(modulePath)).href);
const playwright = imported.chromium ? imported : imported.default;
let context;
const evidence = { channel, result: "RUNNING", created: false, editControlCount: -1, deleteControlCount: -1, cleanup: false };
try {
  context = await playwright.chromium.launchPersistentContext(path.join(evidenceRoot, "profile"), { channel, headless: true, viewport: { width: 1280, height: 900 }, serviceWorkers: "block", args: ["--disable-background-networking", "--no-first-run"] });
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto("http://127.0.0.1:4317", { waitUntil: "domcontentloaded" });
  await page.locator('[data-local-beta="true"]').waitFor();
  await page.getByRole("button", { name: "容器", exact: true }).click();
  await page.getByRole("button", { name: "+ 新增容器", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新增架構容器" });
  await dialog.getByLabel("容器名稱", { exact: true }).fill("QA Group CRUD Probe");
  await dialog.locator('button[type="submit"]').click();
  await page.getByText("QA Group CRUD Probe", { exact: true }).waitFor();
  evidence.created = true;
  evidence.editControlCount = await page.getByRole("button", { name: /編輯.*QA Group CRUD Probe|儲存容器|編輯容器/ }).count();
  evidence.deleteControlCount = await page.getByRole("button", { name: /刪除.*QA Group CRUD Probe|刪除容器/ }).count();
  evidence.availableButtons = await page.getByRole("button").allTextContents();
  await page.screenshot({ path: path.join(evidenceRoot, "group-controls.png"), fullPage: true });
  evidence.result = evidence.editControlCount > 0 && evidence.deleteControlCount > 0 ? "PASS" : "FAIL_MISSING_GROUP_EDIT_DELETE";
} finally {
  if (context) await context.close();
  evidence.cleanup = true;
  fs.writeFileSync(path.join(evidenceRoot, "group-crud.json"), `${JSON.stringify(evidence, null, 2)}\n`);
}
if (evidence.result !== "PASS") process.exitCode = 1;
