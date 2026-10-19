import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { unzipSync } from 'fflate';
import { chromium, expect } from '@playwright/test';
import { safePath, hash } from '../release/beta/runtime/lib/integrity.mjs';
import { betaEnvironment, ORIGIN } from '../release/beta/runtime/lib/environment.mjs';
import { projectExportToJson } from '../app/lib/topology-transfer.ts';

const fixture = {
  groups: [
    { id: 'g-a', name: 'Synthetic Group A', kind: 'site', color: '#123456', collapsed: true },
    { id: 'g-b', name: 'Synthetic Group B', kind: 'domain', color: '#654321', collapsed: false },
    { id: 'g-empty', name: 'Synthetic Empty', kind: 'vlan', color: '#336699' },
  ],
  devices: [
    { id: 'd-a', name: 'Synthetic Switch', type: 'switch', x: 0, y: 0, groupId: 'g-a', quantity: 2, model: 'Test-A', ip: '192.0.2.1' },
    { id: 'd-b', name: 'Synthetic Camera', type: 'camera', x: 400, y: 200, groupId: 'g-b', model: 'Test-B', ip: '192.0.2.2' },
    { id: 'd-c', name: 'Synthetic Printer', type: 'printer', x: 600, y: 400, model: 'Test-C', ip: '192.0.2.3' },
  ],
  links: [{ id: 'l-ab', from: 'd-a', to: 'd-b', kind: 'wired', fromPort: '1', toPort: '2', speed: '1 Gbps', vlan: '10' }],
};
const snapshot = page => page.evaluate(() => new Promise((resolveSnapshot, reject) => {
  const req = indexedDB.open('nettopo-studio-db');
  req.onerror = () => reject(new Error('fixture database unavailable'));
  req.onsuccess = () => {
    const db = req.result, tx = db.transaction(['topologies', 'meta'], 'readonly');
    const rows = tx.objectStore('topologies').getAll(), meta = tx.objectStore('meta').get('activeTopologyId');
    tx.oncomplete = () => { db.close(); resolveSnapshot({ rows: rows.result, active: meta.result.value }); };
    tx.onerror = () => { db.close(); reject(new Error('fixture snapshot failed')); };
  };
}));
const projectOf = s => s.rows.find(r => r.id === s.active).project;

test('actual ZIP group CRUD preserves topology and failure/cancel are durable no-ops', { timeout: 300000 }, async () => {
  const zip = process.env.BTA_TEST_ZIP;
  assert.ok(zip);
  const bytes = await readFile(zip);
  const evidence = await mkdtemp(resolve('.local/bta-20261019/group-browser-'));
  for (const [path, data] of Object.entries(unzipSync(bytes))) {
    safePath(path);
    await mkdir(dirname(join(evidence, path)), { recursive: true });
    await writeFile(join(evidence, path), data);
  }
  const root = join(evidence, 'NetTopo-Studio-0.1.0-beta.1');
  const run = command => {
    const result = spawnSync(process.execPath, ['runtime/tools/' + command + '.mjs'], {
      cwd: root, env: betaEnvironment(), windowsHide: true, encoding: 'utf8', timeout: 120000,
    });
    return { exit: result.status, ...JSON.parse(result.stdout.trim()) };
  };
  const results = [];
  try {
    assert.equal(run('setup').code, 'BTA_SETUP_OK');
    assert.equal(run('start').code, 'BTA_STARTED');
    for (const channel of ['chrome', 'msedge']) {
      const context = await chromium.launchPersistentContext(join(evidence, channel + '-profile'), {
        channel, headless: true, env: betaEnvironment(), viewport: { width: 1280, height: 900 },
        serviceWorkers: 'block', args: ['--disable-background-networking', '--no-first-run'],
      });
      const external = [], errors = [];
      try {
        await context.route('**/*', route => {
          if (route.request().url().startsWith(ORIGIN + '/')) return route.continue();
          external.push(route.request().url()); return route.abort();
        });
        const page = await context.newPage();
        page.on('pageerror', e => errors.push(e.name));
        await page.goto(ORIGIN);
        await page.locator('[data-local-beta="true"]').waitFor();
        await page.getByRole('button', { name: '匯入', exact: true }).click();
        await page.locator('input[type=file]').setInputFiles({
          name: 'synthetic-group-test.json', mimeType: 'application/json',
          buffer: Buffer.from(projectExportToJson(fixture, { safe: false })),
        });
        await page.locator('.import-options select').selectOption('replace');
        const ack = page.locator('.import-warning-ack input');
        if (await ack.count()) await ack.check();
        await page.getByRole('button', { name: '確認寫入', exact: true }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.locator('.tabs').getByRole('button', { name: '容器', exact: true }).click();
        const baseline = await snapshot(page);
        const modal = page.getByRole('dialog');
        const edit = name => page.getByRole('button', { name: '編輯容器 ' + name, exact: true });
        const remove = name => page.getByRole('button', { name: '刪除容器 ' + name, exact: true });
        const viewports = [];
        for (const width of [360, 768, 1024, 1280]) {
          await page.setViewportSize({ width, height: width === 360 ? 640 : 900 });
          await edit('Synthetic Group A').click();
          await modal.getByRole('button', { name: '取消', exact: true }).click();
          await remove('Synthetic Group A').click();
          await expect(modal).toContainText('成員設備：1 個節點');
          await expect(modal).toContainText('刪除容器後，設備與連線會保留；此容器內的設備將改為未分類。');
          await modal.getByRole('button', { name: '取消', exact: true }).click();
          assert.deepEqual(await snapshot(page), baseline);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await page.screenshot({ path: join(evidence, channel + '-' + width + '.png'), fullPage: true });
          viewports.push(width);
        }
        await edit('Synthetic Group A').click();
        await modal.getByLabel('容器名稱', { exact: true }).fill('Synthetic Renamed');
        await modal.getByRole('combobox', { name: /^分類/ }).selectOption('vlan');
        await modal.getByLabel('識別色', { exact: true }).fill('#abcdef');
        await modal.getByRole('button', { name: '儲存變更', exact: true }).click();
        await expect(modal).toHaveCount(0);
        const edited = structuredClone(projectOf(baseline));
        Object.assign(edited.groups[0], { name: 'Synthetic Renamed', kind: 'vlan', color: '#abcdef' });
        assert.deepEqual(projectOf(await snapshot(page)), edited);
        await page.reload();
        await page.locator('[data-local-beta="true"]').waitFor();
        await page.locator('.tabs').getByRole('button', { name: '容器', exact: true }).click();
        assert.deepEqual(projectOf(await snapshot(page)), edited);

        const beforeFailure = await snapshot(page);
        await page.evaluate(() => {
          const original = IDBObjectStore.prototype.put;
          IDBObjectStore.prototype.put = function (...args) {
            if (this.name === 'topologies') throw new DOMException('Synthetic group failure', 'QuotaExceededError');
            return original.apply(this, args);
          };
        });
        for (const action of ['edit', 'delete']) {
          if (action === 'edit') {
            await edit('Synthetic Renamed').click();
            await modal.getByLabel('容器名稱', { exact: true }).fill('Rejected Group Edit');
            await modal.getByRole('button', { name: '儲存變更', exact: true }).click();
          } else {
            await remove('Synthetic Renamed').click();
            await modal.getByRole('button', { name: '刪除容器', exact: true }).click();
          }
          await expect(modal.getByRole('alert')).toHaveText('本機儲存失敗，原資料已保留。');
          await expect(page.getByText(/^(容器已更新|容器已刪除，設備與連線已保留)$/)).toHaveCount(0);
          assert.deepEqual(await snapshot(page), beforeFailure);
          await expect(page.locator('.group-row[data-group-id="g-a"]')).toContainText('Synthetic Renamed');
          await modal.getByRole('button', { name: '取消', exact: true }).click();
        }
        await page.reload();
        await page.locator('[data-local-beta="true"]').waitFor();
        await page.locator('.tabs').getByRole('button', { name: '容器', exact: true }).click();
        assert.deepEqual(await snapshot(page), beforeFailure);

        await remove('Synthetic Renamed').click();
        await modal.getByRole('button', { name: '刪除容器', exact: true }).click();
        await expect(modal).toHaveCount(0);
        await expect(page.getByText('容器已刪除，設備與連線已保留', { exact: true })).toBeVisible();
        const deleted = structuredClone(edited);
        deleted.groups.splice(0, 1); delete deleted.devices[0].groupId;
        assert.deepEqual(JSON.parse(JSON.stringify(projectOf(await snapshot(page)))), deleted);
        await remove('Synthetic Empty').click();
        await expect(modal).toContainText('成員設備：0 個節點');
        await modal.getByRole('button', { name: '刪除容器', exact: true }).click();
        await expect(modal).toHaveCount(0);
        deleted.groups = [deleted.groups[0]];
        await page.reload();
        await page.locator('[data-local-beta="true"]').waitFor();
        assert.deepEqual(JSON.parse(JSON.stringify(projectOf(await snapshot(page)))), deleted);

        await page.getByRole('button', { name: '匯出', exact: true }).click();
        page.once('dialog', d => d.accept());
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: '下載完整 JSON', exact: true }).click();
        const backup = join(evidence, channel + '-groups-backup.json');
        await (await download).saveAs(backup);
        assert.deepEqual(JSON.parse(await readFile(backup, 'utf8')).project, deleted);
        await page.getByRole('dialog').getByRole('button', { name: '關閉', exact: true }).click();
        await page.getByRole('button', { name: '匯入', exact: true }).click();
        await page.locator('input[type=file]').setInputFiles(backup);
        await page.locator('.import-options select').selectOption('replace');
        if (await ack.count()) await ack.check();
        await page.getByRole('button', { name: '確認寫入', exact: true }).click();
        await expect(modal).toHaveCount(0);
        await page.reload();
        await page.locator('[data-local-beta="true"]').waitFor();
        assert.deepEqual(JSON.parse(JSON.stringify(projectOf(await snapshot(page)))), deleted);
        assert.deepEqual(external, []);
        assert.deepEqual(errors, []);
        results.push({ channel, browser: context.browser()?.version(), viewports, cancelZeroWrite: true, editPreserves: true,
          failedEditAndDeleteZeroWrite: true, emptyAndCollapsedDeletePreserves: true, reloadExportRestore: true });
      } finally { await context.close(); }
    }
  } finally {
    const cleanup = run('stop');
    await writeFile(join(evidence, 'result.json'), JSON.stringify({ zipSha256: hash(bytes), results, cleanup }, null, 2));
    assert.ok(['BTA_STOPPED', 'BTA_NOT_RUNNING'].includes(cleanup.code));
    assert.equal(hash(await readFile(zip)), hash(bytes));
  }
});
