import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getMyanmarDayRange } from "@/lib/myanmar-time";
import { hydrateSettledBottleSaleItems } from "@/lib/bottle-sales-ledger";
import { buildDailyBottleSalesSummary } from "@/lib/daily-bottle-sales";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await ensureDatabase();
    const date = new URL(request.url).searchParams.get("date") || getMyanmarDayRange().dateLabel;
    const { start, end } = getMyanmarDayRange(date);
    let ledgers = await prisma.ledger.findMany({
      where: { date: { gte: start, lt: end }, type: "DEBIT" },
      select: { id: true, amount: true, date: true, type: true, saleType: true, note: true, saleItems: true, customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { date: "desc" },
    });
    ledgers = await hydrateSettledBottleSaleItems(prisma, ledgers);
    const creditLedgers = await prisma.ledger.findMany({
      where: { date: { gte: start, lt: end }, type: "CREDIT" },
      select: { id: true, amount: true, date: true, saleType: true, saleItems: true, customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { date: "desc" },
    });
    const cashSales = await prisma.cashSale.findMany({
      where: { date: { gte: start, lt: end } },
      select: { id: true, amount: true, date: true, saleType: true, saleItems: true, customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { date: "desc" },
    });

    // A DEBIT row settles a previous CREDIT order; the shared summary keeps it
    // separate from the physical sale total and prevents double counting.
    const summary = buildDailyBottleSalesSummary({ ledgers, creditLedgers, cashSales });

    return NextResponse.json({ data: {
      date,
      // Headline physical sales include cash and debt-increase rows only.
      // Payment-linked bottles remain separate below for reconciliation.
      ...summary,
    } });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
