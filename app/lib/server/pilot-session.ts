import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getRuntimePolicy, type RuntimePolicy } from "./runtime-policy.ts";

export type PilotRole = "admin" | "engineer";
export type PilotPrincipal = {
  email: string;
  pilotRole: PilotRole;
  version: string;
};

export const PILOT_SESSION_COOKIE = "__Host-nettopo-pilot-session";
const PILOT_SESSION_TTL_SECONDS = 60 * 60 * 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signingSecret() {
  const secret = process.env.NETTOPO_PILOT_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("NETTOPO_PILOT_SESSION_SECRET is required for pilot auth.");
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  const prefix = `${name}=`;
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

export function pilotSiteId(env: NodeJS.ProcessEnv = process.env) {
  const siteId = env.NETTOPO_PILOT_SITE_ID?.trim();
  if (!siteId) throw new Error("NETTOPO_PILOT_SITE_ID is required for pilot auth.");
  return siteId;
}

export function pilotSessionTtlSeconds() {
  return PILOT_SESSION_TTL_SECONDS;
}

export function pilotCookieOptions(maxAge = PILOT_SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: true,
    maxAge,
    path: "/",
  };
}

export function parsePilotAllowlist(env: NodeJS.ProcessEnv = process.env): PilotPrincipal[] {
  const raw = env.NETTOPO_PILOT_USERS;
  if (!raw || raw.trim() === "") throw new Error("NETTOPO_PILOT_USERS allowlist is required for pilot auth.");

  const seen = new Set<string>();
  return raw.split(",").map((entry) => {
    const parts = entry.split(":").map((part) => part.trim());
    if (parts.length !== 3) throw new Error("NETTOPO_PILOT_USERS entries must be email:role:version.");
    const [rawEmail, rawRole, rawVersion] = parts;
    const email = rawEmail.toLowerCase();
    if (!EMAIL_PATTERN.test(email)) throw new Error("NETTOPO_PILOT_USERS contains an invalid email.");
    if (seen.has(email)) throw new Error("NETTOPO_PILOT_USERS contains duplicate emails.");
    seen.add(email);
    if (rawRole !== "admin" && rawRole !== "engineer") throw new Error("NETTOPO_PILOT_USERS role must be admin or engineer.");
    if (!rawVersion) throw new Error("NETTOPO_PILOT_USERS version is required.");
    return { email, pilotRole: rawRole, version: rawVersion } satisfies PilotPrincipal;
  });
}

export function findPilotPrincipal(email: string, env: NodeJS.ProcessEnv = process.env) {
  const normalized = email.trim().toLowerCase();
  return parsePilotAllowlist(env).find((principal) => principal.email === normalized);
}

export function createPilotSessionValue(email: string, now = Date.now()) {
  const principal = findPilotPrincipal(email);
  if (!principal) throw new Error("Pilot user is not allowlisted.");
  const payload = base64Url(JSON.stringify({
    email: principal.email,
    pilotRole: principal.pilotRole,
    version: principal.version,
    nonce: randomBytes(16).toString("base64url"),
    exp: now + PILOT_SESSION_TTL_SECONDS * 1000,
  }));
  return `${payload}.${sign(payload)}`;
}

export function readPilotSession(request: Request, policy: RuntimePolicy = getRuntimePolicy()): PilotPrincipal | undefined {
  if (!policy.capabilities.pilotAuth) return undefined;
  const value = cookieValue(request, PILOT_SESSION_COOKIE);
  if (!value) return undefined;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return undefined;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.byteLength !== expectedBuffer.byteLength || !timingSafeEqual(actualBuffer, expectedBuffer)) return undefined;
  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as { email?: string; pilotRole?: PilotRole; version?: string; exp?: number };
    if (!parsed.email || !parsed.pilotRole || !parsed.version || !parsed.exp || parsed.exp < Date.now()) return undefined;
    const allowlisted = findPilotPrincipal(parsed.email);
    if (!allowlisted || allowlisted.pilotRole !== parsed.pilotRole || allowlisted.version !== parsed.version) return undefined;
    return allowlisted;
  } catch {
    return undefined;
  }
}
