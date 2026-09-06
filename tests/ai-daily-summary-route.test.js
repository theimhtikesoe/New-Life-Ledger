import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  decodeActorHeader: vi.fn(() => "Rhyzoe"),
  getAiDailySummaryPayload: vi.fn(),
  getAiDailySummaryFingerprint: vi.fn(),
  findAiExplanationCache: vi.fn(),
  findLatestAiExplanationCache: vi.fn(),
  buildRuleBasedExplanation: vi.fn(),
  explainAiDailySummary: vi.fn(),
  saveAiExplanationCache: vi.fn(),
}));

vi.mock("@/lib/actor-header", () => ({ decodeActorHeader: mocks.decodeActorHeader }));
vi.mock("@/lib/ai-daily-summary", () => ({
  getAiDailySummaryPayload: mocks.getAiDailySummaryPayload,
  getAiDailySummaryFingerprint: mocks.getAiDailySummaryFingerprint,
  findAiExplanationCache: mocks.findAiExplanationCache,
  findLatestAiExplanationCache: mocks.findLatestAiExplanationCache,
  buildRuleBasedExplanation: mocks.buildRuleBasedExplanation,
  explainAiDailySummary: mocks.explainAiDailySummary,
  saveAiExplanationCache: mocks.saveAiExplanationCache,
}));

import { GET } from "@/app/api/ai/daily-summary/route";

const date = "2026-08-24";
const payload = { date, summary: { totalTransactions: 2 }, genuineActivity: { events: [] } };
const cachedExplanation = { overview: "DB အဟောင်းရှင်းပြချက်", findings: [], checks: [], caution: "သတိ" };
const freshExplanation = { overview: "AI အသစ်ရှင်းပြချက်", findings: [], checks: [], caution: "သတိ" };

function request(query = "") {
  return new Request(`http://localhost/api/ai/daily-summary?date=${date}${query}`, {
    headers: { "x-actor-name": "Rhyzoe" },
  });
}

function cacheRow(explanation = cachedExplanation) {
  return { explanation, updatedAt: "2026-08-24T12:00:00.000Z", createdAt: "2026-08-24T11:00:00.000Z" };
}

describe("Daily Summary AI cache route", () => {
  beforeEach(() => {
    mocks.decodeActorHeader.mockReturnValue("Rhyzoe");
    mocks.getAiDailySummaryPayload.mockReset().mockResolvedValue(payload);
    mocks.getAiDailySummaryFingerprint.mockReset().mockReturnValue("fingerprint-1");
    mocks.findAiExplanationCache.mockReset().mockResolvedValue(null);
    mocks.findLatestAiExplanationCache.mockReset().mockResolvedValue(null);
    mocks.buildRuleBasedExplanation.mockReset().mockReturnValue({ overview: "အလိုအလျောက်အနှစ်ချုပ်", findings: [], checks: [], caution: "AI မရသေးပါ။" });
    mocks.explainAiDailySummary.mockReset();
    mocks.saveAiExplanationCache.mockReset().mockResolvedValue({ updatedAt: "2026-08-24T12:30:00.000Z" });
    delete process.env.MANUS_API_KEY;
  });

  afterEach(() => {
    delete process.env.MANUS_API_KEY;
  });

  it("returns a matching database explanation without calling AI", async () => {
    mocks.findAiExplanationCache.mockResolvedValue(cacheRow());
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: expect.objectContaining({ date, explanation: cachedExplanation, cached: true, stale: false }) });
    expect(mocks.getAiDailySummaryPayload).toHaveBeenCalledWith(date);
    expect(mocks.findAiExplanationCache).toHaveBeenCalledWith({ date, fingerprint: "fingerprint-1" });
    expect(mocks.explainAiDailySummary).not.toHaveBeenCalled();
    expect(mocks.saveAiExplanationCache).not.toHaveBeenCalled();
  });

  it("serves the previous same-date explanation in cacheOnly mode without calling AI", async () => {
    mocks.findLatestAiExplanationCache.mockResolvedValue(cacheRow());
    const response = await GET(request("&cacheOnly=1"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toEqual(expect.objectContaining({ date, explanation: cachedExplanation, cached: false, stale: true, dataChanged: true }));
    expect(mocks.explainAiDailySummary).not.toHaveBeenCalled();
    expect(mocks.saveAiExplanationCache).not.toHaveBeenCalled();
  });

  it("calls AI only on a cache miss and saves the successful explanation", async () => {
    mocks.explainAiDailySummary.mockResolvedValue(freshExplanation);
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toEqual(expect.objectContaining({ date, explanation: freshExplanation, cached: false, stale: false, saved: true }));
    expect(mocks.explainAiDailySummary).toHaveBeenCalledWith(payload);
    expect(mocks.saveAiExplanationCache).toHaveBeenCalledWith(expect.objectContaining({ date, fingerprint: "fingerprint-1", explanation: freshExplanation }));
  });

  it("shows an old explanation with a stale warning when changed-day AI generation fails", async () => {
    mocks.findLatestAiExplanationCache.mockResolvedValue(cacheRow());
    mocks.explainAiDailySummary.mockRejectedValue(Object.assign(new Error("AI အချိန်ကျော်"), { code: "MANUS_TIMEOUT" }));
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(expect.objectContaining({ date, explanation: cachedExplanation, cached: true, stale: true, dataChanged: true }));
    expect(body.warning).toContain("အဟောင်း");
    expect(mocks.saveAiExplanationCache).not.toHaveBeenCalled();
  });

  it("returns a safe automatic summary when AI fails and there is no previous explanation", async () => {
    mocks.explainAiDailySummary.mockRejectedValue(Object.assign(new Error("Manus AI service ကို ယခုချိန်တွင် မရရှိနိုင်ပါ။"), { code: "MANUS_SERVICE" }));
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ ok: true, warning: expect.stringContaining("အလိုအလျောက်") }));
    expect(body.data).toEqual(expect.objectContaining({ date, fallback: true, cached: false, stale: false }));
    expect(body.data.explanation).toEqual({ overview: "အလိုအလျောက်အနှစ်ချုပ်", findings: [], checks: [], caution: "AI မရသေးပါ။" });
    expect(mocks.buildRuleBasedExplanation).toHaveBeenCalledWith(payload);
    expect(mocks.saveAiExplanationCache).not.toHaveBeenCalled();
  });

  it("rejects requests without the website actor header", async () => {
    mocks.decodeActorHeader.mockReturnValue("");
    const response = await GET(new Request(`http://localhost/api/ai/daily-summary?date=${date}`));
    expect(response.status).toBe(401);
    expect(mocks.getAiDailySummaryPayload).not.toHaveBeenCalled();
  });
});
