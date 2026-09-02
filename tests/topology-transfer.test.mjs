import assert from "node:assert/strict";
import test from "node:test";

import {
  CSV_BUNDLE_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION,
  ProjectExportSchema,
  ProjectSchema,
  applyImportPlanExclusions,
  buildImportPlan,
  createProjectExport,
  materializeImport,
  materializeImportBundle,
  projectExportToJson,
  projectToCsvBundleZip,
  projectToCsvFiles,
} from "../app/lib/topology-transfer.ts";
import { buildMissingInfo } from "../app/lib/topology-missing-info.ts";

const project = {
  devices: [
    {
      id: "router-1",
      name: "核心路由器",
      type: "router",
      ip: "192.168.1.1",
      mac: "00:11:22:33:44:55",
      model: "RTX-9000",
      location: "機櫃 A",
      url: "https://192.168.1.1",
      quantity: 5,
      x: 80,
      y: 100,
      groupId: "hq",
    },
    {
      id: "switch-1",
      name: "Core Switch",
      type: "switch",
      model: "SW-48",
      ip: "192.168.1.2",
      location: "機櫃 A",
      x: 320,
      y: 100,
      groupId: "hq",
    },
  ],
  links: [
    {
      id: "link-1",
      from: "router-1",
      to: "switch-1",
      kind: "wired",
      fromPort: "LAN1",
      toPort: "Port 1",
      vlan: "Trunk",
      speed: "1 Gbps",
    },
  ],
  groups: [{ id: "hq", name: "HQ", kind: "site", color: "#526cf5", collapsed: true }],
};

const maskedCredentials = [{
  projectDeviceId: "router-1",
  deviceName: "核心路由器",
  kind: "device_admin",
  usernameMasked: "a***n",
  secretMasked: "********",
  keyVersion: "v1",
  lastRotatedAt: "2026-08-10T00:00:00.000Z",
}];

test("versioned JSON export round-trips through ImportBundlePlan", () => {
  const json = projectExportToJson(project, {
    safe: false,
    topologyName: "HQ topology",
    exportedAt: "2026-07-29T00:00:00.000Z",
  });
  const envelope = ProjectExportSchema.parse(JSON.parse(json));
  const plan = buildImportPlan([{ name: "backup.json", text: json }]);

  assert.equal(envelope.schemaVersion, PROJECT_SCHEMA_VERSION);
  assert.equal(envelope.sharing, "full");
  assert.equal(plan.canApply, true);
  assert.equal(plan.sourceKind, "json");
  assert.equal(plan.suggestedName, "HQ topology");
  assert.deepEqual(plan.project, ProjectSchema.parse(project));
  assert.equal(plan.project.devices[0].quantity, 5);
  assert.equal(plan.project.groups[0].collapsed, true);
  assert.equal(plan.summary.devices, 2);
  assert.equal(plan.summary.links, 1);
  assert.equal(plan.summary.groups, 1);
});

test("safe exports are the default and remove management data from JSON and CSV", () => {
  const projectWithLegacyCredentials = {
    ...project,
    devices: [{ ...project.devices[0], username: "admin", password: "cleartext-secret", secret: "raw-secret" }, project.devices[1]],
  };
  const safe = createProjectExport(projectWithLegacyCredentials, {
    exportedAt: "2026-07-29T00:00:00.000Z",
  });
  const fullJson = projectExportToJson(projectWithLegacyCredentials, { safe: false });
  const fullCsv = projectToCsvFiles(projectWithLegacyCredentials, { safe: false });
  const safeCsv = projectToCsvFiles(projectWithLegacyCredentials);

  assert.equal(safe.sharing, "safe");
  assert.equal(safe.project.devices[0].url, undefined);
  assert.equal(safe.project.devices[0].ip, undefined);
  assert.equal(safe.project.devices[0].mac, undefined);
  assert.equal(safe.project.devices[0].location, undefined);
  assert.doesNotMatch(JSON.stringify(safe), /https:\/\/192|192\.168|00:11/);
  assert.doesNotMatch(fullJson, /admin|cleartext-secret|raw-secret|username|password|secret/i);
  assert.doesNotMatch(safeCsv["devices.csv"], /https:\/\/192|192\.168|00:11/);
  assert.doesNotMatch(fullCsv["devices.csv"], /,admin,|cleartext-secret|raw-secret|username|password|secret/i);
  assert.match(fullCsv["devices.csv"], /schemaVersion,sharing,id,name,type/);
  assert.match(fullCsv["credentials.masked.csv"], /schemaVersion,sharing,projectDeviceId/);
  assert.match(fullCsv["missing-info.csv"], /schemaVersion,sharing,id,severity/);
});

test("five CSV bundle files round-trip with canonical project and safe credential equality", () => {
  const missingInfo = buildMissingInfo(project);
  const csv = projectToCsvFiles(project, { safe: false, maskedCredentials, missingInfo });
  const plan = buildImportPlan(Object.entries(csv).map(([name, text]) => ({ name, text })));

  assert.equal(plan.canApply, true);
  assert.equal(plan.sourceKind, "csv-bundle");
  assert.deepEqual(plan.project, ProjectSchema.parse(project));
  assert.deepEqual(plan.maskedCredentials, maskedCredentials);
  assert.deepEqual(plan.missingInfo, missingInfo);
  assert.equal(plan.summary.maskedCredentials, 1);
  assert.equal(plan.summary.missingBlocking, 0);
});

test("header-only credentials and missing-info CSV files are valid bundle members", () => {
  const csv = projectToCsvFiles(project, { safe: false, maskedCredentials: [], missingInfo: [] });
  const plan = buildImportPlan(Object.entries(csv).map(([name, text]) => ({ name, text })));

  assert.equal(plan.canApply, true);
  assert.deepEqual(plan.maskedCredentials, []);
  assert.equal(plan.missingInfo.length, 0);
  assert.match(csv["devices.csv"], /^\uFEFFschemaVersion/);
  assert.match(csv["links.csv"], /\r\n/);
});

test("ZIP export dynamically produces exactly the five CSV bundle members", async () => {
  const { unzipSync, strFromU8 } = await import("fflate");
  const zip = await projectToCsvBundleZip({
    ...project,
    devices: [{ ...project.devices[0], username: "admin", password: "cleartext-secret" }, project.devices[1]],
  }, { maskedCredentials });
  const files = unzipSync(zip);
  const names = Object.keys(files).sort();
  const textBundle = Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, strFromU8(bytes)]));

  assert.deepEqual(names, [
    "credentials.masked.csv",
    "devices.csv",
    "groups.csv",
    "links.csv",
    "missing-info.csv",
  ]);
  assert.match(textBundle["devices.csv"], /^schemaVersion,sharing/);
  assert.match(textBundle["devices.csv"], new RegExp(`${CSV_BUNDLE_SCHEMA_VERSION},safe,router-1`));
  assert.doesNotMatch(Object.values(textBundle).join("\n"), /,admin,|cleartext-secret|username,password|raw-secret/i);
});

test("masked credentials reject full usernames and formula injection is neutralized", () => {
  const malicious = projectToCsvFiles({
    ...project,
    devices: [{ ...project.devices[0], name: "=cmd|' /C calc'!A0" }, project.devices[1]],
  }, { safe: false });
  const plan = buildImportPlan([
    { name: "devices.csv", text: projectToCsvFiles(project, { safe: false })["devices.csv"] },
    { name: "links.csv", text: projectToCsvFiles(project, { safe: false })["links.csv"] },
    { name: "groups.csv", text: projectToCsvFiles(project, { safe: false })["groups.csv"] },
    {
      name: "credentials.masked.csv",
      text: [
        "schemaVersion,sharing,projectDeviceId,deviceName,kind,usernameMasked,secretMasked,keyVersion,lastRotatedAt",
        "2,full,router-1,Router,device_admin,admin,********,,",
      ].join("\r\n"),
    },
    { name: "missing-info.csv", text: projectToCsvFiles(project, { safe: false, missingInfo: [] })["missing-info.csv"] },
  ]);

  assert.match(malicious["devices.csv"], /'=cmd/);
  assert.equal(plan.canApply, false);
  assert.ok(plan.issues.some((issue) => issue.path?.includes("credentials.masked.csv")));
});

test("legacy three CSV files remain compatible and mask old credential columns", () => {
  const legacyDevices = [
    "id,name,type,ip,username,password,x,y,groupId",
    "router-1,Router,router,192.168.1.1,admin,cleartext,80,100,hq",
    "switch-1,Switch,switch,192.168.1.2,,,320,100,hq",
  ].join("\r\n");
  const plan = buildImportPlan([
    { name: "devices.csv", text: legacyDevices },
    { name: "links.csv", text: "id,from,to,kind,fromPort,toPort,vlan,speed\r\nlink-1,router-1,switch-1,wired,LAN1,Port 1,Trunk,1 Gbps" },
    { name: "groups.csv", text: "id,name,kind,color,collapsed\r\nhq,HQ,site,#526cf5,true" },
  ]);

  assert.equal(plan.canApply, true);
  assert.equal(plan.project.devices[0].username, undefined);
  assert.equal(plan.project.devices[0].password, undefined);
  assert.deepEqual(plan.maskedCredentials, [{
    projectDeviceId: "router-1",
    deviceName: "Router",
    kind: "device_admin",
    usernameMasked: "a***n",
    secretMasked: "********",
  }]);
  assert.ok(plan.issues.some((issue) => issue.code === "csv.v1-credentials-masked"));
});

test("ImportBundlePlan reports malformed schema and broken cross references without writing", () => {
  const plan = buildImportPlan([{
    name: "broken.json",
    text: JSON.stringify({
      schemaVersion: 1,
      kind: "nettopo-project",
      sharing: "full",
      exportedAt: "2026-07-29T00:00:00.000Z",
      project: {
        devices: [{ id: "router-1", name: "Router", type: "router", model: "R", ip: "1.1.1.1", location: "A", x: 0, y: 0 }],
        links: [{ id: "link-1", from: "router-1", to: "missing", kind: "wired" }],
        groups: [],
      },
    }),
  }]);

  assert.equal(plan.canApply, false);
  assert.ok(plan.issues.some((issue) => issue.code === "link.device-missing"));
  assert.throws(() => materializeImport(project, plan, "replace"), /blocking errors/);
});

test("missing group relationships warn and are removed before apply", () => {
  const plan = buildImportPlan([{
    name: "legacy.json",
    text: JSON.stringify({
      devices: [{ id: "router-1", name: "Router", type: "router", model: "R", ip: "1.1.1.1", location: "A", x: 0, y: 0, groupId: "missing" }],
      links: [],
      groups: [],
    }),
  }]);

  assert.equal(plan.canApply, true);
  assert.ok(plan.issues.some((issue) => issue.code === "json.legacy-project"));
  assert.ok(plan.issues.some((issue) => issue.code === "device.group-missing"));
  assert.equal(plan.project.devices[0].groupId, undefined);
});

test("merge remaps colliding IDs and preserves imported link and credential relationships", () => {
  const plan = buildImportPlan(Object.entries(projectToCsvFiles(project, {
    safe: false,
    maskedCredentials,
    missingInfo: [],
  })).map(([name, text]) => ({ name, text })));
  const merged = materializeImportBundle(project, plan, "merge");
  const importedRouter = merged.project.devices.find((device) => device.id.startsWith("router-1-import-"));
  const importedSwitch = merged.project.devices.find((device) => device.id.startsWith("switch-1-import-"));
  const importedLink = merged.project.links.find((link) => link.id.startsWith("link-1-import-"));

  assert.equal(merged.project.devices.length, 4);
  assert.equal(merged.project.groups.length, 2);
  assert.equal(merged.project.links.length, 2);
  assert.equal(importedLink?.from, importedRouter?.id);
  assert.equal(importedLink?.to, importedSwitch?.id);
  assert.equal(merged.maskedCredentials[0].projectDeviceId, importedRouter?.id);
});

test("blocking missing info can be removed by excluding incomplete records and recomputing", () => {
  const plan = buildImportPlan([{
    name: "doc.md",
    text: "| from | to | kind |\n|---|---|---|\n| missing-a | missing-b | wired |\n",
  }]);
  const blocking = plan.missingInfo.find((item) => item.severity === "blocking");

  assert.equal(plan.canApply, false);
  assert.ok(blocking);

  const next = applyImportPlanExclusions(plan, { missingInfoIds: [blocking.id] });

  assert.equal(next.summary.missingBlocking, 0);
});

test("CSV import rejects unknown filenames and mixed document or CSV selections", () => {
  const unknown = buildImportPlan([{ name: "topology.csv", text: "id,name\n1,test" }]);
  const mixed = buildImportPlan([
    { name: "backup.json", text: projectExportToJson(project) },
    { name: "devices.csv", text: projectToCsvFiles(project)["devices.csv"] },
  ]);

  assert.equal(unknown.canApply, false);
  assert.ok(unknown.issues.some((issue) => issue.code === "csv.filename"));
  assert.equal(mixed.canApply, false);
  assert.ok(mixed.issues.some((issue) => issue.code === "source.mixed"));
});
