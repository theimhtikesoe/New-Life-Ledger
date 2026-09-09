import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "src/components/ProductionEntryPage.jsx"), "utf8");
const route = fs.readFileSync(path.join(root, "src/app/api/production-reports/route.js"), "utf8");
const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const database = fs.readFileSync(path.join(root, "src/lib/database.js"), "utf8");

describe("Tube production entry", () => {
  it("switches the category heading and uses pcs per bag wording", () => {
    expect(page).toContain("Tube အမျိုးအစားနှင့် Tube အိတ်");
    expect(page).toContain("pcs/အိတ်");
    expect(page).not.toContain("မဖြည့်မနေရ —");
  });

  it("provides Tube type selection and the requested material/waste fields", () => {
    expect(page).toContain("value={activeTubeKey}");
    expect(page).toContain("သုံးကော်စေ့");
    expect(page).toContain("ကျန်ကော်စေ့");
    expect(page).toContain("ခုတ်ဖက်");
    expect(page).toContain("Tube ပျက်");
    expect(page).toContain("ကော်ပျက်");
    expect(page).toContain("tubeMetrics");
  });

  it("does not submit attached workers for Tube and persists the metrics", () => {
    expect(page).toContain('involvedWorkers: category === "tube" ? [] : workerNames');
    expect(page).toContain("tubeMetrics: category === \"tube\" ? tubeMetrics : null");
    expect(route).toContain("tubeMetrics: row.tubeMetrics");
    expect(schema).toContain("tubeMetrics        Json?");
    expect(database).toContain('"tubeMetrics"');
  });
});
