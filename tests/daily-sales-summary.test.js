import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  findCashSale: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  ensureDatabase: mocks.ensureDatabase,
  databaseErrorResponse: (error) => ({ error: String(error?.message || error) }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { cashSale: { findMany: mocks.findCashSale } },
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

import { GET } from "@/app/api/daily-sales-summary/route";

const sale = (date, saleType, paymentType, amount) => ({
  date: new Date(`${date}T12:00:00.000Z`),
  saleType,
  paymentType,
  amount,
});

describe("Daily sales summary API", () => {
  beforeEach(() => {
    mocks.ensureDatabase.mockReset();
    mocks.findCashSale.mockReset().mockResolvedValue([]);
  });

  it("calculates retail/wholesale totals, cash totals, and month-to-date total", async () => {
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
    expect(body.data.byDate["2026-08-27"]).toMatchObject({ dailyTotal: 750000, cashDailyTotal: 150000 });
  });

  it("rejects an invalid selected date without touching business data", async () => {
    const response = await GET(new Request("http://localhost/api/daily-sales-summary?date=not-a-date"));
    expect(response.status).toBe(400);
    expect(mocks.findCashSale).not.toHaveBeenCalled();
  });
});
