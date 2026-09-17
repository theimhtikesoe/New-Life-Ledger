import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { settlementTargetIds } from "@/lib/ledger-settlement";

export const dynamic = "force-dynamic";
const rounded = (value) => Math.round(Number(value || 0));

function buildCustomerDetail(customer, saved) {
  const credits = customer.ledgers.filter((row) => row.type === "CREDIT")
    .map((credit) => ({ ...credit, paid: 0, legacyPaid: 0, remaining: rounded(credit.amount), linkedPayments: [] }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || String(a.id).localeCompare(String(b.id)));
  const creditById = new Map(credits.map((credit) => [String(credit.id), credit]));
  const payments = customer.ledgers.filter((row) => row.type === "DEBIT");
  const unlinkedPayments = [];
  const futurePrepayments = [];
  let unlinkedPaymentPool = 0;

  payments.forEach((payment) => {
    const targets = settlementTargetIds(payment.note).filter((id) => creditById.has(String(id)));
    if (!targets.length) {
      unlinkedPayments.push({ ...payment, legacyPayment: true });
      const paymentDay = new Date(payment.date).toISOString().slice(0, 10);
      const hasNearFutureMatchingCredit = credits.some((credit) => (
        new Date(credit.date).toISOString().slice(0, 10) >= paymentDay
        && rounded(credit.amount) === rounded(payment.amount)
      ));
      if (String(payment.note || "").includes("__PREPAYMENT__") || hasNearFutureMatchingCredit) futurePrepayments.push({ payment, remaining: rounded(payment.amount) });
      else unlinkedPaymentPool += rounded(payment.amount);
      return;
    }
    const target = creditById.get(String(targets[0]));
    target.paid += rounded(payment.amount);
    target.remaining = Math.max(0, rounded(target.amount) - target.paid - target.legacyPaid);
    target.linkedPayments.push(payment);
  });

  // Do not rewrite old payment notes or create retroactive links. This FIFO
  // allocation is display-only evidence that older credits were already paid.
  credits.forEach((credit) => {
    if (unlinkedPaymentPool <= 0) return;
    const applied = Math.min(credit.remaining, unlinkedPaymentPool);
    credit.legacyPaid += applied;
    credit.remaining = Math.max(0, credit.remaining - applied);
    unlinkedPaymentPool -= applied;
  });
  futurePrepayments.forEach(({ payment, remaining: initialRemaining }) => {
    let remaining = initialRemaining;
    credits.forEach((credit) => {
      if (remaining <= 0 || new Date(credit.date).getTime() < new Date(payment.date).getTime()) return;
      const applied = Math.min(credit.remaining, remaining);
      credit.legacyPaid += applied;
      credit.remaining = Math.max(0, credit.remaining - applied);
      remaining -= applied;
    });
  });

  const websiteBalance = rounded(customer.current_balance);
  const savedGroundTruth = saved?.metadata?.groundTruthBalance;
  const groundTruthBalance = Number.isFinite(Number(savedGroundTruth)) ? rounded(savedGroundTruth) : websiteBalance;
  return {
    id: customer.id, name: customer.name, phone: customer.phone, routeTag: customer.routeTag,
    websiteBalance, groundTruthBalance, difference: groundTruthBalance - websiteBalance,
    oldDebts: credits, unlinkedPayments, payments,
    savedAt: saved?.createdAt || null, savedNote: saved?.metadata?.note || "",
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
        ledgers: { select: { id: true, date: true, type: true, amount: true, discountAmount: true, note: true, paymentType: true, saleType: true }, orderBy: [{ date: "asc" }, { id: "asc" }] },
      },
      orderBy: { name: "asc" },
    });
    const ids = customers.map((customer) => customer.id);
    const savedRows = ids.length ? await prisma.auditLog.findMany({
      where: { action: "DEBT_RECONCILIATION_SAVE", entityType: "Customer", entityId: { in: ids } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: Math.max(100, ids.length * 3),
    }) : [];
    const latest = new Map();
    savedRows.forEach((row) => { if (!latest.has(row.entityId)) latest.set(row.entityId, row); });
    return NextResponse.json({ data: customers.map((customer) => buildCustomerDetail(customer, latest.get(customer.id))) });
  } catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 500 }); }
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
    const saved = await writeAuditLog({
      actorName: getActorName(request), action: "DEBT_RECONCILIATION_SAVE", entityType: "Customer", entityId: customer.id,
      entityLabel: customer.name, summary: `${customer.name} အကြွေးဟောင်း စာရင်းညှိသိမ်း (${groundTruthBalance.toLocaleString()} Ks)`,
      metadata: { groundTruthBalance, websiteBalance: rounded(customer.current_balance), difference: groundTruthBalance - rounded(customer.current_balance), links: [], note: String(body.note || "").trim().slice(0, 500) },
    });
    return NextResponse.json({ data: saved }, { status: 201 });
  } catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 400 }); }
}
