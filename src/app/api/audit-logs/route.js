import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { ACTORS } from "@/lib/audit";
import { getMyanmarDayRange } from "@/lib/myanmar-time";
import { normalizeCashSaleType } from "@/lib/cash-sale-utils";
import { accountingAuditLogWhere, isOrderWorkflowActivity } from "@/lib/accounting-activity";

export const dynamic = "force-dynamic";

function dateRange(dateParam) {
  if (!dateParam) return null;
  const { start, end } = getMyanmarDayRange(dateParam);
  return { gte: start, lt: end };
}

function legacyActionFilter(action) {
  if (action === "PAYMENT") return { type: "DEBIT" };
  if (action === "DEBT_INCREASE") return { type: "CREDIT" };
  return null;
}

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const actor = searchParams.get("actor");
    const action = searchParams.get("action");
    const includeOrders = searchParams.get("includeOrders") === "true";
    const limitParam = Number(searchParams.get("limit") || 100);
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? Math.floor(limitParam) : 100, 1), 500);
    const range = dateRange(dateParam);
        const legacyAction = legacyActionFilter(action);
    const isHiddenReportAction = action === "DAILY_REPORT_SENT";
    const includeLegacy = !actor && (!action || Boolean(legacyAction));
    const auditConditions = [
      range ? { createdAt: range } : null,
      ACTORS.includes(actor) ? { actorName: actor } : null,
      isHiddenReportAction ? { action: "__HIDDEN_DAILY_REPORT_SENT__" } : action ? { action } : null,
      !includeOrders ? accountingAuditLogWhere() : null,
      !action && !isHiddenReportAction ? { NOT: { action: "DAILY_REPORT_SENT" } } : null,
    ].filter(Boolean);
    const [allAuditLogs, legacyLedgers] = await Promise.all([
      prisma.auditLog.findMany({
        where: { AND: auditConditions },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      }),
      includeLegacy
        ? prisma.ledger.findMany({
            where: {
              ...(range ? { date: range } : {}),
              ...(legacyAction || {}),
            },
            select: {
              id: true,
              date: true,
              createdAt: true,
              type: true,
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
            take: limit,
          })
        : [],
    ]);

    const auditLogs = allAuditLogs.filter((log) => !log.hiddenAt && (includeOrders || !isOrderWorkflowActivity(log)));
    const cashSaleIds = allAuditLogs
      .filter((log) => log.entityType === "CashSale" && log.entityId)
      .map((log) => String(log.entityId));
    const cashSaleRows = cashSaleIds.length
      ? await prisma.cashSale.findMany({ where: { id: { in: cashSaleIds } }, select: { id: true, saleType: true, amount: true, paymentType: true } })
      : [];
    const cashSaleById = new Map(cashSaleRows.map((sale) => [String(sale.id), sale]));
    const auditedLedgerIds = new Set(
      allAuditLogs
        .filter((log) => log.entityType === "Ledger" && log.entityId)
        .map((log) => String(log.entityId)),
    );
    const legacyLogs = legacyLedgers
      .filter((ledger) => !auditedLedgerIds.has(String(ledger.id)))
      .map((ledger) => {
      const isPaid = ledger.type === "DEBIT";
      const actionName = isPaid ? "PAYMENT" : "DEBT_INCREASE";
      return {
        id: `legacy-${ledger.id}`,
        actorName: "",
        action: actionName,
        entityType: "Ledger",
        entityId: ledger.id,
        entityLabel: ledger.customer.name,
        summary: `${ledger.customer.name} ${isPaid ? "ငွေချေ" : "အကြွေးတိုး"} ${ledger.amount.toLocaleString()} Ks`,
        createdAt: ledger.date,
        eventDate: ledger.date,
        eventSource: "legacy",
        metadata: {
          customerId: ledger.customer.id,
          amount: ledger.amount,
          type: ledger.type,
          saleType: ledger.saleType,
          itemSize: ledger.itemSize,
          cartons: ledger.cartons,
          rate: ledger.rate,
          deductions: ledger.deductions,
          paymentType: ledger.paymentType,
          note: ledger.note,
          enteredAt: ledger.createdAt,
        },
      };
      });

    const currentLogs = auditLogs.map((log) => {
      const cashSale = log.entityType === "CashSale" ? cashSaleById.get(String(log.entityId)) : null;
      if (!cashSale) return { ...log, eventSource: "audit" };
      return {
        ...log,
        eventSource: "audit",
        metadata: {
          ...(log.metadata && typeof log.metadata === "object" ? log.metadata : {}),
          amount: cashSale.amount,
          paymentType: cashSale.paymentType || "CASH",
          saleType: normalizeCashSaleType(cashSale.saleType),
        },
      };
    });
    const logs = [...currentLogs, ...legacyLogs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return NextResponse.json({ data: logs });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
