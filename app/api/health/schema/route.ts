import { NextResponse } from "next/server";
import { createRuntimeSql } from "@/db/postgres-connection";
import { readPostgresSchemaStatus, schemaStatusAction, type PostgresSchemaStatus } from "@/db/postgres-schema-check";
import { requiredPostgresSchemaVersion } from "@/db/postgres-schema-version";

export async function GET() {
  try {
    const sql = createRuntimeSql();
    try {
      const status = await readPostgresSchemaStatus(sql);
      return NextResponse.json(safeHealthStatus(status), { status: status.ready ? 200 : 503 });
    } finally {
      await sql.end({ timeout: 5 });
    }
  } catch {
    const status: PostgresSchemaStatus = {
      ready: false,
      state: "unavailable",
      requiredVersion: requiredPostgresSchemaVersion,
      appliedVersions: [],
      missingVersions: [],
      incompatibleVersions: [],
      checksumMismatches: [],
      checkedAt: new Date().toISOString(),
      errorCode: "DATABASE_UNAVAILABLE",
    };
    return NextResponse.json(safeHealthStatus(status), { status: 503 });
  }
}

function safeHealthStatus(status: PostgresSchemaStatus) {
  return {
    ready: status.ready,
    state: status.state,
    requiredVersion: status.requiredVersion,
    currentVersion: status.currentVersion,
    action: schemaStatusAction(status),
    checkedAt: status.checkedAt,
  };
}
