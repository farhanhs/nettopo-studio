import { validateRuntimePolicy } from "../app/lib/server/runtime-policy.ts";

async function main() {
  const policy = validateRuntimePolicy(process.env, process.env.HOST);
  if (!policy.capabilities.demoSeed) {
    throw new Error("Demo seed is disabled. Set NETTOPO_RUNTIME_PROFILE=development or test and NETTOPO_ENABLE_DEMO_SEED=1.");
  }
  const { seedDemoDatabase } = await import("../db/topology-postgres.ts");
  await seedDemoDatabase();
  console.log(`Demo seed complete. RuntimePolicy ${JSON.stringify({ profile: policy.profile, capabilities: policy.capabilities })}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
