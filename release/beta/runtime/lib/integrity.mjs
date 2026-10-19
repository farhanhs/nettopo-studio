import { readFile, readdir, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function fail(code = 'BTA_ARTIFACT_INVALID') { throw Object.assign(new Error(code), { code }); }
export function safePath(path) {
  if (typeof path !== 'string' || path !== path.normalize('NFC') || !path || /[\\:\x00-\x1f]/.test(path) || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) fail();
  return path;
}
export const canonicalFiles = files => [...files].sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
export const fileHash = files => hash(canonicalFiles(files).map(f => `${f.path}\0${f.size}\0${f.sha256}\n`).join(''));
export async function walk(root, prefix = '', exclusions = new Set()) {
  const files = [];
  for (const item of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = safePath(prefix + item.name);
    const stat = await lstat(join(root, path));
    if (stat.isSymbolicLink()) fail();
    if (exclusions.has(path)) { if (!stat.isDirectory()) fail(); continue; }
    if (stat.isDirectory()) files.push(...await walk(root, path + '/', exclusions));
    else if (stat.isFile()) files.push({ path, size: stat.size, sha256: hash(await readFile(join(root, path))), mode: 'file' });
    else fail();
  }
  const seen = new Set();
  for (const f of files) { const key = f.path.toLowerCase(); if (seen.has(key)) fail(); seen.add(key); }
  return canonicalFiles(files);
}
export async function json(path) { try { return JSON.parse(await readFile(path, 'utf8')); } catch { fail(); } }
export async function verifyArtifact(root) {
  if ((await lstat(root)).isSymbolicLink()) fail();
  const bytes = await readFile(join(root, 'beta-manifest.json'));
  const m = JSON.parse(bytes.toString('utf8'));
  if (m.format !== 'nettopo-local-beta' || m.formatVersion !== 1 || m.appVersion !== '0.1.0-beta.1' || m.origin !== 'http://127.0.0.1:4317' || m.storage !== 'indexeddb' || !Array.isArray(m.files) || !Array.isArray(m.allowedLifecycleScripts) || m.allowedLifecycleScripts.length || m.offlineExternalOrigins?.length !== 0) fail();
  const actual = (await walk(root, '', new Set(['runtime/node_modules', 'runtime/.state']))).filter(f => !['beta-manifest.json', 'SHA256SUMS.txt'].includes(f.path));
  if (JSON.stringify(actual) !== JSON.stringify(canonicalFiles(m.files)) || fileHash(actual) !== m.fileManifestSha256) fail();
  const expectedSums = canonicalFiles([...actual, { path: 'beta-manifest.json', sha256: hash(bytes) }]).map(f => `${f.sha256}  ${f.path}\n`).join('');
  if (await readFile(join(root, 'SHA256SUMS.txt'), 'utf8') !== expectedSums) fail();
  const lockBytes = await readFile(join(root, 'runtime/package-lock.json'));
  if (hash(lockBytes) !== m.runtimeLockSha256) fail('BTA_DEPENDENCY_LOCK_MISMATCH');
  const pkg = await json(join(root, 'runtime/package.json'));
  const lock = JSON.parse(lockBytes.toString('utf8'));
  if (pkg.scripts && Object.keys(pkg.scripts).length || JSON.stringify(pkg.dependencies) !== JSON.stringify(lock.packages?.['']?.dependencies)) fail('BTA_DEPENDENCY_LOCK_MISMATCH');
  const entries = Object.entries(lock.packages).filter(([p]) => p);
  if (entries.length !== m.runtimeDependencies.length) fail('BTA_DEPENDENCY_LOCK_MISMATCH');
  for (const [p, entry] of entries) {
    if (!p.startsWith('node_modules/') || !entry.integrity || !/^https:\/\/registry\.npmjs\.org\//.test(entry.resolved)) fail('BTA_DEPENDENCY_LOCK_MISMATCH');
    const d = m.runtimeDependencies.find(d => d.name === p.slice(13) && d.version === entry.version && d.integrity === entry.integrity);
    if (!d) fail('BTA_DEPENDENCY_LOCK_MISMATCH');
  }
  return { manifest: m, artifactId: hash(bytes), root: resolve(root) };
}
export function validateNode(m, version = process.versions.node, platform = process.platform, arch = process.arch) {
  const toParts = v => v.split('.').map(Number);
  const compare = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  if (platform !== 'win32' || arch !== 'x64' || !/^\d+\.\d+\.\d+$/.test(version) || compare(toParts(version), toParts(m.supportedNode.min)) < 0 || compare(toParts(version), toParts(m.supportedNode.maxExclusive)) >= 0) fail('BTA_NODE_VERSION_UNSUPPORTED');
}
export function validateNpm(manifest, version) {
  const exactVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  if (typeof version !== 'string' || !exactVersion.test(version) ||
      typeof manifest.toolchain?.npm !== 'string' || !exactVersion.test(manifest.toolchain.npm) ||
      version !== manifest.toolchain.npm) fail('BTA_NPM_VERSION_UNSUPPORTED');
}
export async function installedTree(root, manifest) {
  for (const dep of manifest.runtimeDependencies) {
    const pkg = await json(join(root, 'runtime/node_modules', dep.name, 'package.json'));
    if (pkg.name !== dep.name || pkg.version !== dep.version) fail('BTA_DEPENDENCY_LOCK_MISMATCH');
  }
  return fileHash(await walk(join(root, 'runtime/node_modules')));
}
export async function verifySetup(root) {
  const verified = await verifyArtifact(root);
  validateNode(verified.manifest);
  let marker;
  try { marker = await json(join(root, 'runtime/.state/setup.json')); } catch { fail('BTA_RUNTIME_NOT_SETUP'); }
  validateNpm(verified.manifest, marker.npm);
  if (marker.artifactId !== verified.artifactId || marker.node !== process.versions.node || marker.treeHash !== await installedTree(root, verified.manifest)) fail('BTA_DEPENDENCY_LOCK_MISMATCH');
  return verified;
}
