import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { betaEnvironment } from '../../release/beta/runtime/lib/environment.mjs';
import { fail, hash, safePath } from '../../release/beta/runtime/lib/integrity.mjs';
import { sourceFiles } from './build.mjs';

const BRANCH = 'codex/public-beta-0.1';
const R4 = 'b5c53916cbda6f8bcd2f42f9d9772ef181c1adee';
const fixedBuild = ['package.json', 'package-lock.json', 'tsconfig.json', 'postcss.config.mjs',
  'public/favicon.svg', 'examples/sean-sie-spine-leaf-demo.json'];
const fixedDocs = ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md', '.github/ISSUE_TEMPLATE/beta-feedback.yml'];
const appInput = p => p.startsWith('app/') && (!p.startsWith('app/api/') || p === 'app/api/runtime-capabilities/route.ts');
const invalid = () => fail('BTA_SOURCE_INVALID');

function git(root, ...args) {
  const r = spawnSync('git', ['--no-optional-locks', '--no-replace-objects', '-c', 'core.fsmonitor=false', ...args],
    { cwd: root, env: betaEnvironment(), encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) invalid();
  return r.stdout;
}

export function packageOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--preflight' && !Object.hasOwn(options, 'documentation')) options.documentation = false;
    else if (args[i] === '--approved-commit' && !Object.hasOwn(options, 'approvedCommit')) {
      options.approvedCommit = args[++i];
    } else invalid();
  }
  return options;
}

export function verifyRevision(root, options) {
  const approved = Object.hasOwn(options, 'approvedCommit');
  const pin = approved ? options.approvedCommit : R4;
  if (typeof pin !== 'string' || pin.length !== 40 || !/^[a-f0-9]{40}$/i.test(pin) ||
      (approved && options.documentation === false)) invalid();
  if (git(root, 'branch', '--show-current').trim() !== BRANCH ||
      git(root, 'rev-parse', 'HEAD').trim() !== pin.toLowerCase()) invalid();
  return { baseCommit: pin.toLowerCase(), sourceBranch: BRANCH };
}

async function regular(root, path, directory = false) {
  safePath(path);
  const dest = join(root, path);
  if (await realpath(dest) !== dest) invalid();
  const stat = await lstat(dest);
  if (!(directory ? stat.isDirectory() : stat.isFile())) invalid();
  return dest;
}

// Exact builds require a fresh output, not a mutable dist supplied by the caller.
export async function freshDestination(root, path) {
  const base = resolve(root, '.local/bta-20261019');
  const parent = resolve(path, '..');
  if (!resolve(path).startsWith(base + sep) || await realpath(parent) !== parent ||
      !relative(base, path) || await realpath(root) !== root) invalid();
  try { await lstat(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  invalid();
}

export async function verifyCommittedSources(root, options) {
  const revision = verifyRevision(root, options);
  if (!Object.hasOwn(options, 'approvedCommit') || await realpath(root) !== root ||
      resolve(git(root, 'rev-parse', '--show-toplevel').trim()) !== root ||
      git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none')) invalid();

  const dirs = ['app', 'scripts/beta', 'release/beta', 'docs/beta', 'samples/beta'];
  const disk = new Set([...fixedBuild, ...fixedDocs]);
  for (const dir of dirs) {
    for (const name of await sourceFiles(await regular(root, dir, true))) {
      const path = dir + '/' + name;
      if (dir !== 'app' || appInput(path)) disk.add(path);
    }
  }
  const tree = git(root, 'ls-tree', '-r', '-z', revision.baseCommit, '--', ...dirs, ...fixedBuild, ...fixedDocs);
  const files = [];
  for (const row of tree.split('\0').filter(Boolean)) {
    const [header, path] = row.split('\t');
    const [mode, type, oid] = header.split(' ');
    if (path.startsWith('app/') && !appInput(path)) continue;
    if (!disk.delete(path) || type !== 'blob' || !['100644', '100755'].includes(mode)) invalid();
    const bytes = await readFile(await regular(root, path));
    // Compare raw bytes to the committed blob, even with assume-unchanged/autocrlf.
    const blob = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    if (blob !== oid) fail('BTA_SOURCE_CHANGED');
    files.push({ path, status: 'base', sha256: hash(bytes) });
  }
  if (disk.size) invalid(); // Includes ignored extras and required-but-untracked files.
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { ...revision, files };
}

export function verifyBuildInputs(manifest, source) {
  const sums = new Map(source.files.map(f => [f.path, f.sha256]));
  const needed = new Set([...sums.keys()].filter(p => appInput(p) || fixedBuild.includes(p)));
  if (!Array.isArray(manifest?.files) ||
      !sums.has('scripts/beta/build.mjs') || manifest.producerSha256 !== sums.get('scripts/beta/build.mjs') ||
      !sums.has('scripts/beta/vite.config.ts') || manifest.generatedConfigSha256 !== sums.get('scripts/beta/vite.config.ts')) invalid();
  for (const f of manifest.files) {
    if (!needed.delete(f?.path) || sums.get(f.path) !== f.sha256) fail('BTA_SOURCE_CHANGED');
  }
  if (needed.size) fail('BTA_SOURCE_CHANGED');
}
