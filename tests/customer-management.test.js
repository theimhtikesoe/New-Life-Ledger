import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");
const pageSource = readFileSync(resolve(process.cwd(), "src/components/CustomerManagementPage.jsx"), "utf8");
const balanceDetailSource = readFileSync(resolve(process.cwd(), "src/app/balance-detail/page.js"), "utf8");
const customerManagementRouteSource = readFileSync(resolve(process.cwd(), "src/app/customer-management/page.js"), "utf8");

describe("Customer Management workflow", () => {
  it("opens Customer Management from the Dashboard customer count", () => {
    expect(dashboardSource).toContain('href="/customer-management" aria-label="Customer Management ဖွင့်ရန်"');
    expect(dashboardSource).toContain("Customer Management · အသေးစိတ်ကြည့်ရန် →");
  });

  it("keeps Balance Detail and Customer Management as separate routes", () => {
    expect(balanceDetailSource).toContain("Balance Detail");
    expect(balanceDetailSource).not.toContain("Customer Management");
    expect(customerManagementRouteSource).toContain("CustomerManagementPage");
    expect(customerManagementRouteSource).toContain('title: "Customer Management | New Life Ledger"');
  });

  it("renders one customer per row with prepaid, debt, and editable customer type", () => {
    expect(pageSource).toContain("ကြိုတင်ငွေချေ");
    expect(pageSource).toContain("လက်ကျန်အကြွေး");
    expect(pageSource).toContain("Customer Type");
    expect(pageSource).toContain("လက်လီ Customer");
    expect(pageSource).toContain("လက်ကား Customer");
    expect(pageSource).toContain("updateCustomerType");
    expect(pageSource).toContain('body: JSON.stringify({ customerType })');
    expect(pageSource).toContain('method: "PATCH"');
    expect(pageSource).toContain('method: "DELETE"');
    expect(pageSource).toContain("Customer အချက်အလက် ပြင်ဆင်ရန်");
    expect(pageSource).toContain("Recycle Bin သို့ ရွှေ့မလား?");
  });
});

export {};

