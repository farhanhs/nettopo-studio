import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { betaEnvironment } from '../release/beta/runtime/lib/environment.mjs';
import { freshDestination, packageOptions, verifyBuildInputs, verifyCommittedSources, verifyRevision } from '../scripts/beta/approved-source.mjs';
import { createBetaZip, inspectBetaZip } from '../scripts/beta/zip.mjs';

const product = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const parent = join(product, '.local/bta-20261019');
const env = betaEnvironment();
let suite, template, pin, snapshot, inputs;
const buildPaths = ['app/page.tsx', 'app/api/runtime-capabilities/route.ts', 'package.json',
  'package-lock.json', 'tsconfig.json', 'postcss.config.mjs', 'public/favicon.svg', 'examples/sean-sie-spine-leaf-demo.json'];
const synthetic = [...buildPaths, 'app/api/private/route.ts', 'scripts/beta/build.mjs', 'scripts/beta/vite.config.ts',
  'scripts/beta/package.mjs', 'scripts/beta/zip.mjs', 'release/beta/hello.json', 'docs/beta/guide.md',
  'samples/beta/example.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md', '.github/ISSUE_TEMPLATE/beta-feedback.yml'];
const git = (cwd, ...args) => execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'core.autocrlf=false',
  '-c', 'user.name=Synthetic fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false',
  '-c', 'core.hooksPath=' + join(suite, 'no-hooks'), ...args], { cwd, env, windowsHide: true, encoding: 'utf8' }).trim();

before(async () => {
  await mkdir(parent, { recursive: true });
  suite = await mkdtemp(join(parent, 'dev-approved-source-fixture-'));
  assert.equal(await realpath(suite), suite);
  template = join(suite, 'template');
  await mkdir(template);
  git(template, 'init', '--template=', '--initial-branch=codex/public-beta-0.1');
  assert.equal(resolve(git(template, 'rev-parse', '--show-toplevel')), template);
  await writeFile(join(template, '.gitignore'), '.local/\n*.ignored\n');
  for (const path of synthetic) {
    await mkdir(dirname(join(template, path)), { recursive: true });
    await writeFile(join(template, path), 'synthetic ' + path + '\n');
  }
  // Only synthetic strings enter this disposable repository; never use the product index.
  git(template, 'add', '--', '.gitignore', ...synthetic);
  git(template, 'commit', '-qm', 'synthetic source fixture');
  pin = git(template, 'rev-parse', 'HEAD');
  snapshot = await verifyCommittedSources(template, { approvedCommit: pin });
  const sums = new Map(snapshot.files.map(f => [f.path, f.sha256]));
  inputs = { generatedConfigSha256: sums.get('scripts/beta/vite.config.ts'), producerSha256: sums.get('scripts/beta/build.mjs'),
    files: buildPaths.map(path => ({ path, sha256: sums.get(path) })) };
});

after(async () => {
  if (!suite) return;
  assert.ok(suite.startsWith(await realpath(parent) + sep + 'dev-approved-source-fixture-'));
  assert.equal(await realpath(suite), suite);
  await rm(suite, { recursive: true, force: false });
});

test('approved verified fixture matches every input and survives actual ZIP extraction', async () => {
  assert.equal(snapshot.baseCommit, pin);
  assert.equal(snapshot.sourceBranch, 'codex/public-beta-0.1');
  assert.deepEqual(snapshot.files.map(f => f.path), synthetic.filter(p => p !== 'app/api/private/route.ts').sort());
  assert.ok(snapshot.files.every(f => f.status === 'base'));
  verifyBuildInputs(inputs, snapshot);
  const entries = [];
  for (const f of snapshot.files) entries.push({ path: f.path, data: await readFile(join(template, f.path)) });
  const zip = createBetaZip(entries);
  assert.ok(inspectBetaZip(zip).filter(f => f.path.endsWith('.json')).every(f => f.method === 0));
  const archive = join(suite, 'synthetic.zip'), extracted = join(suite, 'extract');
  await writeFile(archive, zip);
  await mkdir(extracted);
  // On Windows bsdtar supports ZIP; use the platform unzip on other developer hosts.
  if (process.platform === 'win32') execFileSync('tar.exe', ['-xf', archive, '-C', extracted], { env, windowsHide: true });
  else execFileSync('unzip', ['-q', archive, '-d', extracted], { env });
  for (const f of entries) assert.deepEqual(await readFile(join(extracted, f.path)), f.data);
});

test('absence is legacy R4, not approval of the current HEAD; malformed requests fail closed', () => {
  const cli = args => verifyRevision(template, packageOptions(args));
  for (const args of [[], ['--preflight'], ['--approved-commit'], ['--approved-commit', ''], ['--approved-commit', 'HEAD'],
    ['--approved-commit', pin.slice(0, 8)], ['--approved-commit', '0'.repeat(40)], ['--approved-commit', pin + '\n'],
    ['--other'], ['--approved-commit', pin, '--approved-commit', pin], ['--approved-commit', pin, '--preflight']]) {
    assert.throws(() => cli(args), { code: 'BTA_SOURCE_INVALID' });
  }
  assert.equal(cli(['--approved-commit', pin]).baseCommit, pin);
});

for (const change of ['wrong branch', 'missing', 'extra', 'ignored extra', 'modified', 'index only', 'raw byte drift']) {
  test('reject ' + change + ' in an owned Git fixture', async () => {
    const dir = join(suite, change);
    await cp(template, dir, { recursive: true });
    assert.equal(resolve(git(dir, 'rev-parse', '--show-toplevel')), dir);
    const file = join(dir, 'app/page.tsx'), original = await readFile(file);
    if (change === 'wrong branch') git(dir, 'branch', '-m', 'wrong');
    if (change === 'missing') await unlink(file);
    if (change === 'extra') await writeFile(join(dir, 'samples/beta/add.json'), '{}');
    if (change === 'ignored extra') await writeFile(join(dir, 'release/beta/hidden.ignored'), 'x');
    if (change === 'modified') await writeFile(file, 'different');
    if (change === 'index only') {
      await writeFile(file, 'stage this fixture only'); git(dir, 'add', '--', 'app/page.tsx'); await writeFile(file, original);
    }
    if (change === 'raw byte drift') {
      git(dir, 'update-index', '--assume-unchanged', '--', 'app/page.tsx');
      await writeFile(file, original.toString().replaceAll('\n', '\r\n'));
    }
    await assert.rejects(verifyCommittedSources(dir, { approvedCommit: pin }), /BTA_SOURCE_(INVALID|CHANGED)/);
  });
}

test('input list is checked against the whole committed build set, not caller-selected rows', () => {
  const first = inputs.files[0];
  for (const files of [[], inputs.files.slice(1), [...inputs.files, first], [...inputs.files, { ...first, path: '../x' }],
    inputs.files.map((f, i) => i === 0 ? { ...f, sha256: '0'.repeat(64) } : f)]) {
    assert.throws(() => verifyBuildInputs({ ...inputs, files }, snapshot), /BTA_SOURCE_CHANGED/);
  }
  for (const field of ['producerSha256', 'generatedConfigSha256']) {
    assert.throws(() => verifyBuildInputs({ ...inputs, [field]: '0'.repeat(64) }, snapshot), /BTA_SOURCE_INVALID/);
  }
});

test('prebuilt directories cannot be silently relabelled, including under ignored output', async () => {
  const output = join(template, '.local/bta-20261019/new');
  await mkdir(dirname(output), { recursive: true });
  await freshDestination(template, output);
  await mkdir(output);
  await assert.rejects(freshDestination(template, output), /BTA_SOURCE_INVALID/);
  await assert.rejects(freshDestination(template, join(suite, 'escape')), /BTA_SOURCE_INVALID/);
});
