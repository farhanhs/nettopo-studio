import { doctor, policy, runNativeCase } from "./environment.mjs";
import { runNativeLifecycle } from "./native-lifecycle.mjs";

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "doctor" && args.length === 0) {
    console.log(JSON.stringify(await doctor(), null, 2));
  } else if (command === "list" && args.length === 0) {
    console.log(JSON.stringify(policy.nativeCases, null, 2));
  } else if (command === "native" && args.length === 2) {
    const result = await runNativeCase(args[0], args[1]);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === "FAILED" ? 1 : 0;
  } else if (command === "native-lifecycle" && args.length <= 1) {
    const result = await runNativeLifecycle(args[0] ?? "normal");
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.cleanup === "complete" && (result.status === "PASS" || result.scenario !== "normal") ? 0 : 1;
  } else {
    console.error("Usage: node scripts/qa-env/cli.mjs doctor | list | native <case-id> <PM-frozen-fingerprint> | native-lifecycle [normal|failure|timeout]");
    process.exitCode = 2;
  }
} catch {
  console.error("QA environment gate failed. Inspect doctor and approved scope; raw errors and environment values are suppressed.");
  process.exitCode = 1;
}
