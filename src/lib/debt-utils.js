
/**
 * Calculate unpaid credits using FIFO logic.
 * 
 * @param {Array} ledgers - Array of ledger transactions
 * @returns {Array} - Array of unpaid credit objects { date, amount }
 */
export function calculateUnpaidCredits(ledgers) {
  if (!ledgers || ledgers.length === 0) return [];

  // Sort ledgers by date ascending to process chronologically
  const sortedLedgers = [...ledgers].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // FIFO logic to find which credits are still unpaid
  let unpaidCredits = [];
  sortedLedgers.forEach(l => {
    if (l.type === "CREDIT") {
      unpaidCredits.push({ date: new Date(l.date), amount: l.amount });
    } else if (l.type === "DEBIT") {
      let repayment = l.amount;
      while (repayment > 0 && unpaidCredits.length > 0) {
        if (unpaidCredits[0].amount <= repayment) {
          repayment -= unpaidCredits[0].amount;
          unpaidCredits.shift();
        } else {
          unpaidCredits[0].amount -= repayment;
          repayment = 0;
        }
      }
    }
  });

  return unpaidCredits;
}

/**
 * Get the oldest unpaid credit date.
 * 
 * @param {Array} ledgers - Array of ledger transactions
 * @returns {Date|null} - The date of the oldest unpaid credit or null if none
 */
export function getOldestUnpaidCreditDate(ledgers) {
  const unpaidCredits = calculateUnpaidCredits(ledgers);
  if (unpaidCredits.length === 0) return null;
  return new Date(unpaidCredits[0].date);
}

/**
 * Calculate total outstanding debt using FIFO logic.
 * (This should ideally match customer.current_balance)
 * 
 * @param {Array} ledgers - Array of ledger transactions
 * @returns {number} - Total outstanding debt
 */
export function calculateTotalOutstandingDebt(ledgers) {
  const unpaidCredits = calculateUnpaidCredits(ledgers);
  return unpaidCredits.reduce((sum, credit) => sum + credit.amount, 0);
}
