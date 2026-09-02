import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";
import postgres from "postgres";
import { unzipSync } from "fflate";

const prefix = "qa_pil_002";
const host = "127.0.0.1";
const port = process.env.QA_PIL_002_PORT ?? "4392";
const baseUrl = `http://${host}:${port}`;
const screenshotsDir = resolve("docs/dev測試紀錄/screenshots");
const pilotSiteId = `${prefix}_pilot_site`;
const otherSiteId = `${prefix}_other_site`;
const admin = {
  id: `${prefix}_admin_user`,
  email: `${prefix}.admin@company.local`,
  name: "QA PIL 002 Admin",
  role: "boss",
};
const engineer = {
  id: `${prefix}_engineer_user`,
  email: `${prefix}.engineer@company.local`,
  name: "QA PIL 002 Engineer",
  role: "engineer",
};
const otherEngineer = {
  id: `${prefix}_other_engineer_user`,
  email: `${prefix}.other.engineer@company.local`,
  name: "QA PIL 002 Other Engineer",
  role: "engineer",
};
const qaCredentialPlaintext = ["qa", "pil", "002", "placeholder"].join("-");
const sessionSecret = randomBytes(48).toString("base64url");

const evidence = {
  iabFallback: "in-app Browser setup attempted with 26.814.41407 browser-client; runtime service requested unavailable 26.814.41957 browser-service, so Playwright Chromium fallback was used.",
  baseUrl,
  browser: "Playwright Chromium",
  statuses: [],
  headers: {},
  cookie: {},
  screenshots: [],
  dbCounts: {},
  dexie: {},
  import: {},
  export: {},
  security: {},
  cleanup: {},
};

function assertRequiredEnv(name) {
  assert.ok(process.env[name], `${name} is required`);
}

function pilotEnv({ version = "qa1", fullExport = "0" } = {}) {
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
    NETTOPO_PILOT_USERS: `${admin.email}:admin:${version},${engineer.email}:engineer:${version}`,
    NETTOPO_PILOT_SESSION_SECRET: sessionSecret,
    NETTOPO_PILOT_ALLOW_FULL_EXPORT: fullExport,
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
       or customer_id in (select id from customers where id like ${`${prefix}%`} or name like ${"QA PIL 002%"})
       or topology_id in (select id from topologies where id like ${`${prefix}%`} or name like ${"QA PIL 002%"})
       or site_id in (${pilotSiteId}, ${otherSiteId})
  `;
  await sql`
    delete from device_credentials
    where id like ${`${prefix}%`}
       or topology_id in (
         select id from topologies
         where id like ${`${prefix}%`}
            or name like ${"QA PIL 002%"}
            or customer_id in (select id from customers where id like ${`${prefix}%`} or name like ${"QA PIL 002%"})
       )
  `;
  await sql`
    delete from topologies
    where id like ${`${prefix}%`}
       or name like ${"QA PIL 002%"}
       or customer_id in (select id from customers where id like ${`${prefix}%`} or name like ${"QA PIL 002%"})
  `;
  await sql`delete from customers where id like ${`${prefix}%`} or name like ${"QA PIL 002%"}`;
  await sql`delete from user_sites where user_id like ${`${prefix}%`} or site_id in (${pilotSiteId}, ${otherSiteId})`;
  await sql`delete from users where id like ${`${prefix}%`} or email like ${`${prefix}.%`}`;
  await sql`delete from sites where id in (${pilotSiteId}, ${otherSiteId})`;
}

async function snapshot(sql) {
  const [row] = await sql`
    select
      (select count(*)::int from sites where id in (${pilotSiteId}, ${otherSiteId})) as sites,
      (select count(*)::int from users where id like ${`${prefix}%`} or email like ${`${prefix}.%`}) as users,
      (select count(*)::int from customers where id like ${`${prefix}%`} or name like ${"QA PIL 002%"}) as customers,
      (select count(*)::int from topologies where id like ${`${prefix}%`} or name like ${"QA PIL 002%"} or customer_id in (select id from customers where id like ${`${prefix}%`} or name like ${"QA PIL 002%"})) as topologies,
      (select count(*)::int from device_credentials where id like ${`${prefix}%`} or topology_id in (select id from topologies where id like ${`${prefix}%`} or name like ${"QA PIL 002%"})) as credentials,
      (select count(*)::int from audit_logs where actor_user_id like ${`${prefix}%`} or customer_id in (select id from customers where id like ${`${prefix}%`} or name like ${"QA PIL 002%"}) or topology_id in (select id from topologies where id like ${`${prefix}%`} or name like ${"QA PIL 002%"}) or site_id in (${pilotSiteId}, ${otherSiteId})) as audit_logs
  `;
  return row;
}

async function seed(sql) {
  const now = new Date().toISOString();
  await cleanup(sql);
  await sql.begin(async (tx) => {
    await tx`
      insert into sites (id, name, created_at, updated_at)
      values
        (${pilotSiteId}, ${"QA PIL 002 Pilot Site"}, ${now}, ${now}),
        (${otherSiteId}, ${"QA PIL 002 Other Site"}, ${now}, ${now})
    `;
    for (const user of [admin, engineer, otherEngineer]) {
      await tx`
        insert into users (id, email, name, role, disabled_at, created_at, updated_at)
        values (${user.id}, ${user.email}, ${user.name}, ${user.role}, ${null}, ${now}, ${now})
      `;
    }
    await tx`insert into user_sites (user_id, site_id) values (${admin.id}, ${pilotSiteId}), (${engineer.id}, ${pilotSiteId}), (${otherEngineer.id}, ${otherSiteId})`;
    await tx`insert into customers (id, name, created_at, updated_at) values (${`${prefix}_other_customer`}, ${"QA PIL 002 Other Customer"}, ${now}, ${now})`;
    await tx`
      insert into topologies (
        id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id,
        name, version_label, project, created_at, updated_at
      ) values (
        ${`${prefix}_other_topology`}, ${`${prefix}_other_customer`}, ${otherSiteId}, ${otherEngineer.id}, ${otherEngineer.id}, ${otherEngineer.id},
        ${"QA PIL 002 Other Topology"}, ${"v1"}, ${tx.json({ devices: [], links: [], groups: [] })}, ${now}, ${now}
      )
    `;
  });
}

function startPreview(env) {
  return spawn(process.execPath, [
    "--env-file-if-exists=.env.local",
    "--env-file-if-exists=.env",
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

async function restartPreview(current, env) {
  await stopPreview(current);
  const next = startPreview(env);
  await waitForPreview();
  return next;
}

function sanitizedHeaders(response) {
  return {
    status: response.status(),
    cacheControl: response.headers()["cache-control"] ?? "",
    csp: response.headers()["content-security-policy"] ?? "",
    xContentTypeOptions: response.headers()["x-content-type-options"] ?? "",
    referrerPolicy: response.headers()["referrer-policy"] ?? "",
    permissionsPolicy: response.headers()["permissions-policy"] ?? "",
  };
}

function assertNoStoreAndSecurity(response, label) {
  const headers = sanitizedHeaders(response);
  assert.equal(headers.cacheControl.includes("no-store"), true, `${label} missing no-store`);
  assert.equal(headers.xContentTypeOptions, "nosniff", `${label} missing nosniff`);
  assert.ok(headers.csp.includes("default-src"), `${label} missing CSP`);
  assert.ok(headers.referrerPolicy, `${label} missing Referrer-Policy`);
  assert.ok(headers.permissionsPolicy, `${label} missing Permissions-Policy`);
  evidence.headers[label] = headers;
}

function cookieAttributes(setCookie) {
  assert.ok(setCookie, "Set-Cookie header is required");
  const first = setCookie.split(/,(?=\s*__Host-nettopo-pilot-session=)/)[0];
  const [nameValue, ...attributes] = first.split(";").map((part) => part.trim());
  const name = nameValue.split("=")[0];
  return {
    name,
    path: attributes.find((attr) => attr.toLowerCase().startsWith("path=")) ?? "",
    maxAge: attributes.find((attr) => attr.toLowerCase().startsWith("max-age=")) ?? "",
    httpOnly: attributes.some((attr) => attr.toLowerCase() === "httponly"),
    secure: attributes.some((attr) => attr.toLowerCase() === "secure"),
    sameSite: attributes.find((attr) => attr.toLowerCase().startsWith("samesite=")) ?? "",
  };
}

function browserCookieAttributes(cookie) {
  assert.ok(cookie, "Pilot session cookie is required");
  return {
    name: cookie.name,
    path: cookie.path,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: `SameSite=${cookie.sameSite}`,
    expires: cookie.expires,
  };
}

async function browserFetch(page, path, options = {}) {
  return await page.evaluate(async ({ path: fetchPath, options: fetchOptions }) => {
    const response = await fetch(fetchPath, fetchOptions);
    const text = await response.text();
    return {
      status: response.status,
      headers: {
        cacheControl: response.headers.get("cache-control"),
        xContentTypeOptions: response.headers.get("x-content-type-options"),
        csp: response.headers.get("content-security-policy"),
        referrerPolicy: response.headers.get("referrer-policy"),
        permissionsPolicy: response.headers.get("permissions-policy"),
      },
      text,
    };
  }, { path, options });
}

async function contextGet(context, path, headers = {}) {
  const response = await context.request.get(`${baseUrl}${path}`, { failOnStatusCode: false, headers });
  return {
    status: response.status(),
    headers: {
      cacheControl: response.headers()["cache-control"],
      xContentTypeOptions: response.headers()["x-content-type-options"],
      csp: response.headers()["content-security-policy"],
      referrerPolicy: response.headers()["referrer-policy"],
      permissionsPolicy: response.headers()["permissions-policy"],
    },
    text: await response.text(),
  };
}

function assertSafeText(label, text) {
  assert.doesNotMatch(text, new RegExp(qaCredentialPlaintext, "i"), `${label} leaked QA credential plaintext`);
  assert.doesNotMatch(text, /secret_ciphertext|secret_nonce|password\s*[:=]|token\s*[:=]|cookie\s*[:=]|postgres:\/\/|DATABASE_URL/i, `${label} leaked sensitive implementation details`);
}

async function screenshot(page, name) {
  await mkdir(screenshotsDir, { recursive: true });
  const file = resolve(screenshotsDir, name);
  await page.screenshot({ path: file, fullPage: true });
  evidence.screenshots.push(file);
}

async function dropFile(page, filename, mimeType, text) {
  const zone = page.locator("label.file-drop-zone").first();
  await zone.waitFor({ state: "visible" });
  const dataTransfer = await page.evaluateHandle(({ filename: fileName, mimeType: type, text: body }) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([body], fileName, { type }));
    return transfer;
  }, { filename, mimeType, text });
  await zone.dispatchEvent("dragenter", { dataTransfer });
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
  await zone.dispatchEvent("dragenter", { dataTransfer });
  await zone.dispatchEvent("drop", { dataTransfer });
}

async function readDataset(page) {
  const result = await browserFetch(page, "/api/topology", { cache: "no-store" });
  assert.equal(result.status, 200);
  assertSafeText("topology dataset", result.text);
  return JSON.parse(result.text);
}

function projectSummary(dataset, topologyName) {
  const topology = dataset.topologies.find((item) => item.name === topologyName);
  assert.ok(topology, `${topologyName} must exist`);
  return {
    id: topology.id,
    devices: topology.project.devices.length,
    links: topology.project.links.length,
    groups: topology.project.groups.length,
    raw: topology,
  };
}

function csvFixtures() {
  return [
    {
      name: "devices.csv",
      text: [
        "schemaVersion,sharing,id,name,type,ip,mac,model,location,url,quantity,x,y,groupId",
        "2,safe,qa-router,QA Router,router,10.42.0.1,,ISR-QA,QA Lab,,1,80,120,qa-group",
        "2,safe,qa-switch,QA Switch,switch,10.42.0.2,,SW-QA,QA Lab,,1,320,120,qa-group",
        "2,safe,qa-formula,=QA Formula Node,server,10.42.0.10,,SRV-QA,QA Lab,,1,560,120,qa-group",
      ].join("\n"),
    },
    {
      name: "links.csv",
      text: [
        "schemaVersion,sharing,id,from,to,kind,fromPort,toPort,vlan,speed",
        "2,safe,qa-link-1,qa-router,qa-switch,wired,G0/1,G0/2,10,1 Gbps",
        "2,safe,qa-link-2,qa-switch,qa-formula,wired,G0/3,G0/1,20,10 Gbps",
      ].join("\n"),
    },
    {
      name: "groups.csv",
      text: [
        "schemaVersion,sharing,id,name,kind,color,collapsed",
        "2,safe,qa-group,QA Pilot Group,site,#526cf5,false",
      ].join("\n"),
    },
    {
      name: "credentials.masked.csv",
      text: [
        "schemaVersion,sharing,projectDeviceId,deviceName,kind,usernameMasked,secretMasked,keyVersion,lastRotatedAt",
        "2,safe,qa-router,QA Router,device_admin,q***r,********,qa,",
      ].join("\n"),
    },
    {
      name: "missing-info.csv",
      text: "schemaVersion,sharing,id,severity,entityType,entityId,field,code,question,suggestion,sourceFile,sourceLine,status\n",
    },
  ];
}

async function inspectDexie(page) {
  return await page.evaluate(async (plaintext) => {
    const databases = typeof indexedDB.databases === "function" ? await indexedDB.databases() : [];
    const target = databases.find((database) => database.name === "nettopo-studio-db");
    if (!target) return { databasePresent: false, counts: {}, plaintextFound: false };
    const openRequest = indexedDB.open("nettopo-studio-db");
    const db = await new Promise((resolveOpen, rejectOpen) => {
      openRequest.onerror = () => rejectOpen(openRequest.error);
      openRequest.onsuccess = () => resolveOpen(openRequest.result);
    });
    const storeNames = Array.from(db.objectStoreNames);
    const counts = {};
    let plaintextFound = false;
    await Promise.all(storeNames.map((storeName) => new Promise((resolveStore, rejectStore) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const countRequest = store.count();
      countRequest.onsuccess = () => {
        counts[storeName] = countRequest.result;
      };
      const allRequest = store.getAll();
      allRequest.onsuccess = () => {
        plaintextFound ||= JSON.stringify(allRequest.result).includes(plaintext);
      };
      tx.oncomplete = () => resolveStore();
      tx.onerror = () => rejectStore(tx.error);
    })));
    db.close();
    return { databasePresent: true, counts, plaintextFound };
  }, qaCredentialPlaintext);
}

async function loginPilot(page, email) {
  await page.goto(baseUrl);
  await page.getByLabel("Pilot Email").fill(email);
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/pilot/session") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "進入 Internal Pilot" }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200, "pilot login must return 200");
  assertNoStoreAndSecurity(response, "pilot-login");
  const setCookieValues = typeof response.headerValues === "function" ? await response.headerValues("set-cookie") : [];
  const attrs = setCookieValues.length > 0
    ? cookieAttributes(setCookieValues.join(","))
    : browserCookieAttributes((await page.context().cookies(baseUrl)).find((cookie) => cookie.name === "__Host-nettopo-pilot-session"));
  assert.deepEqual({
    name: attrs.name,
    path: attrs.path.replace(/^Path=/, ""),
    httpOnly: attrs.httpOnly,
    secure: attrs.secure,
    sameSite: attrs.sameSite,
  }, {
    name: "__Host-nettopo-pilot-session",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "SameSite=Strict",
  });
  if ("maxAge" in attrs) assert.match(attrs.maxAge, /^Max-Age=21600$/);
  else assert.equal(typeof attrs.expires, "number");
  evidence.cookie = attrs;
  await page.getByText("INTERNAL PILOT · synthetic test data only").waitFor();
}

async function waitForWorkspaceReady(page, userName) {
  await page.getByText("正在載入拓樸工作區...").waitFor({ state: "detached" });
  await page.locator(".session-profile", { hasText: userName }).waitFor();
}

async function waitForSelectOption(page, selector, label) {
  await page.locator(`${selector} option`, { hasText: label }).first().waitFor({ state: "attached" });
}

async function clickImportPreviewTab(page, name) {
  await page.locator(".import-preview-tabs").getByRole("button", { name, exact: true }).click();
}

async function waitForImportSummaryText(page, text) {
  await page.locator(".import-summary-expanded", { hasText: text }).last().waitFor();
}

function currentModal(page) {
  return page.locator(".modal").last();
}

async function main() {
  assertRequiredEnv("DATABASE_URL");
  assertRequiredEnv("MIGRATION_DATABASE_URL");
  await mkdir(screenshotsDir, { recursive: true });

  const env = pilotEnv();
  await run(process.execPath, [
    "--env-file-if-exists=.env.local",
    "--env-file-if-exists=.env",
    "scripts/validate-runtime-policy.mjs",
  ], { env });
  await run(process.execPath, ["scripts/build-local.mjs"], { env });

  const sql = postgres(process.env.MIGRATION_DATABASE_URL, { max: 1, idle_timeout: 5, prepare: false });
  let preview;
  let browser;
  try {
    await seed(sql);
    evidence.dbCounts.afterSeed = await snapshot(sql);
    preview = startPreview(env);
    await waitForPreview();

    browser = await chromium.launch();
    const context = await browser.newContext({ acceptDownloads: true, baseURL: baseUrl });
    const page = await context.newPage();

    await page.goto(baseUrl);
    await page.getByRole("heading", { name: "登入工作平台" }).waitFor();
    assert.equal(await page.getByText("NetTopo Studio").count(), 0, "workspace should not render before login");
    const unauthTopology = await browserFetch(page, "/api/topology?bad=%7B", { cache: "no-store" });
    assert.equal(unauthTopology.status, 401);
    assertSafeText("unauth topology body", unauthTopology.text);
    evidence.statuses.push({ step: "unauth topology", status: unauthTopology.status });

    await loginPilot(page, engineer.email);
    await waitForWorkspaceReady(page, engineer.name);
    await screenshot(page, "qa-pil-002-engineer-login.png");
    assert.equal(await page.getByText("INTERNAL PILOT：僅限假資料與測試客戶").count(), 0, "login intro should be gone after login");
    assert.equal(await page.getByText("本機 Demo").count(), 0, "Pilot workspace must not display demo identity");
    assert.equal(await page.getByText("DEV-DEMO").count(), 0, "Pilot workspace must not display demo employee id");
    assert.equal(await page.getByText("測試身分").count(), 0, "development identity selector must not appear in Pilot");
    assert.equal(await page.locator("#customer-select option").count(), 0, "engineer should not see non-pilot customer before creating synthetic data");
    assert.equal(await page.locator("#topology-select option").count(), 0, "engineer should not see non-pilot topology before creating synthetic data");

    await page.locator(".switcher-field:has(#customer-select) button.mini-action").click();
    await page.getByLabel("客戶名稱").fill("QA PIL 002 Engineer Customer");
    let topologyPost = page.waitForResponse((response) => response.url().endsWith("/api/topology") && response.request().method() === "POST");
    await page.getByRole("button", { name: "建立客戶" }).click();
    let response = await topologyPost;
    assert.equal(response.status(), 200);
    assertNoStoreAndSecurity(response, "engineer-create-customer");
    await waitForSelectOption(page, "#customer-select", "QA PIL 002 Engineer Customer");
    await screenshot(page, "qa-pil-002-engineer-created-customer.png");

    await page.locator(".switcher-field:has(#topology-select) button.mini-action").click();
    await page.getByLabel("拓樸名稱").fill("QA PIL 002 Engineer Topology");
    topologyPost = page.waitForResponse((res) => res.url().endsWith("/api/topology") && res.request().method() === "POST");
    await page.getByRole("button", { name: "建立拓樸" }).click();
    response = await topologyPost;
    assert.equal(response.status(), 200);
    assertNoStoreAndSecurity(response, "engineer-create-topology");
    await waitForSelectOption(page, "#topology-select", "QA PIL 002 Engineer Topology");

    const datasetAfterCreate = await readDataset(page);
    assert.deepEqual(datasetAfterCreate.sites.map((site) => site.id), [pilotSiteId]);
    assert.equal(datasetAfterCreate.customers.some((customer) => customer.name === "QA PIL 002 Other Customer"), false);
    const createdSummary = projectSummary(datasetAfterCreate, "QA PIL 002 Engineer Topology");
    evidence.dbCounts.afterEngineerCreate = await snapshot(sql);

    const credentialRead = await browserFetch(page, `/api/credentials?topologyId=${encodeURIComponent(createdSummary.id)}`, { cache: "no-store" });
    assert.equal(credentialRead.status, 200);
    assert.match(credentialRead.text, /credentials/);
    assertSafeText("engineer credential read", credentialRead.text);
    const credentialWrite = await browserFetch(page, "/api/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert",
        topologyId: createdSummary.id,
        projectDeviceId: "missing-device",
        kind: "device_admin",
        username: "qa-user",
        secret: qaCredentialPlaintext,
      }),
    });
    assert.equal(credentialWrite.status, 403);
    assertSafeText("engineer credential write", credentialWrite.text);
    const auditRead = await browserFetch(page, "/api/audit-logs?limit=10", { cache: "no-store" });
    assert.equal(auditRead.status, 403);
    assertSafeText("engineer audit read", auditRead.text);
    evidence.statuses.push(
      { step: "engineer credential masked read", status: credentialRead.status },
      { step: "engineer credential write", status: credentialWrite.status },
      { step: "engineer audit read", status: auditRead.status },
    );

    await page.getByRole("button", { name: "匯出", exact: true }).click();
    await page.getByRole("heading", { name: "匯出拓樸資料" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "下載完整 JSON" }).isDisabled(), true);
    assert.equal(await page.getByRole("button", { name: "完整 CSV" }).isDisabled(), true);
    await page.getByRole("button", { name: "×" }).click();

    await page.getByRole("button", { name: "匯入" }).click();
    await dropFile(page, "qa-pil-002-preview.txt", "text/plain", [
      "| id | name | type | ip | username | password |",
      "| --- | --- | --- | --- | --- | --- |",
      `| txt-router | TXT Router | router | 10.42.1.1 | qa-router | ${qaCredentialPlaintext} |`,
      "| txt-switch | TXT Switch | switch | 10.42.1.2 | | |",
      "",
      "TXT Router -> TXT Switch",
    ].join("\n"));
    await clickImportPreviewTab(page, "遮蔽帳密");
    await page.getByText("********").waitFor();
    await clickImportPreviewTab(page, "缺失資料");
    await page.getByText("請確認").first().waitFor();
    await screenshot(page, "qa-pil-002-txt-preview.png");
    const beforeCancel = await snapshot(sql);
    await page.getByRole("button", { name: "取消" }).first().click();
    assert.deepEqual(await snapshot(sql), beforeCancel, "TXT preview cancel must not write DB");

    await page.getByRole("button", { name: "匯入" }).click();
    await dropFile(page, "qa-pil-002-preview.md", "text/markdown", [
      "| id | name | type | ip | model | location |",
      "| --- | --- | --- | --- | --- | --- |",
      "| md-router | MD Router | router | 10.42.2.1 | ISR-MD | QA Lab |",
      "| md-switch | MD Switch | switch | 10.42.2.2 | SW-MD | QA Lab |",
      "",
      "MD Router -> MD Switch",
    ].join("\n"));
    await clickImportPreviewTab(page, "設備");
    await page.getByText("MD Router").waitFor();
    await page.getByRole("button", { name: "取消" }).first().click();

    await page.getByRole("button", { name: "匯入" }).click();
    await dropCsvBundle(page, csvFixtures());
    await waitForImportSummaryText(page, "3設備");
    await waitForImportSummaryText(page, "2連線");
    await waitForImportSummaryText(page, "1群組");
    await clickImportPreviewTab(page, "遮蔽帳密");
    await page.getByText("********").waitFor();
    const importNameInput = currentModal(page).locator("label:has-text('新拓樸名稱') input:visible");
    await importNameInput.fill("QA PIL 002 CSV Imported");
    assert.equal(await importNameInput.inputValue(), "QA PIL 002 CSV Imported", "import name input must receive the requested topology name");
    topologyPost = page.waitForResponse((res) => res.url().endsWith("/api/topology") && res.request().method() === "POST");
    await currentModal(page).getByRole("button", { name: "確認寫入" }).click();
    response = await topologyPost;
    assert.equal(response.status(), 200);
    const importResponse = await response.json();
    evidence.import.responseTopologyNames = Array.isArray(importResponse?.topologies)
      ? importResponse.topologies.map((topology) => topology.name)
      : [];
    assertNoStoreAndSecurity(response, "csv-import-apply");
    await waitForSelectOption(page, "#topology-select", "QA PIL 002 CSV Imported");
    await page.getByText("3 個節點").waitFor();
    await screenshot(page, "qa-pil-002-csv-applied.png");

    const datasetAfterImport = await readDataset(page);
    const importedSummary = projectSummary(datasetAfterImport, "QA PIL 002 CSV Imported");
    assert.deepEqual({ devices: importedSummary.devices, links: importedSummary.links, groups: importedSummary.groups }, { devices: 3, links: 2, groups: 1 });
    evidence.import = {
      txtPreviewCancelNoWrite: true,
      mdPreviewShown: true,
      csvApply: { devices: 3, links: 2, groups: 1, maskedCredentialRows: 1 },
    };

    const firstNode = page.locator(".react-flow__node").first();
    await firstNode.waitFor({ state: "visible" });
    const beforeBox = await firstNode.boundingBox();
    assert.ok(beforeBox, "node bounding box is required");
    topologyPost = page.waitForResponse((res) => res.url().endsWith("/api/topology") && res.request().method() === "POST");
    await page.mouse.move(beforeBox.x + beforeBox.width / 2, beforeBox.y + beforeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(beforeBox.x + beforeBox.width / 2 + 90, beforeBox.y + beforeBox.height / 2 + 40, { steps: 8 });
    await page.mouse.up();
    response = await topologyPost;
    assert.equal(response.status(), 200);
    await page.reload();
    await waitForWorkspaceReady(page, engineer.name);
    await waitForSelectOption(page, "#topology-select", "QA PIL 002 CSV Imported");
    await page.getByTestId("rf__node-qa-router").getByText("QA Router").waitFor();
    const reloadedDataset = await readDataset(page);
    const reloadedSummary = projectSummary(reloadedDataset, "QA PIL 002 CSV Imported");
    assert.equal(reloadedSummary.devices, 3);

    const dexie = await inspectDexie(page);
    assert.equal(dexie.plaintextFound, false);
    evidence.dexie = dexie;
    const domText = await page.locator("body").innerText();
    assertSafeText("DOM", domText);

    await page.getByRole("button", { name: "匯出", exact: true }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "安全 CSV" }).click();
    const download = await downloadPromise;
    const zipPath = resolve(screenshotsDir, "qa-pil-002-safe-csv-bundle.zip");
    await download.saveAs(zipPath);
    const zipBuffer = await (await import("node:fs/promises")).readFile(zipPath);
    const files = unzipSync(new Uint8Array(zipBuffer));
    const names = Object.keys(files).sort();
    assert.deepEqual(names, ["credentials.masked.csv", "devices.csv", "groups.csv", "links.csv", "missing-info.csv"]);
    const decoder = new TextDecoder();
    const texts = Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, decoder.decode(bytes)]));
    const zipText = Object.values(texts).join("\n");
    assertSafeText("safe csv zip", zipText);
    assert.match(texts["devices.csv"], /'=QA Formula Node/);
    assert.doesNotMatch(zipText, /10\.42\.0\./, "safe CSV must remove IP values");
    evidence.export = {
      zipPath,
      members: names,
      secretScan: "PASS",
      formulaNeutralized: true,
      safeIpRedaction: true,
      engineerFullExportDisabled: true,
    };
    await page.getByRole("button", { name: "×" }).click();

    const logoutResponsePromise = page.waitForResponse((res) => res.url().endsWith("/api/pilot/session") && res.request().method() === "DELETE");
    await page.getByRole("button", { name: "登出" }).click();
    response = await logoutResponsePromise;
    assert.equal(response.status(), 200);
    assertNoStoreAndSecurity(response, "logout");
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    const afterLogout = await contextGet(context, "/api/topology");
    assert.equal(afterLogout.status, 401);
    evidence.statuses.push({ step: "after logout topology", status: afterLogout.status });
    await context.close();

    const tamperContext = await browser.newContext({ baseURL: baseUrl });
    const tamperResult = await contextGet(tamperContext, "/api/topology", {
      Cookie: "__Host-nettopo-pilot-session=tampered",
    });
    assert.equal(tamperResult.status, 401);
    evidence.statuses.push({ step: "tampered cookie topology", status: tamperResult.status });
    await tamperContext.close();

    const revokeContext = await browser.newContext({ baseURL: baseUrl });
    const revokePage = await revokeContext.newPage();
    await loginPilot(revokePage, engineer.email);
    preview = await restartPreview(preview, pilotEnv({ version: "qa2", fullExport: "0" }));
    const revoked = await contextGet(revokeContext, "/api/topology");
    assert.equal(revoked.status, 401);
    evidence.statuses.push({ step: "allowlist version revoked topology", status: revoked.status });
    await revokeContext.close();

    preview = await restartPreview(preview, pilotEnv({ version: "qa2", fullExport: "0" }));
    const adminContext = await browser.newContext({ acceptDownloads: true, baseURL: baseUrl });
    const adminPage = await adminContext.newPage();
    await loginPilot(adminPage, admin.email);
    await waitForWorkspaceReady(adminPage, admin.name);
    const adminDataset = await readDataset(adminPage);
    assert.deepEqual(adminDataset.sites.map((site) => site.id), [pilotSiteId]);
    assert.equal(adminDataset.customers.some((customer) => customer.name === "QA PIL 002 Other Customer"), false);
    await adminPage.getByRole("button", { name: "匯出", exact: true }).click();
    assert.equal(await adminPage.getByRole("button", { name: "下載完整 JSON" }).isDisabled(), true);
    await adminPage.getByRole("button", { name: "×" }).click();
    await adminContext.close();

    preview = await restartPreview(preview, pilotEnv({ version: "qa2", fullExport: "1" }));
    const fullAdminContext = await browser.newContext({ acceptDownloads: true, baseURL: baseUrl });
    const fullAdminPage = await fullAdminContext.newPage();
    await loginPilot(fullAdminPage, admin.email);
    await waitForWorkspaceReady(fullAdminPage, admin.name);
    await fullAdminPage.getByRole("button", { name: "匯出", exact: true }).click();
    assert.equal(await fullAdminPage.getByRole("button", { name: "下載完整 JSON" }).isDisabled(), false);
    await fullAdminPage.getByRole("button", { name: "完整 CSV" }).isDisabled();
    await fullAdminContext.close();

    const fullEngineerContext = await browser.newContext({ acceptDownloads: true, baseURL: baseUrl });
    const fullEngineerPage = await fullEngineerContext.newPage();
    await loginPilot(fullEngineerPage, engineer.email);
    await waitForWorkspaceReady(fullEngineerPage, engineer.name);
    await fullEngineerPage.getByRole("button", { name: "匯出", exact: true }).click();
    assert.equal(await fullEngineerPage.getByRole("button", { name: "下載完整 JSON" }).isDisabled(), true);
    assert.equal(await fullEngineerPage.getByRole("button", { name: "完整 CSV" }).isDisabled(), true);
    await fullEngineerContext.close();
    evidence.security.fullExportFlag = "PASS";

    evidence.dbCounts.beforeCleanup = await snapshot(sql);
  } finally {
    if (browser) await browser.close();
    await stopPreview(preview);
    await cleanup(sql);
    evidence.cleanup = await snapshot(sql);
    await sql.end({ timeout: 5 });
  }

  assert.deepEqual(evidence.cleanup, {
    sites: 0,
    users: 0,
    customers: 0,
    topologies: 0,
    credentials: 0,
    audit_logs: 0,
  });

  await writeFile(resolve("docs/dev測試紀錄/qa-pil-002-browser-summary.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({
    result: "PASS",
    browser: evidence.browser,
    baseUrl,
    statuses: evidence.statuses,
    cookieAttributes: evidence.cookie,
    screenshots: evidence.screenshots,
    zipMembers: evidence.export.members,
    cleanup: evidence.cleanup,
  }, null, 2));
}

main().catch(async (error) => {
  const failureSummary = {
    result: "FAIL",
    message: error instanceof Error ? error.message : String(error),
    evidence: {
      statuses: evidence.statuses,
      cookieAttributes: evidence.cookie,
      responseHeaders: evidence.headers,
      screenshots: evidence.screenshots,
      import: evidence.import,
      cleanup: evidence.cleanup,
    },
  };
  await writeFile(resolve("docs/dev測試紀錄/qa-pil-002-browser-summary.json"), `${JSON.stringify(failureSummary, null, 2)}\n`);
  console.error(JSON.stringify(failureSummary, null, 2));
  process.exitCode = 1;
});
