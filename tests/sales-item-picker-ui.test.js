import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const picker = readFileSync(resolve(process.cwd(), "src/components/SalesItemPicker.jsx"), "utf8");
const themedSelect = readFileSync(resolve(process.cwd(), "src/components/ThemedSelect.jsx"), "utf8");

describe("sales item picker selection controls", () => {
  it("keeps Tube selection wired to a visible ThemedSelect", () => {
    expect(picker).toContain('"Tube အမျိုးအစား ရွေးပါ"');
    expect(picker).toContain('onChange={(event) => setSelectedKey(event.target.value)}');
  });

  it("does not cancel clicks on dropdown options", () => {
    expect(themedSelect).not.toContain('onClickCapture={(event) => event.preventDefault()}');
    expect(themedSelect).toContain('onClick={(event) => {');
  });

  it("hides the product category selector for cap-only mode", () => {
    expect(picker).toContain('pickerMode === "product" && saleMode !== "cap" ? <ThemedSelect value={currentCategory}');
  });
});
