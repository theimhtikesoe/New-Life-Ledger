import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractOrderFromText } from "@/lib/order-ai";

const extractedValue = {
  customerName: "ကံလီ",
  customerPhone: null,
  requestedDate: "2026-08-26",
  destination: "ပုလဲဂိတ်",
  lines: [{ bottleType: "အပြာ", capacityMl: 300, capacityLabel: "0.3 Liter", bottlesPerCard: 400, cardCount: 20, notes: null }],
  caps: [],
  missingFields: [],
  confidence: "high",
  notes: null,
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Order AI provider polling", () => {
  beforeEach(() => {
    process.env.MANUS_API_KEY = "test-manus-key";
  });

  afterEach(() => {
    delete process.env.MANUS_API_KEY;
    vi.unstubAllGlobals();
  });

  it("retries an initial listMessages not_found before reading structured output", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, task_id: "task-1" }))
      .mockResolvedValueOnce(jsonResponse({ ok: false, error: { code: "not_found" }, request_id: "request-1" }, 404))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        messages: [
          { type: "structured_output_result", structured_output_result: { success: true, value: extractedValue, error: null } },
          { type: "status_update", status_update: { agent_status: "stopped" } },
        ],
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(extractOrderFromText("ကံလီ၊ 0.3 Liter၊ 400 ဆံ့ 20 ကဒ်၊ ပုလဲဂိတ်၊ မနက်ဖြန်"))
      .resolves.toEqual(expect.objectContaining({
        customerName: "ကံလီ",
        requestedDate: "2026-08-26",
        destination: "ပုလဲဂိတ်",
        lines: [expect.objectContaining({ capacityMl: 300, bottlesPerCard: 400, cardCount: 20, totalBottles: 8000 })],
      }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain("task-1");
    expect(fetchMock.mock.calls[2][0]).toContain("task-1");
  });
});

