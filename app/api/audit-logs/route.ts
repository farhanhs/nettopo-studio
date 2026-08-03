import { NextResponse } from "next/server";

import { readAuditLogs } from "@/db/topology-postgres";

export async function GET(request: Request) {
  try {
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(rawLimit) ? rawLimit : 100;
    return NextResponse.json({ auditLogs: await readAuditLogs(currentUserEmail(request), limit) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit log API error.";
    const status = message.includes("DATABASE_URL") ? 503 : message.includes("Permission denied") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

function currentUserEmail(request: Request) {
  return request.headers.get("x-nettopo-user-email") ||
    process.env.NETTOPO_DEV_USER_EMAIL ||
    "manner@company.local";
}
