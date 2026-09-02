import assert from "node:assert/strict";
import test from "node:test";

import {
  IMPORT_BATCH_LIMIT_BYTES,
  IMPORT_FILE_LIMIT_BYTES,
  buildImportPlan,
  buildImportPlanFromFileDescriptors,
  projectToCsvFiles,
} from "../app/lib/topology-transfer.ts";

const project = {
  devices: [
    { id: "router-1", name: "Router", type: "router", x: 100, y: 120 },
    { id: "switch-1", name: "Switch", type: "switch", x: 260, y: 120 },
  ],
  links: [{ id: "link-1", from: "router-1", to: "switch-1", kind: "wired" }],
  groups: [],
};

const v2Headers = {
  "devices.csv": "schemaVersion,sharing,id,name,type,ip,mac,model,location,url,quantity,x,y,groupId\n",
  "links.csv": "schemaVersion,sharing,id,from,to,kind,fromPort,toPort,vlan,speed\n",
  "groups.csv": "schemaVersion,sharing,id,name,kind,color,collapsed\n",
  "credentials.masked.csv": "schemaVersion,sharing,projectDeviceId,deviceName,kind,usernameMasked,secretMasked,keyVersion,lastRotatedAt\n",
  "missing-info.csv": "schemaVersion,sharing,id,severity,entityType,entityId,field,code,question,suggestion,sourceFile,sourceLine,status\n",
};

function sources(files) {
  return Object.entries(files).map(([name, text]) => ({ name, text, size: Buffer.byteLength(text) }));
}

function codes(plan) {
  return plan.issues.map((issue) => issue.code).join(",");
}

test("DEV_IMP_002 file gate enforces single-file limit before text parsing", () => {
  assert.equal(buildImportPlanFromFileDescriptors([{ name: "devices.csv", size: IMPORT_FILE_LIMIT_BYTES - 1 }]), undefined);
  assert.equal(buildImportPlanFromFileDescriptors([{ name: "devices.csv", size: IMPORT_FILE_LIMIT_BYTES }]), undefined);

  const blocked = buildImportPlanFromFileDescriptors([{ name: "devices.csv", size: IMPORT_FILE_LIMIT_BYTES + 1 }]);

  assert.equal(blocked?.canApply, false);
  assert.match(codes(blocked), /source\.size\.file/);
});

test("DEV_IMP_002 file gate enforces batch limit before text parsing", () => {
  const below = [
    { name: "devices.csv", size: IMPORT_FILE_LIMIT_BYTES },
    { name: "links.csv", size: IMPORT_FILE_LIMIT_BYTES },
    { name: "groups.csv", size: IMPORT_BATCH_LIMIT_BYTES - (2 * IMPORT_FILE_LIMIT_BYTES) - 1 },
  ];
  const atLimit = [
    { name: "devices.csv", size: IMPORT_FILE_LIMIT_BYTES },
    { name: "links.csv", size: IMPORT_FILE_LIMIT_BYTES },
    { name: "groups.csv", size: IMPORT_BATCH_LIMIT_BYTES - (2 * IMPORT_FILE_LIMIT_BYTES) },
  ];
  const over = [
    { name: "devices.csv", size: IMPORT_FILE_LIMIT_BYTES },
    { name: "links.csv", size: IMPORT_FILE_LIMIT_BYTES },
    { name: "groups.csv", size: IMPORT_BATCH_LIMIT_BYTES - (2 * IMPORT_FILE_LIMIT_BYTES) + 1 },
  ];

  assert.equal(buildImportPlanFromFileDescriptors(below), undefined);
  assert.equal(buildImportPlanFromFileDescriptors(atLimit), undefined);
  assert.match(codes(buildImportPlanFromFileDescriptors(over)), /source\.size\.batch/);
});

test("DEV_IMP_002 all-header-only v2 bundle is empty safe bundle with info issue", () => {
  const plan = buildImportPlan(sources(v2Headers));

  assert.equal(plan.canApply, true);
  assert.deepEqual(plan.project, { devices: [], links: [], groups: [] });
  assert.ok(plan.issues.some((issue) => issue.code === "EMPTY_V2_BUNDLE" && issue.severity === "info"));
});

test("DEV_IMP_002 v2 attempted by core envelope headers cannot fallback to v1", () => {
  const files = projectToCsvFiles(project, { safe: true, maskedCredentials: [], missingInfo: [] });
  delete files["credentials.masked.csv"];
  delete files["missing-info.csv"];

  const plan = buildImportPlan(sources(files));

  assert.equal(plan.canApply, false);
  assert.match(codes(plan), /csv\.v2\.missing/);
});

test("DEV_IMP_002 exact legacy v1 three-file bundle remains isolated", () => {
  const plan = buildImportPlan(sources({
    "devices.csv": "id,name,type,x,y\nrouter-1,Router,router,100,120\n",
    "links.csv": "id,from,to,kind\n",
    "groups.csv": "id,name,kind,color\n",
  }));

  assert.equal(plan.canApply, true);
  assert.equal(plan.sourceKind, "csv-bundle");
  assert.equal(plan.project.devices[0].id, "router-1");
});

test("DEV_IMP_002 canonical duplicate and path spoof filenames fail closed", () => {
  const duplicate = buildImportPlan([
    ...sources(projectToCsvFiles(project, { safe: true, maskedCredentials: [], missingInfo: [] })),
    { name: "DEVICES.CSV", text: v2Headers["devices.csv"], size: 1 },
  ]);
  const pathSpoof = buildImportPlan([{ name: "../devices.csv", text: v2Headers["devices.csv"], size: 1 }]);

  assert.equal(duplicate.canApply, false);
  assert.match(codes(duplicate), /csv\.filename\.duplicate/);
  assert.equal(pathSpoof.canApply, false);
  assert.match(codes(pathSpoof), /csv\.filename\.path-spoof/);
});

test("DEV_IMP_002 unknown member and mixed v1/v2 headers are blocking", () => {
  const unknown = buildImportPlan(sources({ ...v2Headers, "extra.csv": "id,name\nx,y\n" }));
  const mixed = buildImportPlan(sources({
    "devices.csv": v2Headers["devices.csv"],
    "links.csv": "id,from,to,kind\n",
    "groups.csv": "id,name,kind,color\n",
  }));

  assert.equal(unknown.canApply, false);
  assert.match(codes(unknown), /csv\.filename|csv\.bundle\.member-count/);
  assert.equal(mixed.canApply, false);
  assert.match(codes(mixed), /csv\.v2\.missing|csv\.header\.invalid/);
});

test("DEV_IMP_002 bundle-level schemaVersion and sharing must be consistent", () => {
  const versionMixed = projectToCsvFiles(project, { safe: true, maskedCredentials: [], missingInfo: [] });
  versionMixed["devices.csv"] = versionMixed["devices.csv"].replace("2,safe", "1,safe");
  const sharingMixed = projectToCsvFiles(project, { safe: true, maskedCredentials: [], missingInfo: [] });
  sharingMixed["devices.csv"] = sharingMixed["devices.csv"].replace("2,safe", "2,full");

  const versionPlan = buildImportPlan(sources(versionMixed));
  const sharingPlan = buildImportPlan(sources(sharingMixed));

  assert.equal(versionPlan.canApply, false);
  assert.match(codes(versionPlan), /csv\.bundle\.version/);
  assert.equal(sharingPlan.canApply, false);
  assert.match(codes(sharingPlan), /csv\.bundle\.sharing/);
});
