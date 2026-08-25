import { describe, expect, it } from "vitest";
import {
  consumeDailyAiUsage,
  getAiActivityReviewHref,
  getDailyAiUsage,
  MAX_DAILY_AI_REQUESTS,
  readAiExplanationCache,
  saveAiExplanationCache,
} from "@/lib/ai-explanation-storage";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

describe("AI explanation browser storage", () => {
  it("saves and reads an explanation by report date", () => {
    const storage = createStorage();
    const explanation = { overview: "အနှစ်ချုပ်", findings: [], checks: [], caution: "သတိ" };
    expect(saveAiExplanationCache("2026-08-24", explanation, "Staff", storage)).toBe(true);
    expect(readAiExplanationCache("2026-08-24", "Staff", storage)).toEqual(explanation);
    expect(readAiExplanationCache("2026-08-24", "ဖေဖေ", storage)).toBeNull();
    expect(readAiExplanationCache("2026-08-25", "Staff", storage)).toBeNull();
  });

  it("tracks usage independently for each actor and report date", () => {
    const storage = createStorage();
    expect(getDailyAiUsage("Staff", "2026-08-24", storage)).toBe(0);
    expect(consumeDailyAiUsage("Staff", "2026-08-24", storage)).toBe(1);
    expect(consumeDailyAiUsage("Staff", "2026-08-24", storage)).toBe(2);
    expect(getDailyAiUsage("Staff", "2026-08-25", storage)).toBe(0);
    expect(getDailyAiUsage("ဖေဖေ", "2026-08-24", storage)).toBe(0);
    expect(MAX_DAILY_AI_REQUESTS).toBe(3);
  });

  it("creates an activity link that preserves the selected date and AI return context", () => {
    expect(getAiActivityReviewHref("2026-08-24")).toBe("/activity?date=2026-08-24&from=ai");
  });
});

