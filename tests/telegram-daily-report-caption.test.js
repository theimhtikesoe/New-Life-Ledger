import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalFetch = global.fetch;

describe("Telegram daily report caption", () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_GROUP_CHAT_ID = "group-1";
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, result: { message_id: 1 } }) });
  });

  it("lists the four PDF pages", async () => {
    vi.resetModules();
    const { sendDailyReportToTelegram } = await import("@/lib/telegram");
    await sendDailyReportToTelegram({ pdfBuffer: Buffer.from("pdf"), dateLabel: "2026-09-06" });
    const formData = global.fetch.mock.calls[0][1].body;
    const entries = [];
    for (const [key, value] of formData.entries()) entries.push([key, String(value)]);
    const caption = entries.find(([key]) => key === "caption")?.[1] || "";
    expect(caption).toContain("စာမျက်နှာ ၁ — စာရင်းချုပ်");
    expect(caption).toContain("စာမျက်နှာ ၂ — လက်လီ / လက်ကားစာရင်း");
    expect(caption).toContain("စာမျက်နှာ ၃ — ဗူးထွက်ရှိမှုစာရင်း");
    expect(caption).toContain("စာမျက်နှာ ၄ — ဗူးရောင်းစာရင်း");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_GROUP_CHAT_ID;
  });
});
