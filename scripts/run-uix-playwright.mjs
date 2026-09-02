import { spawn } from "node:child_process";

const host = "127.0.0.1";
const port = process.env.PORT ?? "4391";
const baseUrl = `http://${host}:${port}`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? signal}`));
    });
  });
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not become ready at ${baseUrl}: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
}

function startPreview() {
  return spawn(process.execPath, [
    "--env-file-if-exists=.env.local",
    "--env-file-if-exists=.env",
    "scripts/preview-server.mjs",
  ], {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      HOST: host,
      PORT: port,
      NETTOPO_RUNTIME_PROFILE: "development",
      NETTOPO_AUTH_MODE: "demo",
      NETTOPO_ENABLE_DEMO_SEED: "1",
      NETTOPO_ENABLE_DEV_IDENTITY_HEADER: "1",
    },
  });
}

async function stopPreview(child) {
  if (child.exitCode !== null || child.signalCode) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (child.exitCode === null && !child.signalCode) child.kill("SIGKILL");
}

await run(process.execPath, [
  "--env-file-if-exists=.env.local",
  "--env-file-if-exists=.env",
  "scripts/validate-runtime-policy.mjs",
]);
await run(process.execPath, ["scripts/build-local.mjs"]);

const preview = startPreview();
try {
  await waitForPreview();
  await run(process.execPath, ["node_modules/playwright/cli.js", "test", "tests/e2e/uix-routing.spec.ts"], {
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: baseUrl,
    },
  });
} finally {
  await stopPreview(preview);
}
