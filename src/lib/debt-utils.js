
import { getMyanmarDateInputValue } from "@/lib/myanmar-time";

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
 * Get the latest valid transaction date, regardless of transaction type.
 * This is used for the overdue reminder age shown to the user.
 *
 * @param {Array} ledgers - Array of ledger transactions
 * @returns {Date|null} - The latest transaction date or null if none is valid
 */
export function getLatestTransactionDate(ledgers) {
  const timestamps = (ledgers || [])
    .map((ledger) => ledger?.date ? new Date(ledger.date).getTime() : Number.NaN)
    .filter((timestamp) => Number.isFinite(timestamp));
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps));
}

function dateKeyToUtcMs(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || "")) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = Date.UTC(year, month - 1, day);
  const parsed = new Date(value);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return value;
}

/**
 * Calculate the age of a date in whole Myanmar calendar days.
 *
 * @param {Date|string} value - Transaction date
 * @param {Date|string} now - Reference instant
 * @returns {number|null} - Whole days since the transaction, or null for invalid dates
 */
export function getMyanmarDateAgeInDays(value, now = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const reference = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(reference.getTime())) return null;
  const dateMs = dateKeyToUtcMs(getMyanmarDateInputValue(date));
  const referenceMs = dateKeyToUtcMs(getMyanmarDateInputValue(reference));
  if (dateMs === null || referenceMs === null) return null;
  return Math.floor((referenceMs - dateMs) / (24 * 60 * 60 * 1000));
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
