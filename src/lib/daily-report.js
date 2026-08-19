import { PDFDocument } from "pdf-lib";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
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
  const legacyLogs = ledgers.map((ledger) => ({
    id: `legacy-${ledger.id}`,
    actorName: "",
    action: ledger.type === "DEBIT" ? "PAYMENT" : "DEBT_INCREASE",
    entityType: "Ledger",
    entityLabel: ledger.customer.name,
    summary: `${ledger.customer.name} ${ledger.type === "DEBIT" ? "ငွေချေ" : "အကြွေးတိုး"} ${ledger.amount.toLocaleString()} Ks`,
    createdAt: ledger.date,
    eventSource: "legacy",
    metadata: {
      amount: ledger.amount,
      paymentType: ledger.paymentType,
      note: ledger.note,
    },
  }));
  const activityLogs = [...auditLogs.map((log) => ({ ...log, eventSource: "audit" })), ...legacyLogs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return {
    dateLabel,
    periodLabel: `${dateLabel} 00:00–23:59 (Myanmar time)`,
    start,
    end,
    summary: { ...summary, auditCount: auditLogs.length },
    customers,
    ledgers,
    auditLogs,
    activityLogs,
  };
}

function resolveFontPath() {
  const bundled = path.join(process.cwd(), "assets", "NotoSansMyanmar-Regular.ttf");
  return fs.existsSync(bundled) ? bundled : null;
}

function resolveLatinFontPath() {
  const bundled = path.join(process.cwd(), "assets", "DejaVuSans.ttf");
  return fs.existsSync(bundled) ? bundled : null;
}

let resvgReady;

async function ensureResvgReady() {
  if (!resvgReady) {
    const wasmPath = path.join(process.cwd(), "assets", "resvg.wasm");
    resvgReady = initWasm(fs.readFileSync(wasmPath));
  }
  await resvgReady;
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

function actionLabel(action) {
  return ({ PAYMENT: "ငွေချေ", DEBT_INCREASE: "အကြွေးတိုး", CREATE: "အသစ်ထည့်", UPDATE: "ပြင်ဆင်", RESTORE: "ပြန်ယူ", DELETE: "ဖျက်", PERMANENT_DELETE: "အပြီးဖျက်", DAILY_REPORT_SENT: "Daily Report ပို့" })[action] || action;
}

function clipText(value, maxLength) {
  const text = String(value ?? "");
  const chars = Array.from(text);
  return chars.length > maxLength ? `${chars.slice(0, maxLength - 1).join("")}…` : text;
}

function createReportSvg(report) {
  const fontPath = resolveFontPath();
  if (!fontPath) throw new Error("Daily report font asset is unavailable in the serverless bundle");
  const { summary } = report;
  const customers = report.customers || [];
  const logs = report.activityLogs || report.auditLogs || [];
  const width = 2200;
  const customerRows = Math.max(customers.length, 1);
  const activityRows = Math.max(logs.length, 1);
  const customerStartY = 500;
  const customerRowHeight = 64;
  const paymentTop = customerStartY + customerRows * customerRowHeight + 45;
  const paymentHeight = Math.max(180, 90 + Object.keys(summary.paymentTypes || {}).length * 45);
  const activityTop = paymentTop + paymentHeight + 100;
  const activityHeaderY = activityTop + 105;
  const activityStartY = activityTop + 165;
  const activityRowHeight = 58;
  const height = activityStartY + activityRows * activityRowHeight + 90;
  const esc = escapeXml;
  const card = (x, fill, label, value, detail = "") => `<rect x="${x}" y="170" width="500" height="140" rx="18" fill="${fill}"/><text x="${x + 26}" y="215" class="label">${esc(label)}</text><text x="${x + 26}" y="266" class="value">${esc(value)}</text><text x="${x + 26}" y="294" class="detail">${esc(detail)}</text>`;
  const customerRowsSvg = customers.length ? customers.map((customer, index) => {
    const y = customerStartY + index * customerRowHeight;
    return `<line x1="70" y1="${y + 22}" x2="2130" y2="${y + 22}" class="line"/><text x="90" y="${y}" class="row">${esc(clipText(customer.customerName, 46))}</text><text x="1350" y="${y}" class="row green">${customer.paidCount} / ${esc(amount(customer.paidAmount))}</text><text x="1770" y="${y}" class="row red">${customer.unpaidCount ?? customer.debtCount ?? 0} / ${esc(amount(customer.unpaidAmount ?? customer.debtAmount))}</text>`;
  }).join("") : `<text x="90" y="${customerStartY}" class="row">ဒီနေ့စာရင်းမရှိသေးပါ။</text>`;
  const paymentEntries = Object.entries(summary.paymentTypes || {});
  const paymentRows = paymentEntries.length ? paymentEntries.map(([type, value], index) => `<text x="110" y="${paymentTop + 105 + index * 45}" class="small">${esc(clipText(type, 32))}</text><text x="2070" y="${paymentTop + 105 + index * 45}" text-anchor="end" class="small bold">${esc(amount(value))}</text>`).join("") : `<text x="110" y="${paymentTop + 105}" class="small">ငွေချေမှုမရှိသေးပါ။</text>`;
  const activityRowsSvg = logs.length ? logs.map((log, index) => {
    const metadata = log.metadata || {};
    const y = activityStartY + index * activityRowHeight;
    return `<line x1="70" y1="${y + 20}" x2="2130" y2="${y + 20}" class="line"/><text x="90" y="${y}" class="tiny">${esc(clipText(formatMyanmarDate(log.createdAt), 19))}</text><text x="370" y="${y}" class="tiny">${esc(clipText(log.actorName || "", 12))}</text><text x="520" y="${y}" class="tiny">${esc(clipText(actionLabel(log.action), 15))}</text><text x="760" y="${y}" class="tiny">${esc(clipText(log.entityLabel || log.entityType || "", 34))}</text><text x="1370" y="${y}" class="tiny">${esc(metadata.amount == null ? "" : amount(metadata.amount))}</text><text x="1600" y="${y}" class="tiny">${esc(clipText(metadata.paymentType || "", 15))}</text><text x="1770" y="${y}" class="tiny">${esc(clipText(metadata.note || "", 18))}</text><text x="2000" y="${y}" class="tiny">${esc(log.eventSource === "legacy" ? "အရင်စာရင်း" : "အသစ်မှတ်တမ်း")}</text>`;
  }).join("") : `<text x="90" y="${activityStartY}" class="row">ဒီနေ့လုပ်ဆောင်ချက်မရှိသေးပါ။</text>`;
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .title,.subtitle,.heading,.label,.value,.detail,.row,.small,.tiny { font-family: 'Noto Sans Myanmar', sans-serif; fill: #0f172a; }
      .title { font-size: 42px; } .subtitle { font-size: 24px; fill: #475569; } .heading { font-size: 28px; } .label { font-size: 22px; fill: #334155; } .value { font-size: 38px; } .detail { font-size: 19px; fill: #475569; } .row { font-size: 22px; } .small { font-size: 22px; } .tiny { font-size: 18px; } .bold { font-weight: 700; } .green { fill: #047857; } .red { fill: #be123c; } .line { stroke: #e2e8f0; stroke-width: 2; }
    </style>
    <rect width="100%" height="100%" fill="#f8fafc"/><rect x="28" y="28" width="2144" height="${height - 56}" rx="24" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <text x="70" y="90" class="title">Daily Summary</text><text x="70" y="130" class="subtitle">${esc(report.periodLabel)}</text>
    ${card(65, "#ecfdf5", "ငွေချေသူ", String(summary.paidCount), amount(summary.paidAmount))}${card(595, "#fff1f2", "အကြွေးတိုးသူ", String(summary.debtCount), amount(summary.debtAmount))}${card(1125, "#eff6ff", "Transaction စုစုပေါင်း", String(summary.totalTransactions))}${card(1655, "#f5f3ff", "လုပ်ဆောင်ချက်မှတ်တမ်း", String(summary.auditCount))}
    <text x="70" y="400" class="heading">Customer အလိုက် စာရင်းချုပ်</text><text x="90" y="460" class="small">Customer</text><text x="1350" y="460" class="small">ငွေချေ</text><text x="1770" y="460" class="small">အကြွေးတိုး</text>${customerRowsSvg}
    <rect x="70" y="${paymentTop}" width="2060" height="${paymentHeight}" rx="16" fill="#f8fafc"/><text x="110" y="${paymentTop + 55}" class="heading">Payment Type</text>${paymentRows}
    <text x="70" y="${activityTop}" class="title">Activity History</text><text x="70" y="${activityTop + 42}" class="subtitle">${esc(report.dateLabel)} Activity — ${logs.length} actions</text><text x="90" y="${activityHeaderY}" class="small">စာရင်းနေ့/အချိန်</text><text x="370" y="${activityHeaderY}" class="small">လုပ်သူ</text><text x="520" y="${activityHeaderY}" class="small">လုပ်ဆောင်ချက်</text><text x="760" y="${activityHeaderY}" class="small">Customer / အကြောင်းအရာ</text><text x="1370" y="${activityHeaderY}" class="small">ပမာဏ</text><text x="1600" y="${activityHeaderY}" class="small">Payment</text><text x="1770" y="${activityHeaderY}" class="small">Note</text><text x="2000" y="${activityHeaderY}" class="small">Source</text>${activityRowsSvg}
  </svg>`;
}

async function renderReportImage(report) {
  const fontPath = resolveFontPath();
  const latinFontPath = resolveLatinFontPath();
  if (!fontPath || !latinFontPath) throw new Error("Daily report font assets are unavailable in the serverless bundle");
  await ensureResvgReady();
  const svg = createReportSvg(report);
  return Buffer.from(new Resvg(svg, { font: { fontBuffers: [fs.readFileSync(fontPath), fs.readFileSync(latinFontPath)], loadSystemFonts: false } }).render().asPng());
}

export async function createDailySummaryImage(report) {
  return renderReportImage(report);
}

export async function createDailyReportPdf(report) {
  const imageBuffer = await renderReportImage(report);
  const pdfDoc = await PDFDocument.create();
  const image = await pdfDoc.embedPng(imageBuffer);
  const page = pdfDoc.addPage([900, 900 * image.height / image.width]);
  page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  return Buffer.from(await pdfDoc.save());
}
