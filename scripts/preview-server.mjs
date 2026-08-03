import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { Readable } from "node:stream";

const projectRoot = resolve(import.meta.dirname, "..");
const clientRoot = resolve(projectRoot, "dist", "client");
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function assetPath(url) {
  const pathname = decodeURIComponent(new URL(url).pathname);
  const target = resolve(clientRoot, `.${pathname}`);
  if (target !== clientRoot && !target.startsWith(`${clientRoot}${sep}`)) return undefined;
  return existsSync(target) && statSync(target).isFile() ? target : undefined;
}

function assetResponse(request) {
  const target = assetPath(request.url);
  if (!target) return new Response("Not found", { status: 404 });
  const stat = statSync(target);
  return new Response(Readable.toWeb(createReadStream(target)), {
    headers: {
      "cache-control": request.url.includes("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
      "content-length": String(stat.size),
      "content-type": contentTypes[extname(target)] ?? "application/octet-stream",
    },
  });
}

async function nodeRequestToWeb(request) {
  const url = `http://${request.headers.host ?? `${host}:${port}`}${request.url ?? "/"}`;
  const init = {
    method: request.method,
    headers: request.headers,
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = Readable.toWeb(request);
    init.duplex = "half";
  }
  return new Request(url, init);
}

function sendNodeResponse(response, nodeResponse) {
  nodeResponse.statusCode = response.status;
  response.headers.forEach((value, name) => nodeResponse.setHeader(name, value));
  if (!response.body) {
    nodeResponse.end();
    return;
  }
  Readable.fromWeb(response.body).pipe(nodeResponse);
}

const workerUrl = new URL(`../dist/server/index.js?preview=${Date.now()}`, import.meta.url);
const { default: worker } = await import(workerUrl.href);
const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

function fetchWorker(request) {
  return typeof worker === "function"
    ? worker(request)
    : worker.fetch(request, { ASSETS: { fetch: assetResponse } }, executionContext);
}

const server = createServer(async (request, response) => {
  try {
    const webRequest = await nodeRequestToWeb(request);
    const pathname = new URL(webRequest.url).pathname;
    const result = pathname.startsWith("/assets/") || assetPath(webRequest.url)
      ? assetResponse(webRequest)
      : await fetchWorker(webRequest);
    sendNodeResponse(result, response);
  } catch (error) {
    console.error(error);
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("Preview server error");
  }
});

server.listen(port, host, () => {
  console.log(`NetTopo preview running at http://${host}:${port}/`);
});
