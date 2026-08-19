import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
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

function wrapPdfText(text, font, fontSize, maxWidth) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function createDailyReportPdf(report) {
  const fontPath = resolveFontPath();
  if (!fontPath) throw new Error("Daily report font asset is unavailable in the serverless bundle");

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fs.readFileSync(fontPath), { subset: true });
  const pageSize = [595.28, 841.89];
  const margin = 36;
  const maxWidth = pageSize[0] - margin * 2;
  let page = pdfDoc.addPage(pageSize);
  let y = pageSize[1] - margin;

  const draw = (text, size = 10, gap = 5) => {
    const lines = wrapPdfText(text, font, size, maxWidth);
    for (const line of lines) {
      if (y < margin + size + gap) {
        page = pdfDoc.addPage(pageSize);
        y = pageSize[1] - margin;
      }
      page.drawText(line, { x: margin, y: y - size, size, font });
      y -= size + gap;
    }
  };
  const heading = (text, size = 12) => {
    y -= 8;
    draw(text, size, 5);
    y -= 3;
  };

  const { summary } = report;
  draw("New Life Ledger - Daily Report", 18, 7);
  draw(report.periodLabel, 10, 8);
  heading("Daily Summary");
  draw(`Paid transactions: ${summary.paidCount} | ${amount(summary.paidAmount)}`);
  draw(`Debt increases: ${summary.debtCount} | ${amount(summary.debtAmount)}`);
  draw(`Total transactions: ${summary.totalTransactions}`);
  draw(`Activity actions: ${summary.auditCount}`);
  heading("Payment Types");
  const paymentEntries = Object.entries(summary.paymentTypes);
  if (!paymentEntries.length) draw("No payment records");
  paymentEntries.forEach(([key, value]) => draw(`${key}: ${amount(value)}`));
  heading("Customer Summary");
  if (!report.customers.length) draw("No customer transactions for this period");
  report.customers.forEach((customer) => draw(`${customer.customerName} | Paid ${amount(customer.paidAmount)} | Debt ${amount(customer.debtAmount)}`, 9, 4));

  page = pdfDoc.addPage(pageSize);
  y = pageSize[1] - margin;
  heading("Transactions");
  if (!report.ledgers.length) draw("No transactions for this period", 9);
  report.ledgers.forEach((ledger, index) => {
    const kind = ledger.type === "DEBIT" ? "PAYMENT" : "DEBT INCREASE";
    draw(`${index + 1}. ${formatMyanmarDate(ledger.date)} | ${ledger.customer.name} | ${kind} | ${amount(ledger.amount)} | ${ledger.paymentType || "-"}`, 8, 3);
    if (ledger.note) draw(`Note: ${ledger.note}`, 8, 3);
  });
  heading("Activity History");
  if (!report.auditLogs.length) draw("No new audit actions for this period", 8);
  report.auditLogs.forEach((log, index) => draw(`${index + 1}. ${formatMyanmarDate(log.createdAt)} | ${log.actorName || ""} | ${log.action} | ${log.entityLabel || log.entityType} | ${log.summary}`, 8, 3));

  return Buffer.from(await pdfDoc.save());
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
