import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { unzipSync } from "fflate";
import { chromium } from "playwright";
import postgres from "postgres";

import { canonicalProjectForTransfer } from "../app/lib/topology-transfer.ts";

const prefix = "qa_pil_003";
const host = "127.0.0.1";
const port = process.env.QA_PIL_003_PORT ?? "4396";
const baseUrl = `http://${host}:${port}`;
const screenshotsDir = resolve("docs/dev測試紀錄/screenshots");
const summaryPath = resolve("docs/dev測試紀錄/qa-pil-003-uat-summary.json");
const pilotSiteId = `${prefix}_pilot_site`;
const otherSiteId = `${prefix}_other_site`;
const admin = {
  id: `${prefix}_admin_user`,
  email: `${prefix}.admin@company.local`,
  name: "QA PIL 003 Admin",
  role: "boss",
};
const engineer = {
  id: `${prefix}_engineer_user`,
  email: `${prefix}.engineer@company.local`,
  name: "QA PIL 003 Engineer",
  role: "engineer",
};
const otherEngineer = {
  id: `${prefix}_other_engineer_user`,
  email: `${prefix}.other.engineer@company.local`,
  name: "QA PIL 003 Other Engineer",
  role: "engineer",
};
const sessionSecret = randomBytes(48).toString("base64url");
const qaPlaintextSentinel = ["qa", "pil", "003", "credential", "sentinel"].join("-");
const customerName = "QA PIL 003 Synthetic Customer";
const topologyName = "QA PIL 003 Engineer Topology";
const roundTripTopologyName = "QA PIL 003 Safe Round Trip";

const evidence = {
  ticket: "QA_PIL_003",
  result: "IN_PROGRESS",
  browser: "Playwright Chromium against loopback Pilot preview; in-app Browser runtime setup succeeded before fallback for reproducible UAT script",
  baseUrl,
  startedAt: new Date().toISOString(),
  durationMs: 0,
  statuses: [],
  cookieAttributes: {},
  screenshots: [],
  dbCounts: {},
  importPreview: {},
  missingInfo: {},
  canvas: {},
  persistence: {},
  export: {},
  rbac: {},
  usability: {
    retries: 0,
    frictions: [],
  },
  cleanup: {},
  failure: undefined,
};

function assertRequiredEnv(name) {
  assert.ok(process.env[name], `${name} is required`);
}

function pilotEnv({ version = "qa-pil-003", fullExport = "0" } = {}) {
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
       or customer_id in (select id from customers where id like ${`${prefix}%`} or name like ${"QA PIL 003%"})
       or topology_id in (select id from topologies where id like ${`${prefix}%`} or name like ${"QA PIL 003%"})
       or site_id in (${pilotSiteId}, ${otherSiteId})
  `;
  await sql`
    delete from device_credentials
    where id like ${`${prefix}%`}
       or topology_id in (
         select id from topologies
         where id like ${`${prefix}%`}
            or name like ${"QA PIL 003%"}
            or customer_id in (select id from customers where id like ${`${prefix}%`} or name like ${"QA PIL 003%"})
       )
  `;
  await sql`
    delete from topologies
    where id like ${`${prefix}%`}
       or name like ${"QA PIL 003%"}
       or customer_id in (select id from customers where id like ${`${prefix}%`} or name like ${"QA PIL 003%"})
  `;
  await sql`delete from customers where id like ${`${prefix}%`} or name like ${"QA PIL 003%"}`;
  await sql`delete from user_sites where user_id like ${`${prefix}%`} or site_id in (${pilotSiteId}, ${otherSiteId})`;
  await sql`delete from users where id like ${`${prefix}%`} or email like ${`${prefix}.%`}`;
  await sql`delete from sites where id in (${pilotSiteId}, ${otherSiteId})`;
}

async function snapshot(sql) {
  const [row] = await sql`
    select
      (select count(*)::int from sites where id in (${pilotSiteId}, ${otherSiteId})) as sites,
      (select count(*)::int from users where id like ${`${prefix}%`} or email like ${`${prefix}.%`}) as users,
      (select count(*)::int from customers where id like ${`${prefix}%`} or name like ${"QA PIL 003%"}) as customers,
      (select count(*)::int from topologies where id like ${`${prefix}%`} or name like ${"QA PIL 003%"} or customer_id in (select id from customers where id like ${`${prefix}%`} or name like ${"QA PIL 003%"})) as topologies,
      (select count(*)::int from device_credentials where id like ${`${prefix}%`} or topology_id in (select id from topologies where id like ${`${prefix}%`} or name like ${"QA PIL 003%"})) as credentials,
      (select count(*)::int from audit_logs where actor_user_id like ${`${prefix}%`} or customer_id in (select id from customers where id like ${`${prefix}%`} or name like ${"QA PIL 003%"}) or topology_id in (select id from topologies where id like ${`${prefix}%`} or name like ${"QA PIL 003%"}) or site_id in (${pilotSiteId}, ${otherSiteId})) as audit_logs
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
        (${pilotSiteId}, ${"QA PIL 003 Pilot Site"}, ${now}, ${now}),
        (${otherSiteId}, ${"QA PIL 003 Other Site"}, ${now}, ${now})
    `;
    for (const user of [admin, engineer, otherEngineer]) {
      await tx`
        insert into users (id, email, name, role, disabled_at, created_at, updated_at)
        values (${user.id}, ${user.email}, ${user.name}, ${user.role}, ${null}, ${now}, ${now})
      `;
    }
    await tx`
      insert into user_sites (user_id, site_id)
      values
        (${admin.id}, ${pilotSiteId}),
        (${engineer.id}, ${pilotSiteId}),
        (${otherEngineer.id}, ${otherSiteId})
    `;
    await tx`insert into customers (id, name, created_at, updated_at) values (${`${prefix}_other_customer`}, ${"QA PIL 003 Other Customer"}, ${now}, ${now})`;
    await tx`
      insert into topologies (
        id, customer_id, site_id, owner_user_id, created_by_user_id, updated_by_user_id,
        name, version_label, project, created_at, updated_at
      ) values (
        ${`${prefix}_other_topology`}, ${`${prefix}_other_customer`}, ${otherSiteId}, ${otherEngineer.id}, ${otherEngineer.id}, ${otherEngineer.id},
        ${"QA PIL 003 Other Topology"}, ${"v1"}, ${tx.json({ devices: [], links: [], groups: [] })}, ${now}, ${now}
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

function noStoreHeaders(response) {
  return {
    cacheControl: response.headers()["cache-control"] ?? "",
    xContentTypeOptions: response.headers()["x-content-type-options"] ?? "",
    csp: response.headers()["content-security-policy"] ?? "",
    referrerPolicy: response.headers()["referrer-policy"] ?? "",
    permissionsPolicy: response.headers()["permissions-policy"] ?? "",
  };
}

function assertNoStoreAndSecurity(response, label) {
  const headers = noStoreHeaders(response);
  assert.equal(headers.cacheControl.includes("no-store"), true, `${label} missing no-store`);
  assert.equal(headers.xContentTypeOptions, "nosniff", `${label} missing nosniff`);
  assert.ok(headers.csp.includes("default-src"), `${label} missing CSP`);
  assert.ok(headers.referrerPolicy, `${label} missing Referrer-Policy`);
  assert.ok(headers.permissionsPolicy, `${label} missing Permissions-Policy`);
  return headers;
}

function cookieAttributes(setCookie) {
  assert.ok(setCookie, "Set-Cookie header is required");
  const first = setCookie.split(/,(?=\s*__Host-nettopo-pilot-session=)/)[0];
  const [nameValue, ...attributes] = first.split(";").map((part) => part.trim());
  return {
    name: nameValue.split("=")[0],
    path: attributes.find((attr) => attr.toLowerCase().startsWith("path=")) ?? "",
    maxAge: attributes.find((attr) => attr.toLowerCase().startsWith("max-age=")) ?? "",
    httpOnly: attributes.some((attr) => attr.toLowerCase() === "httponly"),
    secure: attributes.some((attr) => attr.toLowerCase() === "secure"),
    sameSite: attributes.find((attr) => attr.toLowerCase().startsWith("samesite=")) ?? "",
  };
}

async function browserFetch(page, path, options = {}) {
  return await page.evaluate(async ({ path: fetchPath, options: fetchOptions }) => {
    const response = await fetch(fetchPath, fetchOptions);
    return {
      status: response.status,
      headers: {
        cacheControl: response.headers.get("cache-control"),
        xContentTypeOptions: response.headers.get("x-content-type-options"),
        csp: response.headers.get("content-security-policy"),
        referrerPolicy: response.headers.get("referrer-policy"),
        permissionsPolicy: response.headers.get("permissions-policy"),
      },
      text: await response.text(),
    };
  }, { path, options });
}

async function contextGet(context, path, headers = {}) {
  const response = await context.request.get(`${baseUrl}${path}`, { failOnStatusCode: false, headers });
  return {
    status: response.status(),
    text: await response.text(),
  };
}

function assertSafeText(label, text) {
  assert.doesNotMatch(text, new RegExp(qaPlaintextSentinel, "i"), `${label} leaked QA plaintext sentinel`);
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
    for (const item of items) transfer.items.add(new File([item.text], item.name, { type: "text/csv" }));
    return transfer;
  }, files);
  await zone.dispatchEvent("dragenter", { dataTransfer });
  await zone.dispatchEvent("drop", { dataTransfer });
}

function warningCsvFixtures() {
  return [
    {
      name: "devices.csv",
      text: [
        "schemaVersion,sharing,id,name,type,ip,mac,model,location,url,quantity,x,y,groupId",
        "2,safe,uat-router,QA UAT Router,router,10.60.0.1,,ISR-UAT,QA Lab,,1,80,160,uat-group",
        "2,safe,uat-switch,QA UAT Switch,switch,10.60.0.2,,SW-UAT,QA Lab,,1,330,160,uat-group",
        "2,safe,uat-server,QA UAT Server,server,10.60.0.10,,SRV-UAT,QA Lab,,1,580,160,uat-group",
      ].join("\n"),
    },
    {
      name: "links.csv",
      text: [
        "schemaVersion,sharing,id,from,to,kind,fromPort,toPort,vlan,speed",
        "2,safe,uat-link-primary,uat-router,uat-switch,wired,,,,",
        "2,safe,uat-link-backup,uat-router,uat-switch,wired,G0/2,G0/22,20,1 Gbps",
        "2,safe,uat-link-server,uat-switch,uat-server,wired,G0/3,G0/1,30,10 Gbps",
      ].join("\n"),
    },
    {
      name: "groups.csv",
      text: [
        "schemaVersion,sharing,id,name,kind,color,collapsed",
        "2,safe,uat-group,QA UAT Rack,site,#526cf5,false",
      ].join("\n"),
    },
    {
      name: "credentials.masked.csv",
      text: [
        "schemaVersion,sharing,projectDeviceId,deviceName,kind,usernameMasked,secretMasked,keyVersion,lastRotatedAt",
        "2,safe,uat-router,QA UAT Router,device_admin,u***r,********,qa,",
      ].join("\n"),
    },
    {
      name: "missing-info.csv",
      text: "schemaVersion,sharing,id,severity,entityType,entityId,field,code,question,suggestion,sourceFile,sourceLine,status\n",
    },
  ];
}

function formulaProbeCsvFixtures() {
  return [
    {
      name: "devices.csv",
      text: [
        "schemaVersion,sharing,id,name,type,ip,mac,model,location,url,quantity,x,y,groupId",
        "2,safe,uat-formula-camera,QA UAT Camera,camera,,,,,,1,140,140,uat-formula-group",
      ].join("\n"),
    },
    { name: "links.csv", text: "schemaVersion,sharing,id,from,to,kind,fromPort,toPort,vlan,speed\n" },
    {
      name: "groups.csv",
      text: [
        "schemaVersion,sharing,id,name,kind,color,collapsed",
        "2,safe,uat-formula-group,=QA Formula Group,site,#526cf5,false",
      ].join("\n"),
    },
    { name: "credentials.masked.csv", text: "schemaVersion,sharing,projectDeviceId,deviceName,kind,usernameMasked,secretMasked,keyVersion,lastRotatedAt\n" },
    { name: "missing-info.csv", text: "schemaVersion,sharing,id,severity,entityType,entityId,field,code,question,suggestion,sourceFile,sourceLine,status\n" },
  ];
}

async function waitForWorkspaceReady(page, userName) {
  await page.getByText("正在載入拓樸工作區...").waitFor({ state: "detached", timeout: 45_000 });
  await page.locator(".session-profile", { hasText: userName }).waitFor({ state: "visible", timeout: 45_000 });
}

async function loginPilot(page, email, expectedName) {
  await page.goto(baseUrl);
  await page.getByLabel("Pilot Email").fill(email);
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/pilot/session") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "進入 Internal Pilot" }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200);
  const setCookieValues = typeof response.headerValues === "function" ? await response.headerValues("set-cookie") : [];
  const attrs = cookieAttributes(setCookieValues.join(","));
  assert.deepEqual({
    name: attrs.name,
    path: attrs.path.replace(/^Path=/, ""),
    httpOnly: attrs.httpOnly,
    secure: attrs.secure,
    sameSite: attrs.sameSite,
    maxAge: attrs.maxAge,
  }, {
    name: "__Host-nettopo-pilot-session",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "SameSite=Strict",
    maxAge: "Max-Age=21600",
  });
  evidence.cookieAttributes = attrs;
  assertNoStoreAndSecurity(response, "pilot login");
  await page.getByText("INTERNAL PILOT · synthetic test data only").waitFor({ timeout: 20_000 });
  await waitForWorkspaceReady(page, expectedName);
}

async function readDataset(page) {
  const result = await browserFetch(page, "/api/topology", { cache: "no-store" });
  assert.equal(result.status, 200);
  assertSafeText("topology dataset", result.text);
  return JSON.parse(result.text);
}

async function waitForSelectOption(page, selector, label) {
  await page.locator(`${selector} option`, { hasText: label }).first().waitFor({ state: "attached", timeout: 20_000 });
}

function currentModal(page) {
  return page.locator(".modal").last();
}

async function findTopology(sql, name) {
  const [row] = await sql`
    select id, name, project
    from topologies
    where name = ${name} and customer_id in (select id from customers where name like ${"QA PIL 003%"})
    order by updated_at desc
    limit 1
  `;
  return row;
}

async function waitForTopology(sql, name, predicate, label) {
  const deadline = Date.now() + 12_000;
  let lastRow;
  while (Date.now() < deadline) {
    lastRow = await findTopology(sql, name);
    if (lastRow && predicate(lastRow)) return lastRow;
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error(`${label} did not reach expected topology state: ${JSON.stringify({
    name,
    devices: lastRow?.project?.devices?.length,
    links: lastRow?.project?.links?.length,
    groups: lastRow?.project?.groups?.length,
    uatRouter: lastRow?.project?.devices?.find((device) => device.id === "uat-router"),
  })}`);
}

async function openImport(page) {
  await page.getByRole("button", { name: "匯入", exact: true }).click();
  await page.locator("label.file-drop-zone").first().waitFor({ state: "visible" });
}

async function cancelModal(page) {
  const modal = currentModal(page);
  await modal.getByRole("button", { name: "取消" }).first().click();
  await modal.waitFor({ state: "detached", timeout: 10_000 });
}

async function selectActiveTopology(page, topologyId, name) {
  await waitForSelectOption(page, "#topology-select", name);
  await page.locator("#topology-select").selectOption(topologyId);
  await page.waitForFunction((id) => document.querySelector("#topology-select")?.value === id, topologyId);
}

async function assertNoCredentialRows(sql, label) {
  const [{ count }] = await sql`
    select count(*)::int as count
    from device_credentials
    where id like ${`${prefix}%`}
       or topology_id in (select id from topologies where name like ${"QA PIL 003%"})
  `;
  assert.equal(count, 0, `${label} must not write masked preview credentials`);
}

async function applyCsv(page, files, { strategy, name, acknowledge = false, expectedDevices = "3設備", expectedLinks = "3連線" }) {
  await openImport(page);
  await dropCsvBundle(page, files);
  await page.locator(".import-summary-expanded", { hasText: expectedDevices }).last().waitFor({ timeout: 20_000 });
  await page.locator(".import-summary-expanded", { hasText: expectedLinks }).last().waitFor({ timeout: 20_000 });
  const modal = currentModal(page);
  await modal.locator("select").selectOption(strategy);
  if (strategy === "new" && name) {
    await modal.getByLabel("新拓樸名稱").fill(name);
  }
  if (acknowledge) {
    await modal.locator(".import-warning-ack input").check();
  }
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/topology") && response.request().method() === "POST");
  await modal.getByRole("button", { name: "確認寫入" }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200);
  assertNoStoreAndSecurity(response, `apply ${strategy}`);
  await page.getByText(/匯入完成：/).waitFor({ timeout: 20_000 });
  await modal.waitFor({ state: "detached", timeout: 20_000 });
  return await response.json();
}

function parsePathNumbers(path) {
  return [...path.matchAll(/[-+]?\d*\.?\d+/g)].map((match) => Number(match[0]));
}

function assertOrthogonalPath(path) {
  const values = parsePathNumbers(path);
  assert.equal(values.length % 2, 0, `path coordinate count must be even: ${path}`);
  const points = [];
  for (let index = 0; index < values.length; index += 2) points.push({ x: values[index], y: values[index + 1] });
  assert.ok(points.length >= 3, `wired route must have bends, got ${path}`);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    assert.ok(previous.x === current.x || previous.y === current.y, `segment ${index} is diagonal in ${path}`);
  }
}

async function routeEvidence(page) {
  const overlay = page.locator(".flow-link-overlay");
  await overlay.waitFor({ state: "visible", timeout: 20_000 });
  const routeElements = await overlay.locator("g.flow-link").evaluateAll((groups) => groups.map((group) => {
    const path = group.querySelector("path.visible-line")?.getAttribute("d") ?? "";
    const label = group.querySelector(".flow-link-label text")?.textContent ?? "";
    return {
      linkId: group.getAttribute("data-link-id"),
      kind: group.getAttribute("data-route-kind"),
      status: group.getAttribute("data-route-status"),
      className: group.getAttribute("class"),
      path,
      label,
    };
  }));
  const wired = overlay.locator('g.flow-link.orthogonal.resolved[data-route-kind="orthogonal"][data-route-status="resolved"]');
  await wired.first().waitFor({ state: "visible", timeout: 20_000 });
  const resolvedWiredCount = await wired.count();
  const paths = [];
  for (let index = 0; index < resolvedWiredCount; index += 1) {
    const path = await wired.nth(index).locator("path.visible-line").getAttribute("d");
    assert.ok(path, "wired route path is required");
    assertOrthogonalPath(path);
    paths.push(path);
  }
  const wireless = overlay.locator('g.flow-link.wireless.resolved[data-route-kind="wireless"][data-route-status="resolved"]');
  const wiredRoutes = routeElements.filter((route) => route.kind === "orthogonal");
  return {
    routeElements,
    wiredCount: wiredRoutes.length,
    resolvedWiredCount,
    unresolvedWiredCount: wiredRoutes.filter((route) => route.status !== "resolved").length,
    wirelessCount: await wireless.count(),
    orthogonalPaths: paths.length,
    sharedCorridorOffsetObserved: new Set(paths).size > 1,
  };
}

async function inspectDexie(page) {
  return await page.evaluate(async (sentinel) => {
    const databases = typeof indexedDB.databases === "function" ? await indexedDB.databases() : [];
    const target = databases.find((database) => database.name === "nettopo-studio-db");
    if (!target) return { databasePresent: false, plaintextFound: false };
    const request = indexedDB.open("nettopo-studio-db");
    const db = await new Promise((resolveOpen, rejectOpen) => {
      request.onerror = () => rejectOpen(request.error);
      request.onsuccess = () => resolveOpen(request.result);
    });
    let plaintextFound = false;
    for (const storeName of Array.from(db.objectStoreNames)) {
      await new Promise((resolveStore, rejectStore) => {
        const tx = db.transaction(storeName, "readonly");
        const allRequest = tx.objectStore(storeName).getAll();
        allRequest.onsuccess = () => {
          plaintextFound ||= JSON.stringify(allRequest.result).includes(sentinel);
        };
        tx.oncomplete = resolveStore;
        tx.onerror = () => rejectStore(tx.error);
      });
    }
    db.close();
    return { databasePresent: true, plaintextFound };
  }, qaPlaintextSentinel);
}

async function runUat(sql) {
  const start = Date.now();
  let preview;
  let browserInstance;
  let activePage;
  try {
    await seed(sql);
    evidence.dbCounts.afterSeed = await snapshot(sql);
    const env = pilotEnv();
    await run(process.execPath, ["--env-file-if-exists=.env.local", "--env-file-if-exists=.env", "scripts/validate-runtime-policy.mjs"], { env });
    await run(process.execPath, ["scripts/build-local.mjs"], { env });
    preview = startPreview(env);
    await waitForPreview();

    browserInstance = await chromium.launch();
    const context = await browserInstance.newContext({ acceptDownloads: true, baseURL: baseUrl });
    const page = await context.newPage();
    activePage = page;
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto(baseUrl);
    await page.getByRole("heading", { name: "登入工作平台" }).waitFor({ timeout: 20_000 });
    const unauth = await browserFetch(page, "/api/topology", { cache: "no-store" });
    assert.equal(unauth.status, 401);
    evidence.statuses.push({ step: "unauth protected topology", status: unauth.status });

    await loginPilot(page, engineer.email, engineer.name);
    await screenshot(page, "qa-pil-003-01-engineer-login.png");
    assert.equal(await page.getByText("測試身分").count(), 0, "Pilot must not show dev identity selector");
    evidence.statuses.push({ step: "engineer login", status: 200 });

    await page.locator(".switcher-field:has(#customer-select) button.mini-action").click();
    await page.getByLabel("客戶名稱").fill(customerName);
    let topologyPost = page.waitForResponse((response) => response.url().endsWith("/api/topology") && response.request().method() === "POST");
    await page.getByRole("button", { name: "建立客戶" }).click();
    let response = await topologyPost;
    assert.equal(response.status(), 200);
    await waitForSelectOption(page, "#customer-select", customerName);

    await page.locator(".switcher-field:has(#topology-select) button.mini-action").click();
    await page.getByLabel("拓樸名稱").fill(topologyName);
    topologyPost = page.waitForResponse((res) => res.url().endsWith("/api/topology") && res.request().method() === "POST");
    await page.getByRole("button", { name: "建立拓樸" }).click();
    response = await topologyPost;
    assert.equal(response.status(), 200);
    await waitForSelectOption(page, "#topology-select", topologyName);
    evidence.dbCounts.afterSyntheticCreate = await snapshot(sql);
    await screenshot(page, "qa-pil-003-02-synthetic-customer-topology.png");

    const initialDataset = await readDataset(page);
    assert.deepEqual(initialDataset.sites.map((site) => site.id), [pilotSiteId]);
    assert.equal(initialDataset.customers.some((customer) => customer.name === "QA PIL 003 Other Customer"), false);

    const createdTopology = initialDataset.topologies.find((topology) => topology.name === topologyName);
    assert.ok(createdTopology, "created topology must be visible to engineer");
    const credentialWrite = await browserFetch(page, "/api/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert",
        topologyId: createdTopology.id,
        projectDeviceId: "uat-router",
        kind: "device_admin",
        username: "qa-user",
        secret: qaPlaintextSentinel,
      }),
    });
    assert.equal(credentialWrite.status, 403);
    const auditRead = await browserFetch(page, "/api/audit-logs?limit=10", { cache: "no-store" });
    assert.equal(auditRead.status, 403);
    evidence.rbac.engineer = { credentialWrite: credentialWrite.status, auditRead: auditRead.status };

    await openImport(page);
    await dropFile(page, "qa-pil-003-notes.txt", "text/plain", [
      "| id | name | type | ip | username | password |",
      "| --- | --- | --- | --- | --- | --- |",
      `| txt-router | TXT Router | router | 10.60.10.1 | qa-router | ${qaPlaintextSentinel} |`,
      "| txt-switch | TXT Switch | switch | 10.60.10.2 | | |",
      "",
      "TXT Router -> TXT Switch",
    ].join("\n"));
    await page.locator(".import-preview-tabs").getByRole("button", { name: "遮蔽帳密", exact: true }).click();
    await page.getByText("********").waitFor({ timeout: 20_000 });
    await page.locator(".import-preview-tabs").getByRole("button", { name: "缺失資料", exact: true }).click();
    await page.getByText("請確認").first().waitFor({ timeout: 20_000 });
    const beforeTxtCancel = await snapshot(sql);
    await screenshot(page, "qa-pil-003-03-txt-preview.png");
    await cancelModal(page);
    assert.deepEqual(await snapshot(sql), beforeTxtCancel, "TXT preview cancel must be zero-write");

    await openImport(page);
    const beforeBlocking = await snapshot(sql);
    await dropFile(page, "qa-pil-003-blocking.md", "text/markdown", [
      "| from | to | kind |",
      "| --- | --- | --- |",
      "| missing-a | missing-b | wired |",
    ].join("\n"));
    await page.locator(".import-preview-tabs").getByRole("button", { name: "缺失資料", exact: true }).click();
    await page.getByText("blocking").first().waitFor({ timeout: 20_000 });
    const blockingModal = currentModal(page);
    const blockingConfirm = blockingModal.getByRole("button", { name: "確認寫入" });
    assert.equal(await blockingConfirm.isDisabled(), true, "blocking import must disable confirm");
    await blockingModal.getByRole("button", { name: "排除此項" }).first().click();
    await page.waitForTimeout(500);
    evidence.missingInfo.blockingExclusion = {
      confirmDisabledBeforeExclude: true,
      exclusionButtonUsed: true,
      zeroWrite: JSON.stringify(await snapshot(sql)) === JSON.stringify(beforeBlocking),
    };
    await screenshot(page, "qa-pil-003-04-blocking-exclusion.png");
    await cancelModal(page);

    await openImport(page);
    await dropFile(page, "qa-pil-003-preview.md", "text/markdown", [
      "| id | name | type | ip | model | location |",
      "| --- | --- | --- | --- | --- | --- |",
      "| md-router | MD Router | router | 10.60.20.1 | ISR-MD | QA Lab |",
      "| md-switch | MD Switch | switch | 10.60.20.2 | SW-MD | QA Lab |",
      "",
      "MD Router -> MD Switch",
    ].join("\n"));
    await page.locator(".import-preview-tabs").getByRole("button", { name: "設備", exact: true }).click();
    await page.getByText("MD Router").waitFor({ timeout: 20_000 });
    await screenshot(page, "qa-pil-003-05-md-preview.png");
    await cancelModal(page);

    await openImport(page);
    await dropCsvBundle(page, warningCsvFixtures());
    await page.locator(".import-summary-expanded", { hasText: "3設備" }).last().waitFor({ timeout: 20_000 });
    await page.locator(".import-summary-expanded", { hasText: "3連線" }).last().waitFor({ timeout: 20_000 });
    await page.locator(".import-summary-expanded", { hasText: "1群組" }).last().waitFor({ timeout: 20_000 });
    await page.locator(".import-preview-tabs").getByRole("button", { name: "遮蔽帳密", exact: true }).click();
    await page.getByText("********").waitFor({ timeout: 20_000 });
    await page.locator(".import-preview-tabs").getByRole("button", { name: "缺失資料", exact: true }).click();
    await page.getByText("warning").first().waitFor({ timeout: 20_000 });
    const csvModal = currentModal(page);
    await csvModal.locator("select").selectOption("replace");
    const csvConfirm = csvModal.getByRole("button", { name: "確認寫入" });
    assert.equal(await csvConfirm.isDisabled(), true, "warning import must require acknowledgement");
    await csvModal.locator(".import-warning-ack input").check();
    assert.equal(await csvConfirm.isEnabled(), true, "warning acknowledgement should enable apply");
    topologyPost = page.waitForResponse((res) => res.url().endsWith("/api/topology") && res.request().method() === "POST");
    await csvConfirm.click();
    response = await topologyPost;
    assert.equal(response.status(), 200);
    await csvModal.waitFor({ state: "detached", timeout: 20_000 });
    await page.getByText("3 個節點").waitFor({ timeout: 20_000 });
    await screenshot(page, "qa-pil-003-06-csv-applied.png");
    await assertNoCredentialRows(sql, "CSV apply");

    const appliedRow = await waitForTopology(sql, topologyName, (row) =>
      row.project.devices.length === 3 && row.project.links.length === 3 && row.project.groups.length === 1,
      "CSV apply",
    );
    evidence.importPreview = {
      txtMaskedPreview: true,
      txtCancelZeroWrite: true,
      mdPreview: true,
      csvCounts: { devices: 3, links: 3, groups: 1, maskedCredentials: 1 },
      warningAcknowledgement: true,
      appliedProject: { devices: appliedRow.project.devices.length, links: appliedRow.project.links.length, groups: appliedRow.project.groups.length },
    };

    await page.getByRole("button", { name: "連線", exact: true }).click();
    await page.locator(".link-row", { hasText: "QA UAT Router → QA UAT Switch" }).first().click();
    const inspector = page.locator(".inspector-form").last();
    await inspector.locator('input[name="fromPort"]').fill("G0/1");
    await inspector.locator('input[name="toPort"]').fill("G0/21");
    await inspector.locator('select[name="speed"]').selectOption({ label: "1 Gbps" });
    topologyPost = page.waitForResponse((res) => res.url().endsWith("/api/topology") && res.request().method() === "POST");
    await inspector.getByRole("button", { name: "儲存連線" }).click();
    response = await topologyPost;
    assert.equal(response.status(), 200);

    await page.getByRole("button", { name: "連線", exact: true }).click();
    await page.getByRole("button", { name: "+ 建立連線" }).click();
    const linkModal = currentModal(page);
    await linkModal.getByLabel("來源設備").selectOption({ label: "QA UAT Router" });
    await linkModal.getByLabel("目的設備").selectOption({ label: "QA UAT Server" });
    await linkModal.locator('select[name="kind"]').selectOption("wireless");
    await linkModal.locator('select[name="speed"]').selectOption({ label: "1 Gbps" });
    topologyPost = page.waitForResponse((res) => res.url().endsWith("/api/topology") && res.request().method() === "POST");
    await linkModal.getByRole("button", { name: "確認新增" }).click();
    response = await topologyPost;
    assert.equal(response.status(), 200);
    const afterWirelessCreate = await waitForTopology(sql, topologyName, (row) => row.project.links.length === 4, "wireless link create");
    evidence.canvasProject = {
      afterWirelessCreate: {
        devices: afterWirelessCreate.project.devices.length,
        links: afterWirelessCreate.project.links.length,
        wiredLinks: afterWirelessCreate.project.links.filter((link) => link.kind !== "wireless").length,
        wirelessLinks: afterWirelessCreate.project.links.filter((link) => link.kind === "wireless").length,
      },
    };

    await page.getByRole("button", { name: "設備", exact: true }).click();
    await page.locator(".device-row", { hasText: "QA UAT Router" }).first().click();
    const routerNode = page.getByTestId("rf__node-uat-router");
    await routerNode.waitFor({ state: "visible", timeout: 20_000 });
    const box = await routerNode.boundingBox();
    assert.ok(box, "router node box is required");
    const dragStart = { x: box.x + box.width * 0.25, y: box.y + 24 };
    topologyPost = page.waitForResponse((res) => res.url().endsWith("/api/topology") && res.request().method() === "POST");
    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    await page.mouse.move(dragStart.x, dragStart.y + 90, { steps: 10 });
    await page.mouse.up();
    response = await topologyPost;
    assert.equal(response.status(), 200);
    await waitForTopology(sql, topologyName, (row) => {
      const router = row.project.devices.find((device) => device.id === "uat-router");
      return row.project.links.length === 4 && Boolean(router && router.y !== 160);
    }, "drag persistence");
    await page.waitForTimeout(500);
    evidence.canvas = await routeEvidence(page);
    assert.ok(evidence.canvas.wiredCount >= 3, "wired routes should be rendered");
    assert.ok(evidence.canvas.resolvedWiredCount >= 3, "wired routes should be resolved in the safe UAT fixture");
    assert.ok(evidence.canvas.wirelessCount >= 1, "created wireless route should be rendered");
    await screenshot(page, "qa-pil-003-07-canvas-routes.png");

    await page.reload();
    await waitForWorkspaceReady(page, engineer.name);
    const reloadedDataset = await readDataset(page);
    const reloadedTopology = reloadedDataset.topologies.find((topology) => topology.name === topologyName);
    assert.ok(reloadedTopology, "reloaded topology must exist");
    assert.equal(reloadedTopology.project.devices.length, 3);
    assert.equal(reloadedTopology.project.links.length, 4);
    const movedRouter = reloadedTopology.project.devices.find((device) => device.id === "uat-router");
    assert.ok(movedRouter && (movedRouter.x !== 80 || movedRouter.y !== 160), "dragged router position must persist after reload");
    evidence.persistence = {
      reloadProject: { devices: reloadedTopology.project.devices.length, links: reloadedTopology.project.links.length, groups: reloadedTopology.project.groups.length },
      movedRouterPersisted: true,
    };

    const dexie = await inspectDexie(page);
    assert.equal(dexie.plaintextFound, false);
    const domText = await page.locator("body").innerText();
    assertSafeText("DOM", domText);

    const originalSafeCanonical = canonicalProjectForTransfer(reloadedTopology.project, { safe: true });
    await page.getByRole("button", { name: "匯出", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "完整 CSV" }).isDisabled(), true);
    const exportModal = currentModal(page);
    const downloadPromise = page.waitForEvent("download");
    await exportModal.getByRole("button", { name: "安全 CSV" }).click();
    const download = await downloadPromise;
    const zipPath = resolve(screenshotsDir, "qa-pil-003-safe-csv-bundle.zip");
    await download.saveAs(zipPath);
    const zipBytes = await readFile(zipPath);
    const unzipped = unzipSync(new Uint8Array(zipBytes));
    const zipMembers = Object.keys(unzipped).sort();
    assert.deepEqual(zipMembers, ["credentials.masked.csv", "devices.csv", "groups.csv", "links.csv", "missing-info.csv"]);
    const decoder = new TextDecoder();
    const zipTexts = Object.fromEntries(Object.entries(unzipped).map(([name, bytes]) => [name, decoder.decode(bytes)]));
    assertSafeText("safe CSV ZIP", Object.values(zipTexts).join("\n"));
    await exportModal.getByRole("button", { name: "×" }).click();

    await applyCsv(page, formulaProbeCsvFixtures(), { strategy: "new", name: "QA PIL 003 Formula Probe", expectedDevices: "1設備", expectedLinks: "0連線" });
    await selectActiveTopology(page, (await waitForTopology(sql, "QA PIL 003 Formula Probe", (row) => row.project.devices.length === 1, "formula probe")).id, "QA PIL 003 Formula Probe");
    await page.getByRole("button", { name: "匯出", exact: true }).click();
    const formulaDownloadPromise = page.waitForEvent("download");
    await currentModal(page).getByRole("button", { name: "安全 CSV" }).click();
    const formulaDownload = await formulaDownloadPromise;
    const formulaZipPath = resolve(screenshotsDir, "qa-pil-003-formula-probe.zip");
    await formulaDownload.saveAs(formulaZipPath);
    const formulaTexts = Object.fromEntries(Object.entries(unzipSync(new Uint8Array(await readFile(formulaZipPath)))).map(([name, bytes]) => [name, decoder.decode(bytes)]));
    assert.match(formulaTexts["groups.csv"], /'=QA Formula Group/);
    await currentModal(page).getByRole("button", { name: "×" }).click();

    await selectActiveTopology(page, reloadedTopology.id, topologyName);
    const exportedCsvFiles = zipMembers.map((name) => ({ name, text: zipTexts[name] }));
    await applyCsv(page, exportedCsvFiles, { strategy: "new", name: roundTripTopologyName, acknowledge: true, expectedDevices: "3設備", expectedLinks: "4連線" });
    const roundTrip = await waitForTopology(sql, roundTripTopologyName, (row) => row.project.devices.length === 3 && row.project.links.length === 4, "safe round trip");
    assert.deepEqual(canonicalProjectForTransfer(roundTrip.project), originalSafeCanonical);

    evidence.export = {
      safeZipMembers: zipMembers,
      safeSecretScan: "PASS",
      formulaNeutralized: true,
      safeCanonicalEquality: true,
      engineerFullCsvDisabled: true,
      zipPath,
    };

    const logoutRequestPromise = page.waitForRequest((request) => request.method() === "DELETE");
    await page.getByRole("button", { name: "登出" }).click({ noWaitAfter: true });
    const logoutRequest = await logoutRequestPromise;
    assert.equal(new URL(logoutRequest.url()).pathname, "/api/pilot/session");
    response = await logoutRequest.response();
    assert.ok(response, "Pilot logout must return an HTTP response before reload");
    assert.equal(response.status(), 200);
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    const afterLogout = await contextGet(context, "/api/topology");
    assert.equal(afterLogout.status, 401);
    evidence.statuses.push({ step: "after logout topology", status: afterLogout.status });
    await context.close();

    const adminContext = await browserInstance.newContext({ acceptDownloads: true, baseURL: baseUrl });
    const adminPage = await adminContext.newPage();
    await loginPilot(adminPage, admin.email, admin.name);
    const adminDataset = await readDataset(adminPage);
    assert.deepEqual(adminDataset.sites.map((site) => site.id), [pilotSiteId]);
    assert.equal(adminDataset.customers.some((customer) => customer.name === "QA PIL 003 Other Customer"), false);
    await adminPage.getByRole("button", { name: "匯出", exact: true }).click();
    assert.equal(await adminPage.getByRole("button", { name: "完整 CSV" }).isDisabled(), true);
    await adminContext.close();
    evidence.rbac.admin = { pilotSiteOnly: true, fullExportDefaultDisabled: true };

    const tamperContext = await browserInstance.newContext({ baseURL: baseUrl });
    const tampered = await contextGet(tamperContext, "/api/topology", { Cookie: "__Host-nettopo-pilot-session=tampered" });
    assert.equal(tampered.status, 401);
    await tamperContext.close();
    evidence.statuses.push({ step: "tampered cookie topology", status: tampered.status });

    evidence.dbCounts.beforeCleanup = await snapshot(sql);
    evidence.usability.frictions.push({
      severity: "MINOR",
      area: "Import strategy",
      note: "CSV warning import requires explicit acknowledgement; behavior is safe and understandable but adds one extra click.",
    });
    evidence.usability.frictions.push({
      severity: "OBSERVATION",
      area: "Safe export",
      note: "Engineer can discover Safe CSV; Full CSV is visibly disabled in Pilot as expected.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const sessionProfileBlocked = message.includes("session-profile") || message.includes("登入者資料");
    evidence.usability.frictions.push({
      severity: "BLOCKING",
      area: sessionProfileBlocked ? "Canvas/link inspector" : "QA_PIL_003 UAT",
      note: sessionProfileBlocked
        ? "Workspace session profile overlay intercepts the visible save-link action, preventing the engineer from completing the canvas correction workflow."
        : `UAT stopped before completion: ${message}`,
    });
    if (activePage) {
      await screenshot(activePage, "qa-pil-003-failure-session-profile-overlap.png").catch(() => undefined);
    }
    throw error;
  } finally {
    if (browserInstance) await browserInstance.close();
    await stopPreview(preview);
    await cleanup(sql);
    evidence.cleanup = await snapshot(sql);
    evidence.durationMs = Date.now() - start;
  }
}

async function main() {
  assertRequiredEnv("DATABASE_URL");
  assertRequiredEnv("MIGRATION_DATABASE_URL");
  await mkdir(screenshotsDir, { recursive: true });
  const sql = postgres(process.env.MIGRATION_DATABASE_URL, { max: 1, idle_timeout: 5, prepare: false });
  try {
    await runUat(sql);
    assert.deepEqual(evidence.cleanup, {
      sites: 0,
      users: 0,
      customers: 0,
      topologies: 0,
      credentials: 0,
      audit_logs: 0,
    });
    evidence.result = "QA_PASSED";
  } catch (error) {
    evidence.result = "QA_FAILED";
    evidence.failure = {
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    };
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
    evidence.finishedAt = new Date().toISOString();
    await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      result: evidence.result,
      durationMs: evidence.durationMs,
      statuses: evidence.statuses,
      importPreview: evidence.importPreview,
      canvas: evidence.canvas,
      export: {
        safeZipMembers: evidence.export.safeZipMembers,
        safeSecretScan: evidence.export.safeSecretScan,
        formulaNeutralized: evidence.export.formulaNeutralized,
        safeCanonicalEquality: evidence.export.safeCanonicalEquality,
      },
      cleanup: evidence.cleanup,
      failure: evidence.failure,
    }, null, 2));
  }
}

await main();
