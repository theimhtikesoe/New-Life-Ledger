import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.join(process.cwd(), "src/components/DailySalesSummaryPanel.jsx"), "utf8");

describe("Daily sales summary UI", () => {
  it("uses the requested month-to-date retail and wholesale KPI wording", () => {
    expect(source).toContain("လအစမှ ယနေ့အထိ လက်လီ၊လက်ကား စုစုပေါင်း");
    expect(source).not.toContain("ယနေ့အထိ စုစုပေါင်း / နောက်နေ့ Opening");
    expect(source).not.toContain("လအစ Opening နှင့် ယနေ့အထိ လက်လီ/လက်ကား ရောင်းရငွေ စုစုပေါင်း။ ယနေ့အဆုံးတန်ဖိုးသည် နောက်နေ့ Opening ဖြစ်သည်။");
  });

  it("keeps the two actions compact and makes the table more readable without wasting column width", () => {
    expect(source).toContain("text-[11px] font-semibold leading-4");
    expect(source).toContain("text-[11px] font-bold leading-4");
    expect(source).toContain("min-w-[760px] table-fixed text-left text-sm");
    expect(source).toContain("<colgroup>");
    expect(source).toContain("လအစမှ ယနေ့အထိ စုစုပေါင်း");
  });
});
