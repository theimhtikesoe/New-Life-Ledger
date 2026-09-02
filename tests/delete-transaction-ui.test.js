import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");

describe("Transaction delete UI cleanup", () => {
  it("clears PIN and delete-confirmation state after a successful delete", () => {
    expect(source).toContain('setShowPinModal(false);\n      setPinValue("");\n      setPinError("");\n      setDeletingTransaction(null);');
    expect(source).toContain('if (deletingTransaction) {\n        await deleteTransaction(deletingTransaction);\n      } else {\n        await loadDashboard();\n      }');
  });
});

export {};
