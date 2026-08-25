import { NextResponse } from "next/server";
import { getTelegramWebhookInfo, setTelegramOrderWebhook } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function productionUrl() {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (/^https:\/\/(?!localhost(?:[:/]|$)|127\.0\.0\.1(?:[:/]|$))/i.test(configured)) return `${configured}/api/telegram/order-webhook`;
  const vercelUrl = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim().replace(/\/$/, "");
  if (vercelUrl) return `https://${vercelUrl}/api/telegram/order-webhook`;
  return "";
}

function publicInfo(info) {
  return {
    url: String(info?.url || ""),
    hasCustomCertificate: Boolean(info?.has_custom_certificate),
    pendingUpdateCount: Number(info?.pending_update_count || 0),
    lastErrorDatePresent: Number.isInteger(Number(info?.last_error_date)),
    lastErrorMessage: info?.last_error_message ? String(info.last_error_message).slice(0, 240) : null,
    allowedUpdates: Array.isArray(info?.allowed_updates) ? info.allowed_updates.map((item) => String(item)).slice(0, 20) : [],
  };
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, data: publicInfo(await getTelegramWebhookInfo()) });
  } catch (error) {
    console.error("Telegram webhook info failed", error);
    return NextResponse.json({ ok: false, error: "Telegram webhook status ကို ဖတ်မရသေးပါ။" }, { status: 502 });
  }
}

export async function POST() {
  if (String(process.env.VERCEL_ENV || "").toLowerCase() !== "production") {
    return NextResponse.json({ ok: false, error: "Production deployment မှာပဲ webhook register လုပ်နိုင်ပါသည်။" }, { status: 409 });
  }
  const url = productionUrl();
  const secretToken = String(process.env.TELEGRAM_ORDER_WEBHOOK_SECRET || "").trim();
  if (!url || !secretToken) {
    return NextResponse.json({ ok: false, error: "Production webhook URL/secret မပြည့်စုံသေးပါ။" }, { status: 409 });
  }
  try {
    await setTelegramOrderWebhook({ url, secretToken });
    const info = await getTelegramWebhookInfo();
    const verified = String(info?.url || "") === url && Number(info?.pending_update_count || 0) >= 0;
    return NextResponse.json({ ok: verified, data: { registered: verified, webhook: publicInfo(info) } }, { status: verified ? 200 : 502 });
  } catch (error) {
    console.error("Telegram webhook registration failed", error);
    return NextResponse.json({ ok: false, error: "Telegram webhook register မအောင်မြင်ပါ။" }, { status: 502 });
  }
}
