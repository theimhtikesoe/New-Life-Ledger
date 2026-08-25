import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { explainAiDailySummary } from "@/lib/ai-daily-summary";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

const payload = {
  date: "2026-08-24",
  period: "00:00–23:59 (မြန်မာစံတော်ချိန်)",
  summary: { paidCount: 1, paidAmount: 1000, debtCount: 0, debtAmount: 0, totalTransactions: 1, paymentTypes: {} },
  genuineActivity: { total: 1, byAction: {}, byEntityType: {}, events: [] },
  customers: [],
  sourceRules: [],
};

const structuredExplanation = { explanation: { overview: "နေ့စဉ်စာရင်း တည်ငြိမ်ပါသည်။", findings: [], checks: [], caution: "သတိ" } };

describe("Daily Summary official Manus provider", () => {
  beforeEach(() => {
    process.env.MANUS_API_KEY = "test-manus-key";
  });

  afterEach(() => {
    delete process.env.MANUS_API_KEY;
    vi.unstubAllGlobals();
  });

  it("retries a transient initial listMessages 404", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, task_id: "summary-task-1" }))
      .mockResolvedValueOnce(jsonResponse({ ok: false, error: { code: "not_found" } }, 404))
      .mockResolvedValueOnce(jsonResponse({ ok: true, messages: [
        { type: "status_update", status_update: { agent_status: "stopped" } },
        { type: "structured_output_result", structured_output_result: { success: true, value: structuredExplanation } },
      ] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(explainAiDailySummary(payload)).resolves.toEqual({ overview: "နေ့စဉ်စာရင်း တည်ငြိမ်ပါသည်။", findings: [], checks: [], caution: "သတိ" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries a transient 503 create failure but does not retry auth failures", async () => {
    const transientMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: false }, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: true, task_id: "summary-task-2" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, messages: [
        { type: "status_update", status_update: { agent_status: "stopped" } },
        { type: "structured_output_result", structured_output_result: { success: true, value: structuredExplanation } },
      ] }));
    vi.stubGlobal("fetch", transientMock);
    await expect(explainAiDailySummary(payload)).resolves.toMatchObject({ overview: "နေ့စဉ်စာရင်း တည်ငြိမ်ပါသည်။" });
    expect(transientMock).toHaveBeenCalledTimes(3);

    const authMock = vi.fn().mockResolvedValueOnce(jsonResponse({ ok: false }, 401));
    vi.stubGlobal("fetch", authMock);
    await expect(explainAiDailySummary(payload)).rejects.toMatchObject({ code: "MANUS_AUTH" });
    expect(authMock).toHaveBeenCalledTimes(1);
  });
});
