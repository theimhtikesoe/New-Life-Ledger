import { NextResponse } from "next/server";
import { requestHasValidSession } from "@/lib/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  return NextResponse.json({ ok: true, authenticated: await requestHasValidSession(request) });
}
