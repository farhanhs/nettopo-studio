import type { RoleCode, UserRecord } from "../topology-types.ts";
import { pilotSiteId, type PilotPrincipal } from "./pilot-session.ts";

export function isPilotAdmin(principal?: PilotPrincipal) {
  return principal?.pilotRole === "admin";
}

export function isPilotEngineer(principal?: PilotPrincipal) {
  return principal?.pilotRole === "engineer";
}

export function canPilotEngineerCreateSyntheticCustomer(user: UserRecord, principal?: PilotPrincipal, siteId = pilotSiteId()) {
  return isPilotEngineer(principal) && user.role === "engineer" && user.siteIds.includes(siteId);
}

export function expectedDbRoleForPilot(principal: PilotPrincipal): RoleCode {
  return principal.pilotRole === "admin" ? "boss" : "engineer";
}

export function isPilotSubjectBound(user: UserRecord | undefined, principal: PilotPrincipal, siteId = pilotSiteId()) {
  return Boolean(user && user.role === expectedDbRoleForPilot(principal) && user.siteIds.includes(siteId));
}

export function canPilotUseFullExport(user: UserRecord | undefined, principal?: PilotPrincipal) {
  return Boolean(principal?.pilotRole === "admin" && user?.role === "boss");
}

export function pilotAuditMetadata(principal: PilotPrincipal, metadata: Record<string, unknown> = {}) {
  return {
    ...metadata,
    source: "internal-pilot",
    pilotRole: principal.pilotRole,
  };
}
