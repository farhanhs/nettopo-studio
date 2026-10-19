import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { isBuiltin } from 'node:module';
import ts from 'typescript';
import { build } from 'esbuild';
import { zipSync } from 'fflate';
import { sourceFiles, root, sha256 } from './build.mjs';
import { walk, fileHash, canonicalFiles, verifyArtifact } from '../../release/beta/runtime/lib/integrity.mjs';

const VERSION = 'NetTopo-Studio-0.1.0-beta.1';
const writeJson = (path, data) => writeFile(path, JSON.stringify(data, null, 2) + '\n');
function git(...args) {
  const r = spawnSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error('BTA_SOURCE_INVALID');
  return args.includes('-z') ? r.stdout : r.stdout.trim();
}
function owned(path) { const p = resolve(path), base = join(root, '.local/bta-20261019'); if (!p.startsWith(base + '/') && !p.startsWith(base + '\\')) throw new Error('BTA_ARTIFACT_INVALID'); return p; }

export async function packageBeta(buildPath, outputPath, { documentation = true } = {}) {
  const input = owned(buildPath), output = owned(outputPath);
  const inputManifest = JSON.parse(await readFile(join(input, 'build-inputs.json'), 'utf8'));
  if (inputManifest.generatedConfigSha256 !== sha256(await readFile(join(root, 'scripts/beta/vite.config.ts')))) throw new Error('BTA_SOURCE_CHANGED');
  // Fail if any build input changed since this build; never label stale output as a new candidate.
  for (const f of inputManifest.files) if (sha256(await readFile(join(root, f.path))) !== f.sha256) throw new Error('BTA_SOURCE_CHANGED');
  await mkdir(output, { recursive: false });
  const stage = join(output, VERSION);
  await cp(join(root, 'release/beta'), stage, { recursive: true, errorOnExist: true, force: false });
  await cp(join(input, 'dist'), join(stage, 'runtime/dist'), { recursive: true });
  await mkdir(join(stage, 'runtime/public'), { recursive: true });
  await cp(join(root, 'public/favicon.svg'), join(stage, 'runtime/public/favicon.svg'));
  for (const [entry, name] of [['local-beta-request', 'request-gate'], ['runtime-policy', 'runtime-policy']]) {
    const exports = entry === 'runtime-policy' ? 'validateRuntimePolicy, runtimePolicySummary' : 'validateBetaRequest, betaSecurityHeaders';
    await build({ stdin: { contents: `export { ${exports} } from './${entry}.ts';`, resolveDir: join(root, 'app/lib/server'), loader: 'ts' }, outfile: join(stage, 'runtime/lib', name + '.mjs'), bundle: true, platform: 'node', format: 'esm', treeShaking: true, logLevel: 'silent' });
  }
  const external = new Set();
  const imports = [];
  for (const file of (await sourceFiles(join(stage, 'runtime/dist/server'))).filter(p => p.endsWith('.js'))) {
    const code = await readFile(join(stage, 'runtime/dist/server', file), 'utf8');
    const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const visit = node => {
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier?.text;
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(ast) === '__require')) {
        if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0])) throw new Error('BTA_DYNAMIC_IMPORT_UNRESOLVED');
        specifier = node.arguments[0].text;
      }
      if (specifier && !specifier.startsWith('.') && !isBuiltin(specifier)) { const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]; external.add(name); imports.push({ file, specifier }); }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  // Bundled ELK uses a scoped Browserify require, not Node's require; its optional workerUrl branch is unused.
  if ([...external].some(p => !['react', 'react-dom'].includes(p))) throw new Error('BTA_DEPENDENCY_CLOSURE_CHANGED');
  const sourceLock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
  const dependencies = Object.fromEntries([...external].sort().map(name => [name, sourceLock.packages['node_modules/' + name].version]));
  const pkg = { name: 'nettopo-local-beta-runtime', version: '0.1.0-beta.1', private: true, type: 'module', dependencies };
  const packages = { '': { name: pkg.name, version: pkg.version, dependencies } };
  const pending = [...external];
  while (pending.length) {
    const name = pending.shift(), path = 'node_modules/' + name;
    if (packages[path]) continue;
    const entry = sourceLock.packages[path];
    if (!entry || entry.hasInstallScript || entry.optionalDependencies) throw new Error('BTA_DEPENDENCY_CLOSURE_CHANGED');
    packages[path] = { ...entry }; delete packages[path].dev; delete packages[path].peer;
    pending.push(...Object.keys(entry.dependencies || {}));
  }
  const lock = { name: pkg.name, version: pkg.version, lockfileVersion: 3, requires: true, packages };
  await writeJson(join(stage, 'runtime/package.json'), pkg);
  await writeJson(join(stage, 'runtime/package-lock.json'), lock);
  if (documentation) {
    for (const name of ['QUICKSTART.zh-TW.md', 'DATA-AND-BACKUP.zh-TW.md', 'KNOWN-ISSUES.md', 'FEEDBACK.md']) await cp(join(root, 'docs/beta', name), join(stage, name));
    for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) await cp(join(root, name), join(stage, name));
    await cp(join(root, 'samples/beta'), join(stage, 'samples'), { recursive: true });
  }
  const status = git('status', '--porcelain=v1', '-z', '--untracked-files=all');
  const tracked = new Set(git('ls-files', '-z').split('\0'));
  const sourcePaths = new Set([...inputManifest.files.map(f => f.path), ...(await sourceFiles(join(root, 'scripts/beta'))).map(p => 'scripts/beta/' + p), ...(await sourceFiles(join(root, 'release/beta'))).map(p => 'release/beta/' + p)]);
  if (documentation) for (const p of [...(await sourceFiles(join(root, 'docs/beta'))).map(p => 'docs/beta/' + p), ...(await sourceFiles(join(root, 'samples/beta'))).map(p => 'samples/beta/' + p), 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md', '.github/ISSUE_TEMPLATE/beta-feedback.yml']) sourcePaths.add(p);
  const changes = new Map(status.split('\0').filter(Boolean).map(row => [row.slice(3), row.slice(0, 2)]));
  for (const path of changes.keys()) {
    if ((path.startsWith('app/') || path.startsWith('scripts/beta/') || path.startsWith('release/beta/') || ['package.json', 'package-lock.json', 'vite.config.ts', 'next.config.ts'].includes(path)) && !sourcePaths.has(path)) throw new Error('BTA_UNLISTED_SOURCE_INPUT');
  }
  const files = [];
  for (const path of [...sourcePaths].sort()) files.push({ path, status: !tracked.has(path) ? 'added' : changes.has(path) ? 'modified' : 'base', sha256: sha256(await readFile(join(root, path))) });
  const payload = await walk(stage);
  const manifest = {
    format: 'nettopo-local-beta', formatVersion: 1, appVersion: '0.1.0-beta.1', baseCommit: git('rev-parse', 'HEAD'), sourceBranch: git('branch', '--show-current'),
    sourceCandidate: { dirty: files.some(f => f.status !== 'base'), manifestSha256: sha256(JSON.stringify(files)), files },
    toolchain: { node: process.versions.node, npm: '11.16.0', producer: 'scripts/beta/package.mjs', producerSha256: sha256(await readFile(fileURLToPath(import.meta.url))) },
    supportedNode: { major: 24, min: '24.18.0', maxExclusive: '24.18.1' }, supportedWindows: ['Windows 11 Pro 10.0.26300 x64'], supportedBrowsers: [{ name: 'Chrome', minVersion: '155.0.8059.82' }, { name: 'Edge', minVersion: '155.0.4283.45' }],
    origin: 'http://127.0.0.1:4317', storage: 'indexeddb', runtimeLockSha256: sha256(await readFile(join(stage, 'runtime/package-lock.json'))), fileManifestSha256: fileHash(payload), files: payload,
    runtimeDependencies: Object.entries(packages).filter(([p]) => p).map(([p, e]) => ({ name: p.slice(13), version: e.version, integrity: e.integrity })),
    allowedLifecycleScripts: [], offlineExternalOrigins: [], createdAt: new Date().toISOString(),
  };
  if (manifest.baseCommit !== 'b5c53916cbda6f8bcd2f42f9d9772ef181c1adee' || manifest.sourceBranch !== 'codex/public-beta-0.1') throw new Error('BTA_SOURCE_INVALID');
  await writeJson(join(stage, 'beta-manifest.json'), manifest);
  const manifestBytes = await readFile(join(stage, 'beta-manifest.json'));
  const sums = canonicalFiles([...payload, { path: 'beta-manifest.json', sha256: sha256(manifestBytes) }]).map(f => `${f.sha256}  ${f.path}\n`).join('');
  await writeFile(join(stage, 'SHA256SUMS.txt'), sums);
  await verifyArtifact(stage);
  const zipFiles = {};
  for (const f of await walk(stage)) zipFiles[VERSION + '/' + f.path] = new Uint8Array(await readFile(join(stage, f.path)));
  const bytes = zipSync(zipFiles, { level: 6 });
  await writeFile(join(output, VERSION + '.zip'), bytes);
  await writeFile(join(output, VERSION + '.zip.sha256'), sha256(bytes) + '  ' + VERSION + '.zip\n');
  await writeJson(join(output, 'closure-evidence.json'), { imports, external: [...external], bundledElkScopedRequire: 'Browserify internal, workerUrl unused; packaged Browser layout test required', documentation, supportMatrix: 'QA pending' });
  return stage;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await packageBeta(process.argv[2], process.argv[3], { documentation: !process.argv.includes('--preflight') }); console.log('{"code":"BTA_PACKAGED"}'); }
  catch (e) { console.log(JSON.stringify({ code: /^BTA_/.test(e.message) ? e.message : 'BTA_PACKAGE_FAILED' })); process.exitCode = 5; }
}
