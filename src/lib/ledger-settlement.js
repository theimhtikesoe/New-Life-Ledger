export function settlementTargetId(note) {
  const match = String(note || "").match(/^__SETTLES_CREDIT_LEDGER__:(\S+)$/);
  return match ? match[1] : null;
}

export async function hydrateSettlementSaleTypes(db, ledgers = []) {
  const targetIds = [...new Set(
    ledgers.map((ledger) => settlementTargetId(ledger.note)).filter(Boolean),
  )];
  if (!targetIds.length || !db?.ledger?.findMany) return ledgers;

  const targets = await db.ledger.findMany({
    where: { id: { in: targetIds } },
    select: { id: true, saleType: true },
  });
  const saleTypeById = new Map(targets.map((target) => [String(target.id), target.saleType]));
  return ledgers.map((ledger) => {
    const targetId = settlementTargetId(ledger.note);
    if (!targetId || !saleTypeById.has(String(targetId))) return ledger;
    return { ...ledger, settlementSaleType: saleTypeById.get(String(targetId)) };
  });
}

export function isWholesaleSettlement(ledger) {
  if (String(ledger?.type || "").toUpperCase() !== "DEBIT") return false;
  const targetId = settlementTargetId(ledger.note);
  if (!targetId) return true;
  return String(ledger.settlementSaleType || "").toUpperCase() === "WHOLESALE";
}
