import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  ledgerFindMany: vi.fn(),
  cashSaleFindMany: vi.fn(),
  auditFindMany: vi.fn(),
  dailySalesSummaryFindUnique: vi.fn(),
}));

vi.mock("@/lib/database", () => ({ ensureDatabase: mocks.ensureDatabase }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    ledger: { findMany: mocks.ledgerFindMany },
    cashSale: { findMany: mocks.cashSaleFindMany },
    auditLog: { findMany: mocks.auditFindMany },
    dailySalesSummary: { findUnique: mocks.dailySalesSummaryFindUnique },
  },
}));

import { createReportHtml, formatCashSaleDetails, getDailyReportData } from "@/lib/daily-report";

const period = {
  start: new Date("2026-08-25T00:00:00.000Z"),
  end: new Date("2026-08-26T00:00:00.000Z"),
  dateLabel: "2026-08-25",
};

const ledger = {
  id: "ledger-1",
  date: new Date("2026-08-25T08:00:00.000Z"),
  createdAt: new Date("2026-08-25T08:00:00.000Z"),
  type: "CREDIT",
  saleType: "WHOLESALE",
  itemSize: "0.3 Liter",
  cartons: 10,
  rate: 100,
  deductions: 0,
  amount: 100000,
  note: null,
  paymentType: null,
  customer: { id: "customer-1", name: "အကြွေး Customer" },
};

const cashSale = {
  id: "cash-sale-1",
  date: new Date("2026-08-25T09:00:00.000Z"),
  saleType: "WHOLESALE",
  amount: 50000,
  paymentType: "KPay",
  customer: { id: "customer-2", name: "လက်ငင်း Customer" },
};

beforeEach(() => {
  mocks.ensureDatabase.mockReset().mockResolvedValue(undefined);
  mocks.ledgerFindMany.mockReset().mockResolvedValue([ledger]);
  mocks.cashSaleFindMany.mockReset().mockResolvedValue([cashSale]);
  mocks.dailySalesSummaryFindUnique.mockReset().mockResolvedValue(null);
  mocks.auditFindMany.mockReset().mockResolvedValue([
    { id: "audit-ledger-1", actorName: "Staff", action: "DEBT_INCREASE", entityType: "Ledger", entityId: "ledger-1", entityLabel: "အကြွေး Customer", summary: "အကြွေး Customer အကြွေးတိုး 100,000 Ks", metadata: {}, createdAt: ledger.createdAt, hiddenAt: null },
    { id: "audit-cash-sale-1", actorName: "Staff", action: "CASH_SALE", entityType: "CashSale", entityId: "cash-sale-1", entityLabel: "လက်ငင်း Customer", summary: "လက်ငင်း Customer လက်ငင်းရောင်း 50,000 Ks", metadata: { amount: 50000, paymentType: "KPay" }, createdAt: cashSale.date, hiddenAt: null },
  ]);
});

describe("Telegram daily report CashSale data", () => {
  it("renders retail and wholesale cash-sale details on separate full lines", () => {
    const customer = {
      cashRetailCount: 4,
      cashRetailAmount: 162000,
      cashWholesaleCount: 1,
      cashWholesaleAmount: 415000,
    };
    expect(formatCashSaleDetails(customer)).toBe("လက်လီ 4 / 162,000 Ks<br>လက်ကား 1 / 415,000 Ks");
    const html = createReportHtml({ summary: {}, customers: [customer], activityLogs: [], periodLabel: "2026-08-27" }, "", "");
    expect(html).toContain("white-space:normal;overflow:visible;text-overflow:clip");
    expect(html).toContain("လက်လီ 4 / 162,000 Ks<br>လက်ကား 1 / 415,000 Ks");
  });

  it("includes a saved Daily Summary row for the requested business date", async () => {
    mocks.dailySalesSummaryFindUnique.mockResolvedValue({
      id: "summary-28",
      date: "2026-08-28",
      retailTotal: 145000,
      wholesaleTotal: 7389000,
      retailCash: 82000,
      wholesaleCash: 341500,
      source: "DAILY_INPUT",
      note: "28 ရက်စာကို 29 ရက်မှာ ထည့်",
      enteredAt: new Date("2026-08-29T02:45:00.000Z"),
      enteredBy: "Staff",
      createdAt: new Date("2026-08-29T02:45:00.000Z"),
      updatedAt: new Date("2026-08-29T02:45:00.000Z"),
    });
    const report = await getDailyReportData({ ...period, dateLabel: "2026-08-28" });
    expect(report.dailySalesSummary).toMatchObject({
      date: "2026-08-28",
      retailTotal: 145000,
      wholesaleTotal: 7389000,
      enteredBy: "Staff",
    });
    const html = createReportHtml({ ...report, summary: {}, customers: [], activityLogs: [] }, "", "");
    expect(html).not.toContain("နေ့စဉ် လက်လီ / လက်ကား ရောင်းရငွေ");
    expect(html).not.toContain('<section class="daily-sales-summary">');
    expect(mocks.dailySalesSummaryFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { date: "2026-08-28" } }));
  });

  it("shows payment type and sale type in Activity Payment without clipping", () => {
    const html = createReportHtml({
      summary: {
        paymentTypes: { KPAY: 1155000 },
        cashPaymentTypes: { CASH: 2120500, KPAY: 81000 },
        cashSaleTypes: { RETAIL: { count: 7, amount: 297500 }, WHOLESALE: { count: 7, amount: 1904000 } },
        cashAmount: 2201500,
      },
      customers: [],
      activityLogs: [{
        createdAt: cashSale.date,
        actorName: "Staff",
        action: "CASH_SALE",
        entityType: "CashSale",
        entityLabel: "လက်ငင်း Customer",
        metadata: { amount: 50000, paymentType: "CASH", saleType: "WHOLESALE" },
        eventSource: "audit",
      }],
      periodLabel: "2026-08-25",
    }, "", "");
    expect(html).toContain("<td class=\"activity-action\">လက်ငင်းရောင်း</td><td class=\"activity-entity\">လက်ငင်း Customer</td><td class=\"activity-amount\">50,000 Ks</td><td class=\"payment-cell\">CASH 50,000 Ks · လက်ကား</td>");
    expect(html).toContain(".summary-table .summary-amount{font-size:22px;font-weight:700");
    expect(html).toContain("အကြွေးပြန်ဆပ်(ငွေချေ) အသေးစိတ်");
    expect(html).toContain("အကြွေးပြန်ဆပ်(ငွေချေ) စုစုပေါင်း 1,155,000 Ks");
    expect(html).toContain("လက်ငင်း(လက်လီ၊လက်ကား) အသေးစိတ်");
    expect(html).toContain("အောက်မှာရှိတဲ့ payment နည်းလမ်းတစ်ခုချင်းစီက Cash Sale မှာ ထည့်ထားတဲ့ လက်ငင်းရောင်းငွေထဲက ခွဲခြမ်းချက်");
    expect(html).toContain("လက်ငင်း(လက်လီ၊လက်ကား) စုစုပေါင်း 2,201,500 Ks");
    expect(html).toContain("လက်ငင်း လက်လီ/လက်ကား ရောင်းအား");
    expect(html).toContain(".retail-row{background:#f5f3ff;color:#6d28d9");
    expect(html).toContain(".wholesale-row{background:#fffbeb;color:#b45309");
    expect(html).toContain(".sale-total-row{margin-top:8px;background:#ede9fe");
    expect(html).toContain("14 ခု / 2,201,500 Ks");
    expect(html).toContain(".payment-row{display:flex;justify-content:space-between;align-items:baseline;gap:20px;padding:14px 0");
    expect(html).toContain(".payment-row strong{font-size:23px;font-weight:700");
    expect(html).toContain(".activity-table th:nth-child(6),.activity-table td:nth-child(6){width:15%}");
    expect(html).toContain(".activity-table .activity-actor{font-size:14px;color:#475569;font-weight:600");
    expect(html).toContain(".activity-table .activity-amount{font-size:23px;font-weight:800");
    expect(html).toContain(".activity-table .payment-cell{font-size:21px;font-weight:800");
    expect(html).not.toContain("<th>Source</th>");
    expect(html).not.toContain("အသစ်မှတ်တမ်း");
  });

  it("aggregates split cash-sale payments by category", async () => {
    mocks.cashSaleFindMany.mockResolvedValue([{
      ...cashSale,
      amount: 100000,
      paymentType: "MIXED",
      paymentBreakdown: { CASH: 60000, KPAY: 20000, BANK: 20000, WAVE: 0, SPECIAL: 0 },
    }]);
    const report = await getDailyReportData(period);
    expect(report.summary.cashPaymentTypes).toEqual({ CASH: 60000, KPAY: 20000, BANK: 20000 });
  });

  it("renders all split cash-sale categories in an Activity Payment cell", () => {
    const html = createReportHtml({
      summary: {},
      customers: [],
      activityLogs: [{
        createdAt: cashSale.date,
        actorName: "Staff",
        action: "CASH_SALE",
        entityType: "CashSale",
        entityLabel: "ခွဲပေး Customer",
        metadata: {
          amount: 100000,
          paymentType: "MIXED",
          paymentBreakdown: { CASH: 60000, KPAY: 20000, BANK: 20000, WAVE: 0, SPECIAL: 0 },
          saleType: "WHOLESALE",
        },
        eventSource: "audit",
      }],
      periodLabel: "2026-08-25",
    }, "", "");
    expect(html).toContain("CASH 60,000 Ks + KPAY 20,000 Ks + BANK 20,000 Ks · လက်ကား");
  });

  it("keeps cash sales separate from debt totals and includes one activity event", async () => {
    const report = await getDailyReportData(period);
    expect(report.summary).toMatchObject({
      paidCount: 0,
      debtCount: 1,
      debtAmount: 100000,
      cashCount: 1,
      cashAmount: 50000,
      totalTransactions: 1,
      cashPaymentTypes: { KPAY: 50000 },
      cashSaleTypes: { RETAIL: { count: 0, amount: 0 }, WHOLESALE: { count: 1, amount: 50000 } },
    });
    expect(report.customers).toEqual(expect.arrayContaining([
      expect.objectContaining({ customerName: "လက်ငင်း Customer", paidCount: 0, debtCount: 0, cashCount: 1, cashAmount: 50000, cashRetailCount: 0, cashWholesaleCount: 1, cashWholesaleAmount: 50000 }),
    ]));
    expect(report.activityLogs.filter((log) => log.entityType === "CashSale")).toHaveLength(1);
    expect(report.activityLogs.find((log) => log.entityType === "CashSale")).toMatchObject({ eventSource: "audit" });
    expect(report.activityLogs.find((log) => log.entityType === "CashSale")).toMatchObject({ action: "CASH_SALE", entityLabel: "လက်ငင်း Customer" });
  });

  it("uses the accounting-only Activity History scope and excludes Order workflow records", async () => {
    mocks.auditFindMany.mockResolvedValue([
      { id: "order", action: "ORDER_DRAFT", entityType: "Order", entityId: "order-1", hiddenAt: null, createdAt: ledger.createdAt },
      { id: "batch", action: "ORDER_BATCH_NOTIFIED", entityType: "OrderBatch", entityId: "batch-1", hiddenAt: null, createdAt: ledger.createdAt },
      { id: "prefixed", action: "ORDER_CUSTOM", entityType: "Operational", entityId: "op-1", hiddenAt: null, createdAt: ledger.createdAt },
      { id: "customer-edit", action: "UPDATE", entityType: "Customer", entityId: "customer-1", entityLabel: "ပြင်ဆင်ထားသော Customer", hiddenAt: null, createdAt: ledger.createdAt },
      { id: "production-submit", action: "PRODUCTION_REPORT_SUBMIT", entityType: "ProductionReport", entityId: "production-1", summary: "Production report submitted", hiddenAt: null, createdAt: ledger.createdAt },
      { id: "payment", actorName: "Staff", action: "DEBT_INCREASE", entityType: "Ledger", entityId: "ledger-1", entityLabel: "အကြွေး Customer", summary: "အကြွေး Customer အကြွေးတိုး 100,000 Ks", metadata: {}, createdAt: ledger.createdAt, hiddenAt: null },
    ]);
    const report = await getDailyReportData(period);
    expect(report.activityLogs.some((log) => String(log.action).startsWith("ORDER_"))).toBe(false);
    expect(report.activityLogs.some((log) => log.entityType === "OrderBatch")).toBe(false);
    expect(report.activityLogs.some((log) => log.action === "UPDATE")).toBe(false);
    expect(report.activityLogs.some((log) => String(log.summary || "").includes("ပြင်ဆင်ထားသော Customer"))).toBe(false);
    expect(report.activityLogs.some((log) => log.action === "PRODUCTION_REPORT_SUBMIT")).toBe(false);
    const where = mocks.auditFindMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(expect.arrayContaining([
      { NOT: { action: "DAILY_REPORT_SENT" } },
      { NOT: [
        { entityType: "Order" },
        { entityType: "OrderBatch" },
        { action: { startsWith: "ORDER_" } },
        { action: { in: ["DAILY_SALES_OPENING", "DAILY_SALES_SUMMARY"] } },
        { action: "PRODUCTION_REPORT_DELETE" },
        { action: "PRODUCTION_REPORT_SUBMIT" },
      ] },
    ]));
  });
});
