import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const topology = await readFile(new URL("../app/api/topology/route.ts", import.meta.url), "utf8");
const credentials = await readFile(new URL("../app/api/credentials/route.ts", import.meta.url), "utf8");
const auditLogs = await readFile(new URL("../app/api/audit-logs/route.ts", import.meta.url), "utf8");

function body(source, signature) {
  const start = source.indexOf(signature);
  const next = source.indexOf("\nexport async function ", start + signature.length);
  return source.slice(start, next === -1 ? source.length : next);
}

test("topology POST authenticates before parsing an untrusted request body", () => {
  const post = body(topology, "export async function POST");
  assert.ok(post.indexOf("requirePilotBoundRequestIdentity(request)") < post.indexOf("request.json()"));
});

test("credentials POST authenticates before parsing an untrusted request body", () => {
  const post = body(credentials, "export async function POST");
  assert.ok(post.indexOf("requirePilotBoundRequestIdentity(request)") < post.indexOf("request.json()"));
});

test("credentials GET authenticates before query/resource validation", () => {
  const get = body(credentials, "export async function GET");
  assert.ok(get.indexOf("requirePilotBoundRequestIdentity(request)") < get.indexOf('searchParams.get("topologyId")'));
});

test("audit logs GET authenticates before query parsing", () => {
  const handler = body(auditLogs, "export function createAuditLogsGetHandler");
  assert.ok(handler.indexOf("deps.authenticate(request)") < handler.indexOf("parseAuditLimit)(request.url)"));
});
