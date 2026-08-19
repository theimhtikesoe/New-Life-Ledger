import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { ACTORS } from "@/lib/audit";
import { getMyanmarDayRange } from "@/lib/myanmar-time";

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
    const limitParam = Number(searchParams.get("limit") || 100);
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? Math.floor(limitParam) : 100, 1), 500);
    const range = dateRange(dateParam);
    const legacyAction = legacyActionFilter(action);

    const includeLegacy = !actor && (!action || Boolean(legacyAction));
    const [auditLogs, legacyLedgers] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          ...(range ? { createdAt: range } : {}),
          ...(ACTORS.includes(actor) ? { actorName: actor } : {}),
          ...(action ? { action } : {}),
        },
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

    const legacyLogs = legacyLedgers.map((ledger) => {
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

    const currentLogs = auditLogs.map((log) => ({ ...log, eventSource: "audit" }));
    const logs = [...currentLogs, ...legacyLogs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return NextResponse.json({ data: logs });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
