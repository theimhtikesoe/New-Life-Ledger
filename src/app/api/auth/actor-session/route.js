import { NextResponse } from "next/server";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCTION_ONLY_ACTOR = "ဇွဲဇွဲ";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const actorName = String(body?.actorName || "").trim();
  if (actorName !== PRODUCTION_ONLY_ACTOR) {
    return NextResponse.json({ ok: false, error: "ဒီအသုံးပြုသူအတွက် PIN ဖြင့် ဝင်ရောက်ပါ။" }, { status: 403 });
  }

  const token = await createSessionToken({ actorName, access: "production-only" });
  const response = NextResponse.json({ ok: true, actorName, access: "production-only" });
  response.cookies.set(sessionCookieOptions(token));
  return response;
}
