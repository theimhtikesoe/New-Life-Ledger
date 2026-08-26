import { beforeEach, describe, expect, it, vi } from "vitest";

const archiveExpiredOrders = vi.hoisted(() => vi.fn());
const purgeExpiredHistoryTrash = vi.hoisted(() => vi.fn());
const purgeExpiredCancelledOrders = vi.hoisted(() => vi.fn());
vi.mock("@/lib/order-service", () => ({ archiveExpiredOrders, purgeExpiredHistoryTrash, purgeExpiredCancelledOrders }));

import { POST } from "@/app/api/cron/order-trash-cleanup/route";

describe("Order Trash cleanup cron", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-test-secret";
    archiveExpiredOrders.mockReset().mockResolvedValue({ archivedCount: 3, skippedCount: 0, cutoffDate: "2026-08-26" });
    purgeExpiredHistoryTrash.mockReset().mockResolvedValue({ deletedCount: 1 });
    purgeExpiredCancelledOrders.mockReset().mockResolvedValue({ deletedCount: 2, skippedUndatedCount: 1 });
  });

  it("rejects requests without the cron secret", async () => {
    const response = await POST(new Request("http://localhost/api/cron/order-trash-cleanup"));
    expect(response.status).toBe(401);
    expect(archiveExpiredOrders).not.toHaveBeenCalled();
    expect(purgeExpiredHistoryTrash).not.toHaveBeenCalled();
    expect(purgeExpiredCancelledOrders).not.toHaveBeenCalled();
  });

  it("runs the guarded service only with the cron secret", async () => {
    const response = await POST(new Request("http://localhost/api/cron/order-trash-cleanup", { headers: { authorization: "Bearer cron-test-secret" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, archivedCount: 3, skippedCount: 0, cutoffDate: "2026-08-26", historyTrash: { deletedCount: 1 }, deletedCount: 2, skippedUndatedCount: 1 });
    expect(archiveExpiredOrders).toHaveBeenCalledWith({ actorName: "System" });
    expect(purgeExpiredHistoryTrash).toHaveBeenCalledWith({ actorName: "System" });
    expect(purgeExpiredCancelledOrders).toHaveBeenCalledWith({ actorName: "System" });
  });
});
