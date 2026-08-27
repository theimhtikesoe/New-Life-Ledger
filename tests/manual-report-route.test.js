import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runDailyReport: vi.fn(),
  beginAutoReportRun: vi.fn(),
  finishAutoReportRun: vi.fn(),
  getMyanmarDayRange: vi.fn(),
  getPreviousMyanmarDayRange: vi.fn(),
}));

vi.mock("@/lib/daily-report-delivery", () => ({ runDailyReport: mocks.runDailyReport }));
vi.mock("@/lib/auto-report-status", () => ({
  beginAutoReportRun: mocks.beginAutoReportRun,
  finishAutoReportRun: mocks.finishAutoReportRun,
}));
vi.mock("@/lib/myanmar-time", () => ({
  getMyanmarDayRange: mocks.getMyanmarDayRange,
  getPreviousMyanmarDayRange: mocks.getPreviousMyanmarDayRange,
}));

import { POST } from "@/app/api/telegram/manual-report/route";

function request(body, authorization = "Bearer manual-pin") {
  return new Request("http://localhost/api/telegram/manual-report", {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
      "x-actor-name": "Staff",
    },
    body: JSON.stringify(body),
  });
}

describe("Manual Telegram report route", () => {
  beforeEach(() => {
    process.env.MANUAL_REPORT_PIN = "manual-pin";
    mocks.runDailyReport.mockReset().mockResolvedValue({
      date: "2026-08-26",
      period: "26 Aug period",
      counts: { paid: 4, debtIncrease: 6, transactions: 10, activityActions: 11 },
      recipients: 1,
      elapsedMs: 500,
    });
    mocks.beginAutoReportRun.mockReset().mockResolvedValue({ shouldRun: true, runId: "manual-run-1" });
    mocks.finishAutoReportRun.mockReset().mockResolvedValue({ id: "manual-run-1" });
    mocks.getMyanmarDayRange.mockReset().mockReturnValue({ dateLabel: "2026-08-26" });
    mocks.getPreviousMyanmarDayRange.mockReset().mockReturnValue({ dateLabel: "2026-08-26" });
  });

  it("records a successful manual send so the next auto run can skip it", async () => {
    const response = await POST(request({ date: "2026-08-26" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.runDailyReport).toHaveBeenCalledWith({ date: "2026-08-26" });
    expect(mocks.beginAutoReportRun).toHaveBeenCalledWith({ reportDate: "2026-08-26", trigger: "manual" });
    expect(mocks.finishAutoReportRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: "manual-run-1",
      status: "SUCCESS",
      reportDate: "2026-08-26",
      recipients: 1,
    }));
    expect(body).toEqual(expect.objectContaining({ ok: true, date: "2026-08-26", actorName: "Staff" }));
  });

  it("skips a duplicate manual send when the date is already claimed", async () => {
    mocks.beginAutoReportRun.mockResolvedValue({ shouldRun: false, reason: "already_success" });

    const response = await POST(request({ date: "2026-08-26" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ ok: true, skipped: true, reason: "already_success", date: "2026-08-26" }));
    expect(mocks.runDailyReport).not.toHaveBeenCalled();
    expect(mocks.finishAutoReportRun).not.toHaveBeenCalled();
  });

  it("does not run or record a report without the manual PIN", async () => {
    const response = await POST(request({ date: "2026-08-26" }, "Bearer wrong-pin"));

    expect(response.status).toBe(401);
    expect(mocks.runDailyReport).not.toHaveBeenCalled();
    expect(mocks.beginAutoReportRun).not.toHaveBeenCalled();
    expect(mocks.finishAutoReportRun).not.toHaveBeenCalled();
  });
});
