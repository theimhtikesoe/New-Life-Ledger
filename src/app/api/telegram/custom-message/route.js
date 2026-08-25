import { NextResponse } from "next/server";
import { sendTelegramPlainTextMessage } from "@/lib/telegram";
import { ensureDatabase } from "@/lib/database";
import { getActorName, writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_MESSAGE_LENGTH = 4000;

function isAuthorized(request) {
  const configuredPin = process.env.MANUAL_REPORT_PIN || process.env.CRON_SECRET;
  if (!configuredPin) return false;
  return request.headers.get("authorization") === `Bearer ${configuredPin}`;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "PIN code မှားနေပါသည် သို့မဟုတ် Telegram ပို့ရန် PIN မသတ်မှတ်ရသေးပါ။" },
      { status: 401 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ ok: false, error: "ပို့မည့်စာကို အရင်ရေးပါ။" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { ok: false, error: `စာသားသည် အများဆုံး ${MAX_MESSAGE_LENGTH} လုံးအထိသာ ရပါသည်။` },
        { status: 400 },
      );
    }

    const result = await sendTelegramPlainTextMessage(message);
    if (!result?.skipped) {
      try {
        await ensureDatabase();
        await writeAuditLog({
          actorName: getActorName(request),
          action: "TELEGRAM_CUSTOM_MESSAGE_SENT",
          entityType: "Telegram",
          entityLabel: "Telegram Group",
          summary: `Telegram custom message ပို့ပြီး (${message.length} လုံး)`,
          metadata: { messageLength: message.length },
        });
      } catch (auditError) {
        console.error("Custom Telegram message audit failed", auditError);
      }
    }
    return NextResponse.json({ ok: true, data: { sent: !result?.skipped, messageLength: message.length } });
  } catch (error) {
    console.error("Custom Telegram message failed", error);
    return NextResponse.json(
      { ok: false, error: "Telegram သို့ စာပို့ရာတွင် အမှားဖြစ်ပါသည်။ ပြန်စမ်းကြည့်ပါ။" },
      { status: 500 },
    );
  }
}
