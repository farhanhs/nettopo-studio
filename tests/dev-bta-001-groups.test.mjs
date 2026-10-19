import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteTopologyGroupKeepMembers, editTopologyGroup } from '../app/lib/topology-group-operations.ts';

const fixture = () => ({
  groups: [
    { id: 'target', name: 'Synthetic A', kind: 'site', color: '#123456', collapsed: true },
    { id: 'other', name: 'Synthetic B', kind: 'domain', color: '#654321', collapsed: false },
    { id: 'empty', name: 'Synthetic Empty', kind: 'vlan', color: '#336699' },
  ],
  devices: [
    { id: 'a', name: 'A', type: 'switch', x: 20, y: 40, groupId: 'target', quantity: 2 },
    { id: 'b', name: 'B', type: 'camera', x: 220, y: 240, groupId: 'other' },
    { id: 'c', name: 'C', type: 'printer', x: 420, y: 440 },
  ],
  links: [{ id: 'ab', from: 'a', to: 'b', kind: 'wired', fromPort: '1', toPort: '2', speed: '1G', vlan: '10' }],
});

test('edit restricts changes to name/kind/color and keeps collapsed membership and array order', () => {
  const original = fixture(), before = structuredClone(original);
  const result = editTopologyGroup(original, 'target', {
    name: 'Renamed', kind: 'vlan', color: '#abcdef',
    id: 'forged', collapsed: false, groupId: 'forged',
  });
  assert.equal(result.status, 'changed');
  assert.deepEqual(result.project.groups, [
    { id: 'target', name: 'Renamed', kind: 'vlan', color: '#abcdef', collapsed: true },
    before.groups[1], before.groups[2],
  ]);
  assert.deepEqual(result.project.devices, before.devices);
  assert.deepEqual(result.project.links, before.links);
  assert.deepEqual(original, before);
});

test('empty deletion and missing targets never change unrelated data or recreate groups', () => {
  const original = fixture();
  const empty = deleteTopologyGroupKeepMembers(original, 'empty');
  assert.equal(empty.affectedDevices, 0);
  assert.deepEqual(empty.project.devices, original.devices);
  assert.deepEqual(empty.project.links, original.links);
  assert.deepEqual(empty.project.groups, original.groups.slice(0, 2));
  for (const result of [deleteTopologyGroupKeepMembers(original, 'missing'),
    editTopologyGroup(original, 'missing', { name: 'Absent', kind: 'site', color: '#112233' })]) {
    assert.equal(result.status, 'not-found');
    assert.equal(result.affectedDevices, 0);
    assert.equal(result.project, original);
  }
});

test('delete a collapsed nonempty group preserves every device, link and other group', () => {
  const original = fixture(), before = structuredClone(original);
  const result = deleteTopologyGroupKeepMembers(original, 'target');
  assert.equal(result.status, 'changed');
  assert.equal(result.affectedDevices, 1);
  const next = result.project;
  assert.deepEqual(next.groups, [before.groups[1], before.groups[2]]);
  assert.deepEqual(next.devices, [
    { id: 'a', name: 'A', type: 'switch', x: 20, y: 40, quantity: 2, groupId: undefined },
    before.devices[1], before.devices[2],
  ]);
  assert.deepEqual(next.links, before.links);
  assert.deepEqual(original, before);
});
