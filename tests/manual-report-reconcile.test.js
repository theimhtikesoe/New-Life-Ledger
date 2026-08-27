import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reconcileManualReportRun: vi.fn(),
  getMyanmarDayRange: vi.fn(),
  getPreviousMyanmarDayRange: vi.fn(),
}));

vi.mock("@/lib/auto-report-status", () => ({ reconcileManualReportRun: mocks.reconcileManualReportRun }));
vi.mock("@/lib/myanmar-time", () => ({
  getMyanmarDayRange: mocks.getMyanmarDayRange,
  getPreviousMyanmarDayRange: mocks.getPreviousMyanmarDayRange,
}));

import { POST } from "@/app/api/telegram/manual-report/reconcile/route";

function request(body, authorization = "Bearer manual-pin") {
  return new Request("http://localhost/api/telegram/manual-report/reconcile", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Manual report reconciliation route", () => {
  beforeEach(() => {
    process.env.MANUAL_REPORT_PIN = "manual-pin";
    mocks.reconcileManualReportRun.mockReset().mockResolvedValue({ recorded: true, run: { id: "reconciled-1" } });
    mocks.getMyanmarDayRange.mockReset().mockReturnValue({ dateLabel: "2026-08-26" });
    mocks.getPreviousMyanmarDayRange.mockReset().mockReturnValue({ dateLabel: "2026-08-26" });
  });

  it("records a known manual send without calling Telegram", async () => {
    const response = await POST(request({ date: "2026-08-26", recipients: 1 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.reconcileManualReportRun).toHaveBeenCalledWith(expect.objectContaining({ reportDate: "2026-08-26", recipients: 1 }));
    expect(body).toEqual(expect.objectContaining({ ok: true, date: "2026-08-26", recorded: true }));
  });

  it("rejects a request without the manual PIN", async () => {
    const response = await POST(request({ date: "2026-08-26" }, "Bearer wrong-pin"));

    expect(response.status).toBe(401);
    expect(mocks.reconcileManualReportRun).not.toHaveBeenCalled();
  });
});
