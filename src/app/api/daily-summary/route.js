import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getMyanmarDayRange } from "@/lib/myanmar-time";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date") || getMyanmarDayRange().dateLabel;
    const { start, end } = getMyanmarDayRange(dateParam);

    const [ledgers, cashSales, allAuditLogs] = await Promise.all([
      prisma.ledger.findMany({
        where: { date: { gte: start, lt: end } },
        select: {
          id: true,
          date: true,
          type: true,
          amount: true,
          paymentType: true,
          note: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
      }),
      prisma.cashSale.findMany({
        where: { date: { gte: start, lt: end } },
        select: {
          id: true,
          date: true,
          saleType: true,
          itemSize: true,
          cartons: true,
          rate: true,
          deductions: true,
          amount: true,
          note: true,
          paymentType: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
      }),
      prisma.auditLog.findMany({
        where: {
          AND: [
            { createdAt: { gte: start, lt: end } },
            { NOT: { action: "DAILY_REPORT_SENT" } },
            { NOT: { entityType: "Order" } },
          ],
        },
        select: {
          entityType: true,
          entityId: true,
          hiddenAt: true,
        },
      }),
    ]);

    const auditLogs = allAuditLogs.filter((log) => !log.hiddenAt);
    const auditedLedgerIds = new Set(
      allAuditLogs
        .filter((log) => log.entityType === "Ledger" && log.entityId)
        .map((log) => String(log.entityId)),
    );
    const activityCount = auditLogs.length + ledgers.filter((ledger) => !auditedLedgerIds.has(String(ledger.id))).length;

    const summary = {
      paidCount: 0,
      paidAmount: 0,
      unpaidCount: 0,
      unpaidAmount: 0,
      cashCount: cashSales.length,
      cashAmount: cashSales.reduce((total, sale) => total + Number(sale.amount || 0), 0),
      totalTransactions: ledgers.length,
      auditCount: auditLogs.length,
      activityCount,
      paymentTypes: {},
      cashPaymentTypes: {},
    };
    const customerMap = new Map();

    for (const ledger of ledgers) {
      const isPaid = ledger.type === "DEBIT";
      if (isPaid) {
        summary.paidCount += 1;
        summary.paidAmount += ledger.amount;
      } else {
        summary.unpaidCount += 1;
        summary.unpaidAmount += ledger.amount;
      }

      if (isPaid) {
        const paymentType = ledger.paymentType || "မသတ်မှတ်ရသေး";
        summary.paymentTypes[paymentType] = (summary.paymentTypes[paymentType] || 0) + ledger.amount;
      }

      const current = customerMap.get(ledger.customer.id) || {
        customerId: ledger.customer.id,
        customerName: ledger.customer.name,
        paidCount: 0,
        paidAmount: 0,
        unpaidCount: 0,
        unpaidAmount: 0,
        cashCount: 0,
        cashAmount: 0,
      };
      if (isPaid) {
        current.paidCount += 1;
        current.paidAmount += ledger.amount;
      } else {
        current.unpaidCount += 1;
        current.unpaidAmount += ledger.amount;
      }
      customerMap.set(ledger.customer.id, current);
    }

    for (const cashSale of cashSales) {
      const current = customerMap.get(cashSale.customer.id) || {
        customerId: cashSale.customer.id,
        customerName: cashSale.customer.name,
        paidCount: 0,
        paidAmount: 0,
        unpaidCount: 0,
        unpaidAmount: 0,
        cashCount: 0,
        cashAmount: 0,
      };
      current.cashCount += 1;
      current.cashAmount += Number(cashSale.amount || 0);
      const paymentType = cashSale.paymentType || "CASH";
      summary.cashPaymentTypes[paymentType] = (summary.cashPaymentTypes[paymentType] || 0) + Number(cashSale.amount || 0);
      customerMap.set(cashSale.customer.id, current);
    }

    return NextResponse.json({
      data: {
        date: dateParam,
        summary,
        customers: Array.from(customerMap.values()).sort((a, b) =>
          b.paidAmount + b.unpaidAmount + b.cashAmount - (a.paidAmount + a.unpaidAmount + a.cashAmount),
        ),
        transactions: ledgers,
        cashSales,
      },
    });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
