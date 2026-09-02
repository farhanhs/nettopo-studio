import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteDeviceCredential, readDeviceCredentials, upsertDeviceCredential } from "@/db/topology-postgres";
import { assertPilotMutationRequest, noStoreHeaders } from "@/app/lib/server/http-security";
import { requirePilotBoundRequestIdentity } from "@/app/lib/server/pilot-request";
import { PostgresSchemaNotReadyError, safePostgresSchemaError } from "@/db/postgres-schema-check";

const id = z.string().trim().min(1).max(128);
const CredentialActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("upsert"),
    topologyId: id,
    projectDeviceId: id,
    kind: z.enum(["device_admin", "device_readonly", "wifi", "vpn", "external_service"]),
    username: z.string().trim().max(512).optional(),
    secret: z.string().min(1).max(4_096),
  }).strict(),
  z.object({
    action: z.literal("delete"),
    credentialId: id,
  }).strict(),
]);

export async function GET(request: Request) {
  try {
    const identity = await requirePilotBoundRequestIdentity(request);
    const context = { identitySource: identity.source, pilotPrincipal: identity.pilot };
    const topologyId = new URL(request.url).searchParams.get("topologyId");
    if (!topologyId) throw new Error("topologyId is required.");
    if (identity.pilot?.pilotRole === "engineer") {
      return NextResponse.json({ credentials: [], notice: "Pilot engineers cannot read credential metadata." }, { headers: noStoreHeaders() });
    }
    return NextResponse.json({ credentials: await readDeviceCredentials(identity.email, topologyId, context) }, { headers: noStoreHeaders() });
  } catch (error) {
    return credentialError(error);
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requirePilotBoundRequestIdentity(request);
    assertPilotMutationRequest(request);
    const body = CredentialActionSchema.parse(await request.json());
    const context = { identitySource: identity.source, pilotPrincipal: identity.pilot };
    if (identity.pilot?.pilotRole === "engineer") {
      return NextResponse.json({ error: "CREDENTIAL_FORBIDDEN", message: "Permission denied." }, { status: 403, headers: noStoreHeaders() });
    }
    const email = identity.email;
    const credentials = body.action === "upsert"
      ? await upsertDeviceCredential(email, body, context)
      : await deleteDeviceCredential(email, body.credentialId, context);
    return NextResponse.json({ credentials }, { headers: noStoreHeaders() });
  } catch (error) {
    return credentialError(error);
  }
}

function credentialError(error: unknown) {
  if (error instanceof PostgresSchemaNotReadyError) {
    return NextResponse.json(safePostgresSchemaError(error.status), { status: 503, headers: noStoreHeaders() });
  }
  const message = error instanceof Error ? error.message : "Credential API error.";
  const status = message.includes("Authentication") || message.includes("Dev identity") || message.includes("forbidden")
    ? 401
    : message.includes("DATABASE_URL") || message.includes("ENCRYPTION_KEY")
    ? 503
    : message.includes("Resource not found") || message.includes("not found")
        ? 404
        : message.includes("Permission denied")
          ? 403
          : 400;
  return NextResponse.json({ error: status === 401 ? "AUTHENTICATION_REQUIRED" : "CREDENTIAL_API_ERROR", message: safeCredentialMessage(status) }, { status, headers: noStoreHeaders() });
}

function safeCredentialMessage(status: number) {
  if (status === 401) return "Authentication required.";
  if (status === 403) return "Permission denied.";
  if (status === 404) return "Resource not found.";
  if (status === 503) return "Database unavailable.";
  return "Credential API error.";
}
