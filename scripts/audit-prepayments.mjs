import fs from "node:fs";

const path = process.argv[2] || "/home/ubuntu/page_texts/newlifeledger.vercel.app_api_customers_includeLedgers_true.md";
const raw = fs.readFileSync(path, "utf8").trim();
const jsonText = raw.includes("```")
  ? raw.split("```")[1].replace(/^json\s*/i, "").trim()
  : (raw.split(/\r?\n/).find((line) => line.trim().startsWith("{\"data\"")) || raw);
const payload = JSON.parse(jsonText);
const customers = payload.data || [];
const day = (value) => new Date(value).toISOString().slice(0, 10);
const money = (value) => Math.round(Number(value || 0)).toLocaleString("en-US");
const findings = [];
for (const customer of customers) {
  const ledgers = [...(customer.ledgers || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const credits = ledgers.filter((row) => row.type === "CREDIT");
  const debits = ledgers.filter((row) => row.type === "DEBIT");
  const suspicious = [];
  for (const debit of debits) {
    const hasTarget = String(debit.note || "").includes("__SETTLES_CREDIT_LEDGER__:");
    const explicit = String(debit.note || "").includes("__PREPAYMENT__");
    const futureMatches = credits.filter((credit) => {
      const gapDays = (new Date(credit.date) - new Date(debit.date)) / (24 * 60 * 60 * 1000);
      return gapDays > 0 && gapDays <= 3 && Number(credit.amount) === Number(debit.amount);
    });
    const olderCredits = credits.filter((credit) => new Date(credit.date) < new Date(debit.date));
    if (!hasTarget && (explicit || futureMatches.length)) {
      suspicious.push({
        debitDate: day(debit.date), amount: Number(debit.amount), paymentType: debit.paymentType || null,
        explicitPrepayment: explicit, futureMatches: futureMatches.map((row) => ({ date: day(row.date), amount: Number(row.amount), id: row.id })),
        olderCreditCount: olderCredits.length,
      });
    }
  }
  if (suspicious.length) findings.push({ id: customer.id, name: customer.name, currentBalance: Number(customer.current_balance), suspicious });
}
console.log(JSON.stringify({ customerCount: customers.length, customersWithRisk: findings.length, findings }, null, 2));
