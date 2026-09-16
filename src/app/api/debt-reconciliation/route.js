import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { settlementTargetIds } from "@/lib/ledger-settlement";

export const dynamic = "force-dynamic";
const rounded = (value) => Math.round(Number(value || 0));

function buildCustomerDetail(customer, saved) {
  const credits = customer.ledgers.filter((row) => row.type === "CREDIT");
  const payments = customer.ledgers.filter((row) => row.type === "DEBIT");
  const paymentsByCredit = new Map();
  const unlinkedPayments = [];
  payments.forEach((payment) => {
    const targets = settlementTargetIds(payment.note).filter((id) => credits.some((credit) => credit.id === id));
    if (!targets.length) unlinkedPayments.push(payment);
    targets.forEach((targetId) => {
      paymentsByCredit.set(targetId, [...(paymentsByCredit.get(targetId) || []), payment]);
    });
  });
  const oldDebts = credits.map((credit) => {
    const linkedPayments = paymentsByCredit.get(credit.id) || [];
    const paid = linkedPayments.reduce((sum, payment) => sum + rounded(payment.amount), 0);
    return {
      ...credit,
      paid,
      remaining: Math.max(0, rounded(credit.amount) - paid),
      linkedPaymentIds: linkedPayments.map((payment) => payment.id),
      linkedPayments,
    };
  });
  const websiteBalance = rounded(customer.current_balance);
  const savedGroundTruth = saved?.metadata?.groundTruthBalance;
  const groundTruthBalance = Number.isFinite(Number(savedGroundTruth)) ? rounded(savedGroundTruth) : websiteBalance;
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    routeTag: customer.routeTag,
    websiteBalance,
    groundTruthBalance,
    difference: groundTruthBalance - websiteBalance,
    oldDebts,
    unlinkedPayments,
    savedAt: saved?.createdAt || null,
    savedNote: saved?.metadata?.note || "",
  };
}

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const customers = await prisma.customer.findMany({
      where: { deletedAt: null, ...(customerId ? { id: customerId } : { current_balance: { gt: 0 } }) },
      select: {
        id: true, name: true, phone: true, routeTag: true, current_balance: true,
        ledgers: {
          select: { id: true, date: true, type: true, amount: true, discountAmount: true, note: true, paymentType: true, saleType: true },
          orderBy: [{ date: "asc" }, { id: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    });
    const ids = customers.map((customer) => customer.id);
    const savedRows = ids.length ? await prisma.auditLog.findMany({
      where: { action: "DEBT_RECONCILIATION_SAVE", entityType: "Customer", entityId: { in: ids } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.max(100, ids.length * 3),
    }) : [];
    const latest = new Map();
    savedRows.forEach((row) => { if (!latest.has(row.entityId)) latest.set(row.entityId, row); });
    return NextResponse.json({ data: customers.map((customer) => buildCustomerDetail(customer, latest.get(customer.id))) });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const customerId = String(body.customerId || "");
    const groundTruthBalance = rounded(body.groundTruthBalance);
    if (!customerId || groundTruthBalance < 0) return NextResponse.json({ error: "Customer နှင့် မြေပြင်လက်ကျန်ကို မှန်ကန်စွာ ထည့်ပါ။" }, { status: 400 });
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, current_balance: true } });
    if (!customer) return NextResponse.json({ error: "Customer မတွေ့ပါ။" }, { status: 404 });
    const selectedLinks = Array.isArray(body.links) ? body.links : [];
    const saved = await writeAuditLog({
      actorName: getActorName(request),
      action: "DEBT_RECONCILIATION_SAVE",
      entityType: "Customer",
      entityId: customer.id,
      entityLabel: customer.name,
      summary: `${customer.name} အကြွေးဟောင်း စာရင်းညှိသိမ်း (${groundTruthBalance.toLocaleString()} Ks)`,
      metadata: {
        groundTruthBalance,
        websiteBalance: rounded(customer.current_balance),
        difference: groundTruthBalance - rounded(customer.current_balance),
        links: selectedLinks,
        note: String(body.note || "").trim().slice(0, 500),
      },
    });
    return NextResponse.json({ data: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 400 });
  }
}
