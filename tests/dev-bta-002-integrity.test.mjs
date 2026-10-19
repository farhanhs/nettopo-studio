import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { safePath, fileHash, canonicalFiles, hash, walk, verifyArtifact, validateNode, validateNpm } from '../release/beta/runtime/lib/integrity.mjs';
import { betaEnvironment } from '../release/beta/runtime/lib/environment.mjs';

test('payload paths reject traversal, Windows aliases, Unicode and case collisions', async () => {
  for (const path of ['../x', '/x', 'C:/x', 'a\\b', 'con', 'NUL.txt', 'a/../b', 'a//b', 'a.', 'x ', 'e\u0301.txt']) assert.throws(() => safePath(path));
  assert.equal(safePath('runtime/dist/a.js'), 'runtime/dist/a.js');
  const files = [{ path: 'z', size: 1, sha256: hash('x') }, { path: 'a', size: 2, sha256: hash('yy') }];
  assert.equal(fileHash(files), fileHash([...files].reverse()));
});

test('child environment never inherits database, identity, npm config or arbitrary input', () => {
  const result = betaEnvironment({ SystemRoot: 'C:\\Windows', DATABASE_URL: 'sentinel', NETTOPO_PILOT_USERS: 'sentinel', NODE_OPTIONS: 'sentinel', NODE_PATH: 'sentinel', npm_config_userconfig: 'sentinel', RANDOM: 'sentinel' });
  assert.equal(Object.values(result).includes('sentinel'), false);
  assert.equal(result.PORT, '4317'); assert.equal(result.NETTOPO_AUTH_MODE, 'disabled');
});

test('exact tested Node interval rejects old/new and other platforms', () => {
  const m = { supportedNode: { min: '24.18.0', maxExclusive: '24.18.1' } };
  validateNode(m, '24.18.0', 'win32', 'x64');
  for (const v of ['22.13.0', '24.17.0', '24.18.1', '25.0.0']) assert.throws(() => validateNode(m, v, 'win32', 'x64'), /BTA_NODE_VERSION_UNSUPPORTED/);
  assert.throws(() => validateNode(m, '24.18.0', 'linux', 'x64'));
});

test('manifest verifies bytes and rejects extra, missing, changed and duplicate members', async () => {
  const parent = resolve('.local/bta-20261019'); await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, 'integrity-'));
  await mkdir(join(root, 'runtime'));
  await writeFile(join(root, 'runtime/package.json'), JSON.stringify({ dependencies: {} }));
  const lockBytes = JSON.stringify({ packages: { '': { dependencies: {} } } });
  await writeFile(join(root, 'runtime/package-lock.json'), lockBytes);
  const files = await walk(root);
  const m = { format: 'nettopo-local-beta', formatVersion: 1, appVersion: '0.1.0-beta.1', origin: 'http://127.0.0.1:4317', storage: 'indexeddb', files, fileManifestSha256: fileHash(files), runtimeLockSha256: hash(lockBytes), runtimeDependencies: [], allowedLifecycleScripts: [], offlineExternalOrigins: [] };
  const manifest = JSON.stringify(m);
  await writeFile(join(root, 'beta-manifest.json'), manifest);
  await writeFile(join(root, 'SHA256SUMS.txt'), canonicalFiles([...files, { path: 'beta-manifest.json', sha256: hash(manifest) }]).map(f => `${f.sha256}  ${f.path}\n`).join(''));
  assert.equal((await verifyArtifact(root)).artifactId, hash(manifest));
  await writeFile(join(root, 'unexpected.txt'), 'x');
  await assert.rejects(verifyArtifact(root), /BTA_ARTIFACT_INVALID/);
  assert.equal(await readFile(join(root, 'runtime/package-lock.json'), 'utf8'), lockBytes);
});

test('npm prerequisite accepts only the exact manifest version', () => {
  const manifest = { toolchain: { npm: '11.16.0' } };
  validateNpm(manifest, '11.16.0');
  for (const version of ['11.15.9', '11.16.1', '12.0.0', '', '11.16', 'v11.16.0', '11.16.0-beta', ' 11.16.0', '011.16.0', null, undefined, 11]) {
    assert.throws(() => validateNpm(manifest, version), { code: 'BTA_NPM_VERSION_UNSUPPORTED' });
  }
  for (const npm of [undefined, 'latest', '11.16.0-beta']) {
    assert.throws(() => validateNpm({ toolchain: { npm } }, '11.16.0'), { code: 'BTA_NPM_VERSION_UNSUPPORTED' });
  }
});
