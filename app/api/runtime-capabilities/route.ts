import { NextResponse } from "next/server";

import { noStoreHeaders } from "@/app/lib/server/http-security";
import { runtimePolicySummary } from "@/app/lib/server/runtime-policy";

export async function GET() {
  return NextResponse.json(runtimePolicySummary(), { headers: noStoreHeaders() });
}
