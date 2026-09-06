import { NextResponse } from "next/server";
import { getMyanmarDateInputValue } from "@/lib/myanmar-time";
import { runMorningOrderBatch } from "@/lib/order-delivery";

export const dynamic = "force-dynamic";

function isAuthorized(request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${secret}`;
}

export async function GET(request) {
  return POST(request);
}

export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized cron request" }, { status: 401 });
  try {
    const date = getMyanmarDateInputValue();
    const result = await runMorningOrderBatch({ batchDate: date, actorName: "Rhyzoe" });
    return NextResponse.json({ ok: true, date, ...result });
  } catch (error) {
    console.error("Order morning batch failed", error);
    return NextResponse.json({ ok: false, error: "Order morning batch မအောင်မြင်ပါ။" }, { status: 500 });
  }
}
