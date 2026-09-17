import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "src/app/daily-bottle-sales/page.js"), "utf8");
const route = fs.readFileSync(path.join(root, "src/app/api/daily-bottle-sales/route.js"), "utf8");

describe("Daily Bottle Sales combined totals", () => {
  it("uses physical sales only for the headline totals", () => {
    expect(route).toContain("buildDailyBottleSalesSummary");
    expect(fs.readFileSync(path.join(root, "src/lib/daily-bottle-sales.js"), "utf8")).toContain("const overallSummary = summarizeRows(customers);");
  });

  it("explains that the headline excludes duplicate payment bottles", () => {
    expect(page).toContain("စုစုပေါင်း ရောင်းဗူး");
    expect(page).toContain("လက်ငင်း + အကြွေးတိုး (ငွေချေဗူး မထပ်ပေါင်း)");
    expect(page).toContain("စုစုပေါင်း ရောင်းတန်ဖိုး");
    expect(page).toContain("လက်ငင်း + အကြွေးတိုး (ငွေချေငွေ မထပ်ပေါင်း)");
    expect(page).toContain("စုစုပေါင်းထဲ မထပ်ပေါင်း");
  });

  it("shows paid bottles as a separate KPI from debt-increase bottles", () => {
    expect(page).toContain("ငွေရပြီးဗူး");
    expect(page).toContain("data?.paidBottleSales?.totalBottles");
    expect(page).toContain("data?.cashBottleSales?.totalBottles");
    expect(page).toContain("လက်ငင်း + Link ချိတ်ငွေချေ");
    expect(page).toContain("အကြွေးတိုးဗူး");
  });

  it("keeps payment-only ledger rows visible even without saved bottle items", () => {
    expect(fs.readFileSync(path.join(root, "src/lib/daily-bottle-sales.js"), "utf8")).toContain("function buildCustomerRows(rows, { includeEmpty = false } = {})");
    expect(fs.readFileSync(path.join(root, "src/lib/daily-bottle-sales.js"), "utf8")).toContain("const paidCustomers = buildCustomerRows(dedupeSettledBottleSaleItems(ledgers), { includeEmpty: true });");
    expect(page).toContain("data?.paidBottleSales?.totalPaidAmount");
    expect(page).toContain("data?.paidBottleSales?.customers?.length > 0");
  });

  it("selects the ledger type so settled payments can recover their credit sale items", () => {
    expect(route).toContain("type: true, saleType: true");
    expect(route).toContain("hydrateSettledBottleSaleItems(prisma, ledgers)");
  });

  it("keeps payment rows out of the headline physical-sale customers", () => {
    expect(route).toContain("buildDailyBottleSalesSummary({ ledgers, creditLedgers, cashSales })");
    expect(fs.readFileSync(path.join(root, "src/lib/daily-bottle-sales.js"), "utf8")).toContain("const customers = buildCustomerRows([...cashSales, ...creditLedgers]);");
    expect(fs.readFileSync(path.join(root, "src/lib/daily-bottle-sales.js"), "utf8")).toContain("const overallSummary = summarizeRows(customers);");
  });
});

export {};
