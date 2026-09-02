import { NextResponse } from "next/server";

import { createDevSessionValue, DEV_SESSION_COOKIE, readDevSession } from "@/app/lib/server/request-identity";
import { getRuntimePolicy } from "@/app/lib/server/runtime-policy";

export async function GET(request: Request) {
  const policy = getRuntimePolicy();
  if (!policy.capabilities.demoAuth) {
    return NextResponse.json({ authenticated: false }, { status: 404 });
  }

  const session = readDevSession(request, policy);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, email: session.email });
}

export async function POST() {
  const policy = getRuntimePolicy();
  if (!policy.capabilities.demoAuth) {
    return NextResponse.json({ error: "Demo authentication is not enabled." }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEV_SESSION_COOKIE, createDevSessionValue(), {
    httpOnly: true,
    sameSite: "strict",
    secure: policy.profile === "production",
    maxAge: 60 * 60 * 4,
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEV_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return response;
}
