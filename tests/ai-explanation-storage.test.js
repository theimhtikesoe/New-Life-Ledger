import { describe, expect, it } from "vitest";
import {
  consumeDailyAiUsage,
  recordDailyAiSuccess,
  resetDailyAiUsage,
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
    expect(saveAiExplanationCache("2026-08-24", explanation, "Rhyzoe", storage)).toBe(true);
    expect(readAiExplanationCache("2026-08-24", "Rhyzoe", storage)).toEqual(explanation);
    expect(readAiExplanationCache("2026-08-24", "ဖေဖေ", storage)).toBeNull();
    expect(readAiExplanationCache("2026-08-25", "Rhyzoe", storage)).toBeNull();
  });

  it("counts only successful answers and can reset a stuck old counter", () => {
    const storage = createStorage();
    expect(getDailyAiUsage("Rhyzoe", "2026-08-24", storage)).toBe(0);
    expect(recordDailyAiSuccess("Rhyzoe", "2026-08-24", storage)).toBe(1);
    expect(recordDailyAiSuccess("Rhyzoe", "2026-08-24", storage)).toBe(2);
    expect(resetDailyAiUsage("Rhyzoe", "2026-08-24", storage)).toBe(0);
    expect(getDailyAiUsage("Rhyzoe", "2026-08-24", storage)).toBe(0);
  });

  it("keeps the legacy usage alias independent for each actor and report date", () => {
    const storage = createStorage();
    expect(getDailyAiUsage("Rhyzoe", "2026-08-24", storage)).toBe(0);
    expect(consumeDailyAiUsage("Rhyzoe", "2026-08-24", storage)).toBe(1);
    expect(consumeDailyAiUsage("Rhyzoe", "2026-08-24", storage)).toBe(2);
    expect(getDailyAiUsage("Rhyzoe", "2026-08-25", storage)).toBe(0);
    expect(getDailyAiUsage("ဖေဖေ", "2026-08-24", storage)).toBe(0);
    expect(MAX_DAILY_AI_REQUESTS).toBe(3);
  });

  it("creates an activity link that preserves the selected date and AI return context", () => {
    expect(getAiActivityReviewHref("2026-08-24")).toBe("/activity?date=2026-08-24&from=ai");
  });

  it("adds a safe customer, amount, and action target for Activity highlighting", () => {
    const href = getAiActivityReviewHref("2026-08-24", { customerName: "Daw JoThiee", amount: "156,000", action: "DEBT_INCREASE" });
    expect(href).toContain("date=2026-08-24");
    expect(href).toContain("customer=Daw+JoThiee");
    expect(href).toContain("amount=156000");
    expect(href).toContain("action=DEBT_INCREASE");
  });
});

