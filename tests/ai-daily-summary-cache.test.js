import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aiExplanationCache: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/database", () => ({ ensureDatabase: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { aiExplanationCache: mocks.aiExplanationCache } }));

import {
  AI_EXPLANATION_PROMPT_VERSION,
  findAiExplanationCache,
  findLatestAiExplanationCache,
  getAiDailySummaryFingerprint,
  saveAiExplanationCache,
} from "@/lib/ai-daily-summary";

const explanation = { overview: "နေ့စဉ်အနှစ်ချုပ်", findings: [], checks: [], caution: "သတိ" };

describe("Daily Summary database explanation cache helpers", () => {
  beforeEach(() => {
    mocks.aiExplanationCache.findUnique.mockReset().mockResolvedValue(null);
    mocks.aiExplanationCache.findFirst.mockReset().mockResolvedValue(null);
    mocks.aiExplanationCache.upsert.mockReset().mockResolvedValue({ id: "cache-1", updatedAt: "2026-08-24T12:00:00.000Z" });
  });

  it("creates the same fingerprint for the same payload and a different one when data changes", () => {
    const first = { date: "2026-08-24", summary: { paidAmount: 1000 }, events: [] };
    expect(getAiDailySummaryFingerprint(first)).toBe(getAiDailySummaryFingerprint({ ...first, summary: { paidAmount: 1000 } }));
    expect(getAiDailySummaryFingerprint(first)).not.toBe(getAiDailySummaryFingerprint({ ...first, summary: { paidAmount: 2000 } }));
  });

  it("uses the generated Prisma compound unique key with the current prompt version", async () => {
    await findAiExplanationCache({ date: "2026-08-24", fingerprint: "abc123" });
    expect(mocks.aiExplanationCache.findUnique).toHaveBeenCalledWith({
      where: {
        reportDate_dataFingerprint_promptVersion: {
          reportDate: "2026-08-24",
          dataFingerprint: "abc123",
          promptVersion: AI_EXPLANATION_PROMPT_VERSION,
        },
      },
    });
  });

  it("reads the latest same-date explanation for stale fallback", async () => {
    await findLatestAiExplanationCache("2026-08-24");
    expect(mocks.aiExplanationCache.findFirst).toHaveBeenCalledWith({
      where: { reportDate: "2026-08-24" },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
  });

  it("upserts only the successful explanation with date, fingerprint, and provenance", async () => {
    await saveAiExplanationCache({
      date: "2026-08-24",
      fingerprint: "abc123",
      explanation,
      actorName: "ဖေဖေ",
      provider: "MANUS_API",
      model: "manus-1.6-lite",
    });
    expect(mocks.aiExplanationCache.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { reportDate_dataFingerprint_promptVersion: { reportDate: "2026-08-24", dataFingerprint: "abc123", promptVersion: AI_EXPLANATION_PROMPT_VERSION } },
      create: expect.objectContaining({ reportDate: "2026-08-24", dataFingerprint: "abc123", promptVersion: AI_EXPLANATION_PROMPT_VERSION, explanation, generatedBy: "ဖေဖေ", provider: "MANUS_API", model: "manus-1.6-lite" }),
      update: expect.objectContaining({ explanation, generatedBy: "ဖေဖေ" }),
    }));
  });
});
