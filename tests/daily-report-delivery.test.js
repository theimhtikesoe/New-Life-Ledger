import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDailyReportData: vi.fn(),
  createDailyReportPdf: vi.fn(),
  createDailySummaryImage: vi.fn(),
  createDailySalesSummaryImage: vi.fn(),
  createDailyActivityImage: vi.fn(),
  sendDailyReportToTelegram: vi.fn(),
}));

vi.mock("@/lib/daily-report", () => ({
  getDailyReportData: mocks.getDailyReportData,
  createDailyReportPdf: mocks.createDailyReportPdf,
  createDailySalesSummaryImage: mocks.createDailySalesSummaryImage,
  createDailyActivityImage: mocks.createDailyActivityImage,
}));
vi.mock("@/lib/telegram", () => ({ sendDailyReportToTelegram: mocks.sendDailyReportToTelegram }));

import { runDailyReport } from "@/lib/daily-report-delivery";

const report = {
  dateLabel: "2026-09-02",
  periodLabel: "2026-09-02 00:00–23:59 (Myanmar time)",
  summary: {
    paidCount: 1,
    paidAmount: 1000,
    debtCount: 0,
    debtAmount: 0,
    cashCount: 0,
    cashAmount: 0,
    totalTransactions: 1,
    activityCount: 1,
    auditCount: 1,
    cashSaleTypes: {},
  },
  activityLogs: [{ action: "PAYMENT" }],
};

describe("Telegram daily report delivery attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDailyReportData.mockResolvedValue(report);
    mocks.createDailyReportPdf.mockResolvedValue(Buffer.from("pdf"));
    mocks.createDailySalesSummaryImage.mockResolvedValue(Buffer.from("sales"));
    mocks.sendDailyReportToTelegram.mockResolvedValue({ results: [{ chatId: "1984408250" }] });
  });

  it("sends only the PDF and sales summary PNG", async () => {
    await runDailyReport({ date: "2026-09-02", recipientChatId: "1984408250" });

    expect(mocks.createDailyActivityImage).not.toHaveBeenCalled();
    expect(mocks.sendDailyReportToTelegram).toHaveBeenCalledWith(expect.objectContaining({
      pdfBuffer: expect.any(Buffer),
      salesSummaryImageBuffer: expect.any(Buffer),
    }));
    expect(mocks.createDailySummaryImage).not.toHaveBeenCalled();
    expect(mocks.sendDailyReportToTelegram.mock.calls[0][0]).not.toHaveProperty("imageBuffer");
    expect(mocks.sendDailyReportToTelegram.mock.calls[0][0]).not.toHaveProperty("activityImageBuffer");
  });
});
