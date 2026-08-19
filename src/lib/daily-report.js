import PDFDocument from "pdfkit";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { ensureDatabase } from "@/lib/database";

const MYANMAR_OFFSET_MS = (6 * 60 + 30) * 60 * 1000;
const MYANMAR_TIME_ZONE = "Asia/Yangon";

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function amount(value) {
  return `${Number(value || 0).toLocaleString("en-US")} Ks`;
}

function formatMyanmarDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MYANMAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function getMyanmarDateParts(date) {
  const local = new Date(date.getTime() + MYANMAR_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    day: local.getUTCDate(),
  };
}

export function getPreviousMyanmarDayRange(now = new Date()) {
  const current = getMyanmarDateParts(now);
  const previousLocalDay = new Date(Date.UTC(current.year, current.month, current.day - 1));
  const year = previousLocalDay.getUTCFullYear();
  const month = previousLocalDay.getUTCMonth();
  const day = previousLocalDay.getUTCDate();
  const start = new Date(Date.UTC(year, month, day) - MYANMAR_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const dateLabel = `${year}-${pad(month + 1)}-${pad(day)}`;
  return { start, end, dateLabel };
}

function summarizeLedgers(ledgers) {
  const summary = {
    paidCount: 0,
    paidAmount: 0,
    debtCount: 0,
    debtAmount: 0,
    totalTransactions: ledgers.length,
    paymentTypes: {},
  };
  const customers = new Map();

  for (const ledger of ledgers) {
    const isPaid = ledger.type === "DEBIT";
    if (isPaid) {
      summary.paidCount += 1;
      summary.paidAmount += ledger.amount;
    } else {
      summary.debtCount += 1;
      summary.debtAmount += ledger.amount;
    }
    if (isPaid) {
      const paymentType = ledger.paymentType || "မသတ်မှတ်ရသေး";
      summary.paymentTypes[paymentType] = (summary.paymentTypes[paymentType] || 0) + ledger.amount;
    }

    const customerId = ledger.customer.id;
    const current = customers.get(customerId) || {
      customerId,
      customerName: ledger.customer.name,
      paidCount: 0,
      paidAmount: 0,
      debtCount: 0,
      debtAmount: 0,
    };
    if (isPaid) {
      current.paidCount += 1;
      current.paidAmount += ledger.amount;
    } else {
      current.debtCount += 1;
      current.debtAmount += ledger.amount;
    }
    customers.set(customerId, current);
  }

  return {
    summary,
    customers: Array.from(customers.values()).sort(
      (a, b) => b.paidAmount + b.debtAmount - (a.paidAmount + a.debtAmount),
    ),
  };
}

export async function getDailyReportData({ start, end, dateLabel } = getPreviousMyanmarDayRange()) {
  await ensureDatabase();
  const [ledgers, auditLogs] = await Promise.all([
    prisma.ledger.findMany({
      where: { date: { gte: start, lt: end } },
      select: {
        id: true,
        date: true,
        createdAt: true,
        type: true,
        saleType: true,
        itemSize: true,
        cartons: true,
        rate: true,
        deductions: true,
        amount: true,
        note: true,
        paymentType: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);

  const { summary, customers } = summarizeLedgers(ledgers);
  return {
    dateLabel,
    periodLabel: `${dateLabel} 00:00–23:59 (Myanmar time)`,
    start,
    end,
    summary: { ...summary, auditCount: auditLogs.length },
    customers,
    ledgers,
    auditLogs,
  };
}

function resolveFontPath() {
  const bundled = path.join(process.cwd(), "assets", "NotoSansMyanmar-Regular.ttf");
  return fs.existsSync(bundled) ? bundled : null;
}

export async function createDailyReportPdf(report) {
  const fontPath = resolveFontPath();
  if (!fontPath) {
    throw new Error("Daily report font asset is unavailable in the serverless bundle");
  }
  const doc = new PDFDocument({ size: "A4", margin: 36, bufferPages: true });
  doc.font(fontPath);

  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const { summary } = report;
  doc.fontSize(18).text("New Life Ledger - Daily Report");
  doc.moveDown(0.25).fontSize(10).text(report.periodLabel);
  doc.moveDown(0.8).fontSize(12).text("Daily Summary", { underline: true });
  doc.moveDown(0.35).fontSize(10);
  doc.text(`Paid transactions: ${summary.paidCount} | ${amount(summary.paidAmount)}`);
  doc.text(`Debt increases: ${summary.debtCount} | ${amount(summary.debtAmount)}`);
  doc.text(`Total transactions: ${summary.totalTransactions}`);
  doc.text(`Activity actions: ${summary.auditCount}`);

  doc.moveDown(0.8).fontSize(12).text("Payment Types", { underline: true });
  doc.moveDown(0.3).fontSize(10);
  const paymentEntries = Object.entries(summary.paymentTypes);
  if (!paymentEntries.length) doc.text("No payment records");
  paymentEntries.forEach(([key, value]) => doc.text(`${key}: ${amount(value)}`));

  doc.moveDown(0.8).fontSize(12).text("Customer Summary", { underline: true });
  doc.moveDown(0.3).fontSize(9);
  if (!report.customers.length) doc.text("No customer transactions for this period");
  report.customers.forEach((customer) => {
    doc.text(
      `${customer.customerName} | Paid ${amount(customer.paidAmount)} | Debt ${amount(customer.debtAmount)}`,
    );
  });

  doc.addPage().fontSize(12).text("Transactions", { underline: true });
  doc.moveDown(0.35).fontSize(8);
  if (!report.ledgers.length) doc.text("No transactions for this period");
  report.ledgers.forEach((ledger, index) => {
    const kind = ledger.type === "DEBIT" ? "PAYMENT" : "DEBT INCREASE";
    doc.text(
      `${index + 1}. ${formatMyanmarDate(ledger.date)} | ${ledger.customer.name} | ${kind} | ${amount(ledger.amount)} | ${ledger.paymentType || "-"}`,
    );
    if (ledger.note) doc.text(`   Note: ${ledger.note}`);
    doc.moveDown(0.15);
  });

  doc.moveDown(0.7).fontSize(12).text("Activity History", { underline: true });
  doc.moveDown(0.35).fontSize(8);
  if (!report.auditLogs.length) doc.text("No new audit actions for this period");
  report.auditLogs.forEach((log, index) => {
    doc.text(
      `${index + 1}. ${formatMyanmarDate(log.createdAt)} | ${log.actorName || ""} | ${log.action} | ${log.entityLabel || log.entityType} | ${log.summary}`,
    );
  });

  doc.end();
  return done;
}

export async function createDailySummaryImage(report) {
  const { summary } = report;
  const width = 1200;
  const rowHeight = 58;
  const height = 500 + Math.min(report.customers.length, 8) * rowHeight;
  const customerRows = report.customers.slice(0, 8).map((customer, index) => {
    const y = 330 + index * rowHeight;
    return `<text x="70" y="${y}" class="row">${escapeXml(customer.customerName)}</text><text x="760" y="${y}" class="row">Paid ${escapeXml(amount(customer.paidAmount))}</text><text x="1010" y="${y}" class="row">Debt ${escapeXml(amount(customer.debtAmount))}</text>`;
  }).join("");
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .title { font: 700 34px Arial, sans-serif; fill: #0f172a; }
      .subtitle { font: 20px Arial, sans-serif; fill: #475569; }
      .label { font: 700 18px Arial, sans-serif; fill: #334155; }
      .value { font: 700 30px Arial, sans-serif; fill: #0f172a; }
      .row { font: 20px Arial, sans-serif; fill: #334155; }
    </style>
    <rect width="100%" height="100%" fill="#f8fafc"/>
    <rect x="28" y="28" width="1144" height="${height - 56}" rx="24" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <text x="70" y="90" class="title">New Life Ledger - Daily Summary</text>
    <text x="70" y="128" class="subtitle">${escapeXml(report.periodLabel)}</text>
    <rect x="65" y="160" width="250" height="115" rx="16" fill="#dcfce7"/><text x="88" y="198" class="label">Paid</text><text x="88" y="242" class="value">${summary.paidCount} | ${escapeXml(amount(summary.paidAmount))}</text>
    <rect x="335" y="160" width="250" height="115" rx="16" fill="#fee2e2"/><text x="358" y="198" class="label">Debt Increase</text><text x="358" y="242" class="value">${summary.debtCount} | ${escapeXml(amount(summary.debtAmount))}</text>
    <rect x="605" y="160" width="250" height="115" rx="16" fill="#dbeafe"/><text x="628" y="198" class="label">Transactions</text><text x="628" y="242" class="value">${summary.totalTransactions}</text>
    <rect x="875" y="160" width="250" height="115" rx="16" fill="#fef3c7"/><text x="898" y="198" class="label">Activity</text><text x="898" y="242" class="value">${summary.auditCount}</text>
    <text x="70" y="315" class="label">Top customer activity</text>
    ${customerRows || '<text x="70" y="360" class="row">No customer transactions for this period</text>'}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
