import { NextResponse } from "next/server";
import { decodeActorHeader } from "@/lib/actor-header";
import {
  explainAiDailySummary,
  findAiExplanationCache,
  findLatestAiExplanationCache,
  getAiDailySummaryFingerprint,
  getAiDailySummaryPayload,
  saveAiExplanationCache,
} from "@/lib/ai-daily-summary";

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
  const cacheOnly = searchParams.get("cacheOnly") === "1";
  if (!isValidDate(requestedDate)) {
    return NextResponse.json({ ok: false, error: "ရွေးထားသောရက်စွဲ မမှန်ကန်ပါ။" }, { status: 400 });
  }

  try {
    const payload = await getAiDailySummaryPayload(requestedDate);
    const fingerprint = getAiDailySummaryFingerprint(payload);
    const cached = await findAiExplanationCache({ date: requestedDate, fingerprint });
    if (cached?.explanation) {
      return NextResponse.json({
        ok: true,
        data: {
          date: requestedDate,
          explanation: cached.explanation,
          cached: true,
          stale: false,
          generatedAt: cached.updatedAt,
        },
      });
    }

    const previous = await findLatestAiExplanationCache(requestedDate);
    if (cacheOnly) {
      return NextResponse.json({
        ok: true,
        data: {
          date: requestedDate,
          explanation: cached?.explanation || previous?.explanation || null,
          cached: Boolean(cached?.explanation),
          stale: Boolean(previous?.explanation && !cached?.explanation),
          dataChanged: Boolean(previous?.explanation && !cached?.explanation),
          generatedAt: (cached || previous)?.updatedAt || null,
        },
      });
    }
    try {
      const explanation = await explainAiDailySummary(payload);
      const saved = await saveAiExplanationCache({
        date: requestedDate,
        fingerprint,
        explanation,
        actorName: decodeActorHeader(request.headers.get("x-actor-name") || "").trim() || "Staff",
        provider: process.env.MANUS_API_KEY?.trim() ? "MANUS_API" : "LLM_FALLBACK",
        model: process.env.MANUS_API_KEY?.trim() ? "manus-1.6-lite" : (process.env.MANUS_LLM_MODEL || "gpt-5-mini"),
      });
      return NextResponse.json({
        ok: true,
        data: {
          date: requestedDate,
          explanation,
          cached: false,
          stale: false,
          saved: Boolean(saved),
          generatedAt: saved?.updatedAt || new Date().toISOString(),
        },
      });
    } catch (error) {
      if (previous?.explanation) {
        return NextResponse.json({
          ok: true,
          data: {
            date: requestedDate,
            explanation: previous.explanation,
            cached: true,
            stale: true,
            dataChanged: true,
            generatedAt: previous.updatedAt,
          },
          warning: "ဒီရက်စာရင်း ပြောင်းထားသော်လည်း AI အသစ်ရှင်းပြချက် မရသေးပါ။ သိမ်းထားသော အဟောင်းကို ပြထားပါသည်။",
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("AI Daily Summary explanation failed", error);
    const message = String(error?.message || "");
    const knownSafeCodes = new Set(["MANUS_AUTH", "MANUS_RATE_LIMIT", "MANUS_SERVICE", "MANUS_REQUEST", "MANUS_TASK", "MANUS_EMPTY", "MANUS_TIMEOUT", "MANUS_NETWORK", "MANUS_TRANSIENT_NOT_FOUND"]);
    const safeMessage = knownSafeCodes.has(error?.code) || message.includes("AI provider credential") || message.includes("အချိန်ကျော်")
      ? message
      : "AI ရှင်းပြချက် ရယူရာတွင် အမှားဖြစ်ပါသည်။ ပြန်စမ်းကြည့်ပါ။";
    return NextResponse.json({ ok: false, error: safeMessage }, { status: 503 });
  }
}
