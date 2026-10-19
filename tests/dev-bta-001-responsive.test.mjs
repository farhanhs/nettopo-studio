import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { unzipSync } from 'fflate';
import { chromium } from '@playwright/test';
import { safePath, hash } from '../release/beta/runtime/lib/integrity.mjs';
import { betaEnvironment, ORIGIN } from '../release/beta/runtime/lib/environment.mjs';

test('fixed ZIP panel controls receive normal pointer events at each supported viewport', { timeout: 240000 }, async () => {
  const zip = process.env.BTA_TEST_ZIP;
  assert.ok(zip, 'BTA_TEST_ZIP is required');
  const zipBytes = await readFile(zip);
  const evidence = await mkdtemp(resolve('.local/bta-20261019/responsive-'));
  for (const [path, bytes] of Object.entries(unzipSync(zipBytes))) {
    safePath(path);
    await mkdir(dirname(join(evidence, path)), { recursive: true });
    await writeFile(join(evidence, path), bytes);
  }
  const root = join(evidence, 'NetTopo-Studio-0.1.0-beta.1');
  const run = command => {
    const r = spawnSync(process.execPath, ['runtime/tools/' + command + '.mjs'], {
      cwd: root, env: betaEnvironment(), encoding: 'utf8', windowsHide: true, timeout: 120000,
    });
    return { exit: r.status, ...JSON.parse(r.stdout.trim()) };
  };
  const observations = [], failures = [];
  try {
    assert.equal(run('setup').code, 'BTA_SETUP_OK');
    assert.equal(run('start').code, 'BTA_STARTED');
    for (const channel of ['chrome', 'msedge']) {
      const context = await chromium.launchPersistentContext(join(evidence, channel + '-profile'), {
        channel, headless: true, env: betaEnvironment(), viewport: { width: 360, height: 640 },
        serviceWorkers: 'block', args: ['--disable-background-networking', '--no-first-run'],
      });
      try {
        await context.route('**/*', route => route.request().url().startsWith(ORIGIN + '/') ? route.continue() : route.abort());
        const page = await context.newPage();
        await page.goto(ORIGIN);
        await page.locator('[data-local-beta="true"]').waitFor();
        for (const width of [360, 768, 1024, 1280]) {
          await page.setViewportSize({ width, height: width === 360 ? 640 : 900 });
          const add = page.getByRole('button', { name: '+ 新增設備', exact: true });
          await add.waitFor();
          const geometry = await add.evaluate(button => {
            const rect = button.getBoundingClientRect();
            const at = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
            const panels = [...document.querySelectorAll('.workspace-panel, .flow-shell, .react-flow')].map(el => {
              const r = el.getBoundingClientRect(), s = getComputedStyle(el), parent = el.parentElement.getBoundingClientRect();
              return { className: el.className, id: el.id, x: r.x, y: r.y, width: r.width, height: r.height,
                position: s.position, overflow: s.overflow, zIndex: s.zIndex, minWidth: s.minWidth,
                contained: r.x >= parent.x - 1 && r.right <= parent.right + 1 };
            });
            return { button: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              hit: at?.className, ownsHit: at === button || button.contains(at), panels };
          });
          let result = 'PASS';
          try {
            assert.ok(geometry.ownsHit);
            assert.ok(geometry.panels.every(p => p.contained), 'panel/canvas must stay inside its allocated parent');
            await add.click({ timeout: 2500 });
            const modal = page.getByRole('dialog');
            await modal.waitFor();
            await modal.getByRole('button', { name: '關閉', exact: true }).click();
            for (const [tab, label] of [['連線', '+ 建立連線'], ['容器', '+ 新增容器']]) {
              await page.locator('.tabs').getByRole('button', { name: tab, exact: true }).click();
              await page.getByRole('button', { name: label, exact: true }).click({ timeout: 2500 });
              await modal.waitFor();
              await modal.getByRole('button', { name: '關閉', exact: true }).click();
            }
            await page.locator('.tabs').getByRole('button', { name: '設備', exact: true }).click();
          } catch (error) { result = 'FAIL'; failures.push({ channel, width, name: error.name }); }
          await page.screenshot({ path: join(evidence, channel + '-' + width + '.png'), fullPage: true });
          observations.push({ channel, width, result, geometry });
        }
      } finally { await context.close(); }
    }
  } finally {
    const cleanup = run('stop');
    await writeFile(join(evidence, 'result.json'), JSON.stringify({ zipSha256: hash(zipBytes), observations, failures, cleanup }, null, 2));
    assert.ok(['BTA_STOPPED', 'BTA_NOT_RUNNING'].includes(cleanup.code));
    assert.equal(hash(await readFile(zip)), hash(zipBytes));
  }
  assert.deepEqual(failures, []);
});
