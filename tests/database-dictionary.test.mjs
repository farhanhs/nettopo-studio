import assert from "node:assert/strict";
import test from "node:test";

import {
  DATABASE_DICTIONARY,
  DatabaseValidationError,
  MachineCodeSchema,
  SiteRecordSchema,
  TopologyDeviceRecordSchema,
  TopologyLinkRecordSchema,
  UserDatabaseRecordSchema,
  parseDatabaseRecord,
  validateDatabaseRecord,
} from "../db/data-dictionary.ts";
import { generateVirtualDatabase, validateVirtualDatabase } from "../db/virtual-test-data.ts";

test("virtual database follows the formal dictionary and relationships", () => {
  const database = generateVirtualDatabase(7);
  assert.deepEqual(generateVirtualDatabase(7), database);
  assert.notDeepEqual(generateVirtualDatabase(8), database);
  assert.deepEqual(validateVirtualDatabase(database), { valid: true, issues: [] });
});

test("Unicode display names are accepted but machine fields require half-width ASCII", () => {
  assert.equal(SiteRecordSchema.safeParse({ id: "site-01", name: "台北機房Ａ區" }).success, true);
  assert.equal(MachineCodeSchema.safeParse("ａｄｍｉｎ").success, false);
  const result = validateDatabaseRecord("users", UserDatabaseRecordSchema, {
    id: "user-01",
    email: "ｓｅａｎ@example.com",
    name: "謝慶宣",
    role: "engineer",
    siteIds: [],
  });
  assert.equal(result.success, false);
  assert.equal(result.issues[0].field, "email");
  assert.match(result.issues[0].message, /half-width ASCII/);
});

test("string length and data type failures return field-level debug details", () => {
  const tooLong = validateDatabaseRecord("sites", SiteRecordSchema, { id: "site-01", name: "網".repeat(121) });
  assert.equal(tooLong.success, false);
  assert.equal(tooLong.issues[0].field, "name");

  const wrongType = validateDatabaseRecord("devices", TopologyDeviceRecordSchema, {
    id: "device-01",
    topologyId: "topology-01",
    deviceType: "router",
    name: "路由器",
    positionX: "100",
    positionY: 200,
  });
  assert.equal(wrongType.success, false);
  assert.equal(wrongType.issues[0].field, "positionX");
  assert.equal(wrongType.issues[0].received, "string");
});

test("network formats and self-links are rejected", () => {
  const device = {
    id: "device-01", topologyId: "topology-01", deviceType: "router",
    name: "Router", ip: "999.1.1.1", mac: "not-a-mac", managementUrl: "invalid",
    positionX: 0, positionY: 0,
  };
  const invalidDevice = validateDatabaseRecord("devices", TopologyDeviceRecordSchema, device);
  assert.deepEqual(new Set(invalidDevice.issues.map((issue) => issue.field)), new Set(["ip", "mac", "managementUrl"]));

  const invalidLink = validateDatabaseRecord("links", TopologyLinkRecordSchema, {
    id: "link-01", topologyId: "topology-01", fromDeviceId: "device-01",
    toDeviceId: "device-01", kind: "wired",
  });
  assert.equal(invalidLink.success, false);
  assert.equal(invalidLink.issues[0].field, "toDeviceId");
});

test("foreign-key validation detects corrupted virtual records", () => {
  const database = generateVirtualDatabase();
  database.topologyLinks[0].toDeviceId = "missing-device";
  const result = validateVirtualDatabase(database);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "foreign_key"));
});

test("strict parser throws a structured validation error", () => {
  assert.throws(
    () => parseDatabaseRecord("sites", SiteRecordSchema, { id: "站點-01", name: "測試" }),
    (error) => error instanceof DatabaseValidationError && error.table === "sites" && error.issues[0].field === "id",
  );
  assert.equal(DATABASE_DICTIONARY.users.email.maxLength, 254);
  assert.equal(DATABASE_DICTIONARY.topology_devices.positionX.dataType, "integer");
  assert.equal(DATABASE_DICTIONARY.topology_devices.quantity.dataType, "integer");
});

test("extended device types and quantity records are accepted", () => {
  for (const deviceType of ["ssid", "mesh-node", "printer", "camera", "pos", "iot"]) {
    const result = TopologyDeviceRecordSchema.safeParse({
      id: `device-${deviceType}`,
      topologyId: "topology-01",
      deviceType,
      name: deviceType,
      quantity: 5,
      positionX: 0,
      positionY: 0,
    });
    assert.equal(result.success, true, deviceType);
  }
});
