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
    checks.push(`ငွေချေစုစုပေါင်း ${formatAmount(paidAmount)} Ks နှင့် Payment Type စုစုပေါင်း ${formatAmount(paymentTypes)} Ks မကိုက်ပါ။ ပြန်စစ်ရန် လိုအပ်နိုင်သည်။`);
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
