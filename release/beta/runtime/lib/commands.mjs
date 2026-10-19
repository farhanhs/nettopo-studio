import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir, unlink, lstat } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { request as httpRequest } from 'node:http';
import { betaEnvironment, ORIGIN, CONTROL_HEADER } from './environment.mjs';
import { verifyArtifact, verifySetup, installedTree, validateNode, validateNpm, fail } from './integrity.mjs';

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const statePath = root => join(root, 'runtime/.state/instance.json');
const delay = ms => new Promise(r => setTimeout(r, ms));
export async function stateDirectory(root) {
  const path = join(root, 'runtime/.state');
  await mkdir(path, { recursive: true });
  if ((await lstat(path)).isSymbolicLink()) fail('BTA_OWNERSHIP_MISMATCH');
  return path;
}
export async function processProof(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) fail('BTA_OWNERSHIP_MISMATCH');
  const script = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); $p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if($p){[pscustomobject]@{pid=$p.ProcessId;started=$p.CreationDate.ToUniversalTime().ToString('o');exe=$p.ExecutablePath;command=$p.CommandLine}|ConvertTo-Json -Compress}else{'null'}`;
  const ps = join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const r = spawnSync(ps, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 7000, env: betaEnvironment() });
  if (r.status !== 0) fail('BTA_OWNERSHIP_MISMATCH');
  try { return JSON.parse(r.stdout.replace(/^\uFEFF/, '').trim()); } catch { fail('BTA_OWNERSHIP_MISMATCH'); }
}
function validState(state, artifactId) {
  const fields = ['schemaVersion', 'artifactId', 'instanceId', 'pid', 'processStartedAt', 'origin', 'shutdownToken'];
  if (!state || Object.keys(state).sort().join() !== fields.sort().join() || state.schemaVersion !== 1 || state.artifactId !== artifactId || state.origin !== ORIGIN || !/^[0-9a-f-]{36}$/.test(state.instanceId) || !/^[0-9a-f]{64}$/.test(state.shutdownToken) || typeof state.processStartedAt !== 'string') fail('BTA_OWNERSHIP_MISMATCH');
}
export async function readState(root, artifactId) {
  try {
    const stat = await lstat(statePath(root));
    if (!stat.isFile() || stat.isSymbolicLink()) fail('BTA_OWNERSHIP_MISMATCH');
    const state = JSON.parse(await readFile(statePath(root), 'utf8'));
    validState(state, artifactId);
    return state;
  } catch (error) { if (error.code === 'ENOENT') return null; fail('BTA_OWNERSHIP_MISMATCH'); }
}
export async function ownerMatches(root, state) {
  const proof = await processProof(state.pid);
  if (!proof) return false;
  const entry = join(root, 'runtime/server.mjs');
  // Windows quotes only arguments that need it; accept exactly the executable and entry, never extra arguments.
  const args = /^(?:"([^"]+)"|([^\s"]+)) (?:"([^"]+)"|([^\s"]+))$/.exec(proof.command || '');
  if (proof.started !== state.processStartedAt || proof.exe?.toLowerCase() !== process.execPath.toLowerCase() ||
      !args || (args[1] || args[2]).toLowerCase() !== process.execPath.toLowerCase() ||
      (args[3] || args[4]) !== entry) fail('BTA_OWNERSHIP_MISMATCH');
  return true;
}
async function control(state, action) {
  // Node fetch adds Fetch Metadata; control requests must explicitly remain non-browser requests.
  const data = await new Promise((resolveData, reject) => {
    const req = httpRequest(`${ORIGIN}/__local_beta/${action}`, { method: action === 'shutdown' ? 'POST' : 'GET', headers: { [CONTROL_HEADER]: state.shutdownToken, 'Content-Length': '0' }, timeout: 2000 }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; if (body.length > 8192) req.destroy(new Error('BTA_OWNERSHIP_MISMATCH')); });
      res.on('end', () => { try { if (res.statusCode !== 200) throw new Error(); resolveData(JSON.parse(body)); } catch { reject(new Error('BTA_OWNERSHIP_MISMATCH')); } });
    });
    req.on('timeout', () => req.destroy(new Error('BTA_OWNERSHIP_MISMATCH')));
    req.on('error', () => reject(new Error('BTA_OWNERSHIP_MISMATCH')));
    req.end();
  });
  if (data.artifactId !== state.artifactId || data.instanceId !== state.instanceId || data.ready !== true) fail('BTA_OWNERSHIP_MISMATCH');
  return data;
}
async function portBusy() {
  return new Promise(resolve => {
    const s = createConnection({ host: '127.0.0.1', port: 4317 });
    s.setTimeout(800);
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', e => { s.destroy(); resolve(e.code !== 'ECONNREFUSED'); });
    s.once('timeout', () => { s.destroy(); resolve(true); });
  });
}
export async function setupBeta(root = packageRoot) {
  const { artifactId, manifest } = await verifyArtifact(root);
  validateNode(manifest);
  const npmRoot = join(dirname(process.execPath), 'node_modules/npm');
  let npmVersion;
  try { npmVersion = JSON.parse(await readFile(join(npmRoot, 'package.json'), 'utf8')).version; }
  catch { fail('BTA_NPM_VERSION_UNSUPPORTED'); }
  validateNpm(manifest, npmVersion);
  await stateDirectory(root);
  const state = await readState(root, artifactId);
  if (state && await ownerMatches(root, state)) fail('BTA_ALREADY_RUNNING');
  const runtime = join(root, 'runtime');
  const userConfig = join(runtime, '.state/npmrc');
  const globalConfig = join(runtime, '.state/global-npmrc');
  await writeFile(userConfig, ''); await writeFile(globalConfig, '');
  const npm = join(npmRoot, 'bin/npm-cli.js');
  const env = { ...betaEnvironment(), npm_config_userconfig: userConfig, npm_config_globalconfig: globalConfig, npm_config_cache: join(runtime, '.state/npm-cache'), npm_config_registry: 'https://registry.npmjs.org', npm_config_update_notifier: 'false' };
  const r = spawnSync(process.execPath, [npm, 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: runtime, env, windowsHide: true, encoding: 'utf8', timeout: 240000, maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) fail('BTA_DEPENDENCY_LOCK_MISMATCH');
  const treeHash = await installedTree(root, manifest);
  await writeFile(join(runtime, '.state/setup.json'), JSON.stringify({ artifactId, treeHash, node: process.versions.node, npm: npmVersion }) + '\n');
  return { code: 'BTA_SETUP_OK', message: 'Setup complete. Run start.cmd.' };
}
export async function startBeta(root = packageRoot) {
  const { artifactId } = await verifySetup(root);
  await stateDirectory(root);
  const prior = await readState(root, artifactId);
  if (prior && await ownerMatches(root, prior)) {
    await control(prior, 'status');
    return { code: 'BTA_ALREADY_RUNNING', message: 'Local Beta is ready.', origin: ORIGIN };
  }
  if (await portBusy()) fail('BTA_PORT_IN_USE');
  if (prior) await unlink(statePath(root));
  const entry = join(root, 'runtime/server.mjs');
  const child = spawn(process.execPath, [entry], { cwd: join(root, 'runtime'), env: betaEnvironment(), detached: true, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const state = { schemaVersion: 1, artifactId, instanceId: randomUUID(), pid: child.pid, processStartedAt: '', origin: ORIGIN, shutdownToken: randomBytes(32).toString('hex') };
  try {
    const ready = new Promise((resolveReady, reject) => {
      const timer = setTimeout(() => reject(new Error('BTA_START_FAILED')), 20000);
      child.once('message', message => { clearTimeout(timer); if (message?.code === 'BTA_READY') resolveReady(); else reject(new Error('BTA_START_FAILED')); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('BTA_START_FAILED')); });
      child.once('error', () => { clearTimeout(timer); reject(new Error('BTA_START_FAILED')); });
    });
    state.processStartedAt = (await processProof(child.pid))?.started;
    if (!state.processStartedAt) fail('BTA_OWNERSHIP_MISMATCH');
    child.send({ state });
    await ready;
    await writeFile(statePath(root), JSON.stringify(state) + '\n', { flag: 'wx', mode: 0o600 });
    await control(state, 'status');
    child.disconnect(); child.unref();
    return { code: 'BTA_STARTED', message: 'Local Beta is ready.', origin: ORIGIN };
  } catch {
    // Only the child created here is terminated; never an occupant discovered on the port.
    child.kill(); child.unref();
    fail('BTA_START_FAILED');
  }
}
export async function stopOwnedBeta(root = packageRoot) {
  const { artifactId } = await verifyArtifact(root);
  await stateDirectory(root);
  const state = await readState(root, artifactId);
  if (!state) return { code: 'BTA_NOT_RUNNING', message: 'No owned instance.' };
  if (!await ownerMatches(root, state)) {
    if (await portBusy()) fail('BTA_OWNERSHIP_MISMATCH');
    await unlink(statePath(root));
    return { code: 'BTA_NOT_RUNNING', message: 'Stale owned state cleared.' };
  }
  await control(state, 'status');
  await control(state, 'shutdown');
  for (let i = 0; i < 8; i++) {
    await delay(250);
    const proof = await processProof(state.pid);
    if (!proof) { await unlink(statePath(root)); return { code: 'BTA_STOPPED', message: 'Local Beta stopped. Browser data is unchanged.' }; }
    if (proof.started !== state.processStartedAt) fail('BTA_OWNERSHIP_MISMATCH');
  }
  fail('BTA_STOP_FAILED');
}
export async function runCommand(fn) {
  try { console.log(JSON.stringify(await fn())); }
  catch (error) {
    const code = /^BTA_[A-Z_]+$/.test(error?.code || '') ? error.code : 'BTA_RUNTIME_FAILED';
    console.log(JSON.stringify({ code, message: 'Operation did not complete. Check QUICKSTART.zh-TW.md.' }));
    process.exitCode = /NODE_|NPM_/.test(code) ? 2 : /PROFILE|STORAGE/.test(code) ? 3 : /OWNERSHIP|PORT_/.test(code) ? 4 : /ARTIFACT|DEPENDENCY/.test(code) ? 5 : 6;
  }
}
