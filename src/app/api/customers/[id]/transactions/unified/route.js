import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getMyanmarDayRange } from "@/lib/myanmar-time";

export const dynamic = "force-dynamic";

const ledgerSelect = {
  id: true,
  date: true,
  createdAt: true,
  actorName: true,
  type: true,
  saleType: true,
  itemSize: true,
  cartons: true,
  rate: true,
  deductions: true,
  amount: true,
  discountAmount: true,
  discountNote: true,
  note: true,
  paymentType: true,
  saleItems: true,
};

const cashSaleSelect = {
  id: true,
  date: true,
  createdAt: true,
  saleType: true,
  itemSize: true,
  cartons: true,
  rate: true,
  deductions: true,
  amount: true,
  note: true,
  paymentType: true,
  paymentBreakdown: true,
  saleItems: true,
};

function encodeCursor(row) {
  return Buffer.from(JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id })).toString("base64url");
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const createdAt = new Date(parsed.createdAt);
    if (!parsed.id || Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: String(parsed.id) };
  } catch {
    return null;
  }
}

function cursorWhere(cursor) {
  if (!cursor) return {};
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

function dateWhere(searchParams) {
  const date = {};
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  if (startDate) date.gte = getMyanmarDayRange(startDate).start;
  if (endDate) date.lt = getMyanmarDayRange(endDate).end;
  return Object.keys(date).length ? { date } : {};
}

function newestFirst(a, b) {
  const createdDifference = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  return createdDifference || String(b.id).localeCompare(String(a.id));
}

export async function GET(request, { params }) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get("limit") || 50);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 50, 1), 100);
    const cursorValue = searchParams.get("cursor");
    const cursor = decodeCursor(cursorValue);
    if (cursorValue && !cursor) {
      return NextResponse.json({ error: "Transaction cursor မမှန်ကန်ပါ။" }, { status: 400 });
    }
    const commonWhere = { customerId: params.id, ...dateWhere(searchParams), ...cursorWhere(cursor) };
    const [ledgerRows, cashSaleRows] = await Promise.all([
      prisma.ledger.findMany({ where: commonWhere, select: ledgerSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 }),
      prisma.cashSale.findMany({ where: commonWhere, select: cashSaleSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 }),
    ]);

    const merged = [
      ...ledgerRows,
      ...cashSaleRows.map((row) => ({ ...row, type: "CASH_SALE", recordType: "CASH_SALE" })),
    ].sort(newestFirst);
    const items = merged.slice(0, limit);
    const hasMore = merged.length > limit || ledgerRows.length > limit || cashSaleRows.length > limit;
    const nextCursor = hasMore && items.length ? encodeCursor(items[items.length - 1]) : null;
    const includeCount = searchParams.get("includeCount") === "true" && !cursor;
    const total = includeCount
      ? (await Promise.all([
        prisma.ledger.count({ where: { customerId: params.id, ...dateWhere(searchParams) } }),
        prisma.cashSale.count({ where: { customerId: params.id, ...dateWhere(searchParams) } }),
      ])).reduce((sum, count) => sum + count, 0)
      : null;

    return NextResponse.json({
      data: {
        items,
        pagination: { limit, total, nextCursor, hasMore },
      },
    });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
