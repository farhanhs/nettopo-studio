import { readFile, writeFile, mkdir, readdir, lstat, cp } from 'node:fs/promises';
import { resolve, relative, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { betaEnvironment } from '../../release/beta/runtime/lib/environment.mjs';
import { validateRuntimePolicy } from '../../app/lib/server/runtime-policy.ts';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function sourceFiles(folder, prefix = '') {
  const result = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error('BTA_ARTIFACT_INVALID');
    if (entry.isDirectory()) result.push(...await sourceFiles(join(folder, entry.name), path + '/'));
    else if (entry.isFile()) result.push(path);
    else throw new Error('BTA_ARTIFACT_INVALID');
  }
  return result;
}
export async function buildBeta(output) {
  const out = resolve(output);
  const owned = resolve(root, '.local/bta-20261019');
  if (!out.startsWith(owned + '/') && !out.startsWith(owned + '\\')) throw new Error('BTA_ARTIFACT_INVALID');
  await mkdir(out, { recursive: false });
  const mirror = join(out, 'source');
  await mkdir(mirror);
  const appFiles = (await sourceFiles(join(root, 'app'))).filter(p => !p.startsWith('api/') || p === 'api/runtime-capabilities/route.ts');
  const files = [...appFiles.map(p => 'app/' + p), 'package.json', 'package-lock.json', 'tsconfig.json', 'postcss.config.mjs', 'public/favicon.svg', 'examples/sean-sie-spine-leaf-demo.json'];
  const records = [];
  for (const path of files) {
    const src = join(root, path);
    if (!(await lstat(src)).isFile()) throw new Error('BTA_ARTIFACT_INVALID');
    const bytes = await readFile(src);
    await mkdir(dirname(join(mirror, path)), { recursive: true });
    await writeFile(join(mirror, path), bytes);
    records.push({ path, sha256: sha256(bytes) });
  }
  // Build tooling belongs to this Beta worktree only; it is never shipped in the ZIP.
  // Module resolution climbs to this owned worktree's node_modules; no junction is created.
  const config = await readFile(join(root, 'scripts/beta/vite.config.ts'), 'utf8');
  await writeFile(join(mirror, 'vite.config.ts'), config);
  await writeFile(join(out, 'build-inputs.json'), JSON.stringify({ files: records, generatedConfigSha256: sha256(config), excludedApiRoutes: 'all except /api/runtime-capabilities', producerSha256: sha256(await readFile(fileURLToPath(import.meta.url))) }, null, 2) + '\n');
  const env = { ...betaEnvironment(), CI: 'true' };
  validateRuntimePolicy(env);
  const result = spawnSync(process.execPath, [join(root, 'node_modules/vinext/dist/cli.js'), 'build'], { cwd: mirror, env, encoding: 'utf8', windowsHide: true, timeout: 240_000, maxBuffer: 20 * 1024 * 1024 });
  await writeFile(join(out, 'build.log'), (result.stdout || '') + (result.stderr || ''));
  if (result.status !== 0) throw new Error('BTA_BUILD_FAILED');
  await cp(join(mirror, 'dist'), join(out, 'dist'), { recursive: true, errorOnExist: true, force: false });
  await writeFile(join(out, 'build-result.json'), JSON.stringify({ code: 'BTA_BUILD_OK', noDsn: true, CI: true, node: process.version, output: relative(root, out).replaceAll('\\', '/') }) + '\n');
  return out;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await buildBeta(process.argv[2]); process.stdout.write('{"code":"BTA_BUILD_OK"}\n'); }
  catch { process.stderr.write('{"code":"BTA_BUILD_FAILED"}\n'); process.exitCode = 6; }
}
