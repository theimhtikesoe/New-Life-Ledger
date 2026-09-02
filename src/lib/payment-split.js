const PAYMENT_KEYS = ["CASH", "KPAY", "BANK", "WAVE", "SPECIAL"];
const PAYMENT_LABELS = { CASH: "CASH", KPAY: "KPAY", BANK: "BANK", WAVE: "WAVE", SPECIAL: "SPECIAL" };

function toAmount(value) {
  const amount = Math.round(Number(value || 0));
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function normalizePaymentKey(value) {
  const text = String(value || "").trim().toUpperCase().replace(/[\s_-]+/g, "");
  if (text === "CASH" || text === "ငွေသား") return "CASH";
  if (["KPAY", "KBZPAY", "KBANKPAY", "K PAY"].includes(text)) return "KPAY";
  if (["BANK", "BANKING", "KBZBANK", "AYA", "WAVE"].includes(text)) return text === "WAVE" ? "WAVE" : "BANK";
  if (["SPECIAL", "SP"].includes(text)) return "SPECIAL";
  return null;
}

function emptySplit() {
  return { CASH: 0, KPAY: 0, BANK: 0, WAVE: 0, SPECIAL: 0 };
}

function parseNumber(value) {
  const amount = Number(String(value || "").replace(/[,\s]/g, ""));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 0;
}

function parseNote(note) {
  const text = String(note || "");
  const split = emptySplit();
  const patterns = [
    ["CASH", /cash\s*[:=]?\s*([\d,]+)/i],
    ["KPAY", /k\s*-?\s*pay\s*[:=]?\s*([\d,]+)/i],
    ["BANK", /bank(?:ing)?\s*[:=]?\s*([\d,]+)/i],
    ["WAVE", /wave\s*[:=]?\s*([\d,]+)/i],
    ["SPECIAL", /special\s*[:=]?\s*([\d,]+)/i],
  ];
  for (const [key, pattern] of patterns) {
    const match = text.match(pattern);
    if (match) split[key] = parseNumber(match[1]);
  }
  return split;
}

export function getPaymentSplit(row) {
  const amount = toAmount(row?.amount);
  const stored = row?.paymentBreakdown && typeof row.paymentBreakdown === "object" ? row.paymentBreakdown : null;
  const parsed = stored ? emptySplit() : parseNote(row?.note);
  if (stored) {
    for (const key of PAYMENT_KEYS) parsed[key] = toAmount(stored[key]);
  }
  const parsedTotal = PAYMENT_KEYS.reduce((sum, key) => sum + parsed[key], 0);
  if (parsedTotal > 0) {
    if (parsedTotal < amount) {
      const fallbackKey = normalizePaymentKey(row?.paymentType) || "CASH";
      parsed[fallbackKey] += amount - parsedTotal;
    } else if (parsedTotal > amount) {
      parsed.CASH = Math.max(0, parsed.CASH - (parsedTotal - amount));
    }
    return parsed;
  }
  const key = normalizePaymentKey(row?.paymentType) || "CASH";
  parsed[key] = amount;
  return parsed;
}

export function paymentSplitTotal(split) {
  return PAYMENT_KEYS.reduce((sum, key) => sum + toAmount(split?.[key]), 0);
}

export function hasPaymentBreakdownInput(split) {
  return Boolean(split && typeof split === "object" && PAYMENT_KEYS.some((key) => String(split[key] ?? "").trim() !== ""));
}

export function paymentBreakdownValidationMessage(split, amount) {
  const total = paymentSplitTotal(split);
  if (total === amount) return "";
  const difference = total - amount;
  const detail = difference > 0
    ? `${difference.toLocaleString()} Ks ပိုနေပါသည်`
    : `${Math.abs(difference).toLocaleString()} Ks လျော့နေပါသည်`;
  return `ငွေပေးချေမှုခွဲပမာဏ ${total.toLocaleString()} Ks သည် ပမာဏ ${amount.toLocaleString()} Ks နှင့် မကိုက်ပါ။ ${detail}။`;
}

export function paymentSplitForInput(body, amount) {
  const candidate = body?.paymentBreakdown && typeof body.paymentBreakdown === "object"
    ? body.paymentBreakdown
    : null;
  const split = candidate ? emptySplit() : parseNote(body?.note);
  if (candidate) for (const key of PAYMENT_KEYS) split[key] = toAmount(candidate[key]);
  const total = paymentSplitTotal(split);

  if (candidate) {
    const mismatch = paymentBreakdownValidationMessage(split, amount);
    if (mismatch) throw new Error(mismatch);
    return split;
  }

  if (!total) {
    split[normalizePaymentKey(body?.paymentType) || "CASH"] = amount;
    return split;
  }
  if (total < amount) split[normalizePaymentKey(body?.paymentType) || "CASH"] += amount - total;
  if (total > amount) throw new Error("ငွေပေးချေမှုခွဲပမာဏသည် စုစုပေါင်းပမာဏနှင့် မကိုက်ပါ။");
  return split;
}

export function nonCashAmount(split) {
  return PAYMENT_KEYS.filter((key) => key !== "CASH").reduce((sum, key) => sum + toAmount(split?.[key]), 0);
}

export function paymentSplitLabel(row) {
  return PAYMENT_KEYS
    .map((key) => [key, toAmount(row?.[key])])
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => `${PAYMENT_LABELS[key]} ${amount.toLocaleString()} Ks`)
    .join(" + ");
}

export const PAYMENT_SPLIT_KEYS = PAYMENT_KEYS;
