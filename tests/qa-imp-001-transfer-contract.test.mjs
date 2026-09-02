import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CSV_BUNDLE_SCHEMA_VERSION,
  buildImportPlan,
  projectToCsvFiles,
} from "../app/lib/topology-transfer.ts";

const qaProject = {
  devices: [
    {
      id: "qa-router-1",
      name: "QA Router",
      type: "router",
      ip: "10.25.0.1",
      mac: "00:25:00:00:00:01",
      model: "QA-R1000",
      location: "QA Rack A",
      url: "https://qa-router.local",
      x: 100,
      y: 100,
      groupId: "qa-group-1",
    },
    {
      id: "qa-switch-1",
      name: "QA Switch",
      type: "switch",
      ip: "10.25.0.2",
      mac: "00:25:00:00:00:02",
      model: "QA-S4800",
      location: "QA Rack A",
      url: "https://qa-switch.local",
      x: 340,
      y: 100,
      groupId: "qa-group-1",
    },
  ],
  links: [
    {
      id: "qa-link-1",
      from: "qa-router-1",
      to: "qa-switch-1",
      kind: "wired",
      fromPort: "ge-0/0/1",
      toPort: "ge-0/0/48",
      vlan: "trunk",
      speed: "10G",
    },
  ],
  groups: [
    {
      id: "qa-group-1",
      name: "QA Group",
      kind: "site",
      color: "#526cf5",
      collapsed: false,
    },
  ],
};

function csvSources(files) {
  return Object.entries(files).map(([name, text]) => ({ name, text }));
}

function issueCodes(plan) {
  return plan.issues.map((issue) => issue.code);
}

function replaceFirstDataCell(csv, columnName, nextValue) {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/);
  const headers = lines[0].split(",");
  const target = headers.indexOf(columnName);
  assert.notEqual(target, -1, `missing CSV header ${columnName}`);
  const cells = lines[1].split(",");
  cells[target] = nextValue;
  lines[1] = cells.join(",");
  return `\uFEFF${lines.join("\r\n")}`;
}

test("QA_IMP_001 IMP-A: CSV bundle v2 import requires all five canonical members", () => {
  const files = projectToCsvFiles(qaProject, { safe: true, maskedCredentials: [], missingInfo: [] });
  delete files["credentials.masked.csv"];

  const plan = buildImportPlan(csvSources(files));

  assert.equal(plan.canApply, false, `v2 bundle missing credentials.masked.csv was accepted; issues=${issueCodes(plan).join(",")}`);
  assert.match(issueCodes(plan).join(","), /csv\.bundle\.missing|csv\.filename|csv\.v2\.missing/);
});

test("QA_IMP_001 IMP-A: duplicate CSV bundle filenames are rejected before last-wins parsing", () => {
  const files = projectToCsvFiles(qaProject, { safe: true, maskedCredentials: [], missingInfo: [] });
  const duplicateDevices = replaceFirstDataCell(files["devices.csv"], "name", "Silently Replaced Device");
  const plan = buildImportPlan([
    ...csvSources(files),
    { name: "devices.csv", text: duplicateDevices },
  ]);

  assert.equal(plan.canApply, false, `duplicate devices.csv was accepted; issues=${issueCodes(plan).join(",")}`);
  assert.match(issueCodes(plan).join(","), /csv\.filename\.duplicate|csv\.bundle\.duplicate|source\.duplicate/);
});

test("QA_IMP_001 IMP-A: v2 bundle sharing mode must be consistent across all five files", () => {
  const files = projectToCsvFiles(qaProject, { safe: true, maskedCredentials: [], missingInfo: [] });
  files["links.csv"] = files["links.csv"].replaceAll(",safe,", ",full,");

  const plan = buildImportPlan(csvSources(files));

  assert.equal(plan.canApply, false, `mixed safe/full CSV bundle was accepted; issues=${issueCodes(plan).join(",")}`);
  assert.match(issueCodes(plan).join(","), /csv\.sharing|sharing\.mismatch|csv\.bundle\.sharing/);
});

test("QA_IMP_001 IMP-A: import entry has an explicit size gate before parsing oversized files", () => {
  const transferSource = readFileSync(new URL("../app/lib/topology-transfer.ts", import.meta.url), "utf8");
  const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const sizeGateEvidence = [
    /10\s*\*\s*1024\s*\*\s*1024/,
    /10_485_760/,
    /25\s*\*\s*1024\s*\*\s*1024/,
    /26_214_400/,
    /source\.size/i,
    /import\.limit/i,
    /ImportSource\s*=\s*\{[^}]*size/i,
    /FileList[\s\S]{0,600}\.size/,
  ];

  assert.ok(
    sizeGateEvidence.some((pattern) => pattern.test(transferSource) || pattern.test(pageSource)),
    "no explicit import size gate found for D22 10MiB single-file / 25MiB batch limits; the 10MiB runtime probe was interrupted after exceeding 60 seconds",
  );
});

test("QA_IMP_001 IMP-A: duplicate device IDs are blocking errors", () => {
  const files = projectToCsvFiles(qaProject, { safe: true, maskedCredentials: [], missingInfo: [] });
  files["devices.csv"] = files["devices.csv"].replace("qa-switch-1", "qa-router-1");

  const plan = buildImportPlan(csvSources(files));

  assert.equal(plan.canApply, false);
  assert.match(issueCodes(plan).join(","), /id\.duplicate/);
});

test("QA_IMP_001 IMP-A: ZIP import is rejected as unsupported input", () => {
  const plan = buildImportPlan([{ name: "topology-csv-bundle.zip", text: "PK\u0003\u0004fake-zip" }]);

  assert.equal(plan.canApply, false);
  assert.match(issueCodes(plan).join(","), /source\.unsupported/);
});

test("QA_IMP_001 EXP-A: CSV export formula injection is neutralized in all string columns", () => {
  const files = projectToCsvFiles({
    ...qaProject,
    devices: [{
      ...qaProject.devices[0],
      id: "qa-formula-1",
      name: "=cmd|'/C calc'!A0",
      model: "+FORMULA",
      location: "-FORMULA",
      url: "@FORMULA",
    }],
    links: [],
    groups: [{ ...qaProject.groups[0], name: "\tFORMULA" }],
  }, {
    safe: false,
    maskedCredentials: [],
    missingInfo: [],
  });

  const joined = Object.values(files).join("\n");
  assert.match(joined, /'=cmd/);
  assert.match(joined, /'\+FORMULA/);
  assert.match(joined, /'-FORMULA/);
  assert.match(joined, /'@FORMULA/);
  assert.match(files["devices.csv"], new RegExp(`schemaVersion,sharing,id,name,type`));
  assert.match(files["devices.csv"], new RegExp(String(CSV_BUNDLE_SCHEMA_VERSION)));
});
