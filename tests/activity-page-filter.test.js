import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/app/activity/page.js"), "utf8");

describe("Activity History client filter", () => {
  it("filters Daily Sales bookkeeping actions and Customer edits from fetched and cached logs", () => {
    expect(source).toContain("isCustomerEditActivity, isDailySalesActivity, isOrderWorkflowActivity");
    expect(source).toContain("!isOrderWorkflowActivity(log) && !isDailySalesActivity(log) && !isCustomerEditActivity(log)");
    expect(source).toContain('excludeCustomerEdits: "true"');
  });

  it("does not add Daily Sales bookkeeping actions to the action picker", () => {
    expect(source).toContain('const ACTIONS = ["PAYMENT", "DEBT_INCREASE", "CASH_SALE", "CREATE", "UPDATE", "RESTORE", "DELETE", "PERMANENT_DELETE"];');
    expect(source).not.toContain('"DAILY_SALES_OPENING"');
    expect(source).not.toContain('"DAILY_SALES_SUMMARY"');
  });
});
