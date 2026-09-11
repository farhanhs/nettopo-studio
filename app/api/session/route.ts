import { NextResponse } from "next/server";
import { readTopologyDataset } from "@/db/topology-postgres";
import { noStoreHeaders } from "@/app/lib/server/http-security";
import { requirePilotBoundRequestIdentity } from "@/app/lib/server/pilot-request";
import { PostgresSchemaNotReadyError, safePostgresSchemaError } from "@/db/postgres-schema-check";

export async function GET(request: Request) {
  try {
    const identity = await requirePilotBoundRequestIdentity(request);
    const { currentUser, sites, permissions } = await readTopologyDataset(identity.email, {
      identitySource: identity.source,
      pilotPrincipal: identity.pilot,
    });
    return NextResponse.json({
      currentUser,
      sites,
      permissions,
      pilot: identity.pilot ? { email: identity.pilot.email, pilotRole: identity.pilot.pilotRole } : undefined,
    }, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof PostgresSchemaNotReadyError) {
      return NextResponse.json(safePostgresSchemaError(error.status), { status: 503, headers: noStoreHeaders() });
    }
    const message = error instanceof Error ? error.message : "Session API error.";
    const status = message.includes("Authentication") || message.includes("Dev identity") || message.includes("forbidden")
      ? 401
      : message.includes("DATABASE_URL")
        ? 503
        : message.includes("Resource not found") || message.includes("not found")
          ? 404
          : message.includes("Permission denied")
            ? 403
            : 400;
    return NextResponse.json({
      error: status === 401 ? "AUTHENTICATION_REQUIRED" : "SESSION_API_ERROR",
      message: safeSessionMessage(status),
    }, { status, headers: noStoreHeaders() });
  }
}

function safeSessionMessage(status: number) {
  if (status === 401) return "Authentication required.";
  if (status === 403) return "Permission denied.";
  if (status === 404) return "Resource not found.";
  if (status === 503) return "Database unavailable.";
  return "Session API error.";
}
