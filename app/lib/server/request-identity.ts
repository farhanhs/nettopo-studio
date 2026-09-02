import { createHmac, timingSafeEqual } from "node:crypto";

import { readPilotSession, type PilotPrincipal } from "./pilot-session.ts";
import { DEV_IDENTITY_ALLOWLIST, getRuntimePolicy, type RuntimePolicy } from "./runtime-policy.ts";

export type IdentitySource = "oidc" | "dev-session" | "dev-override" | "pilot-session";
export type RequestIdentity = {
  email: string;
  source: IdentitySource;
  pilot?: PilotPrincipal;
};

export class RequestIdentityError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "RequestIdentityError";
    this.status = status;
  }
}

export const DEV_SESSION_COOKIE = "nettopo-dev-session";
const DEV_SESSION_TTL_SECONDS = 60 * 60 * 4;
const DEFAULT_DEV_EMAIL = "sean.sie@dus.local";

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signingSecret() {
  return process.env.NETTOPO_DEV_SESSION_SECRET || "nettopo-local-dev-session-signing-key";
}

function sign(payload: string) {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

function isAllowedDevEmail(email: string) {
  return DEV_IDENTITY_ALLOWLIST.some((identity) => identity.email.toLowerCase() === email.toLowerCase());
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  const prefix = `${name}=`;
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

export function createDevSessionValue(email = DEFAULT_DEV_EMAIL, now = Date.now()) {
  if (!isAllowedDevEmail(email)) throw new RequestIdentityError("Dev session identity is not allowed.", 403);
  const payload = base64Url(JSON.stringify({ email, exp: now + DEV_SESSION_TTL_SECONDS * 1000 }));
  return `${payload}.${sign(payload)}`;
}

export function readDevSession(request: Request, policy: RuntimePolicy = getRuntimePolicy()): RequestIdentity | undefined {
  if (!policy.capabilities.demoAuth) return undefined;
  const value = cookieValue(request, DEV_SESSION_COOKIE);
  if (!value) return undefined;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return undefined;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.byteLength !== expectedBuffer.byteLength || !timingSafeEqual(actualBuffer, expectedBuffer)) return undefined;
  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as { email?: string; exp?: number };
    if (!parsed.email || !parsed.exp || parsed.exp < Date.now() || !isAllowedDevEmail(parsed.email)) return undefined;
    return { email: parsed.email, source: "dev-session" };
  } catch {
    return undefined;
  }
}

export function requireRequestIdentity(request: Request): RequestIdentity {
  const policy = getRuntimePolicy();
  const deprecatedHeader = request.headers.get("x-nettopo-user-email");
  const devHeader = request.headers.get("x-nettopo-dev-user-email");

  if (deprecatedHeader) {
    console.warn("x-nettopo-user-email is deprecated and ignored. Use x-nettopo-dev-user-email with a dev session.");
  }
  if ((policy.profile === "production" || policy.profile === "pilot") && (devHeader || deprecatedHeader)) {
    throw new RequestIdentityError("Dev identity headers are forbidden in this runtime profile.", 401);
  }
  if (policy.authMode === "disabled") {
    throw new RequestIdentityError("Authentication is disabled for protected APIs.", 401);
  }
  if (policy.capabilities.pilotAuth) {
    const pilotSession = readPilotSession(request, policy);
    if (!pilotSession) throw new RequestIdentityError("Authentication required.", 401);
    return { email: pilotSession.email, source: "pilot-session", pilot: pilotSession };
  }

  const devSession = readDevSession(request, policy);
  if (devHeader) {
    if (!policy.capabilities.devIdentityOverride) {
      throw new RequestIdentityError("Dev identity override is not enabled.", 401);
    }
    if (!devSession) {
      throw new RequestIdentityError("Dev identity override requires an active dev session.", 401);
    }
    if (!isAllowedDevEmail(devHeader)) {
      throw new RequestIdentityError("Dev identity override email is not allowed.", 403);
    }
    return { email: devHeader, source: "dev-override" };
  }
  if (devSession) return devSession;

  throw new RequestIdentityError("Authentication required.", 401);
}

export function requestIdentityErrorResponse(error: unknown, fallback = "Authentication error.") {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof RequestIdentityError ? error.status : 400;
  return Response.json({ error: message }, { status });
}
