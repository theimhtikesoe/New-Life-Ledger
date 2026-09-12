import { NextResponse } from "next/server";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCTION_ONLY_ACTORS = ["ဇွဲဇွဲ", "ဖြိုးကို"];
const CAP_STOCK_ONLY_ACTORS = ["သက်မွန်နှင်း"];

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const actorName = String(body?.actorName || "").trim();
  if (!PRODUCTION_ONLY_ACTORS.includes(actorName) && !CAP_STOCK_ONLY_ACTORS.includes(actorName)) {
    return NextResponse.json({ ok: false, error: "ဒီအသုံးပြုသူအတွက် PIN ဖြင့် ဝင်ရောက်ပါ။" }, { status: 403 });
  }

  const access = PRODUCTION_ONLY_ACTORS.includes(actorName) ? "production-only" : "standard";
  const token = await createSessionToken({ actorName, access });
  const response = NextResponse.json({ ok: true, actorName, access });
  response.cookies.set(sessionCookieOptions(token));
  return response;
}
