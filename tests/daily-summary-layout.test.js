import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/app/daily-summary/page.js"), "utf8");

describe("Daily Summary customer amount layout", () => {
  it("keeps each Ks amount together on narrow table and card layouts", () => {
    expect(source).toContain('className="whitespace-nowrap px-3 py-3 text-right text-base font-semibold text-emerald-700"');
    expect(source).toContain('className="whitespace-nowrap px-3 py-3 text-right text-base font-semibold text-rose-700"');
    expect(source).toContain('className="whitespace-nowrap px-3 py-3 text-right text-base font-semibold text-cyan-700"');
    expect(source).toContain('className="block whitespace-nowrap">လက်လီ');
    expect(source).toContain('className="block whitespace-nowrap">လက်ကား');
    expect(source).toContain("text-[clamp(0.72rem,3.6vw,1rem)]");
    expect(source).toContain("const paymentTotal = useMemo");
    expect(source).toContain("Ledger ငွေချေမှုစုစုပေါင်း · Payment Total");
    expect(source).toContain("အောက်က Ledger payment အမျိုးအစားများကိုသာ ပေါင်းထားတာဖြစ်ပြီး လက်ငင်းရောင်းရငွေ မပါဝင်ပါ။");
    expect(source).toContain("ဒီအောက်က CASH / KPAY တွေက လက်ငင်းရောင်းရငွေ စုစုပေါင်းရဲ့ ခွဲခြမ်းချက်ဖြစ်ပြီး အပေါ်က Ledger Payment Total ထဲ မပါဝင်ပါ။");
    expect(source).toContain("text-[clamp(0.72rem,3.6vw,1rem)]");
    expect(source).toContain("mt-3 space-y-2.5");
  });
});

export {};

