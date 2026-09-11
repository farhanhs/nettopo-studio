import { createRuntimeSql } from "../db/postgres-connection.ts";
import { readPostgresSchemaStatus, schemaStatusAction } from "../db/postgres-schema-check.ts";

async function main() {
  const sql = createRuntimeSql();
  try {
    const status = await readPostgresSchemaStatus(sql);
    const summary = {
      ready: status.ready,
      state: status.state,
      requiredVersion: status.requiredVersion,
      currentVersion: status.currentVersion,
      action: schemaStatusAction(status),
    };
    console.log(`PostgreSQL schema ${JSON.stringify(summary)}`);
    if (!status.ready) process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
