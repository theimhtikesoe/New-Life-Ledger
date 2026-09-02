import { describe, expect, it } from "vitest";
import { createDailySalesSummaryCardHtml } from "@/lib/daily-report";

describe("Daily Sales Summary Telegram card image", () => {
  it("renders only the previous-day cards and excludes UI controls/table", () => {
    const html = createDailySalesSummaryCardHtml({
      dateLabel: "2026-09-01",
      retailTotal: 457900,
      retailCash: 391500,
      wholesaleTotal: 7824500,
      wholesaleCash: 2710500,
      dailyTotal: 8282400,
      cashDailyTotal: 3102000,
      monthlyTotal: 8282400,
      opening: 0,
    }, "font-data", "latin-data");

    expect(html).toContain("နေ့စဉ် လက်လီ / လက်ကား ရောင်းရငွေ");
    expect(html).toContain("457,900 Ks");
    expect(html).toContain("7,824,500 Ks");
    expect(html).toContain("8,282,400 Ks");
    expect(html).toContain("3,102,000 Ks");
    expect(html).not.toContain("ပိတ်မည်");
    expect(html).not.toContain("Auto data ပြန်ထားရန်");
    expect(html).not.toContain("နေ့စဉ်စာရင်း သိမ်းမည်");
    expect(html).not.toContain("summary-table");
  });
});
