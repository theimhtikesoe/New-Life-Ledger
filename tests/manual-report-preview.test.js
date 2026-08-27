import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDailyReportData: vi.fn(),
  getMyanmarDayRange: vi.fn((date) => ({ dateLabel: date, start: new Date("2026-08-25T17:30:00.000Z"), end: new Date("2026-08-26T17:30:00.000Z") })),
}));

vi.mock("@/lib/daily-report", () => ({ getDailyReportData: mocks.getDailyReportData }));
vi.mock("@/lib/myanmar-time", () => ({ getMyanmarDayRange: mocks.getMyanmarDayRange }));

import { GET } from "@/app/api/telegram/manual-report-preview/route";

const report = {
  dateLabel: "2026-08-26",
  periodLabel: "2026-08-26 00:00–23:59 (Myanmar time)",
  summary: {
    paidCount: 1,
    paidAmount: 100000,
    debtCount: 0,
    debtAmount: 0,
    cashCount: 2,
    cashAmount: 150000,
    cashPaymentTypes: { CASH: 150000 },
    cashSaleTypes: { RETAIL: { count: 1, amount: 50000 }, WHOLESALE: { count: 1, amount: 100000 } },
    totalTransactions: 1,
    auditCount: 1,
    activityCount: 1,
  },
  activityLogs: [{}],
};

describe("Manual Telegram report preview", () => {
  it("returns retail and wholesale cash-sale totals for the selected Myanmar date", async () => {
    mocks.getDailyReportData.mockResolvedValue(report);
    const response = await GET(new Request("http://localhost/api/telegram/manual-report-preview?date=2026-08-26"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        date: "2026-08-26",
        period: report.periodLabel,
        summary: {
          paidCount: 1,
          paidAmount: 100000,
          debtCount: 0,
          debtAmount: 0,
          cashCount: 2,
          cashAmount: 150000,
          cashPaymentTypes: { CASH: 150000 },
          cashSaleTypes: { RETAIL: { count: 1, amount: 50000 }, WHOLESALE: { count: 1, amount: 100000 } },
          totalTransactions: 1,
          auditCount: 1,
          activityCount: 1,
        },
      },
    });
    expect(mocks.getMyanmarDayRange).toHaveBeenCalledWith("2026-08-26");
    expect(mocks.getDailyReportData).toHaveBeenCalledWith(expect.objectContaining({ dateLabel: "2026-08-26" }));
  });
});
