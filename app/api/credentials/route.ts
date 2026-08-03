import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteDeviceCredential, readDeviceCredentials, upsertDeviceCredential } from "@/db/topology-postgres";

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
    const topologyId = new URL(request.url).searchParams.get("topologyId");
    if (!topologyId) throw new Error("topologyId is required.");
    return NextResponse.json({ credentials: await readDeviceCredentials(currentUserEmail(request), topologyId) });
  } catch (error) {
    return credentialError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = CredentialActionSchema.parse(await request.json());
    const email = currentUserEmail(request);
    const credentials = body.action === "upsert"
      ? await upsertDeviceCredential(email, body)
      : await deleteDeviceCredential(email, body.credentialId);
    return NextResponse.json({ credentials });
  } catch (error) {
    return credentialError(error);
  }
}

function currentUserEmail(request: Request) {
  return request.headers.get("x-nettopo-user-email") ||
    process.env.NETTOPO_DEV_USER_EMAIL ||
    "manner@company.local";
}

function credentialError(error: unknown) {
  const message = error instanceof Error ? error.message : "Credential API error.";
  const status = message.includes("DATABASE_URL") || message.includes("ENCRYPTION_KEY")
    ? 503
    : message.includes("Permission denied")
      ? 403
      : message.includes("not found")
        ? 404
        : 400;
  return NextResponse.json({ error: message }, { status });
}
