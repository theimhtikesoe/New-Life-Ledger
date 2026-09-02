import { getPaymentSplit, paymentSplitLabel } from "@/lib/payment-split";

const RECONCILIATION_PAYMENT_KEYS = ["CASH", "KPAY", "BANK", "WAVE", "SPECIAL"];

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function displayName(value) {
  return String(value || "မသတ်မှတ်ရသေး").replace(/\s+/g, " ").trim() || "မသတ်မှတ်ရသေး";
}

function formatAmount(value) {
  return Math.round(Number(value || 0)).toLocaleString("en-US");
}

function isLedgerActivity(event) {
  const entityType = String(event?.entityType || "").trim();
  const action = String(event?.action || "").trim();
  return entityType === "Ledger" && (action === "ငွေချေ" || action === "အကြွေးတိုး");
}

function eventName(event) {
  return event?.customerName || event?.entityLabel || event?.customer?.name || "";
}

function normalizeLedgerEvents(events = []) {
  return (Array.isArray(events) ? events : []).filter((event) => (
    isLedgerActivity(event)
    && Number.isFinite(Number(event.amount))
    && Number(event.amount) > 0
    && normalizeName(eventName(event))
  ));
}

export function buildDailySummaryReviewChecks({ totalTransactions = 0, events = [], summary = {}, customers = [] } = {}) {
  const checks = [];
  const allEvents = Array.isArray(events) ? events : [];
  const total = Number(totalTransactions || 0);

  const paymentTypes = summary?.paymentTypes && typeof summary.paymentTypes === "object" ? Object.values(summary.paymentTypes).reduce((sum, amount) => sum + Math.round(Number(amount || 0)), 0) : null;
  const paidAmount = Number(summary?.paidAmount ?? 0);
  if (paymentTypes !== null && paymentTypes !== paidAmount) {
    checks.push(`အကြွေးပြန်ဆပ်(ငွေချေ) စုစုပေါင်း ${formatAmount(paidAmount)} Ks နှင့် payment နည်းလမ်းများ၏ ပေါင်းလဒ် ${formatAmount(paymentTypes)} Ks မကိုက်ပါ။ ပြန်စစ်ရန် လိုအပ်နိုင်သည်။`);
  }

  const customerRows = Array.isArray(customers) ? customers : [];
  const customerNames = new Map();
  for (const customer of customerRows) {
    const name = displayName(customer?.customerName || customer?.name);
    const key = normalizeName(name);
    if (!key) continue;
    const ids = customerNames.get(key) || new Set();
    ids.add(String(customer?.customerId || name));
    customerNames.set(key, ids);
  }
  for (const [key, ids] of customerNames.entries()) {
    if (ids.size < 2) continue;
    const display = displayName(customerRows.find((customer) => normalizeName(customer?.customerName || customer?.name) === key)?.customerName || customerRows.find((customer) => normalizeName(customer?.customerName || customer?.name) === key)?.name);
    checks.push(`Customer အမည် ${display} တူသော စာရင်း ${ids.size} ခု တွေ့ရပါသည်။ Customer မှန်/မမှန်နှင့် ပမာဏများကို ပြန်စစ်ရန် လိုအပ်နိုင်သည်။`);
  }

  const customerPaidAmount = customerRows.reduce((sum, customer) => sum + Math.round(Number(customer?.paidAmount || 0)), 0);
  const customerDebtAmount = customerRows.reduce((sum, customer) => sum + Math.round(Number(customer?.unpaidAmount ?? customer?.debtAmount ?? 0)), 0);
  const debtAmount = Number(summary?.unpaidAmount ?? summary?.debtAmount ?? 0);
  if (customerPaidAmount !== Number(summary?.paidAmount ?? 0) || customerDebtAmount !== debtAmount) {
    checks.push(`Customer အလိုက် ငွေချေ/အကြွေးတိုး စုစုပေါင်းနှင့် Daily Summary စုစုပေါင်း မကိုက်ပါ။ ပြန်စစ်ရန် လိုအပ်နိုင်သည်။`);
  }

  const grouped = new Map();
  for (const event of normalizeLedgerEvents(allEvents)) {
    const name = displayName(eventName(event));
    const amount = Math.round(Number(event.amount));
    const key = `${normalizeName(name)}::${amount}`;
    const current = grouped.get(key) || { name, amount, count: 0, actions: new Set() };
    current.count += 1;
    current.actions.add(String(event.action));
    grouped.set(key, current);
  }
  for (const group of grouped.values()) {
    if (group.count < 2) continue;
    const actions = Array.from(group.actions).join(" နှင့် ");
    checks.push(`Customer ${group.name} အတွက် ${formatAmount(group.amount)} Ks ပမာဏတူ ${actions} မှတ်တမ်း ${group.count} ခု တွေ့ရပါသည်။ ထပ်နေခြင်း သို့မဟုတ် သီးခြားမှတ်တမ်းဖြစ်/မဖြစ် Activity History တွင် ပြန်စစ်ရန် လိုအပ်နိုင်သည်။`);
  }

  const createdEvents = allEvents.filter((event) => (
    String(event?.entityType || "").trim() === "Customer"
    && String(event?.action || "").trim() === "Customer အသစ်ထည့်"
    && normalizeName(eventName(event))
  ));
  const ledgerNames = new Set(normalizeLedgerEvents(allEvents).map((event) => normalizeName(eventName(event))));
  for (const event of createdEvents) {
    const name = normalizeName(eventName(event));
    if (!ledgerNames.has(name)) continue;
    checks.push(`Customer အသစ် ${displayName(eventName(event))} ထည့်သည့်နေ့တွင် ငွေစာရင်းလည်း ရှိပါသည်။ Customer ဖန်တီးချိန်နှင့် စာရင်းမှတ်တမ်းချိန်ကို Activity History တွင် ပြန်စစ်ရန် လိုအပ်နိုင်သည်။`);
  }

  return checks.slice(0, 4);
}

export function transactionsToDailySummaryEvents(transactions = []) {
  return (Array.isArray(transactions) ? transactions : []).map((transaction) => ({
    action: String(transaction?.type || "").toUpperCase() === "DEBIT" ? "ငွေချေ" : "အကြွေးတိုး",
    entityType: "Ledger",
    customerName: transaction?.customer?.name || "",
    amount: transaction?.amount,
    eventAt: transaction?.date || null,
    source: "ledger",
  }));
}

function roundAmount(value) {
  const amount = Math.round(Number(value || 0));
  return Number.isFinite(amount) ? amount : 0;
}

function emptyPaymentMatrix() {
  return Object.fromEntries(RECONCILIATION_PAYMENT_KEYS.map((key) => [key, 0]));
}

function addToPaymentMatrix(target, split) {
  for (const key of RECONCILIATION_PAYMENT_KEYS) target[key] += roundAmount(split?.[key]);
}

function signedDifference(autoValue, referenceValue) {
  return roundAmount(autoValue) - roundAmount(referenceValue);
}

export function buildPaymentMatrixSummary(records = []) {
  const matrix = {
    RETAIL: emptyPaymentMatrix(),
    WHOLESALE: emptyPaymentMatrix(),
  };
  for (const record of Array.isArray(records) ? records : []) {
    const saleType = String(record?.saleType || "").toUpperCase() === "WHOLESALE" ? "WHOLESALE" : "RETAIL";
    addToPaymentMatrix(matrix[saleType], getPaymentSplit(record));
  }
  return matrix;
}

export function buildDailyReconciliation({ date, auto = {}, saved = null, cashSales = [], ledgerPayments = [] } = {}) {
  const autoTotals = {
    retailTotal: roundAmount(auto?.retailTotal),
    wholesaleTotal: roundAmount(auto?.wholesaleTotal),
    retailCash: roundAmount(auto?.retailCash),
    wholesaleCash: roundAmount(auto?.wholesaleCash),
    dailyTotal: roundAmount(auto?.retailTotal) + roundAmount(auto?.wholesaleTotal),
  };
  const savedTotals = saved
    ? {
        retailTotal: roundAmount(saved.retailTotal),
        wholesaleTotal: roundAmount(saved.wholesaleTotal),
        retailCash: roundAmount(saved.retailCash),
        wholesaleCash: roundAmount(saved.wholesaleCash),
        dailyTotal: roundAmount(saved.retailTotal) + roundAmount(saved.wholesaleTotal),
      }
    : null;
  const referenceTotals = savedTotals || {
    retailTotal: autoTotals.retailTotal,
    wholesaleTotal: autoTotals.wholesaleTotal,
    retailCash: autoTotals.retailCash,
    wholesaleCash: autoTotals.wholesaleCash,
    dailyTotal: autoTotals.dailyTotal,
  };
  const records = [
    ...(Array.isArray(cashSales) ? cashSales : []).map((record) => ({
      source: "CASH_SALE",
      id: String(record.id),
      customerName: record.customer?.name || record.customerName || "လက်ငင်း Customer",
      date: record.date || null,
      saleType: String(record.saleType || "").toUpperCase() === "WHOLESALE" ? "WHOLESALE" : "RETAIL",
      amount: roundAmount(record.amount),
      paymentType: record.paymentType || "CASH",
      paymentBreakdown: record.paymentBreakdown || null,
      paymentLabel: paymentSplitLabel(getPaymentSplit(record)) || record.paymentType || "CASH",
      note: record.note || "",
    })),
    ...(Array.isArray(ledgerPayments) ? ledgerPayments : [])
      .filter((record) => String(record.type || "").toUpperCase() === "DEBIT")
      .map((record) => ({
        source: "LEDGER",
        id: String(record.id),
        customerName: record.customer?.name || record.customerName || "Customer မသတ်မှတ်ရသေး",
        date: record.date || null,
        saleType: "WHOLESALE",
        amount: roundAmount(record.amount),
        paymentType: record.paymentType || "CASH",
        paymentBreakdown: record.paymentBreakdown || null,
        paymentLabel: paymentSplitLabel(getPaymentSplit(record)) || record.paymentType || "CASH",
        note: record.note || "",
      })),
  ];
  const difference = {
    retailTotal: signedDifference(autoTotals.retailTotal, referenceTotals.retailTotal),
    wholesaleTotal: signedDifference(autoTotals.wholesaleTotal, referenceTotals.wholesaleTotal),
    retailCash: signedDifference(autoTotals.retailCash, referenceTotals.retailCash),
    wholesaleCash: signedDifference(autoTotals.wholesaleCash, referenceTotals.wholesaleCash),
    dailyTotal: signedDifference(autoTotals.dailyTotal, referenceTotals.dailyTotal),
  };
  const nonZeroDifference = Object.values(difference).some((value) => value !== 0);
  const candidateAmount = Math.abs(difference.wholesaleTotal) || Math.abs(difference.retailTotal) || Math.abs(difference.dailyTotal);
  const candidates = candidateAmount > 0
    ? records.filter((record) => record.amount === candidateAmount).slice(0, 12)
    : [];
  return {
    date,
    status: nonZeroDifference ? "REVIEW" : "MATCHED",
    reference: saved ? "SAVED_ROW" : "AUTO",
    autoTotals,
    referenceTotals,
    difference,
    paymentMatrix: buildPaymentMatrixSummary(cashSales),
    records: records.slice(0, 100),
    candidates,
  };
}
