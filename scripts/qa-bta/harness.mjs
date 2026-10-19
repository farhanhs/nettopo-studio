import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const reservedWindowsName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const driveOrAbsolute = /^(?:[a-z]:|[\\/]{1,2})/i;
const safeEnvNames = ["SystemRoot", "WINDIR", "PATH", "Path", "PATHEXT", "ComSpec", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA", "APPDATA"];

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function normalizeArtifactPath(raw) {
  assert.equal(typeof raw, "string", "BTA_ARTIFACT_INVALID:path-type");
  assert.ok(raw.length > 0 && raw.length <= 512, "BTA_ARTIFACT_INVALID:path-length");
  assert.equal(raw, raw.normalize("NFC"), "BTA_ARTIFACT_INVALID:path-nfc");
  assert.doesNotMatch(raw, driveOrAbsolute, "BTA_ARTIFACT_INVALID:path-absolute");
  assert.equal(raw.includes("\\"), false, "BTA_ARTIFACT_INVALID:path-separator");
  const parts = raw.split("/");
  assert.equal(parts.some((part) => part === "" || part === "." || part === ".."), false, "BTA_ARTIFACT_INVALID:path-segment");
  for (const part of parts) {
    assert.doesNotMatch(part, reservedWindowsName, "BTA_ARTIFACT_INVALID:path-reserved");
    assert.equal(/[. ]$/.test(part), false, "BTA_ARTIFACT_INVALID:path-trailing");
    assert.equal(/[<>:"|?*\u0000-\u001f]/.test(part), false, "BTA_ARTIFACT_INVALID:path-character");
  }
  return parts.join("/");
}

export function validateArchiveEntries(entries) {
  assert.ok(Array.isArray(entries) && entries.length > 0, "BTA_ARTIFACT_INVALID:empty-archive");
  const seen = new Set();
  const files = [];
  for (const entry of entries) {
    const directory = entry.isDirectory || String(entry.name).endsWith("/");
    const raw = directory ? String(entry.name).replace(/\/+$/, "") : String(entry.name);
    const normalized = normalizeArtifactPath(raw);
    const folded = normalized.toLocaleLowerCase("en-US");
    assert.equal(seen.has(folded), false, "BTA_ARTIFACT_INVALID:duplicate-path");
    seen.add(folded);
    const unixMode = (Number(entry.externalAttributes) >>> 16) & 0xffff;
    assert.notEqual(unixMode & 0xf000, 0xa000, "BTA_ARTIFACT_INVALID:symlink");
    assert.equal((Number(entry.externalAttributes) & 0x400) !== 0, false, "BTA_ARTIFACT_INVALID:reparse-point");
    assert.ok(Number.isSafeInteger(Number(entry.size)) && Number(entry.size) >= 0, "BTA_ARTIFACT_INVALID:size");
    if (!directory) files.push(normalized);
  }
  return files.sort(compareUtf8);
}

export function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function fileManifestDigest(files) {
  const records = [...files].sort((a, b) => compareUtf8(a.path, b.path)).map((file) => {
    const normalized = normalizeArtifactPath(file.path);
    assert.ok(Number.isSafeInteger(file.size) && file.size >= 0);
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    return `${normalized}\0${file.size}\0${file.sha256}\n`;
  });
  return sha256(Buffer.from(records.join(""), "utf8"));
}

export function validateManifestShape(manifest) {
  assert.equal(manifest.format, "nettopo-local-beta");
  assert.equal(manifest.formatVersion, 1);
  assert.equal(manifest.appVersion, "0.1.0-beta.1");
  assert.equal(manifest.sourceBranch, "codex/public-beta-0.1");
  assert.equal(manifest.origin, "http://127.0.0.1:4317");
  assert.equal(manifest.storage, "indexeddb");
  assert.deepEqual(manifest.offlineExternalOrigins, []);
  assert.equal(fileManifestDigest(manifest.files), manifest.fileManifestSha256);
  validateArchiveEntries(manifest.files.map((file) => ({ name: file.path, size: file.size, externalAttributes: 0, isDirectory: false })));
  validateArchiveEntries(manifest.sourceCandidate.files.map((file) => ({ name: file.path, size: 0, externalAttributes: 0, isDirectory: false })));
  assert.match(manifest.sourceCandidate.manifestSha256, /^[0-9a-f]{64}$/);
  assert.match(manifest.runtimeLockSha256, /^[0-9a-f]{64}$/);
  return manifest;
}

export function createSafeChildEnv(source = process.env) {
  const env = Object.fromEntries(safeEnvNames.filter((name) => source[name]).map((name) => [name, source[name]]));
  return {
    ...env,
    NODE_ENV: "production",
    NETTOPO_RUNTIME_PROFILE: "local-beta",
    NETTOPO_AUTH_MODE: "disabled",
    NEXT_PUBLIC_TOPOLOGY_STORAGE: "indexeddb",
    HOST: "127.0.0.1",
    PORT: "4317",
  };
}

export function auditObservedUrls(urls) {
  const violations = [];
  for (const raw of urls) {
    const url = new URL(raw);
    if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) continue;
    if (url.hostname !== "127.0.0.1" || url.port !== "4317" || !["http:", "ws:"].includes(url.protocol)) violations.push(raw);
  }
  return violations;
}

export function scanBuffersForSentinels(namedBuffers, sentinels) {
  const hits = [];
  for (const [name, bytes] of Object.entries(namedBuffers)) {
    const haystack = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes));
    for (const sentinel of sentinels) if (haystack.includes(Buffer.from(sentinel))) hits.push({ name, sentinel });
  }
  return hits;
}

export function validateOwnedCleanup(evidence) {
  return evidence.processExited === true
    && evidence.portRebind === true
    && evidence.stateRemoved === true
    && evidence.tempRemoved === true
    && evidence.downloadsRetained === 0
    && evidence.profileRemoved === true;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") }));
  });
}

export async function inspectZip(zipPath) {
  const result = await run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(moduleRoot, "list-zip.ps1"), "-ZipPath", path.resolve(zipPath)], { env: createSafeChildEnv() });
  assert.equal(result.code, 0, "BTA_ARTIFACT_INVALID:zip-list");
  const parsed = JSON.parse(result.stdout);
  validateArchiveEntries(parsed.entries);
  return parsed.entries;
}

export async function extractValidatedZip(zipPath, destination) {
  const entries = await inspectZip(zipPath);
  assert.equal(fs.existsSync(destination), false, "QA owned extraction destination must not pre-exist");
  fs.mkdirSync(destination, { recursive: false });
  const command = `Expand-Archive -LiteralPath '${path.resolve(zipPath).replaceAll("'", "''")}' -DestinationPath '${path.resolve(destination).replaceAll("'", "''")}' -Force`;
  const result = await run("powershell.exe", ["-NoProfile", "-Command", command], { env: createSafeChildEnv() });
  assert.equal(result.code, 0, "BTA_ARTIFACT_INVALID:zip-extract");
  return entries;
}

function walkFiles(root, current = root, output = []) {
  for (const name of fs.readdirSync(current)) {
    const absolute = path.join(current, name);
    const stat = fs.lstatSync(absolute);
    assert.equal(stat.isSymbolicLink(), false, "BTA_ARTIFACT_INVALID:extracted-link");
    if (stat.isDirectory()) walkFiles(root, absolute, output);
    else output.push(path.relative(root, absolute).replaceAll("\\", "/"));
  }
  return output;
}

function parseChecksumFile(text) {
  const records = new Map();
  for (const line of text.replaceAll("\r\n", "\n").split("\n").filter(Boolean)) {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    assert.ok(match, "BTA_ARTIFACT_INVALID:checksum-syntax");
    const member = normalizeArtifactPath(match[2]);
    const folded = member.toLocaleLowerCase("en-US");
    assert.equal(records.has(folded), false, "BTA_ARTIFACT_INVALID:checksum-duplicate");
    records.set(folded, { path: member, sha256: match[1] });
  }
  return records;
}

export function locateArtifactRoot(extractionRoot) {
  const members = fs.readdirSync(extractionRoot);
  assert.equal(members.length, 1, "BTA_ARTIFACT_INVALID:zip-root-count");
  const root = path.join(extractionRoot, members[0]);
  assert.equal(fs.lstatSync(root).isDirectory(), true, "BTA_ARTIFACT_INVALID:zip-root-type");
  return root;
}

export function verifyExtractedArtifact(artifactRoot) {
  const manifestPath = path.join(artifactRoot, "beta-manifest.json");
  const checksumsPath = path.join(artifactRoot, "SHA256SUMS.txt");
  assert.equal(fs.existsSync(manifestPath), true, "BTA_ARTIFACT_INVALID:manifest-missing");
  assert.equal(fs.existsSync(checksumsPath), true, "BTA_ARTIFACT_INVALID:checksums-missing");
  const manifestBytes = fs.readFileSync(manifestPath);
  const manifest = validateManifestShape(JSON.parse(manifestBytes.toString("utf8")));
  const actualFiles = walkFiles(artifactRoot).filter((member) => !["beta-manifest.json", "SHA256SUMS.txt"].includes(member)).sort(compareUtf8);
  const expectedFiles = manifest.files.map(({ path: member }) => member).sort(compareUtf8);
  assert.deepEqual(actualFiles, expectedFiles, "BTA_ARTIFACT_INVALID:payload-set");
  for (const file of manifest.files) {
    const bytes = fs.readFileSync(path.join(artifactRoot, ...file.path.split("/")));
    assert.equal(bytes.length, file.size, `BTA_ARTIFACT_INVALID:size:${file.path}`);
    assert.equal(sha256(bytes), file.sha256, `BTA_ARTIFACT_INVALID:hash:${file.path}`);
  }
  const lockBytes = fs.readFileSync(path.join(artifactRoot, "runtime", "package-lock.json"));
  assert.equal(sha256(lockBytes), manifest.runtimeLockSha256, "BTA_DEPENDENCY_LOCK_MISMATCH");
  const sums = parseChecksumFile(fs.readFileSync(checksumsPath, "utf8"));
  const expectedSums = [{ path: "beta-manifest.json", sha256: sha256(manifestBytes) }, ...manifest.files.map(({ path: member, sha256: hash }) => ({ path: member, sha256: hash }))];
  assert.equal(sums.size, expectedSums.length, "BTA_ARTIFACT_INVALID:checksum-set");
  for (const record of expectedSums) assert.deepEqual(sums.get(record.path.toLocaleLowerCase("en-US")), record);
  return { manifest, artifactRoot, payloadFiles: actualFiles };
}

export async function runRuntimeCommand(artifactRoot, commandName, { timeoutMs = 120_000 } = {}) {
  assert.ok(["setup.cmd", "start.cmd", "stop.cmd"].includes(commandName));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn("cmd.exe", ["/d", "/s", "/c", commandName], { cwd: artifactRoot, env: createSafeChildEnv(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"], signal: controller.signal });
      const stdout = [];
      const stderr = [];
      child.stdout.on("data", (chunk) => stdout.push(chunk));
      child.stderr.on("data", (chunk) => stderr.push(chunk));
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve({ code, signal, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") }));
    });
  } finally {
    clearTimeout(timer);
  }
}

export function assertRuntimeCommandResult(result, expectedCode) {
  assert.equal(result.code, expectedCode, `Unexpected command exit: ${result.code}`);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /postgres(?:ql)?:\/\/|password|secret|token|cookie|ciphertext|nonce/i);
  assert.equal(result.stderr.trim(), "", "Runtime command wrote stderr");
  const lines = result.stdout.replaceAll("\r\n", "\n").trim().split("\n").filter(Boolean);
  assert.equal(lines.length, 1, "Runtime command must emit exactly one JSON line");
  const payload = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(payload).sort(), Object.keys(payload).filter((key) => ["code", "message", "origin"].includes(key)).sort(), "Runtime command emitted unknown fields");
  assert.match(payload.code, /^BTA_[A-Z0-9_]+$/);
  assert.equal(typeof payload.message, "string");
  if (payload.origin !== undefined) assert.equal(payload.origin, "http://127.0.0.1:4317");
  return { ...result, payload };
}
