import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { buildKpayRawText, extractKpayAmount, extractKpayName } from "@/lib/kpay";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

function isAuthorized(request) {
  const configuredSecret = String(process.env.KPAY_WEBHOOK_SECRET || "").trim();
  if (!configuredSecret) return true;
  return request.headers.get("x-kpay-webhook-secret") === configuredSecret;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized KPay webhook request" }, { status: 401 });
  }
  try {
    await ensureDatabase();

    const body = await request.json();
    const title = body.title || "";
    const text = body.text || "";
    const raw_text = buildKpayRawText(title, text);
    const amount = extractKpayAmount(text || raw_text);
    const kpayName = body.kpayName?.trim() || body.sender?.trim() || extractKpayName(title, text);

    if (!raw_text) {
      return NextResponse.json({ error: "title or text is required" }, { status: 400 });
    }

    if (!amount) {
      return NextResponse.json({ error: "Could not extract amount from text" }, { status: 400 });
    }

    const alias = kpayName
      ? await prisma.kpayAlias.findUnique({
          where: { kpayName },
          include: { customer: true },
        })
      : null;

    const kpay = await prisma.unverifiedKpay.create({
      data: {
        raw_text,
        kpayName,
        amount,
        status: "PENDING",
        suggestedCustomerId: alias?.customerId || null,
      },
      include: {
        suggestedCustomer: true,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const suggestion = alias?.customer?.name ? ` (${alias.customer.name} နှင့်တွဲရန် အကြံပြု)` : "";
    const message = `🚨 KPay ငွေဝင်ပြီ - ပမာဏ: ${amount.toLocaleString()} ကျပ်${suggestion}။ စစ်ဆေးရန်: ${appUrl}`;

    try {
      await sendTelegramMessage(message);
    } catch (error) {
      console.error(error);
    }

    return NextResponse.json({
      ok: true,
      success: true,
      message: "Data synced successfully",
      extracted_amount: amount,
      data: kpay,
      id: kpay.id,
    });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
