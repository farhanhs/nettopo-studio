import { NextResponse } from "next/server";
import { readTopologyDataset } from "@/db/topology-postgres";

export async function GET(request: Request) {
  try {
    const email = request.headers.get("x-nettopo-user-email") ||
      process.env.NETTOPO_DEV_USER_EMAIL ||
      "manner@company.local";
    const { currentUser, sites, permissions } = await readTopologyDataset(email);
    return NextResponse.json({ currentUser, sites, permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session API error.";
    const status = message.includes("DATABASE_URL") ? 503 : message.includes("Permission denied") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
