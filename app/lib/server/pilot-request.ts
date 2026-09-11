import { loadPilotSessionUser } from "../../../db/topology-postgres.ts";
import { isPilotSubjectBound } from "./pilot-policy.ts";
import { pilotSiteId } from "./pilot-session.ts";
import { RequestIdentityError, requireRequestIdentity, type RequestIdentity } from "./request-identity.ts";
import type { UserRecord } from "../topology-types.ts";

export type BoundRequestIdentity = RequestIdentity & {
  pilotUser?: UserRecord;
};

type PilotBoundIdentityDeps = {
  authenticate: (request: Request) => RequestIdentity;
  loadPilotUser: (email: string) => Promise<UserRecord | undefined>;
};

export function createPilotBoundIdentityResolver(deps: PilotBoundIdentityDeps) {
  return async function resolvePilotBoundIdentity(request: Request): Promise<BoundRequestIdentity> {
  const identity = deps.authenticate(request);
  if (identity.source !== "pilot-session" || !identity.pilot) return identity;

  let user: UserRecord | undefined;
  try {
    user = await deps.loadPilotUser(identity.email);
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required.") {
      throw new RequestIdentityError("Authentication required.", 401);
    }
    throw error;
  }
  if (!isPilotSubjectBound(user, identity.pilot, pilotSiteId())) {
    throw new RequestIdentityError("Authentication required.", 401);
  }
  return { ...identity, pilotUser: user };
  };
}

export const requirePilotBoundRequestIdentity = createPilotBoundIdentityResolver({
  authenticate: requireRequestIdentity,
  loadPilotUser: loadPilotSessionUser,
});
