import assert from "node:assert/strict";
import test from "node:test";

import {
  CSV_BUNDLE_SCHEMA_VERSION,
  canonicalProjectForTransfer,
  buildImportPlan,
  projectToCsvBundleZip,
  projectToCsvFiles,
} from "../app/lib/topology-transfer.ts";

const project = {
  devices: [
    {
      id: "router-1",
      name: "Router",
      type: "router",
      ip: "10.0.0.1",
      mac: "00:11:22:33:44:55",
      model: "RTX",
      location: "Rack A",
      url: "https://router.local",
      quantity: 2,
      x: 100,
      y: 100,
      groupId: "site-a",
    },
    { id: "switch-1", name: "Switch", type: "switch", x: 320, y: 100, groupId: "site-a" },
  ],
  links: [{ id: "link-1", from: "router-1", to: "switch-1", kind: "wired", speed: "10G" }],
  groups: [{ id: "site-a", name: "Site A", kind: "site", color: "#526cf5", collapsed: false }],
};

function sources(files) {
  return Object.entries(files).map(([name, text]) => ({ name, text, size: Buffer.byteLength(text) }));
}

test("DEV_EXP_002 CSV export always produces canonical five members with v2 headers", () => {
  const files = projectToCsvFiles(project, { safe: true, maskedCredentials: [], missingInfo: [] });

  assert.deepEqual(Object.keys(files), [
    "devices.csv",
    "links.csv",
    "groups.csv",
    "credentials.masked.csv",
    "missing-info.csv",
  ]);
  for (const text of Object.values(files)) {
    assert.match(text, /^\uFEFF?schemaVersion,sharing/);
  }
  assert.match(files["credentials.masked.csv"], /schemaVersion,sharing,projectDeviceId/);
  assert.match(files["missing-info.csv"], /schemaVersion,sharing,id,severity/);
});

test("DEV_EXP_002 ZIP export contains exactly the same canonical five members", async () => {
  const { unzipSync, strFromU8 } = await import("fflate");
  const zip = await projectToCsvBundleZip(project, { safe: true, maskedCredentials: [], missingInfo: [] });
  const unzipped = unzipSync(zip);
  const names = Object.keys(unzipped).sort();

  assert.deepEqual(names, [
    "credentials.masked.csv",
    "devices.csv",
    "groups.csv",
    "links.csv",
    "missing-info.csv",
  ]);
  for (const bytes of Object.values(unzipped)) {
    assert.match(strFromU8(bytes), /^\uFEFF?schemaVersion,sharing/);
  }
});

test("DEV_EXP_002 full round-trip equals canonical project", () => {
  const files = projectToCsvFiles(project, { safe: false, maskedCredentials: [], missingInfo: [] });
  const plan = buildImportPlan(sources(files));

  assert.equal(plan.canApply, true);
  assert.deepEqual(plan.project, canonicalProjectForTransfer(project));
});

test("DEV_EXP_002 safe round-trip equals safe canonical project", () => {
  const files = projectToCsvFiles(project, { safe: true, maskedCredentials: [], missingInfo: [] });
  const plan = buildImportPlan(sources(files));

  assert.equal(plan.canApply, true);
  assert.deepEqual(plan.project, canonicalProjectForTransfer(project, { safe: true }));
  assert.equal(plan.project.devices[0].ip, undefined);
  assert.equal(plan.project.devices[0].mac, undefined);
  assert.equal(plan.project.devices[0].location, undefined);
  assert.equal(plan.project.devices[0].url, undefined);
});

test("DEV_EXP_002 exported rows keep schemaVersion and sharing consistent", () => {
  const safeFiles = projectToCsvFiles(project, { safe: true, maskedCredentials: [], missingInfo: [] });
  const fullFiles = projectToCsvFiles(project, { safe: false, maskedCredentials: [], missingInfo: [] });

  assert.doesNotMatch(Object.values(safeFiles).join("\n"), /,full,/);
  assert.doesNotMatch(Object.values(fullFiles).join("\n"), /,safe,/);
  assert.match(Object.values(fullFiles).join("\n"), new RegExp(`${CSV_BUNDLE_SCHEMA_VERSION},full`));
});

test("DEV_EXP_002 CSV formula neutralization covers ASCII, line-break, and fullwidth triggers", () => {
  const files = projectToCsvFiles({
    devices: [
      { id: "eq", name: "=FORMULA", type: "router", x: 0, y: 0 },
      { id: "plus", name: "+FORMULA", type: "router", x: 0, y: 0 },
      { id: "minus", name: "-FORMULA", type: "router", x: 0, y: 0 },
      { id: "at", name: "@FORMULA", type: "router", x: 0, y: 0 },
      { id: "tab", name: "\tFORMULA", type: "router", x: 0, y: 0 },
      { id: "lf", name: "\nFORMULA", type: "router", x: 0, y: 0 },
      { id: "fw-eq", name: "＝FORMULA", type: "router", x: 0, y: 0 },
      { id: "fw-plus", name: "＋FORMULA", type: "router", x: 0, y: 0 },
      { id: "fw-minus", name: "－FORMULA", type: "router", x: 0, y: 0 },
      { id: "fw-at", name: "＠FORMULA", type: "router", x: 0, y: 0 },
    ],
    links: [],
    groups: [],
  }, { safe: false, maskedCredentials: [], missingInfo: [] });

  assert.match(files["devices.csv"], /'=FORMULA/);
  assert.match(files["devices.csv"], /'\+FORMULA/);
  assert.match(files["devices.csv"], /'-FORMULA/);
  assert.match(files["devices.csv"], /'@FORMULA/);
  assert.doesNotMatch(files["devices.csv"], /,\tFORMULA/);
  assert.doesNotMatch(files["devices.csv"], /,\nFORMULA/);
  assert.match(files["devices.csv"], /'＝FORMULA/);
  assert.match(files["devices.csv"], /'＋FORMULA/);
  assert.match(files["devices.csv"], /'－FORMULA/);
  assert.match(files["devices.csv"], /'＠FORMULA/);
});
