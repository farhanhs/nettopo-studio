import { getRuntimePolicy } from "./runtime-policy.ts";

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
} as const;

export function securityHeaders(extra?: Record<string, string>) {
  return { ...SECURITY_HEADERS, ...(extra ?? {}) };
}

export function noStoreHeaders(extra?: Record<string, string>) {
  return securityHeaders({ "Cache-Control": "no-store", ...(extra ?? {}) });
}

export function assertPilotMutationRequest(request: Request) {
  const policy = getRuntimePolicy();
  if (policy.profile !== "pilot") return;
  if (request.method === "GET") throw new Error("Mutation requests cannot use GET.");
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new Error("Mutation requests must use application/json.");
  }
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const source = origin || (referer ? new URL(referer).origin : undefined);
  if (!source || source !== requestUrl.origin) {
    throw new Error("Mutation request origin is not allowed.");
  }
}
