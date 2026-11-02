import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { betaEnvironment } from '../release/beta/runtime/lib/environment.mjs';
import { hash, verifyArtifact } from '../release/beta/runtime/lib/integrity.mjs';
import { inspectBetaZip } from '../scripts/beta/zip.mjs';

// No product Git operations: the sole fixture commit lives in a new private .git with no remote.
test('real producer CLI builds and extracts a synthetic exact-commit package', { timeout: 240000 }, async () => {
  const product = resolve(import.meta.dirname, '..'), parent = join(product, '.local/bta-20261019');
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, 'pkg-e2e-'));
  const output = join(root, '.local/bta-20261019'), buildDir = join(output, 'build'), pkgDir = join(output, 'package');
  const env = betaEnvironment();
  const git = (...args) => execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'core.fsmonitor=false',
    '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=' + join(root, 'no-hooks'), '-c', 'user.name=Fixture',
    '-c', 'user.email=fixture@example.invalid', ...args], { cwd: root, env, windowsHide: true, encoding: 'utf8' }).trim();
  const write = async (p, value) => {
    await mkdir(dirname(join(root, p)), { recursive: true });
    await writeFile(join(root, p), value);
  };
  try {
    assert.equal(await realpath(root), root);
    git('init', '--template=', '--initial-branch=codex/public-beta-0.1');
    assert.equal(resolve(git('rev-parse', '--show-toplevel')), root);
    assert.equal(git('remote'), '');
    const copied = ['scripts/beta/package.mjs', 'scripts/beta/approved-source.mjs', 'scripts/beta/build.mjs',
      'scripts/beta/vite.config.ts', 'scripts/beta/zip.mjs', 'release/beta/runtime/lib/environment.mjs',
      'release/beta/runtime/lib/integrity.mjs', 'app/lib/server/runtime-policy.ts', 'app/lib/server/local-beta-request.ts',
      'public/favicon.svg', 'tsconfig.json', 'postcss.config.mjs', 'package.json', 'package-lock.json'];
    for (const p of copied) await write(p, await readFile(join(product, p)));
    const generated = {
      '.gitignore': '.local/\nnode_modules/\n',
      '.gitattributes': '* -text\n',
      'app/page.tsx': 'export default function Page(){return <main>Synthetic package fixture</main>}',
      'app/layout.tsx': 'export default function Layout({children}){return <html><body>{children}</body></html>}',
      'app/api/runtime-capabilities/route.ts': 'export const GET = () => Response.json({fixture:true});',
      'examples/sean-sie-spine-leaf-demo.json': '{}', 'samples/beta/fixture.json': '{"synthetic":true}',
      '.github/ISSUE_TEMPLATE/beta-feedback.yml': 'name: synthetic fixture',
      'README.md': 'Synthetic package. Not for installation.', 'LICENSE': 'fixture', 'THIRD_PARTY_NOTICES.md': 'fixture',
    };
    for (const p of ['QUICKSTART.zh-TW.md', 'DATA-AND-BACKUP.zh-TW.md', 'KNOWN-ISSUES.md', 'FEEDBACK.md']) generated['docs/beta/' + p] = 'fixture';
    for (const [p, value] of Object.entries(generated)) await write(p, value);
    git('add', '--', ...copied, ...Object.keys(generated));
    git('commit', '-qm', 'synthetic packaging test only');
    const pin = git('rev-parse', 'HEAD');
    await mkdir(output, { recursive: true });
    await mkdir(join(root, 'node_modules'));
    await cp(join(product, 'node_modules/vinext'), join(root, 'node_modules/vinext'), { recursive: true });
    const run = (...flags) => spawnSync(process.execPath, ['scripts/beta/package.mjs', buildDir, pkgDir, ...flags],
      { cwd: root, env, windowsHide: true, timeout: 180000, encoding: 'utf8' });
    for (const flags of [[], ['--approved-commit'], ['--approved-commit', 'HEAD'], ['--approved-commit', '0'.repeat(40)]]) {
      const r = run(...flags);
      assert.equal(r.status, 5); assert.match(r.stdout, /BTA_SOURCE_INVALID/);
      await assert.rejects(lstat(buildDir), { code: 'ENOENT' });
      await assert.rejects(lstat(pkgDir), { code: 'ENOENT' });
    }
    const r = run('--approved-commit', pin);
    if (r.status !== 0) {
      const log = await readFile(join(buildDir, 'build.log'), 'utf8').catch(() => '');
      assert.fail('fixture producer: ' + (r.stdout + r.stderr + log).slice(-1600));
    }
    const name = 'NetTopo-Studio-0.1.0-beta.1', archive = join(pkgDir, name + '.zip'), extract = join(output, 'unzipped');
    await mkdir(extract);
    if (process.platform === 'win32') execFileSync('tar.exe', ['-xf', archive, '-C', extract], { env, windowsHide: true });
    else execFileSync('unzip', ['-q', archive, '-d', extract], { env });
    const { manifest } = await verifyArtifact(join(extract, name));
    assert.equal(manifest.baseCommit, pin);
    assert.equal(manifest.sourceBranch, 'codex/public-beta-0.1');
    assert.equal(manifest.sourceCandidate.dirty, false);
    assert.equal(manifest.sourceCandidate.manifestSha256, hash(JSON.stringify(manifest.sourceCandidate.files)));
    for (const f of manifest.sourceCandidate.files) {
      assert.equal(f.status, 'base');
      assert.equal(f.sha256, hash(execFileSync('git', ['show', pin + ':' + f.path], { cwd: root, env, windowsHide: true })));
    }
    assert.equal(manifest.toolchain.producerSha256, hash(await readFile(join(root, 'scripts/beta/package.mjs'))));
    const bytes = await readFile(archive);
    assert.equal(await readFile(archive + '.sha256', 'utf8'), hash(bytes) + '  ' + name + '.zip\n');
    const small = inspectBetaZip(bytes).filter(e => e.path.endsWith('/vinext-server.json') && e.data.length <= 4096);
    assert.ok(small.length > 0 && small.every(e => e.method === 0));
    assert.equal(run('--approved-commit', pin).status, 5, 'must not reuse or overwrite an old build');
  } finally {
    assert.ok(root.startsWith(await realpath(parent) + sep + 'pkg-e2e-'));
    assert.equal(await realpath(root), root);
    await rm(root, { recursive: true, force: false });
  }
});
