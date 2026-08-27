import { describe, expect, it } from "vitest";
import { mergeOverviewText, normalizeAiItems } from "@/lib/ai-explanation-merge";

describe("AI explanation deduplication", () => {
  it("keeps only one overview when AI repeats the code-based overview", () => {
    const overview = "2026-08-27 အတွက် စာရင်းအချက်အလက်ကို အကျဉ်းချုပ်ပြထားပါသည်။";
    expect(mergeOverviewText(overview, `${overview} ${overview}`)).toBe(overview);
    expect(mergeOverviewText(overview, overview)).toBe(overview);
  });

  it("does not add an AI paragraph when the AI overview is only the same information", () => {
    const code = "2026-08-27 အတွက် စာရင်းအချက်အလက်ကို အကျဉ်းချုပ်ပြထားပါသည်။";
    const ai = "2026-08-27 အတွက် စာရင်းအချက်အလက်ကို အကျဉ်းချုပ်ပြထားပါသည်။";
    expect(mergeOverviewText(code, ai)).not.toContain("AI ထပ်ဖြည့်ရှင်းချက်");
  });

  it("keeps a genuinely new AI overview while avoiding a repeated code prefix", () => {
    const code = "2026-08-27 အတွက် စာရင်းအချက်အလက်ကို အကျဉ်းချုပ်ပြထားပါသည်။";
    const ai = `${code} လက်ငင်းရောင်းနှင့် ငွေချေမှုများကို သီးခြားစစ်ဆေးထားပါသည်။`;
    expect(mergeOverviewText(code, ai)).toBe(ai);
  });

  it("deduplicates repeated findings and checks ignoring final punctuation", () => {
    expect(normalizeAiItems(["စာရင်းရှိပါသည်။", "စာရင်းရှိပါသည်", "အသစ်တွေ့ရှိချက်"])).toEqual([
      "စာရင်းရှိပါသည်။",
      "အသစ်တွေ့ရှိချက်",
    ]);
  });
});
