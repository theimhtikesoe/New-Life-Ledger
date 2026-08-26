export const CASH_SALE_TYPES = ["RETAIL", "WHOLESALE"];

export function normalizeCashSaleType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "WHOLESALE" || normalized.includes("လက်ကား") ? "WHOLESALE" : "RETAIL";
}

export function cashSaleTypeLabel(value) {
  return normalizeCashSaleType(value) === "WHOLESALE" ? "လက်ကား" : "လက်လီ";
}

export function summarizeCashSalesByType(cashSales = []) {
  const summary = {
    RETAIL: { count: 0, amount: 0 },
    WHOLESALE: { count: 0, amount: 0 },
  };
  for (const sale of Array.isArray(cashSales) ? cashSales : []) {
    const saleType = normalizeCashSaleType(sale?.saleType);
    summary[saleType].count += 1;
    summary[saleType].amount += Number(sale?.amount || 0);
  }
  return summary;
}
