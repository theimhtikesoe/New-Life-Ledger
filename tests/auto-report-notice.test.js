import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendTelegramTextToChat: vi.fn() }));

vi.mock("@/lib/telegram", () => ({ sendTelegramTextToChat: mocks.sendTelegramTextToChat }));

import { sendManualReportStatusNotice } from "@/lib/auto-report-notice";

describe("Manual report status notice", () => {
  beforeEach(() => {
    process.env.TELEGRAM_GROUP_CHAT_ID = "report-chat-test";
    mocks.sendTelegramTextToChat.mockReset().mockResolvedValue({ messageId: 12 });
  });

  it("explains the duplicate skip and formats the send time in Myanmar time", async () => {
    const result = await sendManualReportStatusNotice({
      reportDate: "2026-08-26",
      run: { createdAt: "2026-08-27T02:00:00.000Z" },
    });
    const text = mocks.sendTelegramTextToChat.mock.calls[0][0].text;

    expect(result).toEqual({ sent: true, messageId: 12 });
    expect(text).toContain("2026-08-26");
    expect(text).toContain("Duplicate report မဖြစ်စေရန်");
    expect(text).toContain("MMT");
    expect(text).not.toContain("UTC");
  });
});
