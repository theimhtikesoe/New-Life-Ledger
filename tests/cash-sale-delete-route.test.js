import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  cashSaleFindFirst: vi.fn(),
  cashSaleDelete: vi.fn(),
  auditLogUpdateMany: vi.fn(),
  getActorName: vi.fn(),
  writeAuditLog: vi.fn(),
  customerUpdate: vi.fn(),
  ledgerDelete: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  ensureDatabase: mocks.ensureDatabase,
  databaseErrorResponse: (error) => ({ error: error.message }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cashSale: {
      findFirst: mocks.cashSaleFindFirst,
      delete: mocks.cashSaleDelete,
    },
    auditLog: {
      updateMany: mocks.auditLogUpdateMany,
    },
    customer: { update: mocks.customerUpdate },
    ledger: { delete: mocks.ledgerDelete },
    $transaction: vi.fn(async (callback) => callback({
      cashSale: {
        findFirst: mocks.cashSaleFindFirst,
        delete: mocks.cashSaleDelete,
      },
      auditLog: { updateMany: mocks.auditLogUpdateMany },
    })),
  },
}));

vi.mock("@/lib/audit", () => ({
  getActorName: mocks.getActorName,
  writeAuditLog: mocks.writeAuditLog,
}));

import { DELETE } from "@/app/api/customers/[id]/cash-sales/[saleId]/route";

const cashSale = {
  id: "cash-sale-1",
  customerId: "customer-1",
  amount: 1000000,
  paymentType: "CASH",
  note: "လက်ငင်းရောင်း",
  date: new Date("2026-08-26T00:00:00.000Z"),
  customer: { id: "customer-1", name: "ကိုသိမ်း", current_balance: 250000 },
};

function request() {
  return new Request("http://localhost/api/customers/customer-1/cash-sales/cash-sale-1", {
    method: "DELETE",
    headers: { "x-actor-name": "Rhyzoe" },
  });
}

describe("CashSale DELETE route", () => {
  beforeEach(() => {
    mocks.ensureDatabase.mockReset().mockResolvedValue(undefined);
    mocks.cashSaleFindFirst.mockReset().mockResolvedValue(cashSale);
    mocks.cashSaleDelete.mockReset().mockResolvedValue(cashSale);
    mocks.auditLogUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    mocks.getActorName.mockReset().mockReturnValue("Rhyzoe");
    mocks.writeAuditLog.mockReset().mockResolvedValue(undefined);
    mocks.customerUpdate.mockReset();
    mocks.ledgerDelete.mockReset();
  });

  it("deletes only the CashSale and preserves Customer balance/Ledger", async () => {
    const response = await DELETE(request(), { params: { id: "customer-1", saleId: "cash-sale-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ customerId: "customer-1", cashSaleId: "cash-sale-1", currentBalance: 250000 });
    expect(mocks.cashSaleFindFirst).toHaveBeenCalledWith({
      where: { id: "cash-sale-1", customerId: "customer-1" },
      include: { customer: { select: { id: true, name: true, current_balance: true } } },
    });
    expect(mocks.auditLogUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { entityType: "CashSale", entityId: "cash-sale-1", hiddenAt: null },
      data: expect.objectContaining({ hiddenBy: "Rhyzoe" }),
    }));
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "DELETE",
      entityType: "CashSale",
      entityId: "cash-sale-1",
      metadata: expect.objectContaining({ balanceUnchanged: true, balanceAfter: 250000 }),
    }));
    expect(mocks.cashSaleDelete).toHaveBeenCalledWith({ where: { id: "cash-sale-1" } });
    expect(mocks.customerUpdate).not.toHaveBeenCalled();
    expect(mocks.ledgerDelete).not.toHaveBeenCalled();
  });

  it("returns 404 without deleting when the CashSale belongs to another customer or is missing", async () => {
    mocks.cashSaleFindFirst.mockResolvedValue(null);

    const response = await DELETE(request(), { params: { id: "customer-1", saleId: "missing-sale" } });

    expect(response.status).toBe(404);
    expect(mocks.cashSaleDelete).not.toHaveBeenCalled();
    expect(mocks.auditLogUpdateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
    expect(mocks.customerUpdate).not.toHaveBeenCalled();
  });
});
