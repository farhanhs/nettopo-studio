import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { processProof, ownerMatches } from '../release/beta/runtime/lib/commands.mjs';
import { betaEnvironment } from '../release/beta/runtime/lib/environment.mjs';

test('Windows process ownership preserves a Traditional Chinese path exactly', { skip: process.platform !== 'win32' }, async () => {
  const parent = resolve('.local/bta-20261019');
  await mkdir(parent, { recursive: true });
  const dir = await mkdtemp(join(parent, 'process-proof-中文 空白-'));
  const entry = join(dir, 'hold.mjs');
  await writeFile(entry, 'setInterval(() => {}, 1000);\n');
  const child = spawn(process.execPath, [entry], { env: betaEnvironment(), windowsHide: true, stdio: 'ignore' });
  try {
    const proof = await processProof(child.pid);
    assert.equal(proof.pid, child.pid);
    assert.ok(proof.started);
    assert.equal(proof.command.includes(entry), true, 'CIM command must preserve the entry path bytes');
    assert.equal(proof.exe.toLowerCase(), process.execPath.toLowerCase());
  } finally {
    const exited = new Promise(r => child.once('exit', r));
    child.kill(); await exited;
  }
});

for (const label of ['ascii-', '中文 空白-']) test(`owned server entry proof supports ${label}`, { skip: process.platform !== 'win32' }, async () => {
  const dir = await mkdtemp(resolve('.local/bta-20261019/ownership-' + label));
  await mkdir(join(dir, 'runtime'));
  const entry = join(dir, 'runtime/server.mjs');
  await writeFile(entry, 'setInterval(() => {}, 1000);\n');
  const child = spawn(process.execPath, [entry], { env: betaEnvironment(), windowsHide: true, stdio: 'ignore' });
  try {
    const proof = await processProof(child.pid);
    assert.equal(await ownerMatches(dir, { pid: child.pid, processStartedAt: proof.started }), true);
    await assert.rejects(ownerMatches(dir, { pid: child.pid, processStartedAt: 'forged' }), /BTA_OWNERSHIP_MISMATCH/);
    await assert.rejects(ownerMatches(join(dir, 'other'), { pid: child.pid, processStartedAt: proof.started }), /BTA_OWNERSHIP_MISMATCH/);
  } finally {
    const exited = new Promise(r => child.once('exit', r));
    child.kill(); await exited;
  }
});

test('ownership rejects an otherwise matching entry with extra arguments', { skip: process.platform !== 'win32' }, async () => {
  const dir = await mkdtemp(resolve('.local/bta-20261019/ownership-extra-'));
  await mkdir(join(dir, 'runtime'));
  const entry = join(dir, 'runtime/server.mjs');
  await writeFile(entry, 'setInterval(() => {}, 1000);\n');
  const child = spawn(process.execPath, [entry, '--unexpected'], { env: betaEnvironment(), windowsHide: true, stdio: 'ignore' });
  try {
    const proof = await processProof(child.pid);
    await assert.rejects(ownerMatches(dir, { pid: child.pid, processStartedAt: proof.started }), /BTA_OWNERSHIP_MISMATCH/);
  } finally {
    const exited = new Promise(r => child.once('exit', r));
    child.kill(); await exited;
  }
});
