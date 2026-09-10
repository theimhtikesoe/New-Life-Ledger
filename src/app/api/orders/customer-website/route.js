import { NextResponse } from "next/server";
import { createOrderDraft } from "@/lib/order-service";

function configuredSecret() {
  return String(process.env.CUSTOMER_WEBSITE_ORDER_SECRET || "").trim();
}

function isAuthorized(request) {
  const secret = configuredSecret();
  if (!secret) return false;
  const headerSecret = String(
    request.headers.get("x-customer-website-secret") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "",
  ).trim();
  return headerSecret === secret;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function normalizeItem(item) {
  const cardCapacity = positiveInteger(item?.card_size ?? item?.cap_size);
  const cardQuantity = positiveInteger(item?.card_quantity);
  const totalBottles = positiveInteger(item?.total_caps) || (cardCapacity && cardQuantity ? cardCapacity * cardQuantity : null);
  const quotedAmount = positiveInteger(item?.total_price) || null;
  const quotedRate = positiveInteger(item?.price_per_bottle ?? item?.price_per_cap) || null;
  return {
    bottleType: String(item?.product_name || "").trim(),
    capacityMl: positiveInteger(item?.capacity_ml),
    capacityLabel: String(item?.capacity_label || item?.product_name || "").trim(),
    bottlesPerCard: cardCapacity,
    cardCount: cardQuantity,
    totalBottles,
    quotedRate,
    quotedAmount,
    notes: String(item?.notes || "").trim() || null,
    unitType: item?.unit_type === "cap" ? "cap" : "bottle",
  };
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized website order import." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const milesOrderId = String(body?.milesOrderId || "").trim();
    const customerName = String(body?.customer?.name || "").trim();
    const customerPhone = String(body?.customer?.phone || "").trim();
    const customerCity = String(body?.customer?.city || body?.customer?.destination || "").trim();
    const items = Array.isArray(body?.items) ? body.items.map(normalizeItem) : [];
    const bottleItems = items.filter((item) => item.unitType !== "cap");
    const capItems = items.filter((item) => item.unitType === "cap");

    if (!milesOrderId || !customerName || !customerPhone || !customerCity || !items.length) {
      return NextResponse.json(
        { ok: false, error: "milesOrderId, customer details, city, and items are required." },
        { status: 400 },
      );
    }

    if (bottleItems.some((item) => !item.bottleType || !item.bottlesPerCard || !item.cardCount || !item.totalBottles)) {
      return NextResponse.json({ ok: false, error: "Every website order item needs card capacity and quantity." }, { status: 400 });
    }

    const sourceText = [
      "Customer Website Order",
      `Miles Order ID: ${milesOrderId}`,
      `Customer: ${customerName}`,
      `Phone: ${customerPhone}`,
      `City: ${customerCity}`,
      ...items.map((item) => item.unitType === "cap"
        ? `${item.bottleType} — ${item.totalBottles} caps`
        : `${item.bottleType} — ${item.bottlesPerCard} bottles/card × ${item.cardCount} cards`),
    ].join("\n");

    const result = await createOrderDraft({
      sourceChatId: "customer-website",
      sourceMessageId: milesOrderId,
      sourceUpdateId: `miles:${milesOrderId}`,
      sourceText,
      source: "customer_website",
      extracted: {
        customerName,
        customerPhone,
        requestedDate: null,
        destination: customerCity,
        notes: body?.customer?.notes || null,
        lines: bottleItems,
        caps: capItems.map((item) => ({
          capType: item.bottleType,
          normalPcs: item.totalBottles,
          extraPcs: 0,
          notes: item.notes,
        })),
        confidence: "high",
      },
    });

    return NextResponse.json({
      ok: true,
      duplicate: Boolean(result.duplicate),
      data: {
        ledgerOrderId: result.order?.id,
        milesOrderId,
        status: result.order?.status,
        source: "customer_website",
      },
    }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    console.error("Customer website order import failed", error);
    return NextResponse.json({ ok: false, error: "Customer website order import failed." }, { status: 500 });
  }
}
