import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const REQUIRED_SHEETS = ["Backup Info", "Customers", "Transactions", "Audit History"];

function rowsFromSheet(workbook, name) {
  const sheet = workbook.Sheets[name];
  return sheet ? XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false }) : [];
}

function asNumber(value, fallback = 0) {
  const number = Number(String(value ?? "").replace(/,/g, "").replace(/ Ks$/i, "").trim());
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

function normalize(workbook) {
  const infoRows = workbook.Sheets["Backup Info"]
    ? XLSX.utils.sheet_to_json(workbook.Sheets["Backup Info"], { header: 1, defval: null })
    : [];
  const info = Object.fromEntries(infoRows.filter((row) => row[0]).map((row) => [String(row[0]), row[1]]));
  const customers = rowsFromSheet(workbook, "Customers").map((row) => ({
    id: asUuid(row.id || row.ID),
    name: String(row.name ?? row.Name ?? "").trim(),
    phone: row.phone ?? row.Phone ?? null,
    routeTag: row.routeTag ?? row.RouteTag ?? null,
    current_balance: asNumber(row.current_balance ?? row.CurrentBalance),
    createdAt: asDate(row.createdAt ?? row.CreatedAt) || new Date(),
    deletedAt: row.deletedAt || row.DeletedAt ? asDate(row.deletedAt || row.DeletedAt) : null,
  }));
  const transactions = rowsFromSheet(workbook, "Transactions").map((row) => ({
    id: asUuid(row.id || row.ID),
    customerId: asUuid(row.customerId || row.CustomerId),
    date: asDate(row.date || row.Date),
    type: String(row.type || row.Type || "").toUpperCase() === "DEBIT" ? "DEBIT" : "CREDIT",
    saleType: row.saleType || row.SaleType || "RETAIL",
    itemSize: row.itemSize || row.ItemSize || null,
    cartons: row.cartons == null || row.cartons === "" ? null : asNumber(row.cartons || row.Cartons),
    rate: row.rate == null || row.rate === "" ? null : asNumber(row.rate || row.Rate),
    deductions: asNumber(row.deductions ?? row.Deductions),
    amount: asNumber(row.amount ?? row.Amount),
    note: row.note ?? row.Note ?? null,
    paymentType: row.paymentType ?? row.PaymentType ?? null,
    createdAt: asDate(row.createdAt || row.CreatedAt) || asDate(row.date || row.Date) || new Date(),
  }));
  const auditLogs = rowsFromSheet(workbook, "Audit History").map((row) => ({
    id: asUuid(row.id || row.ID),
    actorName: String(row.actorName ?? row.ActorName ?? ""),
    action: String(row.action ?? row.Action ?? "IMPORT"),
    entityType: String(row.entityType ?? row.EntityType ?? "Backup"),
    entityId: row.entityId ?? row.EntityId ?? null,
    entityLabel: row.entityLabel ?? row.EntityLabel ?? null,
    summary: String(row.summary ?? row.Summary ?? "Imported backup audit record"),
    metadata: row.metadata ? { importedMetadata: row.metadata } : undefined,
    createdAt: asDate(row.createdAt || row.CreatedAt) || new Date(),
  }));
  return { info, customers, transactions, auditLogs };
}

function validate(data) {
  const errors = [];
  if (!data.info.format || data.info.format !== "new-life-ledger-backup") {
    errors.push("ဒီဖိုင်သည် New Life Ledger backup format မဟုတ်ပါ။");
  }
  data.customers.forEach((customer, index) => {
    if (!customer.name) errors.push(`Customers row ${index + 2}: name မရှိပါ။`);
    if (customer.id === null) errors.push(`Customers row ${index + 2}: valid id မရှိပါ။`);
  });
  const customerIds = new Set(data.customers.filter((item) => item.id).map((item) => item.id));
  data.transactions.forEach((transaction, index) => {
    if (!transaction.id) errors.push(`Transactions row ${index + 2}: valid id မရှိပါ။`);
    if (!transaction.customerId || !customerIds.has(transaction.customerId)) errors.push(`Transactions row ${index + 2}: customerId မကိုက်ညီပါ။`);
    if (!transaction.date) errors.push(`Transactions row ${index + 2}: date မမှန်ပါ။`);
    if (!transaction.amount || transaction.amount <= 0) errors.push(`Transactions row ${index + 2}: amount မမှန်ပါ။`);
  });
  return errors.slice(0, 50);
}

async function parseRequest(request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const mode = formData.get("mode") === "confirm" ? "confirm" : "preview";
  if (!file || typeof file.arrayBuffer !== "function") throw new Error("Backup Excel file လိုအပ်ပါသည်။");
  if (file.size > MAX_FILE_BYTES) throw new Error("Backup file size သည် 20MB ထက် မကျော်ရပါ။");
  const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: true });
  const missingSheets = REQUIRED_SHEETS.filter((sheet) => !workbook.SheetNames.includes(sheet));
  if (missingSheets.length) throw new Error(`Backup sheet မပြည့်စုံပါ: ${missingSheets.join(", ")}`);
  return { mode, data: normalize(workbook) };
}

export async function POST(request) {
  try {
    await ensureDatabase();
    const { mode, data } = await parseRequest(request);
    const errors = validate(data);
    if (errors.length) return NextResponse.json({ error: "Backup validation မအောင်မြင်ပါ။", details: errors }, { status: 400 });

    const [existingCustomers, existingTransactions, existingAuditLogs] = await Promise.all([
      prisma.customer.findMany({ select: { id: true, name: true, phone: true } }),
      prisma.ledger.findMany({ select: { id: true } }),
      prisma.auditLog.findMany({ select: { id: true } }),
    ]);
    const existingCustomerIds = new Set(existingCustomers.map((item) => item.id));
    const existingCustomerKeys = new Set(existingCustomers.map((item) => `${item.name.trim().toLowerCase()}|${item.phone || ""}`));
    const existingTransactionIds = new Set(existingTransactions.map((item) => item.id));
    const existingAuditIds = new Set(existingAuditLogs.map((item) => item.id));
    const toCreateCustomers = data.customers.filter((item) => item.id && !existingCustomerIds.has(item.id) && !existingCustomerKeys.has(`${item.name.toLowerCase()}|${item.phone || ""}`));
    const toCreateTransactions = data.transactions.filter((item) => item.id && !existingTransactionIds.has(item.id));
    const toCreateAudits = data.auditLogs.filter((item) => item.id && !existingAuditIds.has(item.id));
    const summary = {
      mode,
      backupInfo: data.info,
      sourceCounts: { customers: data.customers.length, transactions: data.transactions.length, auditLogs: data.auditLogs.length },
      willAdd: { customers: toCreateCustomers.length, transactions: toCreateTransactions.length, auditLogs: toCreateAudits.length },
      willSkip: { customers: data.customers.length - toCreateCustomers.length, transactions: data.transactions.length - toCreateTransactions.length, auditLogs: data.auditLogs.length - toCreateAudits.length },
      policy: "add-only; existing records are never updated or deleted",
    };

    if (mode === "preview") return NextResponse.json({ data: summary });

    const result = await prisma.$transaction(async (tx) => {
      let addedCustomers = 0;
      let addedTransactions = 0;
      let addedAuditLogs = 0;
      for (const customer of toCreateCustomers) {
        await tx.customer.create({ data: customer });
        addedCustomers += 1;
      }
      for (const transaction of toCreateTransactions) {
        const customerExists = await tx.customer.findUnique({ where: { id: transaction.customerId }, select: { id: true } });
        if (!customerExists) continue;
        await tx.ledger.create({ data: transaction });
        addedTransactions += 1;
      }
      for (const auditLog of toCreateAudits) {
        await tx.auditLog.create({ data: auditLog });
        addedAuditLogs += 1;
      }
      await writeAuditLog({
        db: tx,
        actorName: getActorName(request),
        action: "IMPORT",
        entityType: "Backup",
        summary: `Backup restore: customer ${addedCustomers}, transaction ${addedTransactions}`,
        metadata: { sourceCounts: summary.sourceCounts, added: { addedCustomers, addedTransactions, addedAuditLogs } },
      });
      return { addedCustomers, addedTransactions, addedAuditLogs };
    });

    return NextResponse.json({ data: { ...summary, result } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
