import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  findCashSale: vi.fn(),
  findDaily: vi.fn(),
  upsertDaily: vi.fn(),
  findOpening: vi.fn(),
  upsertOpening: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  ensureDatabase: mocks.ensureDatabase,
  databaseErrorResponse: (error) => ({ error: String(error?.message || error) }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cashSale: { findMany: mocks.findCashSale },
    dailySalesSummary: { findMany: mocks.findDaily, upsert: mocks.upsertDaily },
    dailySalesOpening: { findUnique: mocks.findOpening, upsert: mocks.upsertOpening },
  },
}));
vi.mock("@/lib/audit", () => ({
  getActorName: () => "Rhyzoe",
  writeAuditLog: mocks.writeAuditLog,
}));
vi.mock("@/lib/myanmar-time", () => ({
  getMyanmarDateInputValue: (value) => new Date(value).toISOString().slice(0, 10),
  getMyanmarDayRange: (dateLabel) => {
    const start = new Date(`${dateLabel}T00:00:00.000Z`);
    return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000), dateLabel };
  },
}));
vi.mock("@/lib/cash-sale-utils", () => ({
  normalizeCashSaleType: (value) => String(value || "RETAIL").toUpperCase() === "WHOLESALE" ? "WHOLESALE" : "RETAIL",
}));

import { GET, POST } from "@/app/api/daily-sales-summary/route";

const sale = (date, saleType, paymentType, amount) => ({
  date: new Date(`${date}T12:00:00.000Z`),
  saleType,
  paymentType,
  amount,
});

const savedRow = (date, values) => ({
  id: `row-${date}`,
  date,
  ...values,
  source: "DAILY_INPUT",
  note: null,
  createdAt: new Date(`${date}T12:00:00.000Z`),
  updatedAt: new Date(`${date}T12:00:00.000Z`),
});

describe("Daily sales summary API", () => {
  beforeEach(() => {
    mocks.ensureDatabase.mockReset();
    mocks.findCashSale.mockReset().mockResolvedValue([]);
    mocks.findDaily.mockReset().mockResolvedValue([]);
    mocks.upsertDaily.mockReset();
    mocks.findOpening.mockReset().mockResolvedValue(null);
    mocks.upsertOpening.mockReset();
    mocks.writeAuditLog.mockReset().mockResolvedValue(null);
  });

  it("calculates retail/wholesale totals, cash totals, and month-to-date total from CashSale", async () => {
    mocks.findCashSale.mockResolvedValue([
      sale("2026-08-25", "RETAIL", "CASH", 50000),
      sale("2026-08-08", "RETAIL", "KPAY", 50000),
      sale("2026-08-27", "RETAIL", "CASH", 100000),
      sale("2026-08-27", "RETAIL", "KPAY", 200000),
      sale("2026-08-27", "WHOLESALE", "BANK", 400000),
      sale("2026-08-27", "WHOLESALE", "CASH", 50000),
    ]);

    const response = await GET(new Request("http://localhost/api/daily-sales-summary?date=2026-08-27"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.selectedDay).toMatchObject({
      retailTotal: 300000,
      wholesaleTotal: 450000,
      dailyTotal: 750000,
      retailCash: 100000,
      wholesaleCash: 50000,
      cashDailyTotal: 150000,
      recordCount: 4,
      paymentTypes: { CASH: 150000, KPAY: 200000, BANK: 400000 },
    });
    expect(body.data.monthlyTotal).toBe(850000);
    expect(body.data.rows.find((row) => row.date === "2026-08-27")).toMatchObject({ dailyTotal: 750000, cashDailyTotal: 150000 });
  });

  it("returns record-level reconciliation only when requested", async () => {
    const sourceSale = { ...sale("2026-08-27", "WHOLESALE", "BANK", 60000), id: "sale-reconcile", note: "စာရင်းစစ်ရန်", paymentBreakdown: { CASH: 40000, KPAY: 20000, BANK: 0, WAVE: 0, SPECIAL: 0 }, customer: { id: "customer-reconcile", name: "စစ်ရန် Customer" } };
    const row = savedRow("2026-08-27", { retailTotal: 0, wholesaleTotal: 0, retailCash: 0, wholesaleCash: 0 });
    mocks.findCashSale.mockResolvedValue([sourceSale]);
    mocks.findDaily.mockResolvedValue([row]);

    const response = await GET(new Request("http://localhost/api/daily-sales-summary?date=2026-08-27&reconcile=true"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.reconciliation).toMatchObject({
      status: "REVIEW",
      autoTotals: { wholesaleTotal: 60000, wholesaleCash: 40000, dailyTotal: 60000 },
      referenceTotals: { wholesaleTotal: 0, dailyTotal: 0 },
      difference: { wholesaleTotal: 60000, dailyTotal: 60000 },
      paymentMatrix: { WHOLESALE: { CASH: 40000, KPAY: 20000, BANK: 0 } },
    });
    expect(body.data.reconciliation.candidates).toEqual([expect.objectContaining({ id: "sale-reconcile", amount: 60000, paymentLabel: "CASH 40,000 Ks + KPAY 20,000 Ks" })]);
  });

  it("saves the four daily inputs as a separate auditable row", async () => {
    const row = savedRow("2026-08-27", { retailTotal: 200000, wholesaleTotal: 450000, retailCash: 100000, wholesaleCash: 50000 });
    mocks.upsertDaily.mockResolvedValue(row);
    mocks.findDaily.mockResolvedValue([row]);

    const response = await POST(new Request("http://localhost/api/daily-sales-summary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-08-27", retailTotal: 200000, wholesaleTotal: 450000, retailCash: 100000, wholesaleCash: 50000 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.upsertDaily).toHaveBeenCalledWith(expect.objectContaining({ where: { date: "2026-08-27" } }));
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "DAILY_SALES_SUMMARY", entityType: "DailySalesSummary" }));
    expect(body.data.selectedDay).toMatchObject({ source: "DAILY_SUMMARY", dailyTotal: 650000 });
    expect(body.data.monthlyTotal).toBe(650000);
  });

  it("adds the current daily row to a one-time month opening amount", async () => {
    const row = savedRow("2026-08-27", { retailTotal: 200000, wholesaleTotal: 450000, retailCash: 100000, wholesaleCash: 50000 });
    const opening = { id: "opening-aug", month: "2026-08", amount: 1000000, asOfDate: "2026-08-26", note: null, updatedAt: new Date("2026-08-27T12:00:00.000Z") };
    mocks.upsertOpening.mockResolvedValue(opening);
    mocks.findOpening.mockResolvedValue(opening);
    mocks.findDaily.mockResolvedValue([row]);

    const response = await POST(new Request("http://localhost/api/daily-sales-summary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "opening", month: "2026-08", selectedDate: "2026-08-27", amount: 1000000, asOfDate: "2026-08-26" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.upsertOpening).toHaveBeenCalledWith(expect.objectContaining({ where: { month: "2026-08" }, update: expect.objectContaining({ amount: 1000000, asOfDate: "2026-08-26" }) }));
    expect(body.data.opening).toMatchObject({ amount: 1000000, asOfDate: "2026-08-26" });
    expect(body.data.monthlyTotal).toBe(1650000);
  });

  it("rejects an invalid selected date without touching business data", async () => {
    const response = await GET(new Request("http://localhost/api/daily-sales-summary?date=not-a-date"));
    expect(response.status).toBe(400);
    expect(mocks.findCashSale).not.toHaveBeenCalled();
    expect(mocks.findDaily).not.toHaveBeenCalled();
  });
});
