import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getRecentMyanmarDayRanges } from "@/lib/myanmar-time";
import { accountingAuditLogWhere } from "@/lib/accounting-activity";
import { normalizeCashSaleType } from "@/lib/cash-sale-utils";

export const dynamic = "force-dynamic";

const MAX_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function toAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function isAccountingActivity(log) {
  const entityType = String(log?.entityType || "").trim().toLowerCase();
  if (entityType === "order" || entityType === "orderbatch") return false;
  return !String(log?.action || "").trim().toUpperCase().startsWith("ORDER_");
}

function makePoint(range) {
  return {
    date: range.dateLabel,
    start: range.start,
    end: range.end,
    paidCount: 0,
    paidAmount: 0,
    debtCount: 0,
    debtAmount: 0,
    cashCount: 0,
    cashAmount: 0,
    cashRetailCount: 0,
    cashWholesaleCount: 0,
    activityCount: 0,
  };
}

function findPoint(points, value) {
  const time = new Date(value).getTime();
  return points.find((point) => time >= point.start.getTime() && time < point.end.getTime());
}

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const requestedDays = Number(searchParams.get("days") || MAX_DAYS);
    const days = Math.min(Math.max(Number.isFinite(requestedDays) ? requestedDays : MAX_DAYS, 3), MAX_DAYS);
    const ranges = getRecentMyanmarDayRanges(new Date(), days);
    const start = ranges[0].start;
    const end = new Date(ranges[ranges.length - 1].end.getTime() + DAY_MS);
    const points = ranges.map(makePoint);

    const [ledgers, cashSales, allAuditLogs] = await Promise.all([
      prisma.ledger.findMany({
        where: { date: { gte: start, lt: end } },
        select: { id: true, date: true, type: true, amount: true },
      }),
      prisma.cashSale.findMany({
        where: { date: { gte: start, lt: end } },
        select: { date: true, saleType: true, amount: true },
      }),
      prisma.auditLog.findMany({
        where: {
          AND: [
            { createdAt: { gte: start, lt: end } },
            { NOT: { action: "DAILY_REPORT_SENT" } },
            accountingAuditLogWhere(),
          ],
        },
        select: { createdAt: true, action: true, entityType: true, entityId: true, hiddenAt: true },
      }),
    ]);

    const auditLogs = allAuditLogs.filter((log) => !log.hiddenAt && isAccountingActivity(log));
    const auditedLedgerIds = new Set(
      auditLogs
        .filter((log) => log.entityType === "Ledger" && log.entityId)
        .map((log) => String(log.entityId)),
    );

    for (const ledger of ledgers) {
      const point = findPoint(points, ledger.date);
      if (!point) continue;
      const amount = toAmount(ledger.amount);
      if (ledger.type === "DEBIT") {
        point.paidCount += 1;
        point.paidAmount += amount;
      } else {
        point.debtCount += 1;
        point.debtAmount += amount;
      }
      if (!auditedLedgerIds.has(String(ledger.id))) point.activityCount += 1;
    }

    for (const cashSale of cashSales) {
      const point = findPoint(points, cashSale.date);
      if (!point) continue;
      const amount = toAmount(cashSale.amount);
      const saleType = normalizeCashSaleType(cashSale.saleType);
      point.cashCount += 1;
      point.cashAmount += amount;
      if (saleType === "WHOLESALE") point.cashWholesaleCount += 1;
      else point.cashRetailCount += 1;
    }

    for (const log of auditLogs) {
      const point = findPoint(points, log.createdAt);
      if (point) point.activityCount += 1;
    }

    const totals = points.reduce((summary, point) => {
      for (const key of Object.keys(summary)) summary[key] += point[key];
      return summary;
    }, {
      paidCount: 0,
      paidAmount: 0,
      debtCount: 0,
      debtAmount: 0,
      cashCount: 0,
      cashAmount: 0,
      activityCount: 0,
    });

    return NextResponse.json({
      data: {
        days: points.map(({ start: _start, end: _end, ...point }) => point),
        totals,
      },
    });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
