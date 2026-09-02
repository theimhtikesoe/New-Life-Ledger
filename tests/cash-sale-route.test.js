import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  customerFindUnique: vi.fn(),
  customerUpdate: vi.fn(),
  cashSaleFindMany: vi.fn(),
  cashSaleCount: vi.fn(),
  cashSaleCreate: vi.fn(),
  getActorName: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/database", () => ({ ensureDatabase: mocks.ensureDatabase, databaseErrorResponse: (error) => ({ error: error.message }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { findUnique: mocks.customerFindUnique, update: mocks.customerUpdate },
    cashSale: { findMany: mocks.cashSaleFindMany, count: mocks.cashSaleCount, create: mocks.cashSaleCreate },
    $transaction: vi.fn(async (callback) => callback({ cashSale: { create: mocks.cashSaleCreate } })),
  },
}));
vi.mock("@/lib/audit", () => ({ getActorName: mocks.getActorName, writeAuditLog: mocks.writeAuditLog }));

import { GET, POST } from "@/app/api/customers/[id]/cash-sales/route";

const customer = { id: "customer-1", name: "စမ်းသပ် Customer", customerType: "RETAIL", deletedAt: null };
const cashSale = {
  id: "cash-sale-1",
  date: new Date("2026-08-26T00:00:00.000Z"),
  saleType: "RETAIL",
  itemSize: "0.3 Liter",
  cartons: null,
  rate: null,
  deductions: 0,
  amount: 1000000,
  note: "ဆိုင်မှာ လက်ငင်းရှင်း",
  paymentType: "CASH",
  createdAt: new Date("2026-08-26T00:00:00.000Z"),
};

function request(body) {
  return new Request("http://localhost/api/customers/customer-1/cash-sales", {
    method: "POST",
    headers: { "content-type": "application/json", "x-actor-name": "Staff" },
    body: JSON.stringify(body),
  });
}

describe("CashSale route", () => {
  beforeEach(() => {
    mocks.ensureDatabase.mockReset().mockResolvedValue(undefined);
    mocks.customerFindUnique.mockReset().mockResolvedValue(customer);
    mocks.customerUpdate.mockReset();
    mocks.cashSaleFindMany.mockReset().mockResolvedValue([]);
    mocks.cashSaleCount.mockReset().mockResolvedValue(0);
    mocks.cashSaleCreate.mockReset().mockResolvedValue(cashSale);
    mocks.getActorName.mockReset().mockReturnValue("Staff");
    mocks.writeAuditLog.mockReset().mockResolvedValue(undefined);
  });

  it("creates a separate cash-sale record without updating balance or Ledger", async () => {
    const response = await POST(request({ amount: 1000000, paymentType: "CASH", note: "ဆိုင်မှာ လက်ငင်းရှင်း", date: "2026-08-26" }), { params: { id: customer.id } });
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.cashSale).toMatchObject({ ...cashSale, date: cashSale.date.toISOString(), createdAt: cashSale.createdAt.toISOString() });
    expect(mocks.customerFindUnique).toHaveBeenCalledWith({ where: { id: customer.id }, select: { id: true, name: true, customerType: true, deletedAt: true } });
    expect(mocks.cashSaleCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ customerId: customer.id, amount: 1000000, paymentType: "CASH" }) }));
    expect(mocks.customerUpdate).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "CASH_SALE", entityType: "CashSale", entityId: cashSale.id, entityLabel: customer.name }));
  });

  it("uses the customer type when the cash-sale type is omitted", async () => {
    const wholesaleCustomer = { ...customer, customerType: "WHOLESALE" };
    const wholesale = { ...cashSale, saleType: "WHOLESALE" };
    mocks.customerFindUnique.mockResolvedValue(wholesaleCustomer);
    mocks.cashSaleCreate.mockResolvedValue(wholesale);
    const response = await POST(request({ amount: 1000000, paymentType: "CASH", date: "2026-08-26" }), { params: { id: customer.id } });
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.cashSale.saleType).toBe("WHOLESALE");
    expect(mocks.cashSaleCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ saleType: "WHOLESALE" }) }));
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ saleType: "WHOLESALE" }) }));
  });

  it("stores MIXED when an exact payment breakdown is submitted", async () => {
    const split = { CASH: 60000, KPAY: 20000, BANK: 20000, WAVE: 0, SPECIAL: 0 };
    const mixed = { ...cashSale, amount: 100000, paymentType: "MIXED", paymentBreakdown: split };
    mocks.cashSaleCreate.mockResolvedValue(mixed);
    const response = await POST(request({ amount: 100000, paymentType: "BANK", paymentBreakdown: split, date: "2026-08-26" }), { params: { id: customer.id } });
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.cashSale.paymentType).toBe("MIXED");
    expect(body.data.cashSale.paymentBreakdown).toEqual(split);
    expect(mocks.cashSaleCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentType: "MIXED", paymentBreakdown: split }) }));
  });

  it("normalizes and records the explicit wholesale cash-sale type without touching balance", async () => {
    const wholesale = { ...cashSale, saleType: "WHOLESALE" };
    mocks.cashSaleCreate.mockResolvedValue(wholesale);
    const response = await POST(request({ amount: 1000000, saleType: "wholesale", paymentType: "CASH", date: "2026-08-26" }), { params: { id: customer.id } });
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.cashSale.saleType).toBe("WHOLESALE");
    expect(mocks.cashSaleCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ saleType: "WHOLESALE" }) }));
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ saleType: "WHOLESALE" }) }));
    expect(mocks.customerUpdate).not.toHaveBeenCalled();
  });

  it("rejects a mismatched payment breakdown before creating a cash sale", async () => {
    const response = await POST(request({
      amount: 100000,
      paymentType: "CASH",
      paymentBreakdown: { CASH: 60000, KPAY: 50000, BANK: 0, WAVE: 0, SPECIAL: 0 },
      date: "2026-08-26",
    }), { params: { id: customer.id } });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toMatch(/မကိုက်ပါ/);
    expect(mocks.cashSaleCreate).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("lists cash-sale records separately", async () => {
    mocks.cashSaleFindMany.mockResolvedValue([cashSale]);
    mocks.cashSaleCount.mockResolvedValue(1);
    const response = await GET(new Request("http://localhost/api/customers/customer-1/cash-sales?limit=10&offset=0"), { params: { id: customer.id } });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ items: [{ ...cashSale, date: cashSale.date.toISOString(), createdAt: cashSale.createdAt.toISOString() }], pagination: { offset: 0, limit: 10, total: 1, hasMore: false } });
  });

  it("rejects a zero amount without creating a record", async () => {
    const response = await POST(request({ amount: 0 }), { params: { id: customer.id } });
    expect(response.status).toBe(400);
    expect(mocks.cashSaleCreate).not.toHaveBeenCalled();
    expect(mocks.customerUpdate).not.toHaveBeenCalled();
  });
});
