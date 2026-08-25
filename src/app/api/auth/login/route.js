import { NextResponse } from "next/server";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth-session";
import { hasConfiguredAppPin, isValidAppPin } from "@/lib/app-pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attemptsByKey = globalThis.__newLifeLedgerPinAttempts || new Map();
globalThis.__newLifeLedgerPinAttempts = attemptsByKey;

function clientKey(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isThrottled(key, now) {
  const record = attemptsByKey.get(key);
  if (!record || now - record.startedAt >= WINDOW_MS) {
    attemptsByKey.set(key, { startedAt: now, count: 0 });
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function registerFailure(key, now) {
  const record = attemptsByKey.get(key) || { startedAt: now, count: 0 };
  if (now - record.startedAt >= WINDOW_MS) {
    attemptsByKey.set(key, { startedAt: now, count: 1 });
    return;
  }
  record.count += 1;
  attemptsByKey.set(key, record);
}

function clearFailures(key) {
  attemptsByKey.delete(key);
}

export async function POST(request) {
  const key = clientKey(request);
  const now = Date.now();
  if (isThrottled(key, now)) {
    return NextResponse.json(
      { ok: false, error: "ကြိုးစားမှုများလွန်းပါသည်။ ၁၅ မိနစ်အကြာတွင် ပြန်စမ်းပါ။" },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  if (!hasConfiguredAppPin()) {
    return NextResponse.json({ ok: false, error: "APP_PIN ကို server environment တွင် မှန်ကန်စွာ မသတ်မှတ်ရသေးပါ။" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const submittedPin = String(body?.pin || "").replace(/\D/g, "").slice(0, 6);
  if (!isValidAppPin(submittedPin)) {
    registerFailure(key, now);
    return NextResponse.json({ ok: false, error: "PIN code မှားနေပါသည်။ ထပ်မံ ကြိုးစားကြည့်ပါ။" }, { status: 401 });
  }

  clearFailures(key);
  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieOptions(token));
  return response;
}
