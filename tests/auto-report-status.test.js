import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  executeRaw: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/database", () => ({ ensureDatabase: mocks.ensureDatabase }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback) => callback({
      $executeRaw: mocks.executeRaw,
      autoReportRun: {
        findFirst: mocks.findFirst,
        update: mocks.update,
        create: mocks.create,
      },
    })),
  },
}));

import { reconcileManualReportRun } from "@/lib/auto-report-status";

const zeroCountRun = {
  id: "manual-reconciled-1",
  status: "SUCCESS",
  trigger: "manual-reconciled",
  reportDate: "2026-08-26",
  periodLabel: "2026-08-26 (Manual ပို့ပြီးသား)",
  recipientCount: 1,
  counts: { paid: 0, debtIncrease: 0, transactions: 0, activityActions: 0 },
  elapsedMs: null,
  errorMessage: null,
  manualNoticeClaimedAt: null,
  manualNoticeSentAt: null,
  createdAt: new Date("2026-08-27T04:28:00.000Z"),
};

describe("Auto Report manual reconciliation metadata", () => {
  beforeEach(() => {
    mocks.ensureDatabase.mockReset();
    mocks.executeRaw.mockReset();
    mocks.findFirst.mockReset();
    mocks.update.mockReset();
    mocks.create.mockReset();
  });

  it("backfills counts only on a zero-count manual-reconciled row", async () => {
    const updated = {
      ...zeroCountRun,
      counts: { paid: 4, debtIncrease: 6, transactions: 10, activityActions: 11 },
    };
    mocks.findFirst.mockResolvedValue(zeroCountRun);
    mocks.update.mockResolvedValue(updated);

    const result = await reconcileManualReportRun({
      reportDate: "2026-08-26",
      counts: { paid: 4, debtIncrease: 6, transactions: 10, activityActions: 11 },
      recipients: 1,
    });

    expect(result).toEqual(expect.objectContaining({ recorded: true, updated: true, reason: "counts_backfilled" }));
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: zeroCountRun.id },
      data: {
        periodLabel: "2026-08-26 (Manual ပို့ပြီးသား)",
        recipientCount: 1,
        counts: { paid: 4, debtIncrease: 6, transactions: 10, activityActions: 11 },
      },
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not overwrite a real successful Manual row that already has counts", async () => {
    const existing = { ...zeroCountRun, trigger: "manual", counts: { paid: 4, debtIncrease: 6, transactions: 10, activityActions: 11 } };
    mocks.findFirst.mockResolvedValue(existing);

    const result = await reconcileManualReportRun({
      reportDate: "2026-08-26",
      counts: { paid: 99, debtIncrease: 99, transactions: 99, activityActions: 99 },
      recipients: 1,
    });

    expect(result).toEqual(expect.objectContaining({ recorded: false, reason: "already_success" }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
