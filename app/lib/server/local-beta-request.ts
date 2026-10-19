export const LOCAL_BETA_ORIGIN = "http://127.0.0.1:4317";
export type BetaAssetKind = "script" | "style" | "image" | "font" | "empty";
export type BetaRequestDecision =
  | { allow: true; kind: "application" | "asset" | "capabilities" | "status" | "shutdown" }
  | { allow: false; status: number; error: string };

export function validateBetaRequest(request: Request, runtime: {
  peer: string | undefined;
  assets: ReadonlyMap<string, BetaAssetKind>;
  controlAuthorized?: boolean;
}): BetaRequestDecision {
  const deny = (status = 404, error = "BTA_API_DENIED"): BetaRequestDecision => ({ allow: false, status, error });
  if (runtime.peer !== "127.0.0.1" || request.headers.get("host") !== "127.0.0.1:4317") return deny(421, "BTA_HOST_DENIED");
  const url = new URL(request.url);
  if (url.origin !== LOCAL_BETA_ORIGIN) return deny(421, "BTA_HOST_DENIED");
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== LOCAL_BETA_ORIGIN) return deny(403, "BTA_ORIGIN_DENIED");
  const site = request.headers.get("sec-fetch-site");
  const mode = request.headers.get("sec-fetch-mode");
  const dest = request.headers.get("sec-fetch-dest");
  if (site === "cross-site" || site === "same-site") return deny(403, "BTA_ORIGIN_DENIED");
  if (request.headers.has("x-nettopo-user-email") || request.headers.has("x-nettopo-dev-user-email")) return deny();
  if (url.pathname.startsWith("/__local_beta/")) {
    if (origin !== null || site !== null || mode !== null || dest !== null || url.search || !runtime.controlAuthorized) return deny();
    if (url.pathname === "/__local_beta/status" && request.method === "GET") return { allow: true, kind: "status" };
    if (url.pathname === "/__local_beta/shutdown" && request.method === "POST"
      && !request.headers.has("transfer-encoding") && (!request.headers.has("content-length") || request.headers.get("content-length") === "0")) return { allow: true, kind: "shutdown" };
    return deny();
  }
  if (!["GET", "HEAD"].includes(request.method) || !["same-origin", "none"].includes(site ?? "")) return deny();
  if (url.pathname === "/api/runtime-capabilities") {
    return request.method === "GET" && !url.search && ["cors", "same-origin"].includes(mode ?? "") && dest === "empty"
      ? { allow: true, kind: "capabilities" } : deny();
  }
  const kind = runtime.assets.get(url.pathname);
  if (kind && !url.search && (dest === kind || (dest === "empty" && kind === "empty")) && ["cors", "no-cors", "same-origin"].includes(mode ?? "")) return { allow: true, kind: "asset" };
  if (url.pathname !== "/") return deny();
  if (!url.search && mode === "navigate" && dest === "document") return { allow: true, kind: "application" };
  const query = [...url.searchParams.entries()];
  if (query.length === 1 && query[0][0] === "_rsc" && /^[a-zA-Z0-9_-]{1,128}$/.test(query[0][1])
    && request.headers.get("rsc") === "1" && ["cors", "same-origin"].includes(mode ?? "") && dest === "empty") return { allow: true, kind: "application" };
  return deny();
}

export function betaSecurityHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}
