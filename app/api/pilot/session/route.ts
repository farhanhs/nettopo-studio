import { assertPilotMutationRequest, noStoreHeaders } from "../../../lib/server/http-security.ts";
import {
  createPilotSessionValue,
  findPilotPrincipal,
  pilotCookieOptions,
  pilotSiteId,
  PILOT_SESSION_COOKIE,
  pilotSessionTtlSeconds,
  type PilotPrincipal,
} from "../../../lib/server/pilot-session.ts";
import { isPilotSubjectBound } from "../../../lib/server/pilot-policy.ts";
import { getRuntimePolicy, type RuntimePolicy } from "../../../lib/server/runtime-policy.ts";
import type { UserRecord } from "../../../lib/topology-types.ts";
import { PostgresSchemaNotReadyError, safePostgresSchemaError } from "../../../../db/postgres-schema-check.ts";
import { loadPilotSessionUser } from "../../../../db/topology-postgres.ts";

type PilotSessionDeps = {
  getPolicy: () => RuntimePolicy;
  assertMutationRequest: (request: Request) => void;
  findPrincipal: (email: string) => PilotPrincipal | undefined;
  loadPilotUser: (email: string) => Promise<UserRecord>;
  createSessionValue: (email: string) => string;
};

class PilotSessionAuthError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "PilotSessionAuthError";
  }
}

export function mapPilotSessionError(error: unknown) {
  if (error instanceof PilotSessionAuthError) {
    return { status: 401, body: { error: "AUTHENTICATION_REQUIRED", message: "Authentication required." } };
  }
  if (error instanceof Error && error.message === "Authentication required.") {
    return { status: 401, body: { error: "AUTHENTICATION_REQUIRED", message: "Authentication required." } };
  }
  if (error instanceof PostgresSchemaNotReadyError) {
    return { status: 503, body: safePostgresSchemaError(error.status) };
  }
  if (error instanceof Error && error.message === "DATABASE_URL is required when NEXT_PUBLIC_TOPOLOGY_STORAGE=server.") {
    return { status: 503, body: { error: "DATABASE_UNAVAILABLE", message: "Database unavailable.", action: "check DB/network/credentials" } };
  }
  if (error instanceof Error && error.message.includes("application/json")) {
    return { status: 400, body: { error: "INVALID_REQUEST", message: "Request must use application/json." } };
  }
  if (error instanceof Error && error.message.includes("origin")) {
    return { status: 403, body: { error: "FORBIDDEN_ORIGIN", message: "Mutation request origin is not allowed." } };
  }
  return { status: 500, body: { error: "PILOT_SESSION_ERROR", message: "Pilot session error." } };
}

export function createPilotSessionPostHandler(deps: PilotSessionDeps) {
  return async function pilotSessionPost(request: Request) {
  try {
    const policy = deps.getPolicy();
    if (!policy.capabilities.pilotAuth) {
      return Response.json({ error: "PILOT_AUTH_DISABLED", message: "Pilot authentication is not enabled." }, { status: 404, headers: noStoreHeaders() });
    }
    deps.assertMutationRequest(request);
    const body = await request.json().catch(() => ({})) as { email?: unknown };
    if (typeof body.email !== "string" || body.email.trim() === "") {
      return Response.json({ error: "INVALID_REQUEST", message: "email is required." }, { status: 400, headers: noStoreHeaders() });
    }
    const principal = deps.findPrincipal(body.email);
    if (!principal) {
      throw new PilotSessionAuthError();
    }
    const user = await deps.loadPilotUser(principal.email);
    if (!isPilotSubjectBound(user, principal, pilotSiteId())) {
      throw new PilotSessionAuthError();
    }
    return Response.json({
      ok: true,
      pilotUser: { email: principal.email, pilotRole: principal.pilotRole },
      ttlSeconds: pilotSessionTtlSeconds(),
    }, { headers: noStoreHeaders({ "Set-Cookie": pilotSetCookie(deps.createSessionValue(principal.email)) }) });
  } catch (error) {
    const { status, body } = mapPilotSessionError(error);
    return Response.json(body, { status, headers: noStoreHeaders() });
  }
  };
}

export async function DELETE(request: Request) {
  try {
    assertPilotMutationRequest(request);
    return Response.json({ ok: true }, { headers: noStoreHeaders({ "Set-Cookie": pilotSetCookie("", 0) }) });
  } catch (error) {
    const { status, body } = mapPilotSessionError(error);
    return Response.json(body, { status, headers: noStoreHeaders() });
  }
}

function pilotSetCookie(value: string, maxAge = pilotSessionTtlSeconds()) {
  const options = pilotCookieOptions(maxAge);
  return [
    `${PILOT_SESSION_COOKIE}=${value}`,
    "Path=/",
    `Max-Age=${options.maxAge}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

export const POST = createPilotSessionPostHandler({
  getPolicy: getRuntimePolicy,
  assertMutationRequest: assertPilotMutationRequest,
  findPrincipal: findPilotPrincipal,
  loadPilotUser: loadPilotSessionUser,
  createSessionValue: createPilotSessionValue,
});
