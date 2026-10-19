import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { buildImportPlan, materializeImport, projectExportToJson } from '../app/lib/topology-transfer.ts';

test('synthetic JSON and five-file sample preserve existing safe exchange contract', async () => {
  const text = await readFile('samples/beta/synthetic-topology.json', 'utf8');
  const exported = JSON.parse(text);
  assert.equal(exported.sharing, 'safe');
  assert.equal(exported.project.devices.length, 3);
  for (const device of exported.project.devices) for (const field of ['ip', 'mac', 'url', 'location', 'username', 'password', 'secret']) assert.equal(device[field], undefined);
  const files = unzipSync(await readFile('samples/beta/synthetic-topology-csv-bundle.zip'));
  assert.deepEqual(Object.keys(files).sort(), ['credentials.masked.csv', 'devices.csv', 'groups.csv', 'links.csv', 'missing-info.csv']);
  const plan = buildImportPlan(Object.entries(files).map(([name, bytes]) => ({ name, text: strFromU8(bytes) })));
  assert.equal(plan.canApply, true);
  const roundtrip = materializeImport({ devices: [], links: [], groups: [] }, plan, 'replace');
  assert.deepEqual(JSON.parse(JSON.stringify(roundtrip)), exported.project);
  const full = JSON.parse(projectExportToJson(roundtrip, { safe: false }));
  assert.deepEqual(full.project, exported.project);
});

test('public documents include license, backup limits and no automatic upload', async () => {
  assert.match(await readFile('LICENSE', 'utf8'), /Copyright \(c\) 2026 sean\.hsieh/);
  const notices = await readFile('THIRD_PARTY_NOTICES.md', 'utf8');
  for (const name of ['elkjs 0.11.1', 'dexie 4.4.4', '@xyflow/react', 'vinext 0.0.50', 'tailwindcss', '@vitejs/plugin-rsc 0.5.26']) assert.ok(notices.includes(name), name);
  assert.match(notices, /Eclipse Public License/i);
  assert.match(await readFile('docs/beta/DATA-AND-BACKUP.zh-TW.md', 'utf8'), /大小大於 0/);
  assert.match(await readFile('docs/beta/FEEDBACK.md', 'utf8'), /不自動上傳/);
});
