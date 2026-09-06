import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const productionSource = fs.readFileSync(path.join(root, "src/components/ProductionEntryPage.jsx"), "utf8");

describe("Production worker form", () => {
  it("keeps the worker add control out of the outer production form", () => {
    expect(productionSource).not.toContain('<form onSubmit={addSavedWorker}');
    expect(productionSource).toContain('role="group" aria-label="Worker အသစ်ထည့်ရန်"');
    expect(productionSource).toContain('type="button" onClick={addSavedWorker}');
    expect(productionSource).toContain("onKeyDown={handleWorkerDraftKeyDown}");
  });

  it("uses the shorter category select label", () => {
    expect(productionSource).toContain('<span className="text-lg">အမျိုးအစား</span>');
    expect(productionSource).not.toContain('<span className="text-lg">ဗူးအမျိုးအစား</span>');
  });
});
