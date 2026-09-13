function settlementTargetId(note) {
  const match = String(note || "").match(/__SETTLES_CREDIT_LEDGER__:(\S+)/);
  // Ledger IDs are String in Prisma. Keep the extracted identifier as a
  // string; converting it to Number makes findMany({ id: { in } }) fail when
  // an older settlement note contains a numeric-looking ID.
  return match ? match[1] : null;
}

export async function hydrateSettledBottleSaleItems(db, ledgers = []) {
  const ids = [...new Set(ledgers
    .filter((row) => row?.type === "DEBIT" && (!Array.isArray(row.saleItems) || !row.saleItems.length))
    .map((row) => settlementTargetId(row.note))
    .filter((id) => typeof id === "string" && id.length > 0))];
  if (!ids.length) return ledgers;

  const sourceRows = await db.ledger.findMany({
    where: { id: { in: ids } },
    select: { id: true, saleItems: true },
  });
  const sourceById = new Map(sourceRows.map((row) => [row.id, row.saleItems]));
  return ledgers.map((row) => {
    if (row?.type !== "DEBIT" || (Array.isArray(row.saleItems) && row.saleItems.length)) return row;
    const sourceItems = sourceById.get(settlementTargetId(row.note));
    return Array.isArray(sourceItems) && sourceItems.length ? { ...row, saleItems: sourceItems } : row;
  });
}

export { settlementTargetId };
