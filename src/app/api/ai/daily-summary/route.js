import { NextResponse } from "next/server";
import { decodeActorHeader } from "@/lib/actor-header";
import { explainAiDailySummary, getAiDailySummaryPayload } from "@/lib/ai-daily-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const ACTORS = ["ဖေဖေ", "ပုံ့ပုံ့", "ဆောင်းဦး", "Staff"];

function isWebsiteAuthorized(request) {
  const actor = decodeActorHeader(request.headers.get("x-actor-name") || "").trim();
  return ACTORS.includes(actor);
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export async function GET(request) {
  if (!isWebsiteAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "AI ရှင်းပြချက်အတွက် Website ထဲသို့ အရင်ဝင်ရောက်ပါ။" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedDate = searchParams.get("date") || "";
  if (!isValidDate(requestedDate)) {
    return NextResponse.json({ ok: false, error: "ရွေးထားသောရက်စွဲ မမှန်ကန်ပါ။" }, { status: 400 });
  }

  try {
    const payload = await getAiDailySummaryPayload(requestedDate);
    const explanation = await explainAiDailySummary(payload);
    return NextResponse.json({ ok: true, data: { date: requestedDate, explanation } });
  } catch (error) {
    console.error("AI Daily Summary explanation failed", error);
    const message = String(error?.message || "");
    const safeMessage = message.includes("AI provider credential")
      ? message
      : message.includes("အချိန်ကျော်")
        ? message
        : "AI ရှင်းပြချက် ရယူရာတွင် အမှားဖြစ်ပါသည်။ ပြန်စမ်းကြည့်ပါ။";
    return NextResponse.json({ ok: false, error: safeMessage }, { status: 503 });
  }
}
