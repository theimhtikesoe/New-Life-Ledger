import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");
const pageSource = readFileSync(resolve(process.cwd(), "src/app/balance-detail/page.js"), "utf8");

describe("Customer Management workflow", () => {
  it("opens Customer Management from the Dashboard customer count", () => {
    expect(dashboardSource).toContain('href="/balance-detail" aria-label="Customer Management ဖွင့်ရန်"');
    expect(dashboardSource).toContain("Customer Management · အသေးစိတ်ကြည့်ရန် →");
  });

  it("loads retail and wholesale history and exposes profile actions", () => {
    expect(pageSource).toContain("includeLedgers=true&includeCashSales=true");
    expect(pageSource).toContain("function saleTypeSummary(customer, saleType)");
    expect(pageSource).toContain("လက်လီ လက်ရှိယူနေ");
    expect(pageSource).toContain("လက်ကား လက်ရှိယူနေ");
    expect(pageSource).toContain('method: "PATCH"');
    expect(pageSource).toContain('method: "DELETE"');
    expect(pageSource).toContain("Customer အချက်အလက် ပြင်ဆင်ရန်");
    expect(pageSource).toContain("Recycle Bin သို့ ရွှေ့မလား?");
  });
});

export {};

