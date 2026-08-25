import { NextResponse } from "next/server";
import { requestHasValidSession } from "@/lib/auth-session";
import { hasConfiguredAppPin, isValidAppPin } from "@/lib/app-pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!(await requestHasValidSession(request))) {
    return NextResponse.json({ ok: false, error: "အရင်ဆုံး PIN ဖြင့် ဝင်ရောက်ပါ။" }, { status: 401 });
  }
  if (!hasConfiguredAppPin()) {
    return NextResponse.json({ ok: false, error: "APP_PIN ကို server environment တွင် မှန်ကန်စွာ မသတ်မှတ်ရသေးပါ။" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const submittedPin = String(body?.pin || "").replace(/\D/g, "").slice(0, 6);
  if (!isValidAppPin(submittedPin)) {
    return NextResponse.json({ ok: false, error: "PIN code မှားနေပါသည်။" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
