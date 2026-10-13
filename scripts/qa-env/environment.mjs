import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
export const policy = JSON.parse(await readFile(new URL("./policy.json", import.meta.url), "utf8"));

// Never forward DB, DUS, NODE_OPTIONS, proxy or Compose settings from a developer shell.
export function isolatedEnvironment(source = process.env) {
  const allowed = new Set(["path", "systemroot", "windir", "comspec", "temp", "tmp", "tmpdir", "pathext"]);
  const result = {};
  for (const [key, value] of Object.entries(source)) {
    if (allowed.has(key.toLowerCase()) && typeof value === "string") result[key] = value;
  }
  return { ...result, TZ: "UTC", LANG: "C", LC_ALL: "C", NO_COLOR: "1" };
}

export function selectNativeCase(id) {
  if (!Object.hasOwn(policy.nativeCases, id)) throw new Error("Unknown approved native case ID.");
  return policy.nativeCases[id];
}

export function fingerprint(manifest) {
  return createHash("sha256").update(JSON.stringify(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))).digest("hex");
}

async function candidateManifest(root) {
  const manifest = {};
  async function walk(relative) {
    const absolute = path.join(root, relative);
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) throw new Error("Candidate contains a symbolic link; explicit review required.");
    if (stat.isDirectory()) {
      for (const name of (await readdir(absolute)).sort()) {
        if (!name.startsWith(".")) await walk(path.join(relative, name));
      }
    } else if (stat.isFile()) {
      manifest[relative.replaceAll("\\", "/")] = createHash("sha256").update(await readFile(absolute)).digest("hex");
    }
  }
  // Source/dependencies only: never traverse .env, .local, logs or user data.
  for (const relative of ["package.json", "package-lock.json", "app", "db", "scripts", "tests", "vite.config.ts", "tsconfig.json"]) {
    if (existsSync(path.join(root, relative))) await walk(relative);
  }
  return manifest;
}

async function versionProbe(file, args, pattern) {
  try {
    const { stdout } = await execFileAsync(file, args, {
      cwd: repoRoot, env: isolatedEnvironment(), windowsHide: true, timeout: 5000, maxBuffer: 32_768,
    });
    const match = stdout.match(pattern);
    return match ? { status: "AVAILABLE", version: match[1] } : { status: "UNRECOGNIZED" };
  } catch {
    // Never relay stderr, process environment, command credentials or daemon metadata.
    return { status: "UNAVAILABLE" };
  }
}

export async function dependencyParity(root = repoRoot) {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
  const discrepancies = [];
  const versions = {};
  for (const group of ["dependencies", "devDependencies"]) {
    const declared = pkg[group] ?? {};
    const locked = lock.packages?.[""]?.[group] ?? {};
    for (const name of new Set([...Object.keys(declared), ...Object.keys(locked)])) {
      if (declared[name] !== locked[name]) discrepancies.push({ name, issue: "MANIFEST_LOCK_MISMATCH" });
      const expected = lock.packages?.[`node_modules/${name}`]?.version;
      let installed;
      try {
        installed = JSON.parse(await readFile(path.join(root, "node_modules", name, "package.json"), "utf8")).version;
      } catch { /* missing package is a readiness failure, not an installation request */ }
      versions[name] = { locked: expected ?? null, installed: installed ?? null };
      if (!expected || installed !== expected) discrepancies.push({ name, issue: "INSTALLED_LOCK_MISMATCH" });
    }
  }
  return { status: discrepancies.length ? "MISMATCH" : "MATCH", discrepancies, versions };
}

async function fixtureDirectoryCount() {
  try {
    return (await readdir(path.join(repoRoot, policy.fixtureRoot), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink()).length;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

export async function doctor() {
  const [dependencies, postgres, docker, manifest, fixtureDirectories] = await Promise.all([
    dependencyParity(),
    versionProbe(path.join(repoRoot, policy.nativePostgresRelativePath), ["--version"], /PostgreSQL\)\s+(\d+\.\d+)/),
    versionProbe("docker", ["--version"], /Docker version\s+([\d.]+)/),
    candidateManifest(repoRoot),
    fixtureDirectoryCount(),
  ]);
  const nodeMatches = process.versions.node === policy.referenceNode;
  const nativeReady = nodeMatches && dependencies.status === "MATCH" && postgres.version === policy.postgresVersion;
  return {
    policy: policy.revision,
    observedAt: new Date().toISOString(),
    node: { actual: process.versions.node, reference: policy.referenceNode, matches: nodeMatches },
    platform: process.platform,
    dependencies, postgres, docker,
    candidate: { fingerprint: fingerprint(manifest), files: manifest },
    isolation: {
      envFilesRead: false, databaseConnectionsOpened: false, destructiveCleanup: false,
      childEnvironment: "OS_ALLOWLIST_ONLY", existingFixtureDirectories: fixtureDirectories,
      fixtureOwnershipVerified: false,
    },
    readiness: {
      nativeToolchain: nativeReady ? "READY" : "BLOCKED",
      nativeExecution: nativeReady && fixtureDirectories === 0 ? "AWAITING_CANDIDATE_FREEZE" : "BLOCKED",
      containers: docker.status === "AVAILABLE" ? "ENGINE_AND_HARNESS_NOT_VERIFIED" : "BLOCKED_NO_DOCKER_CLI",
      browser: "NOT_RUN", ci: "NOT_RUN",
    },
  };
}

export async function runNativeCase(id, expectedFingerprint) {
  const testFile = selectNativeCase(id);
  if (!/^[a-f0-9]{64}$/.test(expectedFingerprint ?? "")) throw new Error("A PM-frozen candidate fingerprint is required.");
  const before = await doctor();
  if (before.readiness.nativeExecution !== "AWAITING_CANDIDATE_FREEZE") throw new Error("Native readiness blocked; run doctor. No resources were removed.");
  if (before.candidate.fingerprint !== expectedFingerprint) throw new Error("Candidate changed before execution; request a new freeze.");
  if (!existsSync(path.join(repoRoot, testFile))) throw new Error("Approved case is not available yet.");
  // Deliberately not npm test/build: those project scripts can load developer .env files.
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, ["--test", "--test-concurrency=1", testFile], {
      cwd: repoRoot, env: isolatedEnvironment(), windowsHide: true, stdio: "inherit",
    });
    child.once("error", () => resolve(1));
    child.once("exit", (exitCode) => resolve(exitCode ?? 1));
  });
  const after = await doctor();
  const unchanged = after.candidate.fingerprint === before.candidate.fingerprint;
  const noFixtureDirectories = after.isolation.existingFixtureDirectories === 0;
  return {
    case: id, exitCode: code, candidateUnchanged: unchanged, noFixtureDirectories,
    cleanupEvidence: "Refer to named test PID/port/dataDir report; directory absence alone is insufficient.",
    status: code === 0 && unchanged && noFixtureDirectories ? "CASE_PASSED_REQUIRES_QA_REVIEW" : "FAILED",
  };
}
