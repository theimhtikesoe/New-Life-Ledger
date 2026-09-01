import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");

describe("Cash-sale payment breakdown disclosure", () => {
  it("starts collapsed and reveals the fields only from the Show/Hide control", () => {
    expect(source).toContain("const [showPaymentBreakdown, setShowPaymentBreakdown] = useState(false);");
    expect(source).toContain("aria-expanded={showPaymentBreakdown}");
    expect(source).toContain("onClick={() => setShowPaymentBreakdown((open) => !open)}");
    expect(source).toContain('{showPaymentBreakdown ? "ဖျောက်ရန် ▲" : "ပြရန် ▼"}');
    expect(source).toContain("{showPaymentBreakdown && (");
    expect(source).toContain("paymentBreakdown?.[key]");
  });
});

export {};
