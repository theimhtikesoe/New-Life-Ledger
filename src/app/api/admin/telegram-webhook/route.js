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

function isValidSecretToken(secretToken) {
  return /^[A-Za-z0-9_-]{1,256}$/.test(String(secretToken || ""));
}

function isValidWebhookUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    return parsed.protocol === "https:"
      && !parsed.username
      && !parsed.password
      && !parsed.search
      && !parsed.hash
      && parsed.pathname === "/api/telegram/order-webhook";
  } catch {
    return false;
  }
}

function safeFailureDiagnostic(error, stage) {
  const message = String(error?.message || "").toLowerCase();
  const statusMatch = message.match(/failed:\s+(\d{3})/);
  let category = "unknown_telegram_failure";
  if (message.includes("unauthorized")) category = "telegram_token_rejected";
  else if (message.includes("failed to resolve") || message.includes("resolve host") || message.includes("cannot resolve") || message.includes("could not resolve")) category = "webhook_host_unreachable";
  else if (message.includes("bad webhook")) category = "bad_webhook_configuration";
  else if (message.includes("certificate")) category = "webhook_certificate_problem";
  else if (message.includes("https")) category = "webhook_https_required";
  else if (message.includes("port")) category = "webhook_port_rejected";
  else if (message.includes("invalid webhook") || message.includes("webhook url")) category = "webhook_url_rejected";
  else if (message.includes("secret")) category = "webhook_secret_rejected";
  else if (message.includes("bad request")) category = "telegram_bad_request";
  return {
    stage,
    category,
    telegramHttpStatus: statusMatch ? Number(statusMatch[1]) : null,
  };
}

export async function GET() {
  const url = productionUrl();
  const secretToken = String(process.env.TELEGRAM_ORDER_WEBHOOK_SECRET || "").trim();
  const config = {
    productionUrlConfigured: Boolean(url),
    productionUrlFormatValid: isValidWebhookUrl(url),
    secretConfigured: Boolean(secretToken),
    secretFormatValid: isValidSecretToken(secretToken),
    botTokenConfigured: Boolean(String(process.env.TELEGRAM_BOT_TOKEN || "").trim()),
    productionEnvironment: String(process.env.VERCEL_ENV || "").toLowerCase() === "production",
  };
  try {
    return NextResponse.json({ ok: true, data: { config, webhook: publicInfo(await getTelegramWebhookInfo()) } });
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
    return NextResponse.json({
      ok: false,
      error: "Production webhook URL/secret မပြည့်စုံသေးပါ။",
      missing: { productionUrl: !url, secret: !secretToken },
    }, { status: 409 });
  }
  if (!isValidWebhookUrl(url) || !isValidSecretToken(secretToken)) {
    return NextResponse.json({
      ok: false,
      error: "Production webhook URL/secret format မမှန်သေးပါ။",
      invalid: { productionUrl: !isValidWebhookUrl(url), secret: !isValidSecretToken(secretToken) },
    }, { status: 409 });
  }
  let stage = "setWebhook";
  try {
    await setTelegramOrderWebhook({ url, secretToken });
    stage = "getWebhookInfo";
    const info = await getTelegramWebhookInfo();
    const verified = String(info?.url || "") === url && Number(info?.pending_update_count || 0) >= 0;
    return NextResponse.json({ ok: verified, data: { registered: verified, webhook: publicInfo(info) } }, { status: verified ? 200 : 502 });
  } catch (error) {
    console.error("Telegram webhook registration failed", { stage, error });
    return NextResponse.json({
      ok: false,
      error: "Telegram webhook register မအောင်မြင်ပါ။",
      diagnostic: safeFailureDiagnostic(error, stage),
    }, { status: 502 });
  }
}
