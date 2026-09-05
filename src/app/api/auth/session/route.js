import { NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = await getSessionInfo(request);
  return NextResponse.json({
    ok: true,
    authenticated: Boolean(session),
    actorName: session?.actorName || null,
    access: session?.access || null,
  });
}
