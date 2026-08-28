import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.join(process.cwd(), "src/app/orders/page.js"), "utf8");

describe("Order status filter UI", () => {
  it("uses one responsive select instead of scattered status buttons", () => {
    expect(source).toContain('id="order-status-filter"');
    expect(source).toContain("value={statusFilter}");
    expect(source).toContain("onChange={(event) => setStatusFilter(event.target.value)}");
    expect(source).toContain("sm:max-w-md");
    expect(source).not.toContain('onClick={() => setStatusFilter(status)}');
  });

  it("keeps the existing six status filter options", () => {
    expect(source).toContain('["ALL", "NEEDS_CUSTOMER", "NEEDS_REVIEW", "DRAFT", "CONFIRMED", "BATCH_QUEUED"]');
    expect(source).toContain('status === "ALL" ? "အားလုံး" : STATUS_LABELS[status] || status');
  });

  it("leaves order actions and status update flow outside the UI-only filter patch", () => {
    expect(source).toContain("const patchOrder = async");
    expect(source).toContain("Confirm");
    expect(source).toContain("Cancel");
  });
});

export {};
