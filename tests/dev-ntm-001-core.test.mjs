import assert from "node:assert/strict";
import test from "node:test";

import {
  cloneProjectV2,
  downcastProjectV2,
  TrustedNetworkModelError,
  upcastProject,
  validateProjectV2,
} from "../app/lib/trusted-network-model.ts";
import * as trustedNetworkCore from "../app/lib/trusted-network-model.ts";

function legacyProject() {
  return {
    devices: [
      { id: "d-a", name: "Core Switch", type: "switch", quantity: 2, x: 10, y: 20 },
      { id: "d-b", name: "Firewall", type: "firewall", x: 300, y: 20 },
    ],
    links: [
      { id: "l-1", from: "d-a", to: "d-b", kind: "wired", fromPort: "Gi1/0/1", toPort: "LAN 1", vlan: "20", speed: "1 Gbps" },
      { id: "l-2", from: "d-a", to: "d-b", kind: "wired" },
    ],
    groups: [{ id: "g-1", name: "HQ", kind: "site", color: "#AABBCC", collapsed: true }],
  };
}

function issueCodes(error) {
  assert.ok(error instanceof TrustedNetworkModelError);
  return error.issues.map((entry) => entry.code);
}

function expectIssue(code, action) {
  assert.throws(action, (error) => {
    assert.ok(issueCodes(error).includes(code), `expected ${code}, got ${issueCodes(error).join(", ")}`);
    assert.equal(error.message, "Trusted network model validation failed.");
    return true;
  });
}

test("CORE-R1 legacy upcast preserves legacy data and creates only explicit unverified endpoints", () => {
  const legacy = legacyProject();
  const project = upcastProject(legacy);

  assert.equal(project.projectSchemaVersion, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(project.devices.map((device) => ({
    id: device.id,
    name: device.name,
    type: device.type,
    quantity: device.quantity,
    x: device.x,
    y: device.y,
  })))), [
    { ...legacy.devices[0] },
    { ...legacy.devices[1] },
  ]);
  assert.deepEqual(project.groups, legacy.groups);
  assert.equal(project.links[0].fromPort, "Gi1/0/1");
  assert.equal(project.links[0].toPort, "LAN 1");
  assert.ok(project.links[0].fromInterfaceId?.startsWith("if-legacy-v1-"));
  assert.ok(project.links[0].toInterfaceId?.startsWith("if-legacy-v1-"));
  assert.equal(project.links[1].fromInterfaceId, undefined);
  assert.equal(project.links[1].toInterfaceId, undefined);
  assert.equal(project.trustedNetwork.interfaces.length, 2);
  assert.ok(project.trustedNetwork.fieldTrust.every((record) => record.verification === "unverified"));
  assert.ok(project.trustedNetwork.fieldTrust.every((record) => !record.verifiedByUserId && !record.verifiedAt));
});

test("CORE-R1 legacy endpoint IDs are deterministic and quantity never creates devices or interfaces", () => {
  const first = upcastProject(legacyProject());
  const second = upcastProject(legacyProject());

  assert.deepEqual(first, second);
  assert.equal(first.devices.length, 2);
  assert.equal(first.devices[0].quantity, 2);
  assert.equal(first.trustedNetwork.interfaces.length, 2);
});

test("CORE-R1 legacy round trip is lossless for the permitted provisional endpoint shape", () => {
  const legacy = legacyProject();
  const downcast = downcastProjectV2(upcastProject(legacy));

  assert.deepEqual(downcast, legacy);
});

test("CORE-R1 clone is deep and does not share nested trusted-network references", () => {
  const original = upcastProject(legacyProject());
  const copy = cloneProjectV2(original);

  copy.trustedNetwork.interfaces[0].aliases.push("uplink");
  copy.trustedNetwork.fieldTrust[0].evidenceIds.push("ev-extra");
  assert.deepEqual(original.trustedNetwork.interfaces[0].aliases, []);
  assert.equal(original.trustedNetwork.fieldTrust[0].evidenceIds.length, 1);
});

test("CORE-R1 rejects unknown project versions and unknown keys without echoing input", () => {
  expectIssue("INVALID_PROJECT_VERSION", () => upcastProject({ projectSchemaVersion: 99, password: "sentinel-password" }));
  const project = upcastProject(legacyProject());
  project.trustedNetwork.rawSource = "sentinel-secret";
  assert.throws(() => validateProjectV2(project), (error) => {
    assert.ok(issueCodes(error).includes("INVALID_PROJECT_SCHEMA"));
    assert.doesNotMatch(JSON.stringify(error), /sentinel|password|secret/i);
    return true;
  });
});

test("CORE-R1 validates interface owner, parent cycle, alias collision and link endpoint owner", () => {
  const missingOwner = upcastProject(legacyProject());
  missingOwner.trustedNetwork.interfaces[0].deviceId = "missing-device";
  expectIssue("MISSING_REFERENCE", () => validateProjectV2(missingOwner));

  const parentCycle = upcastProject(legacyProject());
  const [first, second] = parentCycle.trustedNetwork.interfaces;
  second.deviceId = first.deviceId;
  first.parentInterfaceId = second.id;
  second.parentInterfaceId = first.id;
  expectIssue("RELATION_CYCLE", () => validateProjectV2(parentCycle));

  const aliasCollision = upcastProject(legacyProject());
  aliasCollision.trustedNetwork.interfaces[0].aliases = [aliasCollision.trustedNetwork.interfaces[0].name.toLowerCase()];
  expectIssue("ALIAS_COLLISION", () => validateProjectV2(aliasCollision));

  const wrongEndpoint = upcastProject(legacyProject());
  wrongEndpoint.links[0].fromInterfaceId = wrongEndpoint.links[0].toInterfaceId;
  expectIssue("INVALID_REFERENCE_OWNER", () => validateProjectV2(wrongEndpoint));
});

test("CORE-R1 validates area cycles and area references", () => {
  const project = upcastProject(legacyProject());
  project.trustedNetwork.areas = [
    { id: "area-a", kind: "region", name: "A", parentAreaId: "area-b" },
    { id: "area-b", kind: "region", name: "B", parentAreaId: "area-a" },
  ];
  project.devices[0].networkAreaId = "area-missing";

  assert.throws(() => validateProjectV2(project), (error) => {
    const codes = issueCodes(error);
    assert.ok(codes.includes("RELATION_CYCLE"));
    assert.ok(codes.includes("MISSING_REFERENCE"));
    return true;
  });
});

test("CORE-R1 validates VLAN, canonical CIDR, IP relation and resiliency references", () => {
  const project = upcastProject(legacyProject());
  const interfaceId = project.trustedNetwork.interfaces[0].id;
  project.trustedNetwork.vlans = [{ id: "vlan-20", vlanNumber: 20 }];
  project.trustedNetwork.subnets = [{ id: "subnet-20", cidr: "192.168.020.0/24", vlanId: "vlan-20" }];
  project.trustedNetwork.interfaceVlans = [{ id: "ivr-1", interfaceId, vlanId: "vlan-20", mode: "access" }];
  project.trustedNetwork.interfaceSubnets = [{ id: "isr-1", interfaceId, subnetId: "subnet-20", address: "999.1.1.1" }];
  project.trustedNetwork.resiliencyRelations = [{ id: "rr-1", kind: "active-active", memberLinkIds: ["l-1", "l-2"], primaryLinkId: "l-1" }];

  assert.throws(() => validateProjectV2(project), (error) => {
    const codes = issueCodes(error);
    assert.ok(codes.includes("INVALID_CIDR"));
    assert.ok(codes.includes("INVALID_IP_ADDRESS"));
    assert.ok(codes.includes("INVALID_RESILIENCY"));
    return true;
  });
});

test("CORE-R1 accepts structurally verified data but exposes no verification/apply authority", () => {
  const project = upcastProject(legacyProject());
  const trust = project.trustedNetwork.fieldTrust[0];
  trust.verification = "verified";
  trust.verifiedByUserId = "server-derived-user";
  trust.verifiedAt = "2026-10-09T08:00:00+08:00";

  const validated = validateProjectV2(project);
  assert.equal(validated.trustedNetwork.fieldTrust[0].verification, "verified");
  assert.equal(typeof validated.trustedNetwork.fieldTrust[0].verifiedByUserId, "string");
  assert.equal("verifyProject" in trustedNetworkCore, false);
  assert.equal("applyTrustedTopologyChange" in trustedNetworkCore, false);
});

test("CORE-R1 rejects incomplete or forged trust records", () => {
  const missingActor = upcastProject(legacyProject());
  missingActor.trustedNetwork.fieldTrust[0].verification = "verified";
  expectIssue("INVALID_TRUST_RECORD", () => validateProjectV2(missingActor));

  const forgedUnverified = upcastProject(legacyProject());
  forgedUnverified.trustedNetwork.fieldTrust[0].verifiedByUserId = "imported-user";
  expectIssue("INVALID_TRUST_RECORD", () => validateProjectV2(forgedUnverified));
});

test("CORE-R1 rejects unsafe evidence paths, sensitive values and raw-source keys", () => {
  const unsafePath = upcastProject(legacyProject());
  unsafePath.trustedNetwork.evidence[0].locator = { file: "folder/raw-config.txt", line: 1 };
  expectIssue("UNSAFE_EVIDENCE", () => validateProjectV2(unsafePath));

  const unsafeValue = upcastProject(legacyProject());
  unsafeValue.trustedNetwork.evidence[0].safeSummary = "password=sentinel";
  expectIssue("UNSAFE_EVIDENCE", () => validateProjectV2(unsafeValue));

  const rawKey = upcastProject(legacyProject());
  rawKey.trustedNetwork.evidence[0].rawSource = "interface config";
  expectIssue("INVALID_PROJECT_SCHEMA", () => validateProjectV2(rawKey));
});

test("CORE-R1 refuses lossful downcast for independent trusted data", () => {
  const project = upcastProject(legacyProject());
  project.trustedNetwork.vlans.push({ id: "vlan-30", vlanNumber: 30, name: "Users" });
  expectIssue("DOWNCAST_WOULD_LOSE_DATA", () => downcastProjectV2(project));

  const independentInterface = upcastProject(legacyProject());
  independentInterface.trustedNetwork.interfaces.push({
    id: "if-independent",
    deviceId: "d-a",
    name: "Gi1/0/24",
    kind: "physical",
    aliases: [],
  });
  expectIssue("DOWNCAST_WOULD_LOSE_DATA", () => downcastProjectV2(independentInterface));

  const changedLegacyEvidence = upcastProject(legacyProject());
  changedLegacyEvidence.trustedNetwork.interfaces[0].aliases.push("uplink");
  expectIssue("DOWNCAST_WOULD_LOSE_DATA", () => downcastProjectV2(changedLegacyEvidence));
});

function freezeDeep(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseObjectKeys(child)]));
}

test("CORE-R2 raw legacy strings survive upcast, clone, validation and lossless downcast", () => {
  const legacy = legacyProject();
  legacy.devices[0].name = " Core Switch ";
  legacy.devices[0].model = " Model-A ";
  legacy.devices[0].location = " Rack A ";
  legacy.links[0].fromPort = " Gi0/1 ";
  legacy.links[0].toPort = " LAN 1 ";
  legacy.links[0].vlan = " 20, 30 ";
  legacy.links[0].speed = " 1 Gbps ";
  legacy.groups[0].name = " HQ ";
  const before = structuredClone(legacy);
  freezeDeep(legacy);

  const project = upcastProject(legacy);
  assert.deepEqual(project.devices, legacy.devices);
  assert.deepEqual(project.groups, legacy.groups);
  for (const key of Object.keys(legacy.links[0])) assert.deepEqual(project.links[0][key], legacy.links[0][key]);
  assert.equal(project.trustedNetwork.interfaces[0].name, " Gi0/1 ");
  assert.equal(project.trustedNetwork.interfaces[1].name, " LAN 1 ");
  assert.deepEqual(upcastProject(project), project);
  assert.deepEqual(validateProjectV2(project), project);
  const copy = cloneProjectV2(freezeDeep(project));
  assert.deepEqual(copy, project);
  assert.deepEqual(downcastProjectV2(copy), legacy);
  assert.deepEqual(legacy, before);
});

test("CORE-R2 blank legacy ports stay intact without inventing interfaces", () => {
  const legacy = legacyProject();
  legacy.links[0].fromPort = "   ";
  legacy.links[0].toPort = "";
  const project = upcastProject(legacy);
  assert.equal(project.links[0].fromPort, "   ");
  assert.equal(project.links[0].toPort, "");
  assert.equal(project.links[0].fromInterfaceId, undefined);
  assert.equal(project.links[0].toInterfaceId, undefined);
  assert.deepEqual(project.trustedNetwork.interfaces, []);
  assert.deepEqual(downcastProjectV2(project), legacy);
});

test("CORE-R2 normalized label matching preserves raw Unicode, case and aliases", () => {
  const legacy = legacyProject();
  legacy.links[0].fromPort = " Gi\u0065\u0301/1 ";
  legacy.links[1].fromPort = "GI\u00c9/1";
  const project = upcastProject(legacy);
  assert.equal(project.links[0].fromInterfaceId, project.links[1].fromInterfaceId);
  assert.equal(project.trustedNetwork.interfaces[0].name, legacy.links[0].fromPort);
  assert.deepEqual(downcastProjectV2(project), legacy);
  project.trustedNetwork.interfaces[0].aliases = [" UPLINK "];
  const validated = validateProjectV2(project);
  assert.deepEqual(validated.trustedNetwork.interfaces[0].aliases, [" UPLINK "]);
  validated.trustedNetwork.interfaces[0].aliases.push("uplink");
  expectIssue("ALIAS_COLLISION", () => validateProjectV2(validated));
});

test("CORE-R2 canonicalProjectV2 is public, deterministic, idempotent and preserves array order", () => {
  assert.equal(typeof trustedNetworkCore.canonicalProjectV2, "function");
  const original = upcastProject(legacyProject());
  original.links[0].fromPort = " Gi1/0/1 ";
  original.trustedNetwork.interfaces[0].aliases = [" UPLINK ", "Core Port"];
  const before = structuredClone(original);
  const reversed = reverseObjectKeys(original);
  freezeDeep(original);
  const canonical = trustedNetworkCore.canonicalProjectV2(original);
  assert.equal(JSON.stringify(canonical), JSON.stringify(trustedNetworkCore.canonicalProjectV2(reversed)));
  assert.deepEqual(trustedNetworkCore.canonicalProjectV2(canonical), canonical);
  assert.deepEqual(canonical, original);
  assert.deepEqual(canonical.devices.map(({ id }) => id), original.devices.map(({ id }) => id));
  assert.deepEqual(canonical.trustedNetwork.interfaces[0].aliases, [" UPLINK ", "Core Port"]);
  canonical.trustedNetwork.interfaces[0].aliases.push("Changed");
  canonical.trustedNetwork.fieldTrust[0].evidenceIds.push("ev-changed");
  canonical.devices[0].name = "Changed";
  assert.deepEqual(original, before);
});

test("CORE-R2 canonicalProjectV2 does not verify or change structurally verified records", () => {
  assert.equal(typeof trustedNetworkCore.canonicalProjectV2, "function");
  const project = upcastProject(legacyProject());
  assert.ok(trustedNetworkCore.canonicalProjectV2(project).trustedNetwork.fieldTrust.every((entry) => entry.verification === "unverified"));
  const record = project.trustedNetwork.fieldTrust[0];
  record.verification = "verified";
  record.verifiedByUserId = "server-derived-user";
  record.verifiedAt = "2026-10-09T08:00:00+08:00";
  const before = structuredClone(project);
  freezeDeep(project);
  assert.deepEqual(trustedNetworkCore.canonicalProjectV2(project), before);
  assert.deepEqual(project, before);
});

test("CORE-R2 canonical rejects invalid schema, references, aliases and evidence without echo", () => {
  assert.equal(typeof trustedNetworkCore.canonicalProjectV2, "function");
  const cases = [
    ["INVALID_PROJECT_VERSION", (p) => { p.projectSchemaVersion = 3; }],
    ["INVALID_PROJECT_SCHEMA", (p) => { p.password = "secret-sentinel-r2"; }],
    ["INVALID_PROJECT_SCHEMA", (p) => { p.links[0].fromPort = 42; }],
    ["INVALID_PROJECT_SCHEMA", (p) => { p.links[0].fromPort = "x".repeat(2001); }],
    ["INVALID_PROJECT_SCHEMA", (p) => { p.devices[0].name = "   "; }],
    ["DUPLICATE_ID", (p) => { p.links[1].id = ` ${p.links[0].id} `; }],
    ["MISSING_REFERENCE", (p) => { p.links[0].from = "missing-device"; }],
    ["ALIAS_COLLISION", (p) => { p.trustedNetwork.interfaces[0].aliases = [" gi1/0/1 "]; }],
    ["INVALID_TRUST_RECORD", (p) => { p.trustedNetwork.fieldTrust[0].verification = "verified"; }],
    ["UNSAFE_EVIDENCE", (p) => { p.trustedNetwork.evidence[0].safeSummary = " password=secret-sentinel-r2 "; }],
  ];
  for (const [code, mutate] of cases) {
    const project = upcastProject(legacyProject());
    mutate(project);
    const before = structuredClone(project);
    expectIssue(code, () => trustedNetworkCore.canonicalProjectV2(project));
    assert.throws(() => trustedNetworkCore.canonicalProjectV2(project), (error) => {
      assert.doesNotMatch(JSON.stringify(error), /secret-sentinel-r2/);
      return true;
    });
    assert.deepEqual(project, before);
  }
});

test("CORE-R2 validation gates remain strict for raw legacy inputs", () => {
  for (const mutate of [
    (p) => { p.devices[0].name = "   "; },
    (p) => { p.links[0].fromPort = 42; },
    (p) => { p.links[0].fromPort = "x".repeat(2001); },
    (p) => { p.devices[0].password = "secret-sentinel-r2"; },
    (p) => { p.links[0].from = "missing"; },
  ]) {
    const legacy = legacyProject();
    mutate(legacy);
    expectIssue("INVALID_PROJECT_SCHEMA", () => upcastProject(legacy));
  }
});

test("CORE-R2 canonical key ordering does not block a lossless downcast or allow data loss", () => {
  const legacy = legacyProject();
  legacy.devices[0].id = " d-a ";
  for (const link of legacy.links) link.from = " d-a ";
  legacy.links[0].fromPort = " Gi0/1 ";
  const original = upcastProject(legacy);
  const canonical = trustedNetworkCore.canonicalProjectV2(reverseObjectKeys(original));
  freezeDeep(canonical);
  assert.deepEqual(downcastProjectV2(canonical), legacy);
  assert.deepEqual(canonical, original);
  const edited = cloneProjectV2(canonical);
  edited.trustedNetwork.interfaces[0].aliases.push("Additional meaning");
  const before = structuredClone(edited);
  expectIssue("DOWNCAST_WOULD_LOSE_DATA", () => downcastProjectV2(edited));
  assert.deepEqual(edited, before);
});
