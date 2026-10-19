import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, mkdtemp, stat, unlink } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { request, createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { unzipSync } from 'fflate';
import { chromium } from '@playwright/test';
import { betaEnvironment, ORIGIN } from '../release/beta/runtime/lib/environment.mjs';
import { safePath, hash } from '../release/beta/runtime/lib/integrity.mjs';

const evidence = resolve('.local/bta-20261019');
const zip = process.env.BTA_TEST_ZIP || join(evidence, 'portable-03/NetTopo-Studio-0.1.0-beta.1.zip');
const browserExecutables = [
  ['Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
  ['Edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
];
const http = (path, headers = {}) => new Promise((resolveResponse, reject) => {
  const req = request(ORIGIN + path, { headers, timeout: 5000 }, res => { let body = ''; res.on('data', b => body += b); res.on('end', () => resolveResponse({ status: res.statusCode, body, headers: res.headers })); });
  req.on('error', reject); req.on('timeout', () => req.destroy()); req.end();
});

test('actual portable ZIP: clean Chinese-path setup, owned lifecycle and offline Chrome/Edge', { timeout: 240000 }, async () => {
  const folder = await mkdtemp(join(evidence, 'portable-run-中文 空白-'));
  for (const [path, bytes] of Object.entries(unzipSync(await readFile(zip)))) {
    safePath(path); const file = join(folder, path);
    await mkdir(dirname(file), { recursive: true }); await writeFile(file, bytes);
  }
  const root = join(folder, 'NetTopo-Studio-0.1.0-beta.1');
  const run = command => {
    const result = spawnSync(process.execPath, ['runtime/tools/' + command + '.mjs'], { cwd: root, env: betaEnvironment(), windowsHide: true, encoding: 'utf8', timeout: 90000 });
    const output = JSON.parse(result.stdout.trim());
    return { exit: result.status, ...output };
  };
  const results = [];
  try {
    const setup = run('setup'); assert.equal(setup.code, 'BTA_SETUP_OK');
    const start = run('start'); assert.equal(start.code, 'BTA_STARTED');
    assert.equal(run('start').code, 'BTA_ALREADY_RUNNING');
    for (const path of ['/api/topology', '/api/session', '/api/dev/session', '/api/pilot/session', '/api/credentials', '/api/audit-logs', '/api/health/schema', '/__local_beta/status']) {
      const r = await http(path); assert.equal(r.status, 404, path); assert.equal(r.headers['cache-control'], 'no-store');
    }
    assert.equal((await http('/', { host: 'localhost:4317' })).status, 421);
    assert.equal((await http('/', { origin: 'http://example.invalid' })).status, 403);
    for (const [name, executablePath] of browserExecutables) {
      const browser = await chromium.launch({ executablePath, headless: true, args: ['--disable-background-networking', '--no-first-run'] });
      try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
        const external = [], errors = [], requests = [], responses = [], consoleErrors = [];
        await context.route('**/*', route => {
          const url = route.request().url(); requests.push(new URL(url).pathname);
          if (url.startsWith(ORIGIN + '/')) return route.continue();
          external.push(url); return route.abort();
        });
        const page = await context.newPage();
        page.on('pageerror', e => errors.push(e.name));
        page.on('response', r => responses.push({ path: new URL(r.url()).pathname, status: r.status() }));
        page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 600)); });
        const navigation = await page.goto(ORIGIN);
        try {
          assert.equal(navigation.status(), 200, 'built application navigation');
          await page.locator('[data-local-beta="true"]').waitFor({ timeout: 20000 });
        } catch (e) {
          await page.screenshot({ path: join(folder, name + '-failure.png'), fullPage: true });
          await writeFile(join(folder, name + '-failure.json'), JSON.stringify({ responses, consoleErrors, errors, body: (await page.locator('body').innerText()).slice(0, 2000) }, null, 2));
          throw e;
        }
        assert.equal(await page.getByRole('button', { name: '進入本機 Demo', exact: true }).count(), 0);
        assert.equal((await context.cookies()).length, 0);
        await page.getByRole('button', { name: '+ 新增設備', exact: true }).click();
        await page.getByLabel('設備名稱', { exact: true }).fill('Synthetic ' + name);
        await page.locator('.modal form button[type=submit], .modal-panel form button[type=submit], form.form-grid button[type=submit]').last().click();
        await page.getByText('已自動儲存', { exact: true }).waitFor();
        await page.reload();
        await page.getByText('Synthetic ' + name, { exact: true }).first().waitFor();
        await page.getByRole('button', { name: '自動整理', exact: true }).click();
        await page.getByText('已自動儲存', { exact: true }).waitFor();
        await page.evaluate(() => {
          const original = IDBObjectStore.prototype.put;
          IDBObjectStore.prototype.put = function (...args) {
            if (this.name === 'topologies') throw new DOMException('Synthetic write failure', 'QuotaExceededError');
            return original.apply(this, args);
          };
        });
        await page.getByRole('button', { name: '+ 新增設備', exact: true }).click();
        await page.getByLabel('設備名稱', { exact: true }).fill('Rejected ' + name);
        await page.locator('form.form-grid button[type=submit]').last().click();
        await page.getByText('本機儲存失敗，原資料已保留。', { exact: true }).waitFor();
        assert.equal(await page.getByText('Rejected ' + name, { exact: true }).count(), 0);
        await page.reload();
        await page.getByText('Synthetic ' + name, { exact: true }).first().waitFor();
        assert.equal(await page.getByText('Rejected ' + name, { exact: true }).count(), 0);
        await page.getByRole('button', { name: '匯出', exact: true }).click();
        page.once('dialog', d => d.accept());
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: '下載完整 JSON', exact: true }).click();
        const backup = join(folder, name + '-backup.json');
        await (await download).saveAs(backup);
        assert.ok((await stat(backup)).size > 0);
        const exported = JSON.parse(await readFile(backup, 'utf8'));
        assert.deepEqual(exported.project.devices.map(d => d.name), ['Synthetic ' + name]);
        await page.screenshot({ path: join(folder, name + '-1280.png'), fullPage: true });
        assert.deepEqual(external, []);
        assert.deepEqual(errors, []);
        assert.ok(requests.every(p => !p.startsWith('/api/') || p === '/api/runtime-capabilities'));
        results.push({ browser: name, version: browser.version(), localOnly: true, cookies: 0, saveReload: true, layout: true, failedWriteZeroMutation: true, nonemptyBackup: true });
        await context.close();
      } finally { await browser.close(); }
    }
    assert.equal(run('stop').code, 'BTA_STOPPED');
    assert.equal(run('stop').code, 'BTA_NOT_RUNNING');
    const foreign = createServer((_req, res) => res.end('synthetic unrelated listener'));
    await new Promise((r, reject) => { foreign.once('error', reject); foreign.listen(4317, '127.0.0.1', r); });
    try {
      assert.equal(run('start').code, 'BTA_PORT_IN_USE');
      assert.equal(run('stop').code, 'BTA_NOT_RUNNING');
      assert.equal(foreign.listening, true);
    } finally { await new Promise(r => foreign.close(r)); }
    const statePath = join(root, 'runtime/.state/instance.json');
    await writeFile(statePath, JSON.stringify({ schemaVersion: 1, artifactId: hash(await readFile(join(root, 'beta-manifest.json'))), instanceId: randomUUID(), pid: process.pid, processStartedAt: 'forged', origin: ORIGIN, shutdownToken: '0'.repeat(64) }));
    try { assert.equal(run('stop').code, 'BTA_OWNERSHIP_MISMATCH'); }
    finally { await unlink(statePath); }
    assert.equal(run('setup').code, 'BTA_SETUP_OK');
    const original = await readFile(join(root, 'runtime/package-lock.json'));
    await writeFile(join(root, 'runtime/package-lock.json'), Buffer.concat([original, Buffer.from(' ')]));
    try { assert.equal(run('start').code, 'BTA_ARTIFACT_INVALID'); }
    finally { await writeFile(join(root, 'runtime/package-lock.json'), original); }
  } finally {
    const cleanup = run('stop');
    await writeFile(join(folder, 'result.json'), JSON.stringify({ results, cleanup }, null, 2) + '\n');
    assert.ok(['BTA_STOPPED', 'BTA_NOT_RUNNING'].includes(cleanup.code), 'owned process cleanup');
  }
});
