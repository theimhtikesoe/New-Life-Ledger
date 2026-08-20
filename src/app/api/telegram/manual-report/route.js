import { NextResponse } from "next/server";
import { runDailyReport } from "@/lib/daily-report-delivery";
import { decodeActorHeader } from "@/lib/actor-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request) {
  const configuredPin = process.env.MANUAL_REPORT_PIN || process.env.CRON_SECRET;
  if (!configuredPin) return false;
  return request.headers.get("authorization") === `Bearer ${configuredPin}`;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "PIN code မှားနေပါသည် သို့မဟုတ် report PIN မသတ်မှတ်ရသေးပါ။" }, { status: 401 });
  }

  try {
    const actorName = decodeActorHeader(request.headers.get("x-actor-name")) || "Manual User";
    return NextResponse.json({
      ok: true,
      ...(await runDailyReport({ actorName, trigger: "manual" })),
    });
  } catch (error) {
    console.error("Manual Telegram report failed", error);
    return NextResponse.json({ ok: false, error: error.message || "Telegram report ပို့ခြင်း မအောင်မြင်ပါ။" }, { status: 500 });
  }
}
