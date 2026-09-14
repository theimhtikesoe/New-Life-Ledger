export function settlementTargetId(note) {
  return settlementTargetIds(note)[0] || null;
}

export function settlementTargetIds(note) {
  return [...String(note || "").matchAll(/__SETTLES_CREDIT_LEDGER__:(\S+)/g)]
    .map((match) => match[1])
    .filter((id, index, ids) => ids.indexOf(id) === index);
}

export function cleanSettlementNote(note) {
  return String(note || "")
    .replace(/__SETTLES_CREDIT_LEDGER__:\S+/g, "")
    .replace(/__PREPAYMENT__/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSettlementNote(note, { targetId = "", prepayment = false } = {}) {
  const base = cleanSettlementNote(note);
  const marker = prepayment
    ? "__PREPAYMENT__"
    : targetId ? `__SETTLES_CREDIT_LEDGER__:${targetId}` : "";
  return [base, marker].filter(Boolean).join(" ");
}

export function normalizeSettlementNote(note) {
  const base = cleanSettlementNote(note);
  const targetId = settlementTargetId(note);
  const marker = targetId
    ? `__SETTLES_CREDIT_LEDGER__:${targetId}`
    : String(note || "").includes("__PREPAYMENT__") ? "__PREPAYMENT__" : "";
  return [base, marker].filter(Boolean).join(" ");
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
  // Settlement selection is a data link only. Every ledger DEBIT is a
  // payment received and must remain in the wholesale/payment total even
  // when it points to one or more old CREDIT rows.
  return String(ledger?.type || "").toUpperCase() === "DEBIT";
}
