import { beforeEach, describe, expect, it, vi } from "vitest";

const purgeExpiredCancelledOrders = vi.hoisted(() => vi.fn());
vi.mock("@/lib/order-service", () => ({ purgeExpiredCancelledOrders }));

import { POST } from "@/app/api/cron/order-trash-cleanup/route";

describe("Order Trash cleanup cron", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-test-secret";
    purgeExpiredCancelledOrders.mockReset().mockResolvedValue({ deletedCount: 2, skippedUndatedCount: 1 });
  });

  it("rejects requests without the cron secret", async () => {
    const response = await POST(new Request("http://localhost/api/cron/order-trash-cleanup"));
    expect(response.status).toBe(401);
    expect(purgeExpiredCancelledOrders).not.toHaveBeenCalled();
  });

  it("runs the guarded service only with the cron secret", async () => {
    const response = await POST(new Request("http://localhost/api/cron/order-trash-cleanup", { headers: { authorization: "Bearer cron-test-secret" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, deletedCount: 2, skippedUndatedCount: 1 });
    expect(purgeExpiredCancelledOrders).toHaveBeenCalledWith({ actorName: "System" });
  });
});
