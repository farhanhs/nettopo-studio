import assert from "node:assert/strict";
import test from "node:test";

import {
  MASKED_SECRET,
} from "../app/lib/credential-masking.ts";
import {
  buildImportPlan,
  materializeImportBundle,
  projectExportToJson,
  projectToCsvBundleZip,
  projectToCsvFiles,
} from "../app/lib/topology-transfer.ts";

const RAW_SECRET_SENTINELS = [
  "raw-username-sentinel",
  "raw-password-sentinel",
  "raw-secret-sentinel",
  "ciphertext-sentinel",
  "nonce-sentinel",
  "cookie-sentinel",
  "token-sentinel",
  "postgres://secret-dsn",
];

const projectWithSecretLikeFields = {
  devices: [{
    id: "router-1",
    name: "Router",
    type: "router",
    ip: "10.0.0.1",
    x: 100,
    y: 100,
    username: RAW_SECRET_SENTINELS[0],
    password: RAW_SECRET_SENTINELS[1],
    secret: RAW_SECRET_SENTINELS[2],
    ciphertext: RAW_SECRET_SENTINELS[3],
    nonce: RAW_SECRET_SENTINELS[4],
    cookie: RAW_SECRET_SENTINELS[5],
    token: RAW_SECRET_SENTINELS[6],
    databaseUrl: RAW_SECRET_SENTINELS[7],
  }],
  links: [],
  groups: [],
};

function assertNoRawSecrets(text, label) {
  for (const sentinel of RAW_SECRET_SENTINELS) {
    assert.doesNotMatch(text, new RegExp(sentinel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${label} leaked ${sentinel}`);
  }
}

test("DEV_SEC_002 JSON and CSV exports strip raw credential-like device fields", async () => {
  const json = projectExportToJson(projectWithSecretLikeFields, { safe: false });
  const csv = projectToCsvFiles(projectWithSecretLikeFields, { safe: false, maskedCredentials: [], missingInfo: [] });
  const zip = await projectToCsvBundleZip(projectWithSecretLikeFields, { safe: false, maskedCredentials: [], missingInfo: [] });
  const { unzipSync, strFromU8 } = await import("fflate");
  const zipText = Object.values(unzipSync(zip)).map((bytes) => strFromU8(bytes)).join("\n");

  assertNoRawSecrets(json, "json");
  assertNoRawSecrets(Object.values(csv).join("\n"), "csv");
  assertNoRawSecrets(zipText, "zip");
});

test("DEV_SEC_002 masked credentials remain preview/export rows and never enter materialized Project", () => {
  const files = projectToCsvFiles({
    devices: [{ id: "router-1", name: "Router", type: "router", x: 100, y: 100 }],
    links: [],
    groups: [],
  }, {
    safe: false,
    maskedCredentials: [{
      projectDeviceId: "router-1",
      deviceName: "Router",
      kind: "device_admin",
      usernameMasked: "a***n",
      secretMasked: MASKED_SECRET,
    }],
    missingInfo: [],
  });
  const plan = buildImportPlan(Object.entries(files).map(([name, text]) => ({ name, text, size: Buffer.byteLength(text) })));
  const materialized = materializeImportBundle({ devices: [], links: [], groups: [] }, plan, "replace");

  assert.equal(plan.canApply, true);
  assert.equal(plan.maskedCredentials.length, 1);
  assert.equal(JSON.stringify(materialized.project).includes("usernameMasked"), false);
  assert.equal(JSON.stringify(materialized.project).includes(MASKED_SECRET), false);
});

test("DEV_SEC_002 Apply performs defense-in-depth strip even for a forged canApply plan", () => {
  const forgedPlan = {
    sourceKind: "json",
    sourceNames: ["forged.json"],
    suggestedName: "forged",
    project: projectWithSecretLikeFields,
    maskedCredentials: [],
    missingInfo: [],
    issues: [],
    summary: {
      devices: 1,
      links: 0,
      groups: 0,
      maskedCredentials: 0,
      missingBlocking: 0,
      missingWarnings: 0,
    },
    canApply: true,
  };

  const materialized = materializeImportBundle({ devices: [], links: [], groups: [] }, forgedPlan, "replace");

  assertNoRawSecrets(JSON.stringify(materialized.project), "materialized project");
  assert.deepEqual(Object.keys(materialized.project.devices[0]).sort(), ["id", "ip", "name", "type", "x", "y"].sort());
});

test("DEV_SEC_002 legacy username/password import only creates masked preview", () => {
  const plan = buildImportPlan([
    {
      name: "devices.csv",
      text: [
        "id,name,type,username,password,x,y",
        "router-1,Router,router,raw-username-sentinel,raw-password-sentinel,100,100",
      ].join("\r\n"),
    },
    { name: "links.csv", text: "id,from,to,kind\n" },
    { name: "groups.csv", text: "id,name,kind,color\n" },
  ]);

  assert.equal(plan.canApply, true);
  assert.equal(plan.maskedCredentials[0].secretMasked, MASKED_SECRET);
  assertNoRawSecrets(JSON.stringify(plan.project), "legacy project");
});
