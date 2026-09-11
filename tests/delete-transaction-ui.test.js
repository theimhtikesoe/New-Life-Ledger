import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");

describe("Transaction delete UI cleanup", () => {
  it("clears PIN and delete-confirmation state after a successful delete", () => {
    expect(source).toContain('deletingTransaction && !showPinModal');
    expect(source).toContain('setShowPinModal(false);\n      setPinValue("");\n      setPinError("");\n      setDeletingTransaction(null);');
    expect(source).toContain('if (deletingTransaction) {\n        await deleteTransaction(deletingTransaction);\n      } else {\n        await loadDashboard();\n      }');
  });
});

export {};

const ledgerDeleteSource = readFileSync(resolve(process.cwd(), "src/app/api/transactions/[id]/route.js"), "utf8");
const cashSaleDeleteSource = readFileSync(resolve(process.cwd(), "src/app/api/customers/[id]/cash-sales/[saleId]/route.js"), "utf8");

describe("Sale stock movement cleanup", () => {
  it("removes Ledger and Cash Sale stock movements when deleting a sale", () => {
    expect(ledgerDeleteSource).toContain('sourceType: "LEDGER", sourceId: ledger.id');
    expect(cashSaleDeleteSource).toContain('sourceType: "CASH_SALE", sourceId: cashSale.id');
    expect(ledgerDeleteSource).toContain("tx.factoryStockMovement.deleteMany");
    expect(cashSaleDeleteSource).toContain("tx.factoryStockMovement.deleteMany");
  });
});
