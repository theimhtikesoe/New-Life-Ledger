import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const productionSource = fs.readFileSync(path.join(root, "src/components/ProductionEntryPage.jsx"), "utf8");
const routeSource = fs.readFileSync(path.join(root, "src/app/api/production-reports/route.js"), "utf8");
const schemaSource = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const migrationSource = fs.readFileSync(path.join(root, "prisma/migrations/20260907000000_add_production_tube_quantity_unit/migration.sql"), "utf8");
const databaseSource = fs.readFileSync(path.join(root, "src/lib/database.js"), "utf8");

describe("Production page enhancements", () => {
  it("supports both tube quantity units and persists the selected unit", () => {
    expect(productionSource).toContain('const [tubeQuantityUnit, setTubeQuantityUnit] = useState("အိတ်");');
    expect(productionSource).toContain('<option value="အိတ်">အိတ်</option>');
    expect(productionSource).toContain('<option value="ခြင်း">ခြင်း</option>');
    expect(productionSource).toContain("tubeQuantityUnit, involvedWorkers");
    expect(routeSource).toContain('if (!["အိတ်", "ခြင်း"].includes(unit))');
    expect(routeSource).toContain("tubeQuantityUnit: index === 0 ? tubeQuantityUnitValue : \"အိတ်\"");
    expect(schemaSource).toContain('tubeQuantityUnit   String   @default("အိတ်")');
    expect(migrationSource).toContain('ADD COLUMN IF NOT EXISTS "tubeQuantityUnit" TEXT NOT NULL DEFAULT \'အိတ်\'');
    expect(databaseSource).toContain('const REQUIRED_PRODUCTION_COLUMNS = ["tubeDamageQuantity", "tubeQuantity", "tubeQuantityValue", "tubeQuantityUnit"];');
    expect(databaseSource).toContain('ADD COLUMN IF NOT EXISTS "tubeQuantityUnit" TEXT NOT NULL DEFAULT \'အိတ်\'');
  });

  it("accepts decimal tube quantities and preserves the exact entered value", () => {
    expect(productionSource).toContain('type="text" inputMode="decimal" value={tubeQuantity}');
    expect(productionSource).toContain("onChange={(event) => setTubeQuantity(event.target.value)}");
    expect(productionSource).toContain("tubeQuantityValue: tubeQuantity");
    expect(routeSource).toContain("function decimalTubeQuantity(value)");
    expect(routeSource).toContain("tubeQuantityValue: String(row.tubeQuantityValue ?? row.tubeQuantity ?? 0)");
    expect(schemaSource).toContain('tubeQuantityValue  String   @default("0")');
    expect(databaseSource).toContain('"tubeQuantityValue" TEXT NOT NULL DEFAULT \'0\'');
  });

  it("highlights the currently edited field", () => {
    expect(productionSource).toContain('const [focusedField, setFocusedField] = useState("");');
    expect(productionSource).toContain("ring-4 ring-amber-300 shadow-lg");
    expect(productionSource).toContain("onBlur={blurField}");
  });

  it("includes bottle capacity in confirmation and saved history labels", () => {
    expect(productionSource).toContain('`${entry.bottleType} · ${entry.capacity.toLocaleString()} ဆံ့`');
    expect(productionSource).toContain('`${entry.tubeG} ${entry.tubeColor} · ${entry.capacity.toLocaleString()} ဗူး/အိတ်`');
    expect(productionSource).toContain('`${row.bottleType} · ${row.outputCapacity} ဆံ့`');
    expect(productionSource).toContain('{group.tubeQuantityUnit || "အိတ်"}');
  });

  it("keeps quantity inputs in an equal row above the KPI cards", () => {
    expect(productionSource).toContain('className="grid items-stretch gap-3 sm:grid-cols-3"');
    expect(productionSource).toContain('className="flex h-full flex-col text-sm font-bold text-slate-700"');
    expect(productionSource.indexOf("ဗူးပျက်၊ Tube ပျက်နှင့် Tube အရေအတွက်")).toBeLessThan(
      productionSource.indexOf('className="mt-4 grid gap-2 sm:grid-cols-3"'),
    );
  });

  it("uses catalog-defined units in bottle cards and saved report rows", () => {
    expect(productionSource).toContain('sub: `${capacity} ဆံ့ (${getBottleUnit(item.type)})`');
    expect(productionSource).toContain('`${entry.unit} အရေအတွက် — ${entry.capacity.toLocaleString()} ဆံ့`');
    expect(routeSource).toContain('outputUnit: category === "tube" ? "အိတ်" : getBottleUnit(row.bottleType)');
  });
});
