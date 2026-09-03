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
    expect(source).toContain("ငွေချေမှုနှင့် လက်ငင်းရောင်း စာရင်းရှင်းလင်းချက်");
    expect(source).toContain("အကြွေးပြန်ဆပ်(ငွေချေ) စုစုပေါင်း");
    expect(source).toContain("အောက်မှာရှိတဲ့ payment နည်းလမ်းတစ်ခုချင်းစီက Ledger မှာ ငွေချေပြီးသား မှတ်တမ်းတွေပါ။ လက်ငင်းရောင်းငွေ မပါဝင်ပါ။");
    expect(source).toContain("လက်ငင်း(လက်လီ၊လက်ကား) အသေးစိတ်");
    expect(source).toContain("Ledger စုစုပေါင်းနဲ့ မပေါင်းပါ");
    expect(source).toContain("လက်ငင်း လက်လီ/လက်ကား ရောင်းအား");
    expect(source).toContain("ဒီအပိုင်းက payment နည်းလမ်း မဟုတ်ဘဲ ရောင်းအားအမျိုးအစား ဖြစ်ပါတယ်။");
    expect(source).toContain("function paymentMethodLabel");
    expect(source).not.toContain(">Payment Type</h2>");
    expect(source).toContain("text-[clamp(0.72rem,3.6vw,1rem)]");
    expect(source).toContain("mt-3 space-y-2.5");
    expect(source.indexOf("အကြွေးပြန်ဆပ်(ငွေချေ) အသေးစိတ်")).toBeLessThan(source.indexOf("အကြွေးပြန်ဆပ်(ငွေချေ) စုစုပေါင်း"));
    expect(source.indexOf("လက်ငင်း(လက်လီ၊လက်ကား) အသေးစိတ်")).toBeLessThan(source.indexOf("လက်ငင်း(လက်လီ၊လက်ကား) စုစုပေါင်း"));
  });
});

export {};

