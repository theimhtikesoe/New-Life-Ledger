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
  });
});

export {};

