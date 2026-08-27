import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dailySummarySource = readFileSync(resolve(process.cwd(), "src/app/daily-summary/page.js"), "utf8");
const activitySource = readFileSync(resolve(process.cwd(), "src/app/activity/page.js"), "utf8");

describe("Daily Summary AI review navigation", () => {
  it("hydrates the report date from the URL before loading data and AI cache", () => {
    expect(dailySummarySource).toContain("const [urlReady, setUrlReady] = useState(false);");
    expect(dailySummarySource).toContain('new URLSearchParams(window.location.search).get("date")');
    expect(dailySummarySource).toContain("if (!urlReady) return undefined;");
    expect(dailySummarySource).toContain("}, [date, urlReady]);");
  });

  it("keeps fallback explanations available when returning from Activity", () => {
    expect(dailySummarySource).toContain("saveAiExplanationCache(date, fallback, actorName);");
    expect(dailySummarySource).toContain("href={`${getAiActivityReviewHref(date, getReviewTarget(item))}#activity-results`}");
    expect(activitySource).toContain('href={`/daily-summary?date=${encodeURIComponent(date)}#ai-explanation`}');
  });

  it("hydrates Activity review targets, preserves the selected date, and scrolls to a match", () => {
    expect(activitySource).toContain("const [urlReady, setUrlReady] = useState(false);");
    expect(activitySource).toContain("setReviewTarget(target.customerName || target.amount || target.action || target.targetText ? target : null);");
    expect(activitySource).toContain("}, [date, actor, action, urlReady]);");
    expect(activitySource).toContain("scrollIntoView({ behavior: \"smooth\", block: \"center\" })");
  });
});
