import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

import { deleteTopologyGroupKeepMembers } from "../app/lib/topology-group-operations.ts";

const pageSource = ts.createSourceFile("page.tsx", fs.readFileSync("app/page.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function actualPageHandler(name, dependencies) {
  let declaration;
  const visit = node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node;
    else ts.forEachChild(node, visit);
  };
  visit(pageSource);
  assert.ok(declaration, `actual page handler is required: ${name}`);
  const javascript = ts.transpileModule(declaration.getText(pageSource), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${javascript}; return ${name}`)(...Object.values(dependencies));
}

function scenario(overrides = {}) {
  const project = { devices: [{ id: "d", name: "D", type: "router", x: 1, y: 2, groupId: "g" }], links: [], groups: [{ id: "g", name: "G", kind: "site", color: "#123456" }] };
  const state = { saving: false, localEditing: true, activeTopologyId: "t", topologies: [{ id: "t", project }] };
  const calls = { writes: 0, success: [], errors: [], updater: undefined };
  let listener;
  const dependencies = {
    canManageGroups: true,
    groupAction: { type: "delete", id: "g", topologyId: "t" },
    activeTopologyId: "t",
    saving: false,
    groupBusyRef: { current: false },
    actionGroup: project.groups[0],
    project,
    validateProject: value => structuredClone(value),
    LOCAL_BETA_BUILD: true,
    USE_SERVER_STORAGE: false,
    canWriteTopology: () => false,
    setGroupError: value => calls.errors.push(value),
    setGroupBusy: () => {},
    setGroupAction: () => {},
    setGroupCollapseOverrides: () => {},
    setNotice: value => calls.success.push(value),
    useTopologyStore: { getState: () => state, subscribe: callback => { listener = callback; return () => { listener = undefined; }; } },
    setProject: updater => { calls.writes += 1; calls.updater = updater; state.saving = true; listener?.(state); },
    ...overrides,
  };
  return { project, state, calls, dependencies, emit: () => listener?.(state) };
}

test("QA BTA actual page handler rejects readonly and stale/missing scope before enqueue", async () => {
  for (const override of [{ canManageGroups: false }, { activeTopologyId: "other" }, { actionGroup: undefined }]) {
    const item = scenario(override);
    await actualPageHandler("commitGroupChange", item.dependencies)(value => deleteTopologyGroupKeepMembers(value, "g"), "success");
    assert.equal(item.calls.writes, 0);
    assert.deepEqual(item.calls.success, []);
    assert.deepEqual(item.project.groups.map(group => group.id), ["g"]);
    assert.equal(item.project.devices[0].groupId, "g");
  }
});

test("QA BTA actual page handler fails closed when target disappears before updater commit", async () => {
  const item = scenario();
  const pending = actualPageHandler("commitGroupChange", item.dependencies)(value => deleteTopologyGroupKeepMembers(value, "g"), "success");
  assert.equal(item.calls.writes, 1);
  assert.throws(() => item.calls.updater({ devices: item.project.devices, links: [], groups: [] }), /Group no longer exists/);
  item.state.writeError = "QA synthetic safe failure";
  item.state.saving = false;
  item.emit();
  await pending;
  assert.deepEqual(item.calls.success, []);
  assert.equal(item.calls.errors.at(-1), "QA synthetic safe failure");
  assert.equal(item.project.devices[0].groupId, "g");
});
