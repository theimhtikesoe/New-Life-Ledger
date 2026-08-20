import { NextResponse } from "next/server";
import { runDailyReport } from "@/lib/daily-report-delivery";
import { decodeActorHeader } from "@/lib/actor-header";
import { getMyanmarDayRange } from "@/lib/myanmar-time";

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
    const requestBody = await request.json().catch(() => ({}));
    const date = requestBody?.date;
    if (date) getMyanmarDayRange(date);
    const actorName = decodeActorHeader(request.headers.get("x-actor-name")) || "Manual User";
    return NextResponse.json({
      ok: true,
      ...(await runDailyReport({ actorName, trigger: "manual", date })),
    });
  } catch (error) {
    console.error("Manual Telegram report failed", error);
    const isInvalidDate = /report date မမှန်ကန်ပါ/.test(String(error?.message || ""));
    return NextResponse.json(
      { ok: false, error: error.message || "Telegram report ပို့ခြင်း မအောင်မြင်ပါ။" },
      { status: isInvalidDate ? 400 : 500 },
    );
  }
}
