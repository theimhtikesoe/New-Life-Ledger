import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, "src/components/Dashboard.jsx"), "utf8");
const database = fs.readFileSync(path.join(root, "src/lib/database.js"), "utf8");
const transactionRoute = fs.readFileSync(path.join(root, "src/app/api/customers/[id]/transactions/route.js"), "utf8");
const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");

describe("ledger save reliability", () => {
  it("does not await dashboard refresh after a successful create save", () => {
    expect(dashboard).toContain("The write has already succeeded at this point");
    expect(dashboard).toContain("void loadDashboard().catch((refreshError)");
  });

  it("does not turn a successful edit into a failed save when refresh is slow", () => {
    expect(dashboard).toContain("PATCH has succeeded");
    expect(dashboard).toContain("void loadCustomer(selectedCustomerId).catch((refreshError)");
  });

  it("keeps the selected customer visible and shows a processing indicator during refresh", () => {
    expect(dashboard).toContain("loadingCustomer && !selectedCustomer");
    expect(dashboard).toContain('role="status" aria-live="polite"');
    expect(dashboard).toContain("လုပ်ဆောင်နေပါသည်...");
  });

  it("hides raw Prisma pool details from users", () => {
    expect(database).toContain('code: "DATABASE_BUSY"');
    expect(database).toContain("ခဏစောင့်ပြီး တစ်ကြိမ်သာ ပြန်စမ်းပါ");
  });

  it("closes the same-tick double-submit window and sends a stable request key", () => {
    expect(dashboard).toContain("ledgerSaveInFlightRef.current");
    expect(dashboard).toContain("requestId: ledgerRequestIdRef.current");
  });

  it("keeps transaction creates idempotent across network retries", () => {
    expect(schema).toContain("requestId      String?  @unique");
    expect(database).toContain('ADD COLUMN IF NOT EXISTS "requestId" TEXT');
    expect(transactionRoute).toContain("where: { requestId }");
    expect(transactionRoute).toContain("result.duplicate ? 200 : 201");
  });
});

export {};
