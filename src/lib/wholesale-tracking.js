export const WHOLESALE_THRESHOLD_KS = 100000;

export function amountExceedsWholesaleThreshold(amount) {
  const numericAmount = Number(amount);
  return Number.isFinite(numericAmount) && numericAmount > WHOLESALE_THRESHOLD_KS;
}

export function getWholesaleTracking(amount) {
  const numericAmount = Number(amount || 0);
  const exceedsThreshold = amountExceedsWholesaleThreshold(numericAmount);
  return {
    thresholdKs: WHOLESALE_THRESHOLD_KS,
    amount: Number.isFinite(numericAmount) ? numericAmount : 0,
    exceedsThreshold,
    classification: exceedsThreshold ? "WHOLESALE_THRESHOLD_MATCH" : "BELOW_WHOLESALE_THRESHOLD",
    rule: `amount > ${WHOLESALE_THRESHOLD_KS} Ks`,
  };
}
