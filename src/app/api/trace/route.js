import { NextResponse } from "next/server";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getMyanmarDayRange } from "@/lib/myanmar-time";
import { loadCanonicalFactoryStockMovements } from "@/lib/factory-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value) {
  return String(value ?? "").trim();
}

function matchesQuery(row, query) {
  if (!query) return true;
  const haystack = [
    row.title,
    row.subtitle,
    row.sourceType,
    row.sourceId,
    row.customerName,
    row.productKey,
    row.productName,
    row.reason,
    row.note,
    JSON.stringify(row.saleItems || ""),
  ].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function movementEvent(movement) {
  const quantity = Number(movement.quantityBottles || movement.quantityCards || 0);
  const unit = movement.stockType === "TUBE" ? "pcs" : movement.stockType === "CAP" ? "ဖုံး/အဖုံး" : "ဗူး";
  const direction = quantity >= 0 ? "ဝင်" : "နုတ်/ထွက်";
  return {
    id: `movement-${movement.id || movement.sourceType}-${movement.sourceId}-${movement.productKey}-${movement.movementType}`,
    kind: "STOCK_MOVEMENT",
    date: movement.movementDate,
    title: `${movement.productName || movement.productKey} — ${direction} ${Math.abs(quantity).toLocaleString()} ${unit}`,
    subtitle: `${movement.movementType} · ${movement.stockType} · ${movement.reason || "Stock movement"}`,
    sourceType: movement.sourceType || "MANUAL",
    sourceId: movement.sourceId || movement.id || null,
    productKey: movement.productKey,
    productName: movement.productName,
    stockType: movement.stockType,
    quantity,
    unit,
    reason: movement.reason,
    note: movement.note,
  };
}

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const query = text(searchParams.get("q"));
    const from = text(searchParams.get("from"));
    const to = text(searchParams.get("to"));
    const requestedLimit = Number(searchParams.get("limit") || 250);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 250, 25), 1000);
    const date = {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) date.gte = getMyanmarDayRange(from).start;
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) date.lt = getMyanmarDayRange(to).end;
    const dateWhere = Object.keys(date).length ? { date } : {};
    const movementDateWhere = {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) movementDateWhere.gte = from;
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) movementDateWhere.lte = to;

    const [movementsResult, productions, ledgers, cashSales, auditLogs] = await Promise.all([
      loadCanonicalFactoryStockMovements({ actorName: "trace" }),
      prisma.productionReport.findMany({
        where: Object.keys(movementDateWhere).length ? { reportDate: movementDateWhere } : {},
        orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
        take: limit,
      }),
      prisma.ledger.findMany({
        where: dateWhere,
        select: { id: true, date: true, type: true, amount: true, paymentType: true, note: true, saleItems: true, customer: { select: { id: true, name: true } } },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: limit,
      }),
      prisma.cashSale.findMany({
        where: dateWhere,
        select: { id: true, date: true, amount: true, paymentType: true, note: true, saleItems: true, customer: { select: { id: true, name: true } } },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: limit,
      }),
      prisma.auditLog.findMany({
        where: Object.keys(date).length ? { createdAt: date } : {},
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      }),
    ]);

    const movementEvents = movementsResult.movements.map(movementEvent);
    const productionEvents = productions.map((row) => ({
      id: `production-${row.id}`,
      kind: "PRODUCTION",
      date: row.reportDate,
      title: `${row.category === "tube" ? "Tube" : "ဗူး"} ထုတ်လုပ်မှု — ${row.outputQuantity?.toLocaleString?.() || row.outputQuantity} ${row.outputUnit || "ယူနစ်"}`,
      subtitle: `${row.bottleType || row.tubeG || "အမျိုးအစားမသတ်မှတ်ရသေး"}${row.outputCapacity ? ` · ${row.outputCapacity} ဆံ့` : ""}`,
      sourceType: "PRODUCTION",
      sourceId: row.id,
      productName: row.bottleType || row.tubeG || "",
      quantity: Number(row.outputQuantity || 0),
      unit: row.outputUnit || "ယူနစ်",
      reason: row.notes || null,
    }));
    const ledgerEvents = ledgers.map((row) => ({
      id: `ledger-${row.id}`,
      kind: "TRANSACTION",
      date: row.date,
      title: `${row.customer?.name || "Customer"} — ${row.type === "DEBIT" ? "ငွေချေ" : "အကြွေးတိုး"} ${Number(row.amount || 0).toLocaleString()} Ks`,
      subtitle: `${row.type} · ${row.paymentType || "ငွေချေမှု မသတ်မှတ်ရသေး"}${Array.isArray(row.saleItems) ? ` · ${row.saleItems.length} item` : ""}`,
      sourceType: "LEDGER",
      sourceId: row.id,
      customerName: row.customer?.name,
      customerId: row.customer?.id,
      amount: Number(row.amount || 0),
      saleItems: row.saleItems,
      note: row.note,
    }));
    const cashEvents = cashSales.map((row) => ({
      id: `cash-${row.id}`,
      kind: "CASH_SALE",
      date: row.date,
      title: `${row.customer?.name || "Customer"} — လက်ငင်းရောင်း ${Number(row.amount || 0).toLocaleString()} Ks`,
      subtitle: `${row.paymentType || "CASH"}${Array.isArray(row.saleItems) ? ` · ${row.saleItems.length} item` : ""}`,
      sourceType: "CASH_SALE",
      sourceId: row.id,
      customerName: row.customer?.name,
      customerId: row.customer?.id,
      amount: Number(row.amount || 0),
      saleItems: row.saleItems,
      note: row.note,
    }));
    const auditEvents = auditLogs.map((row) => ({
      id: `audit-${row.id}`,
      kind: "AUDIT",
      date: row.createdAt,
      title: row.summary || `${row.action || "Activity"} — ${row.entityLabel || row.entityType || ""}`,
      subtitle: `${row.action || "ACTIVITY"} · ${row.entityType || ""}`,
      sourceType: row.entityType || "AUDIT",
      sourceId: row.entityId || row.id,
      reason: row.summary,
      note: row.actorName ? `လုပ်သူ: ${row.actorName}` : null,
    }));

    const all = [...movementEvents, ...productionEvents, ...ledgerEvents, ...cashEvents, ...auditEvents]
      .filter((row) => matchesQuery(row, query))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
    return NextResponse.json({ data: { items: all, counts: { total: all.length, movements: movementEvents.filter((row) => matchesQuery(row, query)).length, productions: productionEvents.filter((row) => matchesQuery(row, query)).length, transactions: [...ledgerEvents, ...cashEvents].filter((row) => matchesQuery(row, query)).length, activities: auditEvents.filter((row) => matchesQuery(row, query)).length }, dataSource: movementsResult.dataSource, filters: { q: query || null, from: from || null, to: to || null } } });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
