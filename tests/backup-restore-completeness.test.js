import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const backupRoute = fs.readFileSync(path.join(root, "src/app/api/backup/route.js"), "utf8");
const restoreRoute = fs.readFileSync(path.join(root, "src/app/api/restore/route.js"), "utf8");
const dataManagementPage = fs.readFileSync(path.join(root, "src/app/data-management/page.js"), "utf8");

const modelToClient = (model) => model[0].toLowerCase() + model.slice(1);
const prismaModels = [...schema.matchAll(/^model (\w+)/gm)].map((match) => match[1]);

const expectedSheets = [
  "Backup Info",
  "Customers",
  "Transactions",
  "Cash Sales",
  "KPay Aliases",
  "Pending KPay",
  "Audit History",
  "Orders",
  "Order Lines",
  "Order Caps",
  "Order Deliveries",
  "Order Automation",
  "Order Batch Runs",
  "AI Explanation Cache",
  "Auto Report Runs",
  "Daily Summaries",
  "Summary Sources",
  "Daily Openings",
  "Production Reports",
  "Integrity",
];

describe("full database backup and restore coverage", () => {
  it("keeps every Prisma model in both export reads and restore writes", () => {
    expect(prismaModels).toHaveLength(18);
    for (const model of prismaModels) {
      const client = modelToClient(model);
      expect(backupRoute).toContain(`prisma.${client}`);
      expect(restoreRoute).toContain(`tx.${client}`);
    }
  });

  it("keeps every persisted collection represented in the Excel workbook", () => {
    for (const sheet of expectedSheets) {
      expect(dataManagementPage).toContain(`"${sheet}"`);
    }
  });

  it("uses the current version and exposes counts for all new collections", () => {
    expect(backupRoute).toContain("version: 6");
    for (const count of [
      "orderAutomationSetting",
      "aiExplanationCaches",
      "autoReportRuns",
      "dailySalesSummaries",
      "dailySalesSummarySources",
      "dailySalesOpenings",
      "productionReports",
    ]) {
      expect(backupRoute).toContain(`${count}:`);
      expect(restoreRoute).toContain(`${count}:`);
    }
  });

  it("retains add-only restore behavior and balance recalculation", () => {
    expect(restoreRoute).toContain("mode === \"confirm\"");
    expect(restoreRoute).toContain("await tx.customer.create({ data: customer })");
    expect(restoreRoute).toContain("recomputedBalance");
    expect(restoreRoute).toContain("existingDailySalesSummaryByDate");
  });
});

export { expectedSheets, modelToClient, prismaModels };

// This test intentionally checks the source contract rather than requiring a live
// PostgreSQL instance. The production build and route-level tests validate syntax
// and module integration separately, while this test guards against future model drift.
