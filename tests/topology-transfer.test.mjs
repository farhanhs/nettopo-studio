import assert from "node:assert/strict";
import test from "node:test";

import {
  PROJECT_SCHEMA_VERSION,
  ProjectExportSchema,
  ProjectSchema,
  buildImportPlan,
  createProjectExport,
  materializeImport,
  projectExportToJson,
  projectToCsvFiles,
} from "../app/lib/topology-transfer.ts";

const project = {
  devices: [
    {
      id: "router-1",
      name: "Core Router",
      type: "router",
      ip: "192.168.1.1",
      url: "https://192.168.1.1",
      username: "admin",
      password: "secret",
      quantity: 5,
      x: 80,
      y: 100,
      groupId: "hq",
    },
    {
      id: "switch-1",
      name: "Core Switch",
      type: "switch",
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
    },
  ],
  groups: [{ id: "hq", name: "HQ", kind: "site", color: "#526cf5", collapsed: true }],
};

test("versioned JSON export round-trips through ImportPlan", () => {
  const json = projectExportToJson(project, {
    topologyName: "HQ topology",
    exportedAt: "2026-07-29T00:00:00.000Z",
  });
  const envelope = ProjectExportSchema.parse(JSON.parse(json));
  const plan = buildImportPlan([{ name: "backup.json", text: json }]);

  assert.equal(envelope.schemaVersion, PROJECT_SCHEMA_VERSION);
  assert.equal(envelope.sharing, "full");
  assert.equal(plan.canApply, true);
  assert.equal(plan.suggestedName, "HQ topology");
  assert.deepEqual(plan.project, ProjectSchema.parse(project));
  assert.equal(plan.project.devices[0].quantity, 5);
  assert.equal(plan.project.groups[0].collapsed, true);
  assert.deepEqual(plan.summary, { devices: 2, links: 1, groups: 1 });
});

test("safe exports remove management secrets from JSON and CSV", () => {
  const safe = createProjectExport(project, {
    safe: true,
    exportedAt: "2026-07-29T00:00:00.000Z",
  });
  const csv = projectToCsvFiles(project, { safe: true });

  assert.equal(safe.sharing, "safe");
  assert.equal(safe.project.devices[0].username, undefined);
  assert.equal(safe.project.devices[0].password, undefined);
  assert.equal(safe.project.devices[0].url, undefined);
  assert.equal(safe.project.devices[0].ip, undefined);
  assert.equal(safe.project.devices[0].mac, undefined);
  assert.equal(safe.project.devices[0].location, undefined);
  assert.doesNotMatch(JSON.stringify(safe), /secret|admin|https:\/\/192|192\.168/);
  assert.doesNotMatch(csv["devices.csv"], /secret|admin|https:\/\/192|192\.168/);
  assert.match(csv["devices.csv"], /quantity/);
  assert.match(csv["groups.csv"], /collapsed/);
});

test("three CSV files round-trip through the same project schema", () => {
  const csv = projectToCsvFiles(project);
  const plan = buildImportPlan(
    Object.entries(csv).map(([name, text]) => ({ name, text })),
  );

  assert.equal(plan.canApply, true);
  assert.deepEqual(plan.project, ProjectSchema.parse(project));
});

test("ImportPlan reports malformed schema and broken cross references without writing", () => {
  const plan = buildImportPlan([{
    name: "broken.json",
    text: JSON.stringify({
      schemaVersion: 1,
      kind: "nettopo-project",
      sharing: "full",
      exportedAt: "2026-07-29T00:00:00.000Z",
      project: {
        devices: [{ id: "router-1", name: "Router", type: "router", x: 0, y: 0 }],
        links: [{ id: "link-1", from: "router-1", to: "missing", kind: "wired" }],
        groups: [],
      },
    }),
  }]);

  assert.equal(plan.canApply, false);
  assert.ok(plan.issues.some((issue) => issue.code === "link.device-missing"));
  assert.throws(() => materializeImport(project, plan, "replace"), /含有錯誤/);
});

test("ImportPlan warns and removes missing group relationships", () => {
  const plan = buildImportPlan([{
    name: "legacy.json",
    text: JSON.stringify({
      devices: [{ id: "router-1", name: "Router", type: "router", x: 0, y: 0, groupId: "missing" }],
      links: [],
      groups: [],
    }),
  }]);

  assert.equal(plan.canApply, true);
  assert.ok(plan.issues.some((issue) => issue.code === "json.legacy-project"));
  assert.ok(plan.issues.some((issue) => issue.code === "device.group-missing"));
  assert.equal(plan.project.devices[0].groupId, undefined);
});

test("merge remaps colliding IDs and preserves imported link relationships", () => {
  const plan = buildImportPlan([{
    name: "incoming.json",
    text: projectExportToJson(project, { exportedAt: "2026-07-29T00:00:00.000Z" }),
  }]);
  const merged = materializeImport(project, plan, "merge");
  const importedRouter = merged.devices.find((device) => device.id.startsWith("router-1-import-"));
  const importedSwitch = merged.devices.find((device) => device.id.startsWith("switch-1-import-"));
  const importedLink = merged.links.find((link) => link.id.startsWith("link-1-import-"));

  assert.equal(merged.devices.length, 4);
  assert.equal(merged.groups.length, 2);
  assert.equal(merged.links.length, 2);
  assert.equal(importedLink?.from, importedRouter?.id);
  assert.equal(importedLink?.to, importedSwitch?.id);
  assert.ok(importedRouter?.groupId?.startsWith("hq-import-"));
});

test("CSV import rejects unknown filenames and mixed JSON/CSV selections", () => {
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
