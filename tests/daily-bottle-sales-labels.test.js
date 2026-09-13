import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "src/app/daily-bottle-sales/page.js"), "utf8");
const route = fs.readFileSync(path.join(root, "src/app/api/daily-bottle-sales/route.js"), "utf8");

describe("Daily Bottle Sales combined totals", () => {
  it("uses a combined summary for the headline totals", () => {
    expect(route).toContain("const overallSummary = summarizeRows([...customers, ...creditCustomers]);");
    expect(route).toContain("totalBottles: overallSummary.totalBottles");
    expect(route).toContain("totalAmount: overallSummary.totalAmount");
  });

  it("explains that the headline includes cash, payment, and debt increase", () => {
    expect(page).toContain("စုစုပေါင်း ရောင်းဗူး");
    expect(page).toContain("လက်ငင်း + ငွေချေ + အကြွေးတိုး");
    expect(page).toContain("စုစုပေါင်း ရောင်းတန်ဖိုး");
    expect(page).toContain("တကယ်ရရှိငွေ");
    expect(page).toContain("လက်ငင်း + ငွေချေ သာ");
  });

  it("shows paid bottles as a separate KPI from debt-increase bottles", () => {
    expect(page).toContain("ငွေရပြီးဗူး");
    expect(page).toContain("data?.paidBottleSales?.totalBottles");
    expect(page).toContain("data?.cashBottleSales?.totalBottles");
    expect(page).toContain("ငွေချေ + လက်ငင်း");
    expect(page).toContain("အကြွေးတိုးဗူး");
  });

  it("keeps payment-only ledger rows visible even without saved bottle items", () => {
    expect(route).toContain("function buildCustomerRows(rows, { includeEmpty = false } = {})");
    expect(route).toContain("const paidCustomers = buildCustomerRows(ledgers, { includeEmpty: true });");
    expect(page).toContain("data?.paidBottleSales?.totalPaidAmount");
    expect(page).toContain("data?.paidBottleSales?.customers?.length > 0");
  });

  it("selects the ledger type so settled payments can recover their credit sale items", () => {
    expect(route).toContain("type: true, saleType: true");
    expect(route).toContain("hydrateSettledBottleSaleItems(prisma, ledgers)");
  });

  it("keeps payment rows out of the headline physical-sale customers", () => {
    expect(route).toContain("const customers = buildCustomerRows([...cashSales, ...creditLedgers]);");
    expect(route).toContain("const paidCustomers = buildCustomerRows(ledgers, { includeEmpty: true });");
  });
});

export {};
