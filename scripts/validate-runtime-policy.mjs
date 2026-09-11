import { getRuntimePolicy, runtimePolicySummary, validateRuntimePolicy } from "../app/lib/server/runtime-policy.ts";

try {
  const policy = validateRuntimePolicy(process.env, process.env.HOST);
  console.log(`RuntimePolicy ${JSON.stringify(runtimePolicySummary(policy))}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

export { getRuntimePolicy, validateRuntimePolicy };
