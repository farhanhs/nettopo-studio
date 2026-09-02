import { NextResponse } from "next/server";

import { readDevSession } from "@/app/lib/server/request-identity";
import { DEV_IDENTITY_ALLOWLIST, getRuntimePolicy } from "@/app/lib/server/runtime-policy";

export async function GET(request: Request) {
  const policy = getRuntimePolicy();
  if (!policy.capabilities.devIdentityOverride) {
    return NextResponse.json({ identities: [] });
  }
  if (!readDevSession(request, policy)) {
    return NextResponse.json({ error: "Dev identities require an active dev session." }, { status: 401 });
  }
  return NextResponse.json({ identities: DEV_IDENTITY_ALLOWLIST });
}
