import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runDailyReport: vi.fn(),
  beginAutoReportRun: vi.fn(),
  finishAutoReportRun: vi.fn(),
  getPreviousMyanmarDayRanges: vi.fn(),
}));

vi.mock("@/lib/daily-report-delivery", () => ({ runDailyReport: mocks.runDailyReport }));
vi.mock("@/lib/auto-report-status", () => ({
  beginAutoReportRun: mocks.beginAutoReportRun,
  finishAutoReportRun: mocks.finishAutoReportRun,
}));
vi.mock("@/lib/myanmar-time", () => ({ getPreviousMyanmarDayRanges: mocks.getPreviousMyanmarDayRanges }));

import { GET, POST } from "@/app/api/cron/daily-report/route";

const ranges = [
  { dateLabel: "2026-08-24", start: new Date("2026-08-23T17:30:00.000Z"), end: new Date("2026-08-24T17:30:00.000Z") },
  { dateLabel: "2026-08-25", start: new Date("2026-08-24T17:30:00.000Z"), end: new Date("2026-08-25T17:30:00.000Z") },
  { dateLabel: "2026-08-26", start: new Date("2026-08-25T17:30:00.000Z"), end: new Date("2026-08-26T17:30:00.000Z") },
];

function request(headers = {}) {
  return new Request("http://localhost/api/cron/daily-report", { headers });
}

describe("Daily Telegram report cron", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-test-secret";
    mocks.getPreviousMyanmarDayRanges.mockReset().mockReturnValue(ranges);
    mocks.beginAutoReportRun.mockReset();
    mocks.finishAutoReportRun.mockReset().mockResolvedValue({});
    mocks.runDailyReport.mockReset().mockImplementation(async ({ date, lateByDays }) => ({
      date,
      period: `${date} period`,
      counts: { paid: 1, debtIncrease: 0, transactions: 1, activityActions: 1 },
      recipients: 1,
      elapsedMs: 100,
      catchUp: lateByDays > 0,
      lateByDays,
    }));
  });

  it("rejects an unauthenticated request without attempting delivery", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.beginAutoReportRun).not.toHaveBeenCalled();
    expect(mocks.runDailyReport).not.toHaveBeenCalled();
  });

  it("processes missed dates oldest-first, skips successful dates, and labels late reports", async () => {
    mocks.beginAutoReportRun
      .mockResolvedValueOnce({ shouldRun: true, runId: "run-24" })
      .mockResolvedValueOnce({ shouldRun: false, reason: "already_success" })
      .mockResolvedValueOnce({ shouldRun: true, runId: "run-26" });

    const response = await POST(request({ authorization: "Bearer cron-test-secret" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.beginAutoReportRun.mock.calls.map(([input]) => input.reportDate)).toEqual(["2026-08-24", "2026-08-25", "2026-08-26"]);
    expect(mocks.runDailyReport.mock.calls).toEqual([
      [{ date: "2026-08-24", lateByDays: 2 }],
      [{ date: "2026-08-26", lateByDays: 0 }],
    ]);
    expect(mocks.finishAutoReportRun).toHaveBeenCalledTimes(2);
    expect(body).toEqual({
      ok: true,
      results: [
        { date: "2026-08-24", sent: true, catchUp: true, lateByDays: 2, recipients: 1 },
        { date: "2026-08-25", skipped: true, reason: "already_success" },
        { date: "2026-08-26", sent: true, catchUp: false, lateByDays: 0, recipients: 1 },
      ],
    });
  });
});
