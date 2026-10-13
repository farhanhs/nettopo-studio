import assert from "node:assert/strict";
import test from "node:test";

import { upcastProject, validateProjectV2 } from "../app/lib/trusted-network-model.ts";
import { generateInterfaceCandidates, InterfaceCandidateError, INTERFACE_CANDIDATE_LIMITS } from "../app/lib/trusted-network-interface-candidates.ts";

function project() {
  return upcastProject({ devices: [
    { id: "d-a", name: "Synthetic switch A", type: "switch", x: 0, y: 0, quantity: 24 },
    { id: "d-b", name: "Synthetic switch B", type: "switch", x: 300, y: 0 },
  ], links: [], groups: [] });
}
const row = (name, extras = {}) => ({ name, kind: "physical", ...extras });
const source = (rows, id = "ev-fixture") => ({ evidence: { id, method: "parsed", sourceKind: "json", displayName: "Synthetic interface list" }, interfaces: rows });
const explicit = (rows, extras = {}) => ({ deviceId: "d-a", explicit: [source(rows)], ...extras });
const manual = (extras = {}) => ({ deviceId: "d-a", manual: { quantity: 3, start: 1, pattern: "{n}", prefix: "Port ", kind: "physical", ...extras } });
const template = (rows = [row("Port 1"), row("Port 2")], extras = {}) => ({
  templateId: "tpl-synthetic", version: "1", vendor: "Fixture vendor", modelMatch: "Fixture 24",
  fingerprint: "a".repeat(64), reviewedAt: "2026-10-09T00:00:00Z", interfaces: rows, ...extras,
});
const templateInput = (extras = {}) => ({ deviceId: "d-a", vendor: "Fixture vendor", model: "Fixture 24", ...extras });
function freeze(value) {
  if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
async function rejects(input, code, current = project(), templates = []) {
  const before = structuredClone({ input, current, templates });
  await assert.rejects(generateInterfaceCandidates(current, input, templates), (error) => {
    assert.ok(error instanceof InterfaceCandidateError);
    if (code) assert.equal(error.code, code);
    assert.equal(error.message, "Interface candidate input was rejected.");
    assert.doesNotMatch(JSON.stringify(error), /SENSITIVE_FIXTURE|postgres:\/\/|rawConfig|verifiedBy/);
    return true;
  });
  assert.deepEqual({ input, current, templates }, before);
}
function appendPreview(current, plan) {
  const copy = structuredClone(current);
  copy.trustedNetwork.interfaces.push(...structuredClone(plan.candidates.map((candidate) => candidate.interface)));
  copy.trustedNetwork.evidence.push(...structuredClone(plan.evidence));
  return validateProjectV2(copy);
}
function existingTemplateProject() {
  const current = project();
  current.trustedNetwork.interfaces = [
    { id: "if-existing-1", deviceId: "d-a", name: "Port 1", kind: "physical", aliases: [] },
    { id: "if-existing-2", deviceId: "d-a", name: "Port 2", kind: "physical", aliases: [] },
  ];
  current.trustedNetwork.evidence = [{
    id: "ev-old-template", method: "template", sourceKind: "template", displayName: "Reviewed fixture",
    template: { templateId: "tpl-synthetic", version: "0", fingerprint: "b".repeat(64) },
  }];
  current.trustedNetwork.fieldTrust = current.trustedNetwork.interfaces.map((entry, index) => ({
    id: `trust-${index}`, entityType: "interface", entityId: entry.id, fieldPath: "name",
    valueFingerprint: "c".repeat(64), evidenceIds: ["ev-old-template"], verification: "verified",
    verifiedByUserId: "synthetic-reviewer", verifiedAt: "2026-10-08T00:00:00Z",
  }));
  return validateProjectV2(current);
}

test("GEN-01 deterministic IDs/order, immutable inputs and core-compatible additions", async () => {
  const current = freeze(project());
  const input = freeze(explicit([row(" Z ", { aliases: [" uplink "], description: " Safe original " }), row("A")]));
  const before = structuredClone({ current, input });
  const first = await generateInterfaceCandidates(current, input);
  assert.deepEqual(first, await generateInterfaceCandidates(current, input));
  assert.deepEqual({ current, input }, before);
  assert.deepEqual(first.candidates.map((entry) => entry.interface.name), ["A", " Z "]);
  assert.deepEqual(first.candidates[1].interface.aliases, [" uplink "]);
  assert.equal(first.candidates[1].interface.description, " Safe original ");
  assert.ok(first.candidates.every((entry) => /^if-gen-v1-[a-f0-9]{64}$/.test(entry.interface.id)));
  assert.equal(appendPreview(current, first).trustedNetwork.interfaces.length, 2);
  first.candidates[1].interface.aliases.push("mutated result");
  assert.deepEqual(input.explicit[0].interfaces[0].aliases, [" uplink "]);
});

test("GEN-02 exact normalized vendor/model and explicit missing-field fill priority", async () => {
  const input = templateInput({ vendor: " fixture VENDOR ", model: " FIXTURE 24 ", explicit: [source([row("Port 1", { description: "Explicit description" })])] });
  const result = await generateInterfaceCandidates(project(), input, [template([row("Port 1", { aliases: ["p1"] }), row("Port 2")])]);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].source, "explicit");
  assert.equal(result.candidates[0].interface.description, "Explicit description");
  assert.deepEqual(result.candidates[0].interface.aliases, ["p1"]);
  assert.equal(result.candidates[0].evidenceIds.length, 2);
  assert.equal(result.candidates[1].source, "template");
  assert.equal(result.evidence.find((entry) => entry.method === "template").template.fingerprint, "a".repeat(64));
});

test("GEN-02 fuzzy/unknown/partial identity never becomes a trusted template match", async () => {
  for (const model of ["Fixture", "Fixture 24 rev B", "Unknown"] ) {
    const result = await generateInterfaceCandidates(project(), templateInput({ model }), [template()]);
    assert.equal(result.candidates.length, 0);
    assert.ok(result.missingInfo.some((entry) => entry.code === "TEMPLATE_NOT_FOUND"));
  }
  const partial = await generateInterfaceCandidates(project(), { deviceId: "d-a", vendor: "Fixture vendor" }, [template()]);
  assert.ok(partial.missingInfo.some((entry) => entry.code === "TEMPLATE_IDENTITY_MISSING"));
});

test("GEN-02 multiple reviewed versions require an exact version/fingerprint selection", async () => {
  const first = template();
  const second = template([row("Port 3")], { version: "2", fingerprint: "d".repeat(64) });
  const ambiguous = await generateInterfaceCandidates(project(), templateInput(), [first, second]);
  assert.equal(ambiguous.candidates.length, 0);
  assert.ok(ambiguous.conflicts.some((entry) => entry.code === "TEMPLATE_AMBIGUOUS"));
  const selected = await generateInterfaceCandidates(project(), templateInput({ templateSelection: { templateId: second.templateId, version: second.version, fingerprint: second.fingerprint } }), [first, second]);
  assert.deepEqual(selected.candidates.map((entry) => entry.interface.name), ["Port 3"]);
  const wrong = await generateInterfaceCandidates(project(), templateInput({ templateSelection: { templateId: second.templateId, version: second.version, fingerprint: "0".repeat(64) } }), [first, second]);
  assert.equal(wrong.candidates.length, 0);
  assert.ok(wrong.missingInfo.some((entry) => entry.code === "TEMPLATE_NOT_FOUND"));
  const duplicate = await generateInterfaceCandidates(project(), templateInput(), [first, structuredClone(first)]);
  assert.equal(duplicate.candidates.length, 2);
});

test("GEN-02 unversioned/unreviewed/malformed or inconsistent trusted records fail closed", async () => {
  for (const field of ["version", "fingerprint", "reviewedAt", "vendor", "modelMatch"]) {
    const bad = template(); delete bad[field];
    await rejects(templateInput(), "INVALID_INPUT", project(), [bad]);
  }
  await rejects(templateInput(), "INVALID_INPUT", project(), [template(), template([row("Different")])]);
});

test("GEN-03 finite manual formats preserve prefix/suffix and generate an explicit preview", async () => {
  const result = await generateInterfaceCandidates(project(), manual({ quantity: 3, start: 7, prefix: "Gi1/0/", pattern: "{n:02}", suffix: " ", kind: "logical" }));
  assert.deepEqual(result.candidates.map((entry) => entry.interface.name), ["Gi1/0/07 ", "Gi1/0/08 ", "Gi1/0/09 "]);
  assert.ok(result.candidates.every((entry) => entry.source === "manual" && entry.interface.kind === "logical" && entry.verification === "unverified"));
  assert.equal(result.evidence[0].method, "human");
});

test("GEN-03 quantity limit-1/limit, index edges and minimum are accepted", async () => {
  for (const quantity of [1, 511, 512]) {
    const result = await generateInterfaceCandidates(project(), manual({ quantity, start: 0 }));
    assert.equal(result.candidates.length, quantity);
  }
  const edge = await generateInterfaceCandidates(project(), manual({ quantity: 2, start: 999998 }));
  assert.equal(edge.candidates.length, 2);
  assert.ok(edge.candidates.some((entry) => entry.interface.name === "Port 999999"));
});

test("GEN-03 rejects noninteger/negative/oversized quantities and unsafe index arithmetic", async () => {
  for (const quantity of [0, -1, 1.5, 513, Number.MAX_SAFE_INTEGER, NaN, Infinity, "2"]) await rejects(manual({ quantity }));
  for (const start of [-1, 0.5, 1000000, Number.MAX_SAFE_INTEGER, NaN, Infinity, "1"]) await rejects(manual({ start }));
  await rejects(manual({ quantity: 2, start: 999999 }), "INPUT_LIMIT_EXCEEDED");
});

test("GEN-03 rejects ambiguous formats, arbitrary expressions, regex and placeholder injection", async () => {
  for (const pattern of ["", "%d", "{n}{n}", "{n+1}", "{n:01}", "{n:07}", "${n}", "(.*)", "Port {n}", "{n:2}"]) await rejects(manual({ pattern }), "INVALID_MANUAL_FORMAT");
  await rejects(manual({ prefix: "{n}" }), "INVALID_MANUAL_FORMAT");
  await rejects(manual({ suffix: "}" }), "INVALID_MANUAL_FORMAT");
  await rejects(manual({ prefix: "a".repeat(128), suffix: "b".repeat(128) }), "INVALID_MANUAL_FORMAT");
});

test("GEN-03 never uses Device.quantity, model text, MAC or observed links as an interface count", async () => {
  const current = project();
  current.devices[0].quantity = 1000;
  current.devices[0].mac = "aa:bb:cc:dd:ee:ff";
  current.devices[0].model = "48 port switch";
  current.links = [{ id: "link-a", from: "d-a", to: "d-b", kind: "wired", fromPort: "Port 1" }];
  const result = await generateInterfaceCandidates(current, { deviceId: "d-a" });
  assert.equal(result.candidates.length, 0);
  assert.deepEqual(result.missingInfo, [{ code: "NO_SOURCE" }]);
  const count = await generateInterfaceCandidates(current, manual());
  assert.equal(count.candidates.length, 3);
  assert.ok(count.candidates.every((entry) => entry.interface.mac === undefined));
});

test("GEN-04 all ranks preserve disagreements instead of silent priority overwrite", async () => {
  const result = await generateInterfaceCandidates(project(), templateInput({
    explicit: [source([row("Port 1", { kind: "logical" })])],
    manual: manual({ quantity: 1 }).manual,
  }), [template([row("Port 1")])]);
  assert.equal(result.candidates.length, 0);
  const conflict = result.conflicts.find((entry) => entry.code === "SOURCE_DISAGREEMENT");
  assert.ok(conflict);
  assert.equal(conflict.proposals.length, 3);
  assert.deepEqual(conflict.proposals.map((entry) => entry.source), ["explicit", "template", "manual"]);
  assert.ok(conflict.proposals.every((entry) => entry.verification === "unverified"));
});

test("GEN-04 explicit same-name disagreements and alias collisions are blocking", async () => {
  const different = await generateInterfaceCandidates(project(), { deviceId: "d-a", explicit: [source([row("Port 1")], "ev-a"), source([row("Port 1", { kind: "aggregate" })], "ev-b")] });
  assert.equal(different.candidates.length, 0);
  assert.ok(different.conflicts.some((entry) => entry.code === "SOURCE_DISAGREEMENT"));
  const aliases = await generateInterfaceCandidates(project(), explicit([row("A", { aliases: [" UPLINK "] }), row("uplink")]));
  assert.equal(aliases.candidates.length, 0);
  assert.ok(aliases.conflicts.every((entry) => entry.code === "ALIAS_COLLISION"));
});

test("GEN-04 NFC/case/trim collisions retain safe text in conflict proposals", async () => {
  const result = await generateInterfaceCandidates(project(), explicit([row("A", { aliases: [" Cafe\u0301 "] }), row("CAFÉ")]));
  assert.equal(result.candidates.length, 0);
  assert.ok(result.conflicts.some((entry) => entry.proposals.some((proposal) => proposal.interface.aliases.includes(" Cafe\u0301 "))));
  const self = await generateInterfaceCandidates(project(), explicit([row("A", { aliases: [" a "] })]));
  assert.equal(self.candidates.length, 0);
  assert.ok(self.conflicts.some((entry) => entry.code === "ALIAS_COLLISION"));
});

test("GEN-04 current verified and unverified values remain untouched and are not auto-filled", async () => {
  for (const verified of [true, false]) {
    const current = existingTemplateProject();
    if (!verified) current.trustedNetwork.fieldTrust = [];
    freeze(current);
    const before = structuredClone(current);
    const result = await generateInterfaceCandidates(current, explicit([row("Port 1", { description: "New proposed detail" })]));
    assert.equal(result.candidates.length, 0);
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0].protected, verified);
    assert.deepEqual(result.conflicts[0].existingInterfaceIds, ["if-existing-1"]);
    assert.deepEqual(current, before);
  }
});

test("GEN-04 template changes/removal report conflicts without rewriting current facts", async () => {
  const current = freeze(existingTemplateProject());
  const before = structuredClone(current);
  const renamed = await generateInterfaceCandidates(current, templateInput(), [template([row("Uplink 1", { aliases: ["Port 1"] }), row("Port 3")])]);
  assert.ok(renamed.conflicts.some((entry) => entry.code === "TEMPLATE_CHANGED" && entry.protected));
  assert.ok(renamed.conflicts.some((entry) => entry.code === "TEMPLATE_REMOVED" && entry.existingInterfaceIds.includes("if-existing-2")));
  assert.deepEqual(renamed.candidates.map((entry) => entry.interface.name), ["Port 3"]);
  assert.deepEqual(current, before);
  const removedAll = await generateInterfaceCandidates(current, templateInput(), [template([])]);
  assert.equal(removedAll.conflicts.filter((entry) => entry.code === "TEMPLATE_REMOVED").length, 2);
});

test("GEN-04 unknown provenance never invents template deletions", async () => {
  const current = existingTemplateProject(); current.trustedNetwork.fieldTrust = [];
  const result = await generateInterfaceCandidates(current, templateInput(), [template([row("Port 3")])]);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.candidates.length, 1);
});

test("GEN-04 parents resolve names/aliases only within the requested device", async () => {
  const current = project();
  current.trustedNetwork.interfaces = [{ id: "other", deviceId: "d-b", name: "Parent", kind: "physical", aliases: [] }];
  const wrongDevice = await generateInterfaceCandidates(current, explicit([row("Child", { parentName: "Parent" })]));
  assert.equal(wrongDevice.candidates.length, 0);
  assert.ok(wrongDevice.conflicts.some((entry) => entry.code === "PARENT_MISSING"));
  const valid = await generateInterfaceCandidates(current, explicit([row("Parent", { aliases: ["Root"] }), row("Child", { kind: "logical", parentName: " ROOT " })]));
  assert.equal(valid.conflicts.length, 0);
  const child = valid.candidates.find((entry) => entry.interface.name === "Child");
  const parent = valid.candidates.find((entry) => entry.interface.name === "Parent");
  assert.equal(child.interface.parentInterfaceId, parent.interface.id);
  assert.equal(appendPreview(current, valid).trustedNetwork.interfaces.length, 3);
});

test("GEN-04 cyclic and blocked parents cannot leak into safe candidates", async () => {
  for (const rows of [[row("A", { parentName: "A" })], [row("A", { parentName: "B" }), row("B", { parentName: "A" }), row("C", { parentName: "A" })]]) {
    const result = await generateInterfaceCandidates(project(), explicit(rows));
    assert.equal(result.candidates.length, 0);
    assert.ok(result.conflicts.some((entry) => entry.code === "PARENT_CYCLE"));
  }
  const blocked = await generateInterfaceCandidates(project(), explicit([row("A", { parentName: "Missing" }), row("Child", { parentName: "A" })]));
  assert.equal(blocked.candidates.length, 0);
  assert.ok(blocked.conflicts.some((entry) => entry.code === "PARENT_BLOCKED"));
});

test("GEN-05 every candidate and evidence reference is unverified, not a persisted trust transition", async () => {
  const result = await generateInterfaceCandidates(project(), templateInput({ explicit: [source([row("Explicit")])], manual: manual({ prefix: "Human " }).manual }), [template()]);
  const evidence = new Set(result.evidence.map((entry) => entry.id));
  assert.ok(result.candidates.every((entry) => entry.verification === "unverified" && entry.evidenceIds.length > 0 && entry.evidenceIds.every((id) => evidence.has(id))));
  assert.ok(result.candidates.every((entry) => entry.interface.mac === undefined && entry.interface.description === undefined && entry.interface.adminLabel === undefined));
  assert.doesNotMatch(JSON.stringify(result), /verifiedByUserId|verifiedAt|valueFingerprint/);
});

test("GEN-06 unknown fields, evidence misuse and unsafe strings fail without echo", async () => {
  const unknown = explicit([row("Port 1", { unsupported: "SENSITIVE_FIXTURE" })]);
  await rejects(unknown, "INVALID_INPUT");
  for (const key of ["password", "username", "secret", "token", "nonce", "ciphertext", "rawConfig"]) {
    await rejects({ ...explicit([row("Port 1")]), [key]: "SENSITIVE_FIXTURE" }, "UNSAFE_INPUT");
  }
  for (const field of ["name", "description", "adminLabel", "mac"]) await rejects(explicit([row("Port 1", { [field]: "password=SENSITIVE_FIXTURE" })]), "UNSAFE_INPUT");
  await rejects(explicit([row("Port 1", { aliases: ["cookie=SENSITIVE_FIXTURE"] })]), "UNSAFE_INPUT");
  const raw = explicit([row("Port 1")]); raw.explicit[0].evidence.safeSummary = "interface a\n configuration";
  await rejects(raw, "UNSAFE_INPUT");
  const path = explicit([row("Port 1")]); path.explicit[0].evidence.locator = { file: "../private.txt" };
  await rejects(path, "UNSAFE_INPUT");
  const actor = explicit([row("Port 1", { verifiedByUserId: "SENSITIVE_FIXTURE" })]);
  await rejects(actor, "INVALID_INPUT");
  const method = explicit([row("Port 1")]); method.explicit[0].evidence.method = "human";
  await rejects(method, "INVALID_INPUT");
});

test("GEN-06 strict row/template schemas reject metadata and raw payload containers", async () => {
  await rejects(explicit([row("A", { metadata: { raw: "SENSITIVE_FIXTURE" } })]), "INVALID_INPUT");
  await rejects(templateInput(), "INVALID_INPUT", project(), [template([row("A", { description: "not in template contract" })])]);
  const current = project(); current.trustedNetwork.invalidField = "SENSITIVE_FIXTURE";
  await rejects(manual(), "INVALID_CURRENT_PROJECT", current);
  await rejects({ deviceId: "nonexistent" }, "DEVICE_NOT_FOUND");
});

test("GEN-06 evidence ID conflicts and global generated ID collisions are not overwritten", async () => {
  const current = project();
  current.trustedNetwork.evidence = [{ id: "ev-fixture", method: "human", sourceKind: "manual", displayName: "Other source" }];
  await rejects(explicit([row("Port 1")]), "INVALID_INPUT", current);
  const generated = await generateInterfaceCandidates(project(), explicit([row("Port 1")]));
  const colliding = project(); colliding.groups.push({ id: generated.candidates[0].interface.id, name: "ID collision fixture", kind: "site", color: "#112233" });
  const result = await generateInterfaceCandidates(colliding, explicit([row("Port 1")]));
  assert.equal(result.candidates.length, 0);
  assert.ok(result.conflicts.some((entry) => entry.code === "ID_COLLISION"));
});

test("GEN-06 resource bounds reject source/row/alias/name and aggregate excess", async () => {
  await rejects({ deviceId: "d-a", explicit: Array.from({ length: 33 }, (_, i) => source([], `ev-${i}`)) }, "INVALID_INPUT");
  await rejects(explicit(Array.from({ length: 513 }, (_, i) => row(`P${i}`))), "INVALID_INPUT");
  await rejects(explicit([row("A", { aliases: Array.from({ length: 33 }, (_, i) => `a${i}`) })]), "INVALID_INPUT");
  await rejects(explicit([row("a".repeat(257))]), "INVALID_INPUT");
  await rejects(templateInput(), "INVALID_INPUT", project(), Array.from({ length: 33 }, (_, i) => template([], { templateId: `tpl-${i}` })));
  const many = Array.from({ length: 9 }, (_, i) => source(Array.from({ length: 512 }, (_, n) => row(`p${i}-${n}`)), `ev-${i}`));
  await rejects({ deviceId: "d-a", explicit: many }, "INPUT_LIMIT_EXCEEDED");
  assert.ok(Object.isFrozen(INTERFACE_CANDIDATE_LIMITS));
});

test("GEN-06 executable/accessor/cyclic inputs rejected without executing getters", async () => {
  let calls = 0;
  const input = { deviceId: "d-a" }; Object.defineProperty(input, "explicit", { enumerable: true, get() { calls++; return []; } });
  await assert.rejects(generateInterfaceCandidates(project(), input), InterfaceCandidateError);
  assert.equal(calls, 0);
  const cyclic = { deviceId: "d-a" }; cyclic.child = cyclic;
  await assert.rejects(generateInterfaceCandidates(project(), cyclic), InterfaceCandidateError);
  await assert.rejects(generateInterfaceCandidates(project(), { deviceId: "d-a", callback() {} }), InterfaceCandidateError);
  await assert.rejects(generateInterfaceCandidates(project(), new Date()), InterfaceCandidateError);
});

test("GEN-07 repeated/duplicate rows and repeated generation after insertion are idempotent", async () => {
  const current = project();
  const input = explicit([row("Port 1"), row("Port 1")]);
  const result = await generateInterfaceCandidates(current, input);
  assert.equal(result.candidates.length, 1);
  const inserted = appendPreview(current, result);
  const repeated = await generateInterfaceCandidates(inserted, input);
  assert.equal(repeated.candidates.length, 0);
  assert.equal(repeated.conflicts.length, 0);
  assert.equal(repeated.evidence.length, 0);
});

test("GEN-07 IDs are scoped to device and row ordering does not change output", async () => {
  const current = project();
  const a = await generateInterfaceCandidates(current, explicit([row("B"), row("A")]));
  const b = await generateInterfaceCandidates(current, explicit([row("A"), row("B")]));
  assert.deepEqual(a, b);
  const other = await generateInterfaceCandidates(current, explicit([row("A"), row("B")], { deviceId: "d-b" }));
  const ids = new Set(a.candidates.map((entry) => entry.interface.id));
  assert.ok(other.candidates.every((entry) => !ids.has(entry.interface.id) && entry.interface.deviceId === "d-b"));
});

test("GEN-04 parent disagreements preserve both requested references for review", async () => {
  const result = await generateInterfaceCandidates(project(), { deviceId: "d-a", explicit: [
    source([row("Parent A"), row("Parent B"), row("Child", { parentName: "Parent A" })], "ev-a"),
    source([row("Child", { parentName: "Parent B" })], "ev-b"),
  ] });
  const conflict = result.conflicts.find((entry) => entry.code === "SOURCE_DISAGREEMENT");
  assert.deepEqual(conflict.proposals.map((entry) => entry.parentName), ["Parent A", "Parent B"]);
  assert.equal(conflict.proposals[1].interface.parentInterfaceId, undefined);
});

test("GEN-06 JSON arrays reject unknown properties instead of silently stripping them", async () => {
  const input = explicit([row("A")]); input.explicit.extra = "SENSITIVE_FIXTURE";
  await assert.rejects(generateInterfaceCandidates(project(), input), InterfaceCandidateError);
  const hole = explicit(Array(1));
  await assert.rejects(generateInterfaceCandidates(project(), hole), InterfaceCandidateError);
});

test("GEN-06 current project accessors are rejected before invoking core validation", async () => {
  let calls = 0;
  const current = project(); Object.defineProperty(current, "devices", { enumerable: true, get() { calls++; return []; } });
  await assert.rejects(generateInterfaceCandidates(current, manual()), (error) => error instanceof InterfaceCandidateError && error.code === "INVALID_CURRENT_PROJECT");
  assert.equal(calls, 0);
});

test("GEN-06 bounded source/row/name/alias/template maxima retain safe values", async () => {
  for (const length of [255, 256]) {
    const result = await generateInterfaceCandidates(project(), explicit([row("a".repeat(length))]));
    assert.equal(result.candidates[0].interface.name.length, length);
  }
  for (const count of [31, 32]) {
    const aliases = Array.from({ length: count }, (_, index) => `Alias ${index}`);
    const input = { deviceId: "d-a", explicit: Array.from({ length: count }, (_, index) => source([row(`P${index}`, { aliases: aliases.map((alias) => `${index}-${alias}`) })], `ev-${index}`)) };
    const result = await generateInterfaceCandidates(project(), input);
    assert.equal(result.candidates.length, count);
    assert.equal(result.candidates[0].interface.aliases.length, count);
    const templates = Array.from({ length: count }, (_, index) => template([], { templateId: `tpl-${index}`, modelMatch: `Other ${index}` }));
    assert.equal((await generateInterfaceCandidates(project(), templateInput(), templates)).candidates.length, 0);
  }
  for (const count of [511, 512]) {
    const result = await generateInterfaceCandidates(project(), explicit(Array.from({ length: count }, (_, index) => row(`P${index}`))));
    assert.equal(result.candidates.length, count);
  }
});

test("GEN-06 total selected rows limit-1/limit/limit+1 and registry budget", async () => {
  for (const count of [4095, 4096, 4097]) {
    const sources = Array.from({ length: Math.ceil(count / 512) }, (_, batch) => source(
      Array.from({ length: Math.min(512, count - batch * 512) }, (_, index) => row(`P${batch * 512 + index}`)), `ev-${batch}`));
    const input = { deviceId: "d-a", explicit: sources };
    if (count > 4096) await rejects(input, "INPUT_LIMIT_EXCEEDED");
    else assert.equal((await generateInterfaceCandidates(project(), input)).candidates.length, count);
  }
  const templates = Array.from({ length: 9 }, (_, batch) => template(Array.from({ length: 512 }, (_, index) => row(`P${index}`)), { templateId: `tpl-${batch}` }));
  await rejects(templateInput(), "INPUT_LIMIT_EXCEEDED", project(), templates);
});

test("GEN-06 depth/text budgets fail closed and current sensitive IDs never escape", async () => {
  let child = {};
  for (let depth = 0; depth < 14; depth++) child = { child };
  await rejects({ deviceId: "d-a", child }, "INPUT_LIMIT_EXCEEDED");
  await rejects({ deviceId: "d-a", field: "a".repeat(2001) }, "INPUT_LIMIT_EXCEEDED");
  const sources = Array.from({ length: 2 }, (_, batch) => source(Array.from({ length: 512 }, (_, index) => row(`P${index}`, { description: "a".repeat(1100) })), `ev-${batch}`));
  await rejects({ deviceId: "d-a", explicit: sources }, "INPUT_LIMIT_EXCEEDED");
  const current = project();
  current.trustedNetwork.interfaces = [{ id: "password-SENSITIVE_FIXTURE", deviceId: "d-a", name: "A", kind: "physical", aliases: [] }];
  await rejects(explicit([row("A", { kind: "logical" })]), "INVALID_CURRENT_PROJECT", current);
});

test("GEN-07 generation from already verified matching interfaces preserves trust and makes no proposals", async () => {
  const current = freeze(existingTemplateProject());
  const before = structuredClone(current);
  const result = await generateInterfaceCandidates(current, explicit([row("Port 1"), row("Port 2")]));
  assert.deepEqual(result.candidates, []);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.evidence, []);
  assert.deepEqual(current, before);
});
