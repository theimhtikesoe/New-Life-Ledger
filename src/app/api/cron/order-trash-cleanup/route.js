import { NextResponse } from "next/server";
import { purgeExpiredCancelledOrders } from "@/lib/order-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request) {
  return POST(request);
}

export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized cron request" }, { status: 401 });
  try {
    const result = await purgeExpiredCancelledOrders({ actorName: "System" });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Order Trash cleanup failed", error);
    return NextResponse.json({ ok: false, error: "Order Trash cleanup မအောင်မြင်ပါ။" }, { status: 500 });
  }
}
