import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { unzipSync } from "fflate";
import { chromium } from "playwright";
import postgres from "postgres";

const prefix = "qa_imp_001_retest";
const host = "127.0.0.1";
const port = process.env.QA_IMP_001_PORT ?? "4395";
const baseUrl = `http://${host}:${port}`;
const screenshotsDir = resolve("docs/dev測試紀錄/screenshots");
const summaryPath = resolve("docs/dev測試紀錄/qa-imp-001-browser-retest-summary.json");
const pilotSiteId = `${prefix}_pilot_site`;
const engineer = {
  id: `${prefix}_engineer_user`,
  email: `${prefix}.engineer@company.local`,
  name: "QA IMP 001 Engineer",
  role: "engineer",
};
const customerId = `${prefix}_customer`;
const topologyId = `${prefix}_topology`;
const sessionSecret = randomBytes(48).toString("base64url");

const evidence = {
  ticket: "QA_IMP_001",
  phase: "2026-08-29 re-test browser",
  baseUrl,
  browser: "Playwright Chromium against loopback Pilot preview",
  statuses: [],
  fileGate: {},
  previewControls: {},
  warningAck: {},
  blockingFailClosed: {},
  applyScenarios: {},
  exportChecks: {},
  screenshots: [],
  dbCounts: {},
  cleanup: {},
  failure: undefined,
};

function assertRequiredEnv(name) {
  assert.ok(process.env[name], `${name} is required`);
}

function pilotEnv() {
  return {
    ...process.env,
    HOST: host,
    PORT: port,
    NEXT_PUBLIC_TOPOLOGY_STORAGE: "server",
    NETTOPO_RUNTIME_PROFILE: "pilot",
    NETTOPO_AUTH_MODE: "pilot",
    NETTOPO_ENABLE_DEV_IDENTITY_HEADER: "0",
    NETTOPO_ENABLE_DEMO_SEED: "0",
    NETTOPO_PILOT_SITE_ID: pilotSiteId,
    NETTOPO_PILOT_USERS: `${engineer.email}:engineer:qa-imp-001`,
    NETTOPO_PILOT_SESSION_SECRET: sessionSecret,
    NETTOPO_PILOT_ALLOW_FULL_EXPORT: "0",
  };
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    });
    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} ${args.join(" ")} exited with ${code ?? signal}`));
    });
  });
}

async function cleanup(sql) {
  await sql`
    delete from audit_logs
    where actor_user_id like ${`${prefix}%`}
       or customer_id like ${`${prefix}%`}
       or topology_id like ${`${prefix}%`}
       or site_id = ${pilotSiteId}
  `;
  await sql`
    delete from device_credentials
    where id like ${`${prefix}%`}
       or topology_id like ${`${prefix}%`}
  `;
  await sql`delete from topologies where id like ${`${prefix}%`} or customer_id like ${`${prefix}%`}`;
  await sql`delete from customers where id like ${`${prefix}%`}`;
  await sql`delete from user_sites where user_id like ${`${prefix}%`} or site_id = ${pilotSiteId}`;
  await sql`delete from users where id like ${`${prefix}%`} or email like ${`${prefix}.%`}`;
  await sql`delete from sites where id = ${pilotSiteId}`;
}

async function snapshot(sql) {
  const [row] = await sql`
    select
      (select count(*)::int from sites where id = ${pilotSiteId}) as sites,
      (select count(*)::int from users where id like ${`${prefix}%`} or email like ${`${prefix}.%`}) as users,
      (select count(*)::int from customers where id like ${`${prefix}%`}) as customers,
      (select count(*)::int from topologies where id like ${`${prefix}%`} or customer_id like ${`${prefix}%`}) as topologies,
      (select count(*)::int from device_credentials where id like ${`${prefix}%`} or topology_id like ${`${prefix}%`}) as credentials,
      (select count(*)::int from audit_logs where actor_user_id like ${`${prefix}%`} or customer_id like ${`${prefix}%`} or topology_id like ${`${prefix}%`} or site_id = ${pilotSiteId}) as audit_logs
  `;
  return row;
}

async function topologyDigest(sql) {
  const rows = await sql`
    select id, name, project
    from topologies
    where id like ${`${prefix}%`} or customer_id like ${`${prefix}%`}
    order by id
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    devices: (row.project?.devices ?? []).map((device) => device.id).sort(),
    links: (row.project?.links ?? []).map((link) => `${link.id}:${link.from}->${link.to}`).sort(),
    groups: (row.project?.groups ?? []).map((group) => group.id).sort(),
  }));
}

async function findTopologyByName(sql, name) {
  const [row] = await sql`
    select id, name, project
    from topologies
    where name = ${name} and customer_id like ${`${prefix}%`}
    order by updated_at desc
    limit 1
  `;
  return row;
}

async function waitForTopology(sql, name, predicate, label) {
  const deadline = Date.now() + 10_000;
  let lastRow;
  while (Date.now() < deadline) {
    lastRow = await findTopologyByName(sql, name);
    if (lastRow && predicate(lastRow)) return lastRow;
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error(`${label} did not reach expected topology state: ${JSON.stringify({
    name,
    devices: lastRow?.project?.devices?.length,
    links: lastRow?.project?.links?.length,
    groups: lastRow?.project?.groups?.length,
  })}`);
}

async function assertNoCredentialRows(sql, label) {
  const [{ count }] = await sql`
    select count(*)::int as count
    from device_credentials
    where id like ${`${prefix}%`} or topology_id like ${`${prefix}%`}
  `;
  assert.equal(count, 0, `${label} must not write masked CSV credentials to credential storage`);
}

async function seed(sql) {
  const now = new Date().toISOString();
  await cleanup(sql);
  await sql.begin(async (tx) => {
    await tx`insert into sites (id, name, created_at, updated_at) values (${pilotSiteId}, ${"QA IMP 001 Pilot Site"}, ${now}, ${now})`;
    await tx`
      insert into users (id, email, name, role, disabled_at, created_at, updated_at)
      values (${engineer.id}, ${engineer.email}, ${engineer.name}, ${engineer.role}, ${null}, ${now}, ${now})
    `;
    await tx`insert into user_sites (user_id, site_id) values (${engineer.id}, ${pilotSiteId})`;
    await tx`insert into customers (id, name, created_at, updated_at) values (${customerId}, ${"QA IMP 001 Customer"}, ${now}, ${now})`;
    await tx`
      insert into topologies (
        id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id,
        name, version_label, project, created_at, updated_at
      ) values (
        ${topologyId}, ${customerId}, ${pilotSiteId}, ${engineer.id}, ${engineer.id}, ${engineer.id},
        ${"QA IMP 001 Base Topology"}, ${"v1"}, ${tx.json({ devices: [], links: [], groups: [] })}, ${now}, ${now}
      )
    `;
  });
}

function startPreview(env) {
  return spawn(process.execPath, [
    "scripts/preview-server.mjs",
  ], {
    stdio: "inherit",
    shell: false,
    env,
  });
}

async function stopPreview(child) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveStop) => child.once("exit", resolveStop)),
    new Promise((resolveStop) => setTimeout(resolveStop, 2_000)),
  ]);
  if (child.exitCode === null && !child.signalCode) child.kill("SIGKILL");
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/runtime-capabilities`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Preview server did not become ready: ${lastError instanceof Error ? lastError.message : "unknown"}`);
}

async function screenshot(page, name) {
  await mkdir(screenshotsDir, { recursive: true });
  const file = resolve(screenshotsDir, name);
  await page.screenshot({ path: file, fullPage: true });
  evidence.screenshots.push(file);
}

function csvFixtures() {
  return [
    {
      name: "devices.csv",
      text: [
        "schemaVersion,sharing,id,name,type,ip,mac,model,location,url,quantity,x,y,groupId",
        "2,safe,qa-imp-router,QA IMP Router,router,10.88.0.1,,ISR-QA,QA Lab,,1,80,120,qa-imp-group",
        "2,safe,qa-imp-switch,QA IMP Switch,switch,10.88.0.2,,SW-QA,QA Lab,,1,320,120,qa-imp-group",
      ].join("\n"),
    },
    {
      name: "links.csv",
      text: [
        "schemaVersion,sharing,id,from,to,kind,fromPort,toPort,vlan,speed",
        "2,safe,qa-imp-link-1,qa-imp-router,qa-imp-switch,wired,G0/1,G0/2,10,1 Gbps",
      ].join("\n"),
    },
    {
      name: "groups.csv",
      text: [
        "schemaVersion,sharing,id,name,kind,color,collapsed",
        "2,safe,qa-imp-group,QA IMP Group,site,#526cf5,false",
      ].join("\n"),
    },
    {
      name: "credentials.masked.csv",
      text: [
        "schemaVersion,sharing,projectDeviceId,deviceName,kind,usernameMasked,secretMasked,keyVersion,lastRotatedAt",
        "2,safe,qa-imp-router,QA IMP Router,device_admin,q***r,********,qa,",
      ].join("\n"),
    },
    {
      name: "missing-info.csv",
      text: "schemaVersion,sharing,id,severity,entityType,entityId,field,code,question,suggestion,sourceFile,sourceLine,status\n",
    },
  ];
}

function warningCsvFixtures() {
  return [
    {
      name: "devices.csv",
      text: [
        "schemaVersion,sharing,id,name,type,ip,mac,model,location,url,quantity,x,y,groupId",
        "2,safe,qa-imp-warning-router,QA IMP Warning Router,router,10.88.1.1,,ISR-QA,QA Lab,,1,80,120,",
        "2,safe,qa-imp-warning-switch,QA IMP Warning Switch,switch,10.88.1.2,,SW-QA,QA Lab,,1,320,120,",
      ].join("\n"),
    },
    {
      name: "links.csv",
      text: [
        "schemaVersion,sharing,id,from,to,kind,fromPort,toPort,vlan,speed",
        "2,safe,qa-imp-warning-link,qa-imp-warning-router,qa-imp-warning-switch,wired,,,,",
      ].join("\n"),
    },
    {
      name: "groups.csv",
      text: "schemaVersion,sharing,id,name,kind,color,collapsed\n",
    },
    {
      name: "credentials.masked.csv",
      text: "schemaVersion,sharing,projectDeviceId,deviceName,kind,usernameMasked,secretMasked,keyVersion,lastRotatedAt\n",
    },
    {
      name: "missing-info.csv",
      text: "schemaVersion,sharing,id,severity,entityType,entityId,field,code,question,suggestion,sourceFile,sourceLine,status\n",
    },
  ];
}

function blockingCsvFixtures() {
  return [
    {
      name: "devices.csv",
      text: [
        "schemaVersion,sharing,id,name,type,ip,mac,model,location,url,quantity,x,y,groupId",
        "2,safe,qa-imp-block-router,QA IMP Block Router,router,10.88.2.1,,ISR-QA,QA Lab,,1,80,120,",
      ].join("\n"),
    },
    {
      name: "links.csv",
      text: [
        "schemaVersion,sharing,id,from,to,kind,fromPort,toPort,vlan,speed",
        "2,safe,qa-imp-block-link,qa-imp-block-router,qa-imp-missing-switch,wired,G0/1,G0/2,10,1 Gbps",
      ].join("\n"),
    },
    {
      name: "groups.csv",
      text: "schemaVersion,sharing,id,name,kind,color,collapsed\n",
    },
    {
      name: "credentials.masked.csv",
      text: "schemaVersion,sharing,projectDeviceId,deviceName,kind,usernameMasked,secretMasked,keyVersion,lastRotatedAt\n",
    },
    {
      name: "missing-info.csv",
      text: "schemaVersion,sharing,id,severity,entityType,entityId,field,code,question,suggestion,sourceFile,sourceLine,status\n",
    },
  ];
}

function replacementCsvFixtures() {
  return [
    {
      name: "devices.csv",
      text: [
        "schemaVersion,sharing,id,name,type,ip,mac,model,location,url,quantity,x,y,groupId",
        "2,safe,qa-imp-camera,QA IMP Camera,camera,,,,,,1,160,180,qa-imp-replace-group",
      ].join("\n"),
    },
    {
      name: "links.csv",
      text: "schemaVersion,sharing,id,from,to,kind,fromPort,toPort,vlan,speed\n",
    },
    {
      name: "groups.csv",
      text: [
        "schemaVersion,sharing,id,name,kind,color,collapsed",
        "2,safe,qa-imp-replace-group,QA IMP Replacement Group,site,#526cf5,false",
      ].join("\n"),
    },
    {
      name: "credentials.masked.csv",
      text: "schemaVersion,sharing,projectDeviceId,deviceName,kind,usernameMasked,secretMasked,keyVersion,lastRotatedAt\n",
    },
    {
      name: "missing-info.csv",
      text: "schemaVersion,sharing,id,severity,entityType,entityId,field,code,question,suggestion,sourceFile,sourceLine,status\n",
    },
  ];
}

async function dropOversizedCsvWithTextSpy(page) {
  const zone = page.locator("label.file-drop-zone").first();
  await zone.waitFor({ state: "visible" });
  const dataTransfer = await page.evaluateHandle(() => {
    window.__qaImpOversizedTextRead = false;
    const transfer = new DataTransfer();
    const oversized = new File([new Uint8Array((10 * 1024 * 1024) + 1)], "devices.csv", { type: "text/csv" });
    Object.defineProperty(oversized, "text", {
      value: () => {
        window.__qaImpOversizedTextRead = true;
        return Promise.resolve("SHOULD_NOT_READ");
      },
    });
    transfer.items.add(oversized);
    return transfer;
  });
  await zone.dispatchEvent("drop", { dataTransfer });
}

async function dropCsvBundle(page, files) {
  const zone = page.locator("label.file-drop-zone").first();
  await zone.waitFor({ state: "visible" });
  const dataTransfer = await page.evaluateHandle((items) => {
    const transfer = new DataTransfer();
    for (const item of items) {
      transfer.items.add(new File([item.text], item.name, { type: "text/csv" }));
    }
    return transfer;
  }, files);
  await zone.dispatchEvent("drop", { dataTransfer });
}

async function openImport(page) {
  await page.getByRole("button", { name: "匯入" }).click();
  await page.locator("label.file-drop-zone").first().waitFor({ state: "visible" });
}

async function waitForValidPreview(page, expectedDevices = "2設備", expectedLinks = "1連線") {
  await page.locator(".import-summary-expanded", { hasText: expectedDevices }).last().waitFor();
  await page.locator(".import-summary-expanded", { hasText: expectedLinks }).last().waitFor();
  return page.locator(".modal").last();
}

async function cancelImportPreview(page) {
  const modal = page.locator(".modal").last();
  await modal.getByRole("button", { name: "取消" }).first().click();
  await modal.waitFor({ state: "detached" });
}

async function applyCsvImport(page, files, { strategy, name, acknowledgeWarnings = false, expectedDevices = "2設備", expectedLinks = "1連線" }) {
  await openImport(page);
  await dropCsvBundle(page, files);
  const modal = await waitForValidPreview(page, expectedDevices, expectedLinks);
  await modal.locator("select").selectOption(strategy);
  assert.equal(await modal.locator("select").inputValue(), strategy, `strategy select must switch to ${strategy}`);
  if (strategy === "new" && name) {
    await modal.getByLabel("新拓樸名稱").waitFor({ state: "visible", timeout: 5_000 });
    await modal.getByLabel("新拓樸名稱").fill(name);
  } else if (strategy !== "new") {
    await modal.getByLabel("新拓樸名稱").waitFor({ state: "detached", timeout: 5_000 });
  }
  if (acknowledgeWarnings) {
    await modal.locator(".import-warning-ack input").check();
  }
  await modal.getByRole("button", { name: /確認寫入/ }).click();
  await page.getByText(/匯入完成：/).waitFor({ timeout: 20_000 });
  await modal.waitFor({ state: "detached", timeout: 20_000 });
}

async function loginPilot(page) {
  await page.goto(baseUrl);
  await page.getByLabel("Pilot Email").fill(engineer.email);
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/pilot/session") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "進入 Internal Pilot" }).click();
  const response = await responsePromise;
  evidence.statuses.push({ step: "pilot login", status: response.status() });
  assert.equal(response.status(), 200);
  const topologyProbe = await page.evaluate(async () => {
    const response = await fetch("/api/topology", { cache: "no-store" });
    return { status: response.status, text: await response.text() };
  });
  evidence.statuses.push({ step: "post-login topology probe", status: topologyProbe.status });
  assert.equal(topologyProbe.status, 200, "post-login protected topology probe must return 200");
  await page.getByText("正在載入拓樸工作區...").waitFor({ state: "detached", timeout: 45_000 });
  await page.locator(".session-profile").waitFor({ state: "visible", timeout: 45_000 });
  const sessionProfileText = await page.locator(".session-profile").innerText();
  evidence.statuses.push({ step: "session profile visible", status: sessionProfileText.includes(engineer.name) ? 200 : 500 });
  assert.match(sessionProfileText, new RegExp(engineer.name));
}

async function runBrowserFlow(sql) {
  let preview;
  let browser;
  try {
    await seed(sql);
    evidence.dbCounts.afterSeed = await snapshot(sql);
    const env = pilotEnv();
    await run(process.execPath, ["scripts/validate-runtime-policy.mjs"], { env });
    await run(process.execPath, ["scripts/build-local.mjs"], { env });
    preview = startPreview(env);
    await waitForPreview();

    browser = await chromium.launch();
    const context = await browser.newContext({ acceptDownloads: true, baseURL: baseUrl });
    const page = await context.newPage();
    await loginPilot(page);
    await page.getByText("INTERNAL PILOT · synthetic test data only").waitFor();

    await page.getByRole("button", { name: "匯入" }).click();
    const beforeOversized = await snapshot(sql);
    await dropOversizedCsvWithTextSpy(page);
    await page.getByText("單一匯入檔案不可超過 10 MiB。").first().waitFor();
    const textRead = await page.evaluate(() => window.__qaImpOversizedTextRead === true);
    assert.equal(textRead, false, "oversized CSV must be blocked before File.text()");
    assert.deepEqual(await snapshot(sql), beforeOversized, "oversized blocked preview must not write DB");
    evidence.fileGate = {
      oversizedBeforeTextRead: true,
      dbZeroWrite: true,
      duplicateIssueMessageCount: await page.getByText("單一匯入檔案不可超過 10 MiB。").count(),
    };
    await screenshot(page, "qa-imp-001-retest-oversized-file-gate.png");
    await page.locator(".modal").last().getByRole("button", { name: "取消" }).first().click();
    await page.locator(".modal").waitFor({ state: "detached" });

    await page.getByRole("button", { name: "匯入" }).click();
    await dropCsvBundle(page, csvFixtures());
    await page.locator(".import-summary-expanded", { hasText: "2設備" }).last().waitFor();
    await page.locator(".import-summary-expanded", { hasText: "1連線" }).last().waitFor();
    await page.locator(".import-preview-tabs").getByRole("button", { name: "遮蔽帳密", exact: true }).click();
    await page.getByText("********").waitFor();
    await screenshot(page, "qa-imp-001-retest-preview-controls.png");

    const modal = page.locator(".modal").last();
    const strategySelectCount = await modal.locator("select").count();
    const confirmButtonCount = await modal.getByRole("button", { name: /確認(寫入|匯入)/ }).count();
    evidence.previewControls = {
      strategySelectCount,
      confirmButtonCount,
      expectedStrategySelectCount: 1,
      expectedConfirmButtonCount: 1,
    };
    assert.equal(strategySelectCount, 1, `Import preview must expose one strategy select; found ${strategySelectCount}`);
    assert.equal(confirmButtonCount, 1, `Import preview must expose one confirm button; found ${confirmButtonCount}`);

    const beforeValidCancel = await topologyDigest(sql);
    await cancelImportPreview(page);
    assert.deepEqual(await topologyDigest(sql), beforeValidCancel, "normal valid preview cancel must not write DB");

    await openImport(page);
    await dropCsvBundle(page, warningCsvFixtures());
    const warningModal = await waitForValidPreview(page);
    const warningConfirm = warningModal.getByRole("button", { name: /確認寫入/ });
    assert.equal(await warningConfirm.isDisabled(), true, "warning preview must require acknowledgement before import");
    await warningModal.locator(".import-warning-ack input").check();
    assert.equal(await warningConfirm.isEnabled(), true, "warning acknowledgement must enable import when no blocking issue remains");
    const beforeWarningCancel = await topologyDigest(sql);
    await cancelImportPreview(page);
    assert.deepEqual(await topologyDigest(sql), beforeWarningCancel, "warning preview cancel must not write DB");
    evidence.warningAck = {
      confirmDisabledBeforeAck: true,
      confirmEnabledAfterAck: true,
      cancelZeroWrite: true,
    };

    await openImport(page);
    await dropCsvBundle(page, blockingCsvFixtures());
    await page.getByText(/連線兩端設備|端點必須存在|參照不存在/).first().waitFor({ timeout: 10_000 });
    const blockingModal = page.locator(".modal").last();
    const blockingConfirm = blockingModal.getByRole("button", { name: /確認寫入/ });
    assert.equal(await blockingConfirm.isDisabled(), true, "blocking preview must disable confirm");
    const beforeBlockingHack = await topologyDigest(sql);
    await blockingConfirm.evaluate((button) => {
      button.disabled = false;
      button.removeAttribute("disabled");
    });
    await blockingConfirm.click({ force: true });
    await page.waitForTimeout(500);
    assert.deepEqual(await topologyDigest(sql), beforeBlockingHack, "blocking preview must remain zero-write even if disabled attribute is removed");
    evidence.blockingFailClosed = {
      confirmDisabled: true,
      domHackZeroWrite: true,
    };
    await cancelImportPreview(page);

    const importedTopologyName = "QA IMP 001 Imported New";
    await applyCsvImport(page, csvFixtures(), { strategy: "new", name: importedTopologyName });
    const newRow = await waitForTopology(sql, importedTopologyName, (row) =>
      row.project.devices.length === 2 && row.project.links.length === 1 && row.project.groups.length === 1,
      "new import",
    );
    await page.locator("#topology-select").locator("option", { hasText: importedTopologyName }).waitFor({ state: "attached", timeout: 10_000 });
    await page.locator("#topology-select").selectOption(newRow.id);
    await page.waitForFunction((topologyId) => document.querySelector("#topology-select")?.value === topologyId, newRow.id);
    await page.getByText("QA IMP Router").first().waitFor({ state: "visible", timeout: 10_000 });
    await assertNoCredentialRows(sql, "new import");

    await applyCsvImport(page, csvFixtures(), { strategy: "merge" });
    evidence.applyScenarios.afterMergeDigest = await topologyDigest(sql);
    const mergedRow = await waitForTopology(sql, importedTopologyName, (row) =>
      row.project.devices.length === 4 &&
      row.project.links.length === 2 &&
      row.project.groups.length === 2 &&
      row.project.devices.some((device) => device.id.includes("-import-2")) &&
      row.project.links.some((link) => link.from.includes("-import-2") || link.to.includes("-import-2")),
      "merge import",
    );
    await assertNoCredentialRows(sql, "merge import");

    await applyCsvImport(page, replacementCsvFixtures(), {
      strategy: "replace",
      expectedDevices: "1設備",
      expectedLinks: "0連線",
    });
    const replacedRow = await waitForTopology(sql, importedTopologyName, (row) =>
      row.project.devices.length === 1 &&
      row.project.devices[0]?.id === "qa-imp-camera" &&
      row.project.links.length === 0 &&
      row.project.groups.length === 1,
      "replace import",
    );
    const baseRow = await findTopologyByName(sql, "QA IMP 001 Base Topology");
    assert.deepEqual(baseRow?.project, { devices: [], links: [], groups: [] }, "replace must not affect sibling topology");
    await assertNoCredentialRows(sql, "replace import");
    evidence.applyScenarios = {
      cancelZeroWrite: true,
      new: {
        topologyName: newRow.name,
        devices: newRow.project.devices.length,
        links: newRow.project.links.length,
        groups: newRow.project.groups.length,
      },
      merge: {
        devices: mergedRow.project.devices.length,
        links: mergedRow.project.links.length,
        groups: mergedRow.project.groups.length,
        remappedIds: true,
      },
      replace: {
        devices: replacedRow.project.devices.length,
        links: replacedRow.project.links.length,
        groups: replacedRow.project.groups.length,
        siblingUnaffected: true,
      },
      maskedCredentialsWritten: 0,
    };

    await page.getByRole("button", { name: "匯出", exact: true }).click();
    const exportModal = page.locator(".modal").last();
    await assert.rejects(
      exportModal.getByRole("button", { name: "完整 CSV" }).click({ timeout: 1_000 }),
      /locator\.click|Target closed|Timeout/i,
      "Pilot Engineer must not be able to click disabled full CSV export",
    );
    const downloadPromise = page.waitForEvent("download");
    await exportModal.getByRole("button", { name: "安全 CSV" }).click();
    const download = await downloadPromise;
    await mkdir(resolve("test-results"), { recursive: true });
    const zipPath = resolve("test-results", await download.suggestedFilename());
    await download.saveAs(zipPath);
    const zipBytes = await readFile(zipPath);
    const unzipped = unzipSync(new Uint8Array(zipBytes));
    const zipMembers = Object.keys(unzipped).sort();
    assert.deepEqual(zipMembers, [
      "credentials.masked.csv",
      "devices.csv",
      "groups.csv",
      "links.csv",
      "missing-info.csv",
    ]);
    const zipText = Object.values(unzipped).map((content) => new TextDecoder().decode(content)).join("\n");
    assert.doesNotMatch(zipText, /sean002002dus|password|ciphertext|nonce|postgres:\/\/|__Host-nettopo-pilot-session/i);

    const exportedCsvFiles = zipMembers.map((name) => ({
      name,
      text: new TextDecoder().decode(unzipped[name]),
    }));
    await exportModal.locator("header").getByRole("button", { name: "×" }).click();
    await exportModal.waitFor({ state: "detached" });
    await applyCsvImport(page, exportedCsvFiles, {
      strategy: "replace",
      expectedDevices: "1設備",
      expectedLinks: "0連線",
    });
    const roundTripRow = await waitForTopology(sql, importedTopologyName, (row) =>
      row.project.devices.length === 1 &&
      row.project.devices[0]?.id === "qa-imp-camera" &&
      row.project.links.length === 0 &&
      row.project.groups.length === 1,
      "safe CSV browser round-trip",
    );
    await assertNoCredentialRows(sql, "safe CSV browser round-trip");
    evidence.exportChecks = {
      pilotEngineerFullCsvDisabled: true,
      safeCsvZipMembers: zipMembers,
      safeCsvBrowserRoundTrip: {
        devices: roundTripRow.project.devices.length,
        links: roundTripRow.project.links.length,
        groups: roundTripRow.project.groups.length,
      },
      secretScan: "PASS",
    };

    await context.close();
  } finally {
    if (browser) await browser.close();
    await stopPreview(preview);
    await cleanup(sql);
    evidence.cleanup = await snapshot(sql);
  }
}

async function main() {
  assertRequiredEnv("DATABASE_URL");
  assertRequiredEnv("MIGRATION_DATABASE_URL");
  await mkdir(screenshotsDir, { recursive: true });
  const sql = postgres(process.env.MIGRATION_DATABASE_URL, { max: 1, idle_timeout: 5, prepare: false });
  try {
    await runBrowserFlow(sql);
  } catch (error) {
    evidence.failure = {
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : "Unknown browser flow failure",
    };
    throw error;
  } finally {
    try {
      await cleanup(sql);
      evidence.cleanup = await snapshot(sql);
    } finally {
      await sql.end({ timeout: 5 });
      await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    }
  }
}

await main();
