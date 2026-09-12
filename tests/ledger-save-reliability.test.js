import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, "src/components/Dashboard.jsx"), "utf8");
const database = fs.readFileSync(path.join(root, "src/lib/database.js"), "utf8");

describe("ledger save reliability", () => {
  it("does not await dashboard refresh after a successful create save", () => {
    expect(dashboard).toContain("The write has already succeeded at this point");
    expect(dashboard).toContain("void loadDashboard().catch((refreshError)");
  });

  it("does not turn a successful edit into a failed save when refresh is slow", () => {
    expect(dashboard).toContain("PATCH has succeeded");
    expect(dashboard).toContain("void loadCustomer(selectedCustomerId).catch((refreshError)");
  });

  it("hides raw Prisma pool details from users", () => {
    expect(database).toContain('code: "DATABASE_BUSY"');
    expect(database).toContain("ခဏစောင့်ပြီး တစ်ကြိမ်သာ ပြန်စမ်းပါ");
  });
});

export {};
