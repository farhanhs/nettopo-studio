import { NextResponse } from "next/server";

import { noStoreHeaders } from "@/app/lib/server/http-security";
import { runtimePolicySummary, validateRuntimePolicy } from "@/app/lib/server/runtime-policy";

export async function GET() {
  if (process.env.NETTOPO_RUNTIME_PROFILE === "local-beta") {
    try { return NextResponse.json(runtimePolicySummary(validateRuntimePolicy()), { headers: noStoreHeaders() }); }
    catch { return NextResponse.json({ error: "BTA_PROFILE_INVALID" }, { status: 503, headers: noStoreHeaders() }); }
  }
  return NextResponse.json(runtimePolicySummary(), { headers: noStoreHeaders() });
}
