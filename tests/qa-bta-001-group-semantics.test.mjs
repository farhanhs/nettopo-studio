import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { assertGroupDeleteTransition, assertGroupEditTransition, assertProjectUnchanged } from "../scripts/qa-bta/browser-assertions.mjs";
import { deleteTopologyGroupKeepMembers, editTopologyGroup } from "../app/lib/topology-group-operations.ts";

const fixture = JSON.parse(fs.readFileSync(new URL("./fixtures/qa-bta-001/group-crud-cases.json", import.meta.url), "utf8"));

test("QA BTA group edit changes only name/kind/color", () => {
  assert.deepEqual(assertGroupEditTransition(fixture.base, fixture.edited, fixture.targetGroupId), fixture.edited);
});

test("QA BTA non-empty collapsed group delete keeps devices, links, geometry and unrelated groups", () => {
  assert.deepEqual(assertGroupDeleteTransition(fixture.base, fixture.deletedNonEmpty, fixture.targetGroupId), fixture.deletedNonEmpty);
  const explicitUndefined = structuredClone(fixture.deletedNonEmpty);
  explicitUndefined.devices[0].groupId = undefined;
  explicitUndefined.devices[1].groupId = undefined;
  assertGroupDeleteTransition(fixture.base, explicitUndefined, fixture.targetGroupId);
});

test("QA BTA empty group delete removes only the target group", () => {
  assert.deepEqual(assertGroupDeleteTransition(fixture.base, fixture.deletedEmpty, fixture.emptyGroupId), fixture.deletedEmpty);
});

test("QA BTA Cancel, storage failure, and readonly rejection are exact zero mutation", () => {
  assert.equal(assertProjectUnchanged(fixture.base, structuredClone(fixture.base)), true);
  assert.throws(() => assertProjectUnchanged(fixture.base, fixture.edited), /zero mutation/);
});

test("QA BTA group operations reject a missing target and detect reordered durable arrays", () => {
  assert.throws(() => assertGroupDeleteTransition(fixture.base, fixture.base, "missing-group"), /target group must exist/);
  const reordered = structuredClone(fixture.deletedNonEmpty);
  reordered.devices.reverse();
  assert.throws(() => assertGroupDeleteTransition(fixture.base, reordered, fixture.targetGroupId), /order/);
});

test("QA BTA product group helper follows the independent edit/delete/missing-target oracle", () => {
  const source = structuredClone(fixture.base);
  const missingEdit = editTopologyGroup(source, "missing-group", { name: "No", kind: "site", color: "#000000" });
  const missingDelete = deleteTopologyGroupKeepMembers(source, "missing-group");
  assert.equal(missingEdit.status, "not-found");
  assert.equal(missingDelete.status, "not-found");
  assert.equal(missingEdit.project, source);
  assert.equal(missingDelete.project, source);
  assert.deepEqual(source, fixture.base);

  const edited = editTopologyGroup(source, fixture.targetGroupId, { name: "Edited Target", kind: "vlan", color: "#112233" });
  assert.equal(edited.status, "changed");
  assertGroupEditTransition(source, edited.project, fixture.targetGroupId);
  assert.deepEqual(edited.project, fixture.edited);

  const deleted = deleteTopologyGroupKeepMembers(edited.project, fixture.targetGroupId);
  assert.equal(deleted.status, "changed");
  assert.equal(deleted.affectedDevices, 2);
  assertGroupDeleteTransition(edited.project, deleted.project, fixture.targetGroupId);
  assert.deepEqual(JSON.parse(JSON.stringify(deleted.project)), fixture.deletedNonEmpty);
  assert.deepEqual(source, fixture.base);
});
