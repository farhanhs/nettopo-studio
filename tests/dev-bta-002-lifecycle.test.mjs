import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { request, createServer } from 'node:http';
import { unzipSync } from 'fflate';
import { betaEnvironment, ORIGIN } from '../release/beta/runtime/lib/environment.mjs';
import { safePath, hash, canonicalFiles } from '../release/beta/runtime/lib/integrity.mjs';

const evidence = resolve('.local/bta-20261019');
const zipPath = process.env.BTA_TEST_ZIP;
async function extract(label) {
  assert.ok(zipPath, 'BTA_TEST_ZIP must name the fixed candidate');
  await mkdir(evidence, { recursive: true });
  const folder = await mkdtemp(join(evidence, 'lifecycle-' + label));
  for (const [path, bytes] of Object.entries(unzipSync(await readFile(zipPath)))) {
    safePath(path);
    await mkdir(dirname(join(folder, path)), { recursive: true });
    await writeFile(join(folder, path), bytes);
  }
  return { folder, root: join(folder, 'NetTopo-Studio-0.1.0-beta.1') };
}
const run = (root, command) => {
  const r = spawnSync(process.execPath, ['runtime/tools/' + command + '.mjs'], {
    cwd: root, env: betaEnvironment(), windowsHide: true, encoding: 'utf8', timeout: 120000,
  });
  return { exit: r.status, ...JSON.parse(r.stdout.trim()) };
};
const get = (path, headers = {}) => new Promise((resolveResponse, reject) => {
  const req = request(ORIGIN + path, { headers, timeout: 5000 }, res => {
    let body = '';
    res.on('data', b => body += b);
    res.on('end', () => resolveResponse({ status: res.statusCode, body, headers: res.headers }));
  });
  req.on('error', reject);
  req.on('timeout', () => req.destroy(new Error('HTTP_TIMEOUT')));
  req.end();
});

// No browser launch or profile access: independent Browser QA is a separate blocked gate.
for (const label of ['ascii-', '中文 空白-']) test('fixed ZIP lifecycle: ' + label, { timeout: 240000 }, async () => {
  const before = hash(await readFile(zipPath));
  const { root, folder } = await extract(label);
  const results = [];
  const check = (command, expected) => {
    const result = run(root, command);
    results.push({ command, ...result });
    assert.equal(result.exit, 0);
    assert.equal(result.code, expected);
  };
  try {
    check('setup', 'BTA_SETUP_OK');
    const marker = JSON.parse(await readFile(join(root, 'runtime/.state/setup.json'), 'utf8'));
    assert.equal(marker.npm, '11.16.0');
    check('start', 'BTA_STARTED');
    check('start', 'BTA_ALREADY_RUNNING');
    const caps = await get('/api/runtime-capabilities', {
      'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty',
    });
    assert.equal(caps.status, 200);
    assert.equal(caps.headers['cache-control'], 'no-store');
    for (const path of ['/api/session', '/api/topology', '/api/credentials', '/__local_beta/status']) {
      assert.equal((await get(path)).status, 404);
    }
    assert.equal((await get('/', { host: 'localhost:4317' })).status, 421);
    assert.equal((await get('/', { origin: 'https://example.invalid' })).status, 403);
    check('stop', 'BTA_STOPPED');
    check('stop', 'BTA_NOT_RUNNING');
    check('setup', 'BTA_SETUP_OK');
    const foreign = createServer((_req, res) => res.end('owned fixture, not Beta'));
    await new Promise((r, reject) => { foreign.once('error', reject); foreign.listen(4317, '127.0.0.1', r); });
    try {
      assert.equal(run(root, 'start').code, 'BTA_PORT_IN_USE');
      check('stop', 'BTA_NOT_RUNNING');
      assert.equal(foreign.listening, true);
    } finally { await new Promise(r => foreign.close(r)); }
  } finally {
    const cleanup = run(root, 'stop');
    await writeFile(join(folder, 'result.json'), JSON.stringify({ results, cleanup, zipSha256: before, browser: 'NOT RUN' }, null, 2));
    assert.ok(['BTA_STOPPED', 'BTA_NOT_RUNNING'].includes(cleanup.code));
    assert.equal(hash(await readFile(zipPath)), before);
  }
});

test('fixed package npm gate rejects incompatible prerequisites before installation', { timeout: 60000 }, async () => {
  const { root, folder } = await extract('npm-gate-');
  const { validateNpm } = await import(pathToFileURL(join(root, 'runtime/lib/integrity.mjs')));
  const manifestPath = join(root, 'beta-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  validateNpm(manifest, '11.16.0');
  for (const version of ['11.15.9', '11.16.1', 'not-semver', undefined]) {
    assert.throws(() => validateNpm(manifest, version), { code: 'BTA_NPM_VERSION_UNSUPPORTED' });
  }
  const results = [];
  // Synthetic re-signed fixtures exercise the actual setup command without changing installed npm.
  for (const npm of ['11.15.9', '11.16.1', 'not-semver', undefined]) {
    const changed = { ...manifest, toolchain: { ...manifest.toolchain, npm } };
    const bytes = JSON.stringify(changed, null, 2) + '\n';
    await writeFile(manifestPath, bytes);
    await writeFile(join(root, 'SHA256SUMS.txt'), canonicalFiles([...manifest.files, {
      path: 'beta-manifest.json', sha256: hash(bytes),
    }]).map(f => `${f.sha256}  ${f.path}\n`).join(''));
    const result = run(root, 'setup');
    assert.equal(result.code, 'BTA_NPM_VERSION_UNSUPPORTED');
    assert.equal(result.exit, 2);
    await assert.rejects(access(join(root, 'runtime/node_modules')), { code: 'ENOENT' });
    await assert.rejects(access(join(root, 'runtime/.state')), { code: 'ENOENT' });
    results.push({ expectedNpm: npm ?? 'absent', ...result });
  }
  await writeFile(join(folder, 'result.json'), JSON.stringify({ results, zeroInstall: true }, null, 2));
});
