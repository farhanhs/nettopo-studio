import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  assertRuntimeCommandResult,
  auditObservedUrls,
  createSafeChildEnv,
  extractValidatedZip,
  fileManifestDigest,
  inspectZip,
  locateArtifactRoot,
  normalizeArtifactPath,
  runRuntimeCommand,
  scanBuffersForSentinels,
  validateArchiveEntries,
  validateManifestShape,
  validateOwnedCleanup,
  verifyExtractedArtifact,
} from "../scripts/qa-bta/harness.mjs";

test("QA Beta artifact paths fail closed for traversal, Windows collisions, reserved names and links", () => {
  assert.equal(normalizeArtifactPath("runtime/dist/client/app.js"), "runtime/dist/client/app.js");
  for (const invalid of ["../escape", "/absolute", "C:/drive", "runtime\\bad", "runtime/CON", "runtime/trailing. ", "runtime//double"]) {
    assert.throws(() => normalizeArtifactPath(invalid), /BTA_ARTIFACT_INVALID/);
  }
  assert.throws(() => validateArchiveEntries([
    { name: "runtime/App.js", size: 1, externalAttributes: 0 },
    { name: "runtime/app.js", size: 1, externalAttributes: 0 },
  ]), /duplicate-path/);
  assert.throws(() => validateArchiveEntries([{ name: "runtime/link", size: 0, externalAttributes: 0xa000 << 16 }]), /symlink/);
});

test("QA Beta manifest canonical digest and fixed profile contract are executable", () => {
  const files = [
    { path: "runtime/server.mjs", size: 3, sha256: "a".repeat(64), mode: "file" },
    { path: "setup.cmd", size: 2, sha256: "b".repeat(64), mode: "file" },
  ];
  const manifest = {
    format: "nettopo-local-beta", formatVersion: 1, appVersion: "0.1.0-beta.1",
    baseCommit: "b5c53916cbda6f8bcd2f42f9d9772ef181c1adee", sourceBranch: "codex/public-beta-0.1",
    sourceCandidate: { dirty: true, manifestSha256: "c".repeat(64), files: [{ path: "app/page.tsx", status: "modified", sha256: "d".repeat(64) }] },
    toolchain: { node: "v24", npm: "11", producer: "scripts/beta/producer.mjs", producerSha256: "e".repeat(64) },
    supportedNode: { major: 24, min: "24.0.0", maxExclusive: "25.0.0" }, supportedWindows: ["Windows 11"], supportedBrowsers: [{ name: "Chrome", minVersion: "1" }],
    origin: "http://127.0.0.1:4317", storage: "indexeddb", runtimeLockSha256: "f".repeat(64),
    fileManifestSha256: fileManifestDigest(files), files, runtimeDependencies: [], allowedLifecycleScripts: [], offlineExternalOrigins: [], createdAt: "2026-10-19T00:00:00Z",
  };
  assert.equal(validateManifestShape(manifest), manifest);
  assert.throws(() => validateManifestShape({ ...manifest, origin: "http://localhost:4317" }));
});

test("QA Beta environment, offline audit, sentinel scan and cleanup are fail closed", () => {
  const env = createSafeChildEnv({ SystemRoot: "C:\\Windows", DATABASE_URL: "forbidden", NETTOPO_PILOT_USERS: "forbidden", PATH: "bin" });
  assert.equal(env.DATABASE_URL, undefined);
  assert.equal(env.NETTOPO_PILOT_USERS, undefined);
  assert.equal(env.NETTOPO_RUNTIME_PROFILE, "local-beta");
  assert.deepEqual(auditObservedUrls(["http://127.0.0.1:4317/", "ws://127.0.0.1:4317/socket"]), []);
  assert.deepEqual(auditObservedUrls(["https://example.com/app", "http://localhost:4317/"]), ["https://example.com/app", "http://localhost:4317/"]);
  assert.deepEqual(scanBuffersForSentinels({ dom: "safe", log: "QA_BETA_SECRET_SENTINEL" }, ["QA_BETA_SECRET_SENTINEL"]), [{ name: "log", sentinel: "QA_BETA_SECRET_SENTINEL" }]);
  assert.equal(validateOwnedCleanup({ processExited: true, portRebind: true, stateRemoved: true, tempRemoved: true, downloadsRetained: 0, profileRemoved: true }), true);
  assert.equal(validateOwnedCleanup({ processExited: true, portRebind: false, stateRemoved: true, tempRemoved: true, downloadsRetained: 0, profileRemoved: true }), false);
});

test("QA Beta ZIP inspector and extractor operate on an owned synthetic archive", async (context) => {
  if (process.platform !== "win32") return context.skip("Windows contract fixture");
  const owned = fs.mkdtempSync(path.join(os.tmpdir(), "qa-bta-001-"));
  const source = path.join(owned, "source");
  const zip = path.join(owned, "synthetic.zip");
  const extracted = path.join(owned, "中文 路徑");
  fs.mkdirSync(path.join(source, "runtime"), { recursive: true });
  fs.writeFileSync(path.join(source, "setup.cmd"), "@echo off\r\nexit /b 0\r\n");
  fs.writeFileSync(path.join(source, "runtime", "server.mjs"), "export {};\n");
  const command = `Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[System.IO.Compression.ZipFile]::Open('${zip.replaceAll("'", "''")}',[System.IO.Compression.ZipArchiveMode]::Create); try { [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z,'${path.join(source, "setup.cmd").replaceAll("'", "''")}','setup.cmd') | Out-Null; [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z,'${path.join(source, "runtime", "server.mjs").replaceAll("'", "''")}','runtime/server.mjs') | Out-Null } finally { $z.Dispose() }`;
  const made = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], { encoding: "utf8" });
  assert.equal(made.status, 0, made.stderr);
  try {
    const entries = await inspectZip(zip);
    assert.deepEqual(entries.filter(({ isDirectory }) => !isDirectory).map(({ name }) => name).sort(), ["runtime/server.mjs", "setup.cmd"]);
    await extractValidatedZip(zip, extracted);
    assert.equal(fs.readFileSync(path.join(extracted, "runtime", "server.mjs"), "utf8"), "export {};\n");
  } finally {
    fs.rmSync(owned, { recursive: true, force: true });
  }
  assert.equal(fs.existsSync(owned), false);
});

test("QA Beta extracted artifact verification checks payload, lock and checksum closure", () => {
  const owned = fs.mkdtempSync(path.join(os.tmpdir(), "qa-bta-001-manifest-"));
  const extraction = path.join(owned, "extracted");
  const artifact = path.join(extraction, "NetTopo-Studio-0.1.0-beta.1");
  fs.mkdirSync(path.join(artifact, "runtime"), { recursive: true });
  const payloads = {
    "setup.cmd": Buffer.from("@echo off\r\n"),
    "runtime/package-lock.json": Buffer.from('{"lockfileVersion":3}\n'),
    "runtime/server.mjs": Buffer.from("export {};\n"),
  };
  for (const [member, bytes] of Object.entries(payloads)) {
    const target = path.join(artifact, ...member.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  const files = Object.entries(payloads).map(([member, bytes]) => ({ path: member, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), mode: "file" }));
  const digest = fileManifestDigest(files);
  const manifest = {
    format: "nettopo-local-beta", formatVersion: 1, appVersion: "0.1.0-beta.1", baseCommit: "b5c53916cbda6f8bcd2f42f9d9772ef181c1adee", sourceBranch: "codex/public-beta-0.1",
    sourceCandidate: { dirty: true, manifestSha256: "a".repeat(64), files: [{ path: "app/page.tsx", status: "modified", sha256: "b".repeat(64) }] },
    toolchain: { node: "v24", npm: "11", producer: "scripts/beta/producer.mjs", producerSha256: "c".repeat(64) }, supportedNode: { major: 24, min: "24.0.0", maxExclusive: "25.0.0" }, supportedWindows: ["Windows 11"], supportedBrowsers: [{ name: "Chrome", minVersion: "1" }],
    origin: "http://127.0.0.1:4317", storage: "indexeddb", runtimeLockSha256: files.find(({ path: member }) => member === "runtime/package-lock.json").sha256,
    fileManifestSha256: digest, files, runtimeDependencies: [], allowedLifecycleScripts: [], offlineExternalOrigins: [], createdAt: "2026-10-19T00:00:00Z",
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`);
  fs.writeFileSync(path.join(artifact, "beta-manifest.json"), manifestBytes);
  const sums = [{ path: "beta-manifest.json", sha256: createHash("sha256").update(manifestBytes).digest("hex"), mode: "file" }, ...files]
    .map(({ sha256: hash, path: member }) => `${hash}  ${member}`).join("\n") + "\n";
  fs.writeFileSync(path.join(artifact, "SHA256SUMS.txt"), sums);
  try {
    assert.equal(locateArtifactRoot(extraction), artifact);
    assert.equal(verifyExtractedArtifact(artifact).payloadFiles.length, 3);
    fs.appendFileSync(path.join(artifact, "runtime", "server.mjs"), "tampered");
    assert.throws(() => verifyExtractedArtifact(artifact), /BTA_ARTIFACT_INVALID/);
  } finally {
    fs.rmSync(owned, { recursive: true, force: true });
  }
  assert.equal(fs.existsSync(owned), false);
});

test("QA Beta lifecycle command runner strips inherited env and cleans only owned fixture", async () => {
  const owned = fs.mkdtempSync(path.join(os.tmpdir(), "qa-bta-001-lifecycle-"));
  fs.writeFileSync(path.join(owned, "setup.cmd"), "@echo off\r\nif defined DATABASE_URL exit /b 9\r\nif not \"%NETTOPO_RUNTIME_PROFILE%\"==\"local-beta\" exit /b 8\r\necho {\"code\":\"BTA_SETUP_OK\",\"message\":\"ready\"}\r\nexit /b 0\r\n");
  fs.writeFileSync(path.join(owned, "stop.cmd"), "@echo off\r\necho {\"code\":\"BTA_NOT_RUNNING\",\"message\":\"already stopped\"}\r\nexit /b 0\r\n");
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "qa-forbidden-inherited-value";
  try {
    const setup = assertRuntimeCommandResult(await runRuntimeCommand(owned, "setup.cmd"), 0);
    assert.equal(setup.payload.code, "BTA_SETUP_OK");
    const stop = assertRuntimeCommandResult(await runRuntimeCommand(owned, "stop.cmd"), 0);
    assert.equal(stop.payload.code, "BTA_NOT_RUNNING");
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    fs.rmSync(owned, { recursive: true, force: true });
  }
  assert.equal(fs.existsSync(owned), false);
});
