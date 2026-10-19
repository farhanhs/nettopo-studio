import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { deleteTopologyGroupKeepMembers } from '../app/lib/topology-group-operations.ts';

const source = ts.createSourceFile('page.tsx', readFileSync('app/page.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(name, deps) {
  let node;
  const find = n => { if (ts.isFunctionDeclaration(n) && n.name?.text === name) node = n; else ts.forEachChild(n, find); };
  find(source);
  assert.ok(node, 'actual page handler must exist');
  const js = ts.transpileModule(node.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(deps), js + '; return ' + name)(...Object.values(deps));
}
function fixture(overrides = {}) {
  const project = { devices: [], links: [], groups: [{ id: 'g', name: 'Group', kind: 'site', color: '#123456' }] };
  const state = { saving: false, localEditing: true, activeTopologyId: 't', topologies: [{ id: 't', project }] };
  const calls = { write: 0, success: [], errors: [], updater: undefined };
  let listener;
  const deps = {
    canManageGroups: true, groupAction: { type: 'delete', id: 'g', topologyId: 't' }, activeTopologyId: 't',
    saving: false, groupBusyRef: { current: false }, actionGroup: project.groups[0], project,
    validateProject: p => structuredClone(p), LOCAL_BETA_BUILD: true, USE_SERVER_STORAGE: false,
    canWriteTopology: () => false,
    setGroupError: e => calls.errors.push(e), setGroupBusy: () => {}, setGroupAction: () => {},
    setGroupCollapseOverrides: () => {}, setNotice: text => calls.success.push(text),
    useTopologyStore: { getState: () => state, subscribe: fn => { listener = fn; return () => { listener = undefined; }; } },
    setProject: updater => { calls.write++; calls.updater = updater; state.saving = true; listener?.(state); },
    ...overrides,
  };
  return { deps, state, calls, emit: () => listener?.(state), project };
}

test('actual group handler rejects read-only, stale scope, missing target and concurrent submission before enqueue', async () => {
  for (const patch of [{ canManageGroups: false }, { activeTopologyId: 'other' }, { actionGroup: undefined },
    { saving: true }, { groupBusyRef: { current: true } }]) {
    const f = fixture(patch);
    await handler('commitGroupChange', f.deps)(p => deleteTopologyGroupKeepMembers(p, 'g'), 'success');
    assert.equal(f.calls.write, 0);
    assert.deepEqual(f.calls.success, []);
  }
});

test('actual handler queues once and reports success only after committed state and saving completion', async () => {
  const f = fixture();
  const operation = handler('commitGroupChange', f.deps)(p => deleteTopologyGroupKeepMembers(p, 'g'), 'success');
  assert.equal(f.calls.write, 1);
  const next = f.calls.updater(f.project);
  assert.deepEqual(f.calls.success, []);
  f.state.topologies[0].project = next;
  f.emit();
  assert.deepEqual(f.calls.success, []);
  f.state.saving = false; f.emit();
  await operation;
  assert.deepEqual(f.calls.success, ['success']);
});

test('actual handler does not claim success on failed persistence or permission revoked before updater', async () => {
  for (const revoke of [false, true]) {
    const f = fixture();
    const before = structuredClone(f.state.topologies);
    const operation = handler('commitGroupChange', f.deps)(p => deleteTopologyGroupKeepMembers(p, 'g'), 'success');
    if (revoke) {
      f.state.localEditing = false;
      assert.throws(() => f.calls.updater(f.project), /Group write unavailable/);
    } else f.calls.updater(f.project);
    f.state.writeError = 'Synthetic safe write failure';
    f.state.saving = false; f.emit();
    await operation;
    assert.equal(f.calls.write, 1);
    assert.deepEqual(f.state.topologies, before);
    assert.deepEqual(f.calls.success, []);
    assert.equal(f.calls.errors.at(-1), 'Synthetic safe write failure');
  }
});

test('cancel invokes no Project update and missing target at updater time cannot recreate or unclassify', async () => {
  const f = fixture();
  handler('closeGroupAction', f.deps)();
  assert.equal(f.calls.write, 0);
  const operation = handler('commitGroupChange', f.deps)(p => deleteTopologyGroupKeepMembers(p, 'g'), 'success');
  assert.throws(() => f.calls.updater({ devices: [], links: [], groups: [] }), /Group no longer exists/);
  f.state.writeError = 'Synthetic safe write failure';
  f.state.saving = false; f.emit();
  await operation;
  assert.deepEqual(f.calls.success, []);
});
