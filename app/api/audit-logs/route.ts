import { noStoreHeaders } from "../../lib/server/http-security.ts";
import { requirePilotBoundRequestIdentity } from "../../lib/server/pilot-request.ts";
import { RequestIdentityError, type RequestIdentity } from "../../lib/server/request-identity.ts";
import type { AuditLogRecord } from "../../lib/topology-types.ts";
import { PostgresSchemaNotReadyError, safePostgresSchemaError } from "../../../db/postgres-schema-check.ts";
import { readAuditLogs } from "../../../db/topology-postgres.ts";

export type AuditApiErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "AUDIT_FORBIDDEN"
  | "INVALID_LIMIT"
  | "DATABASE_SCHEMA_UNINITIALIZED"
  | "DATABASE_SCHEMA_OUTDATED"
  | "DATABASE_SCHEMA_TOO_NEW"
  | "DATABASE_SCHEMA_CHECKSUM_MISMATCH"
  | "DATABASE_UNAVAILABLE"
  | "AUDIT_API_ERROR";

type AuditLogsHandlerDeps = {
  authenticate: (request: Request) => RequestIdentity | Promise<RequestIdentity>;
  parseLimit?: (url: string) => number;
  readAuditLogs: (
    email: string,
    limit: number,
    context?: { identitySource?: RequestIdentity["source"]; pilotPrincipal?: RequestIdentity["pilot"] },
  ) => Promise<AuditLogRecord[]>;
};

export class AuditApiError extends Error {
  code: AuditApiErrorCode;
  status: number;

  constructor(code: AuditApiErrorCode, message: string, status: number) {
    super(message);
    this.name = "AuditApiError";
    this.code = code;
    this.status = status;
  }
}

export function parseAuditLimit(url: string) {
  const values = new URL(url).searchParams.getAll("limit");
  if (values.length === 0) return 100;
  if (values.length > 1) throw new AuditApiError("INVALID_LIMIT", "limit must be an integer between 1 and 200.", 400);

  const value = values[0];
  if (!/^[1-9]\d*$/.test(value)) throw new AuditApiError("INVALID_LIMIT", "limit must be an integer between 1 and 200.", 400);

  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
    throw new AuditApiError("INVALID_LIMIT", "limit must be an integer between 1 and 200.", 400);
  }
  return limit;
}

function isAuditForbidden(error: unknown) {
  return error instanceof Error && error.message.startsWith("Permission denied:");
}

function isDatabaseUnavailable(error: unknown) {
  return error instanceof Error && error.message === "DATABASE_URL is required when NEXT_PUBLIC_TOPOLOGY_STORAGE=server.";
}

export function mapAuditApiError(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof RequestIdentityError) {
    return { status: 401, body: { error: "AUTHENTICATION_REQUIRED", message: "Authentication required." } };
  }
  if (error instanceof AuditApiError) {
    return { status: error.status, body: { error: error.code, message: error.message } };
  }
  if (error instanceof PostgresSchemaNotReadyError) {
    return { status: 503, body: safePostgresSchemaError(error.status) };
  }
  if (isAuditForbidden(error)) {
    return { status: 403, body: { error: "AUDIT_FORBIDDEN", message: "Permission denied." } };
  }
  if (isDatabaseUnavailable(error)) {
    return { status: 503, body: { error: "DATABASE_UNAVAILABLE", message: "Database unavailable.", action: "check DB/network/credentials" } };
  }
  return { status: 500, body: { error: "AUDIT_API_ERROR", message: "Audit API error." } };
}

export function createAuditLogsGetHandler(deps: AuditLogsHandlerDeps) {
  return async function auditLogsGetHandler(request: Request) {
    try {
      const identity = await deps.authenticate(request);
      const limit = (deps.parseLimit ?? parseAuditLimit)(request.url);
      return Response.json(
        { auditLogs: await deps.readAuditLogs(identity.email, limit, { identitySource: identity.source, pilotPrincipal: identity.pilot }) },
        { headers: noStoreHeaders() },
      );
    } catch (error) {
      const { status, body } = mapAuditApiError(error);
      return Response.json(body, { status, headers: noStoreHeaders() });
    }
  };
}

export const GET = createAuditLogsGetHandler({
  authenticate: requirePilotBoundRequestIdentity,
  readAuditLogs,
});
