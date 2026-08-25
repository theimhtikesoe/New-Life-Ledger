import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const SUPPORTED_BACKUP_VERSION = 3;
const REQUIRED_SHEETS = ["Backup Info", "Customers", "Transactions", "Audit History"];
const OPTIONAL_SHEETS = ["KPay Aliases", "Pending KPay", "Integrity", "Orders", "Order Lines", "Order Caps", "Order Deliveries", "Order Automation", "Order Batch Runs"];

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

function asText(value, fallback = "") {
  return value == null ? fallback : String(value).trim();
}

function parseJsonCell(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return { importedMetadata: String(value) };
  }
}

function nullableNumber(value) {
  if (value == null || value === "") return null;
  const parsed = asNumber(value, null);
  return parsed === null ? null : parsed;
}

function normalize(workbook) {
  const infoRows = workbook.Sheets["Backup Info"]
    ? XLSX.utils.sheet_to_json(workbook.Sheets["Backup Info"], { header: 1, defval: null })
    : [];
  const info = Object.fromEntries(infoRows.filter((row) => row[0]).map((row) => [String(row[0]), row[1]]));
  const customers = rowsFromSheet(workbook, "Customers").map((row) => ({
    id: asUuid(row.id || row.ID),
    name: asText(row.name ?? row.Name),
    phone: row.phone ?? row.Phone ?? null,
    routeTag: row.routeTag ?? row.RouteTag ?? null,
    current_balance: asNumber(row.current_balance ?? row.CurrentBalance),
    createdAt: asDate(row.createdAt ?? row.CreatedAt) || new Date(),
    deletedAt: row.deletedAt || row.DeletedAt ? asDate(row.deletedAt || row.DeletedAt) : null,
  }));
  const transactions = rowsFromSheet(workbook, "Transactions").map((row) => {
    const normalizedType = asText(row.type || row.Type).toUpperCase();
    return {
      id: asUuid(row.id || row.ID),
      customerId: asUuid(row.customerId || row.CustomerId),
      date: asDate(row.date || row.Date),
      type: normalizedType === "CREDIT" || normalizedType === "DEBIT" ? normalizedType : "",
      saleType: row.saleType || row.SaleType || "RETAIL",
      itemSize: row.itemSize || row.ItemSize || null,
      cartons: row.cartons == null || row.cartons === "" ? null : asNumber(row.cartons || row.Cartons),
      rate: row.rate == null || row.rate === "" ? null : asNumber(row.rate || row.Rate),
      deductions: asNumber(row.deductions ?? row.Deductions),
      amount: asNumber(row.amount ?? row.Amount),
      note: row.note ?? row.Note ?? null,
      paymentType: row.paymentType ?? row.PaymentType ?? null,
      createdAt: asDate(row.createdAt || row.CreatedAt) || asDate(row.date || row.Date) || new Date(),
    };
  });
  const kpayAliases = rowsFromSheet(workbook, "KPay Aliases").map((row) => ({
    id: asUuid(row.id || row.ID),
    kpayName: asText(row.kpayName ?? row.KpayName),
    customerId: asUuid(row.customerId || row.CustomerId),
  }));
  const unverifiedKpay = rowsFromSheet(workbook, "Pending KPay").map((row) => ({
    id: asUuid(row.id || row.ID),
    raw_text: asText(row.raw_text ?? row.rawText ?? row.RawText),
    kpayName: row.kpayName ?? row.KpayName ?? null,
    amount: asNumber(row.amount ?? row.Amount),
    status: asText(row.status ?? row.Status, "PENDING") || "PENDING",
    suggestedCustomerId: asUuid(row.suggestedCustomerId || row.SuggestedCustomerId),
    createdAt: asDate(row.createdAt || row.CreatedAt) || new Date(),
  }));
  const auditLogs = rowsFromSheet(workbook, "Audit History").map((row) => ({
    id: asUuid(row.id || row.ID),
    actorName: asText(row.actorName ?? row.ActorName, "Legacy") || "Legacy",
    action: asText(row.action ?? row.Action, "IMPORT") || "IMPORT",
    entityType: asText(row.entityType ?? row.EntityType, "Backup") || "Backup",
    entityId: row.entityId ?? row.EntityId ?? null,
    entityLabel: row.entityLabel ?? row.EntityLabel ?? null,
    summary: asText(row.summary ?? row.Summary, "Imported backup audit record") || "Imported backup audit record",
    metadata: parseJsonCell(row.metadata ?? row.Metadata),
    createdAt: asDate(row.createdAt || row.CreatedAt) || new Date(),
  }));
  const orders = rowsFromSheet(workbook, "Orders").map((row) => ({
    id: asUuid(row.id || row.ID),
    status: asText(row.status ?? row.Status, "DRAFT") || "DRAFT",
    requestedDate: asText(row.requestedDate ?? row.RequestedDate),
    sourceChatId: row.sourceChatId ?? row.SourceChatId ?? null,
    sourceMessageId: row.sourceMessageId ?? row.SourceMessageId ?? null,
    sourceUpdateId: row.sourceUpdateId ?? row.SourceUpdateId ?? null,
    sourceText: asText(row.sourceText ?? row.SourceText),
    customerId: asUuid(row.customerId || row.CustomerId),
    draftCustomerName: row.draftCustomerName ?? row.DraftCustomerName ?? null,
    draftCustomerPhone: row.draftCustomerPhone ?? row.DraftCustomerPhone ?? null,
    customerPhone: row.customerPhone ?? row.CustomerPhone ?? null,
    missingFields: parseJsonCell(row.missingFields ?? row.MissingFields),
    aiConfidence: row.aiConfidence ?? row.AiConfidence ?? null,
    aiNotes: row.aiNotes ?? row.AiNotes ?? null,
    destination: row.destination ?? row.Destination ?? null,
    notificationMode: asText(row.notificationMode ?? row.NotificationMode, "IMMEDIATE") || "IMMEDIATE",
    confirmedBy: row.confirmedBy ?? row.ConfirmedBy ?? null,
    confirmedAt: row.confirmedAt || row.ConfirmedAt ? asDate(row.confirmedAt || row.ConfirmedAt) : null,
    createdAt: asDate(row.createdAt || row.CreatedAt) || new Date(),
    updatedAt: asDate(row.updatedAt || row.UpdatedAt) || asDate(row.createdAt || row.CreatedAt) || new Date(),
  }));
  const orderLines = rowsFromSheet(workbook, "Order Lines").map((row) => ({
    id: asUuid(row.id || row.ID),
    orderId: asUuid(row.orderId || row.OrderId),
    lineNumber: asNumber(row.lineNumber ?? row.LineNumber, 0),
    bottleType: row.bottleType ?? row.BottleType ?? null,
    capacityMl: nullableNumber(row.capacityMl ?? row.CapacityMl),
    capacityLabel: row.capacityLabel ?? row.CapacityLabel ?? null,
    bottlesPerCard: nullableNumber(row.bottlesPerCard ?? row.BottlesPerCard),
    cardCount: nullableNumber(row.cardCount ?? row.CardCount),
    totalBottles: nullableNumber(row.totalBottles ?? row.TotalBottles),
    notes: row.notes ?? row.Notes ?? null,
    createdAt: asDate(row.createdAt || row.CreatedAt) || new Date(),
  }));
  const orderCaps = rowsFromSheet(workbook, "Order Caps").map((row) => ({
    id: asUuid(row.id || row.ID),
    orderId: asUuid(row.orderId || row.OrderId),
    capType: asText(row.capType ?? row.CapType),
    normalPcs: asNumber(row.normalPcs ?? row.NormalPcs),
    extraPcs: asNumber(row.extraPcs ?? row.ExtraPcs),
    requestedTotalPcs: asNumber(row.requestedTotalPcs ?? row.RequestedTotalPcs),
    expectedPcs: nullableNumber(row.expectedPcs ?? row.ExpectedPcs),
    warningText: row.warningText ?? row.WarningText ?? null,
    notes: row.notes ?? row.Notes ?? null,
    createdAt: asDate(row.createdAt || row.CreatedAt) || new Date(),
  }));
  const orderDeliveries = rowsFromSheet(workbook, "Order Deliveries").map((row) => ({
    id: asUuid(row.id || row.ID),
    orderId: asUuid(row.orderId || row.OrderId),
    destinationType: asText(row.destinationType ?? row.DestinationType),
    mode: asText(row.mode ?? row.Mode),
    status: asText(row.status ?? row.Status, "PENDING") || "PENDING",
    telegramChatId: row.telegramChatId ?? row.TelegramChatId ?? null,
    telegramMessageId: row.telegramMessageId ?? row.TelegramMessageId ?? null,
    sentAt: row.sentAt || row.SentAt ? asDate(row.sentAt || row.SentAt) : null,
    errorMessage: row.errorMessage ?? row.ErrorMessage ?? null,
    createdAt: asDate(row.createdAt || row.CreatedAt) || new Date(),
    updatedAt: asDate(row.updatedAt || row.UpdatedAt) || asDate(row.createdAt || row.CreatedAt) || new Date(),
  }));
  const automationRows = rowsFromSheet(workbook, "Order Automation");
  const orderAutomationSetting = automationRows[0] ? {
    id: asNumber(automationRows[0].id ?? automationRows[0].ID, 1),
    morningBatchEnabled: String(automationRows[0].morningBatchEnabled ?? automationRows[0].MorningBatchEnabled).toLowerCase() === "true",
    morningBatchTime: asText(automationRows[0].morningBatchTime ?? automationRows[0].MorningBatchTime, "08:10") || "08:10",
    updatedAt: asDate(automationRows[0].updatedAt || automationRows[0].UpdatedAt) || new Date(),
  } : null;
  const orderBatchRuns = rowsFromSheet(workbook, "Order Batch Runs").map((row) => ({
    id: asUuid(row.id || row.ID),
    batchDate: asText(row.batchDate ?? row.BatchDate),
    status: asText(row.status ?? row.Status, "RUNNING") || "RUNNING",
    orderCount: asNumber(row.orderCount ?? row.OrderCount),
    sentAt: row.sentAt || row.SentAt ? asDate(row.sentAt || row.SentAt) : null,
    errorMessage: row.errorMessage ?? row.ErrorMessage ?? null,
    createdAt: asDate(row.createdAt || row.CreatedAt) || new Date(),
  }));
  const integrityRows = rowsFromSheet(workbook, "Integrity");
  const integrity = Object.fromEntries(
    integrityRows
      .filter((row) => row.key || row.Key)
      .map((row) => [String(row.key || row.Key), parseJsonCell(row.value ?? row.Value)]),
  );
  return { info, customers, transactions, kpayAliases, unverifiedKpay, auditLogs, orders, orderLines, orderCaps, orderDeliveries, orderAutomationSetting, orderBatchRuns, integrity };
}

function computeIntegrity(data) {
  const totals = new Map();
  for (const transaction of data.transactions) {
    const delta = transaction.type === "CREDIT" ? transaction.amount : -transaction.amount;
    totals.set(transaction.customerId, (totals.get(transaction.customerId) || 0) + delta);
  }
  const balanceMismatches = data.customers
    .map((customer) => {
      const storedBalance = customer.current_balance || 0;
      const recomputedBalance = totals.get(customer.id) || 0;
      return {
        customerId: customer.id,
        name: customer.name,
        storedBalance,
        recomputedBalance,
        difference: storedBalance - recomputedBalance,
      };
    })
    .filter((item) => item.difference !== 0);
  return {
    customerBalanceTotal: data.customers.reduce((sum, customer) => sum + (customer.current_balance || 0), 0),
    transactionNetBalance: data.transactions.reduce(
      (sum, transaction) => sum + (transaction.type === "CREDIT" ? transaction.amount : -transaction.amount),
      0,
    ),
    balanceMismatchCount: balanceMismatches.length,
    balanceMismatches,
  };
}

function validate(data) {
  const errors = [];
  const version = asNumber(data.info.version, 1);
  if (data.info.format !== "new-life-ledger-backup") errors.push("ဒီဖိုင်သည် New Life Ledger backup format မဟုတ်ပါ။");
  if (version > SUPPORTED_BACKUP_VERSION) errors.push(`Backup version ${version} ကို မထောက်ပံ့သေးပါ။`);

  const customerIds = new Set();
  data.customers.forEach((customer, index) => {
    if (!customer.name) errors.push(`Customers row ${index + 2}: name မရှိပါ။`);
    if (!customer.id) errors.push(`Customers row ${index + 2}: valid id မရှိပါ။`);
    if (customer.id && customerIds.has(customer.id)) errors.push(`Customers row ${index + 2}: duplicate id ဖြစ်နေပါသည်။`);
    if (customer.id) customerIds.add(customer.id);
  });

  const transactionIds = new Set();
  data.transactions.forEach((transaction, index) => {
    if (!transaction.id) errors.push(`Transactions row ${index + 2}: valid id မရှိပါ။`);
    if (transaction.id && transactionIds.has(transaction.id)) errors.push(`Transactions row ${index + 2}: duplicate id ဖြစ်နေပါသည်။`);
    if (transaction.id) transactionIds.add(transaction.id);
    if (!transaction.customerId || !customerIds.has(transaction.customerId)) errors.push(`Transactions row ${index + 2}: customerId မကိုက်ညီပါ။`);
    if (!transaction.date) errors.push(`Transactions row ${index + 2}: date မမှန်ပါ။`);
    if (transaction.type !== "CREDIT" && transaction.type !== "DEBIT") errors.push(`Transactions row ${index + 2}: type သည် CREDIT/DEBIT မဟုတ်ပါ။`);
    if (!transaction.amount || transaction.amount <= 0) errors.push(`Transactions row ${index + 2}: amount မမှန်ပါ။`);
  });

  const aliasIds = new Set();
  const aliasNames = new Set();
  data.kpayAliases.forEach((alias, index) => {
    if (!alias.id) errors.push(`KPay Aliases row ${index + 2}: valid id မရှိပါ။`);
    if (!alias.kpayName) errors.push(`KPay Aliases row ${index + 2}: kpayName မရှိပါ။`);
    if (!alias.customerId || !customerIds.has(alias.customerId)) errors.push(`KPay Aliases row ${index + 2}: customerId မကိုက်ညီပါ။`);
    if (alias.id && aliasIds.has(alias.id)) errors.push(`KPay Aliases row ${index + 2}: duplicate id ဖြစ်နေပါသည်။`);
    if (alias.kpayName && aliasNames.has(alias.kpayName)) errors.push(`KPay Aliases row ${index + 2}: duplicate kpayName ဖြစ်နေပါသည်။`);
    if (alias.id) aliasIds.add(alias.id);
    if (alias.kpayName) aliasNames.add(alias.kpayName);
  });

  const pendingIds = new Set();
  data.unverifiedKpay.forEach((item, index) => {
    if (!item.id) errors.push(`Pending KPay row ${index + 2}: valid id မရှိပါ။`);
    if (!item.raw_text) errors.push(`Pending KPay row ${index + 2}: raw_text မရှိပါ။`);
    if (!item.amount || item.amount <= 0) errors.push(`Pending KPay row ${index + 2}: amount မမှန်ပါ။`);
    if (item.suggestedCustomerId && !customerIds.has(item.suggestedCustomerId)) errors.push(`Pending KPay row ${index + 2}: suggestedCustomerId မကိုက်ညီပါ။`);
    if (item.id && pendingIds.has(item.id)) errors.push(`Pending KPay row ${index + 2}: duplicate id ဖြစ်နေပါသည်။`);
    if (item.id) pendingIds.add(item.id);
  });

  const auditIds = new Set();
  data.auditLogs.forEach((audit, index) => {
    if (!audit.id) errors.push(`Audit History row ${index + 2}: valid id မရှိပါ။`);
    if (!audit.summary) errors.push(`Audit History row ${index + 2}: summary မရှိပါ။`);
    if (audit.id && auditIds.has(audit.id)) errors.push(`Audit History row ${index + 2}: duplicate id ဖြစ်နေပါသည်။`);
    if (audit.id) auditIds.add(audit.id);
  });

  const orderIds = new Set();
  const orderSourceUpdateIds = new Set();
  data.orders.forEach((order, index) => {
    if (!order.id) errors.push(`Orders row ${index + 2}: valid id မရှိပါ။`);
    if (!order.sourceText) errors.push(`Orders row ${index + 2}: sourceText မရှိပါ။`);
    if (order.id && orderIds.has(order.id)) errors.push(`Orders row ${index + 2}: duplicate id ဖြစ်နေပါသည်။`);
    if (order.id) orderIds.add(order.id);
    if (order.sourceUpdateId && orderSourceUpdateIds.has(order.sourceUpdateId)) errors.push(`Orders row ${index + 2}: duplicate sourceUpdateId ဖြစ်နေပါသည်။`);
    if (order.sourceUpdateId) orderSourceUpdateIds.add(order.sourceUpdateId);
    if (order.customerId && !customerIds.has(order.customerId)) errors.push(`Orders row ${index + 2}: customerId မကိုက်ညီပါ။`);
    if (!['DRAFT', 'NEEDS_CUSTOMER', 'NEEDS_REVIEW', 'CONFIRMED', 'BATCH_QUEUED', 'FACTORY_NOTIFIED', 'PREPARED', 'COMPLETED', 'CANCELLED'].includes(order.status)) errors.push(`Orders row ${index + 2}: status မမှန်ကန်ပါ။`);
  });

  const orderLineIds = new Set();
  data.orderLines.forEach((line, index) => {
    if (!line.id || !line.orderId || !orderIds.has(line.orderId)) errors.push(`Order Lines row ${index + 2}: id/orderId မမှန်ပါ။`);
    if (line.id && orderLineIds.has(line.id)) errors.push(`Order Lines row ${index + 2}: duplicate id ဖြစ်နေပါသည်။`);
    if (line.id) orderLineIds.add(line.id);
    if (!line.lineNumber || line.lineNumber < 1) errors.push(`Order Lines row ${index + 2}: lineNumber မမှန်ပါ။`);
  });

  const orderCapIds = new Set();
  data.orderCaps.forEach((cap, index) => {
    if (!cap.id || !cap.orderId || !orderIds.has(cap.orderId) || !cap.capType) errors.push(`Order Caps row ${index + 2}: id/orderId/capType မမှန်ပါ။`);
    if (cap.id && orderCapIds.has(cap.id)) errors.push(`Order Caps row ${index + 2}: duplicate id ဖြစ်နေပါသည်။`);
    if (cap.id) orderCapIds.add(cap.id);
  });

  const orderDeliveryIds = new Set();
  data.orderDeliveries.forEach((delivery, index) => {
    if (!delivery.id || !delivery.orderId || !orderIds.has(delivery.orderId) || !delivery.destinationType || !delivery.mode) errors.push(`Order Deliveries row ${index + 2}: id/orderId/destination/mode မမှန်ပါ။`);
    if (delivery.id && orderDeliveryIds.has(delivery.id)) errors.push(`Order Deliveries row ${index + 2}: duplicate id ဖြစ်နေပါသည်။`);
    if (delivery.id) orderDeliveryIds.add(delivery.id);
  });

  const batchDates = new Set();
  data.orderBatchRuns.forEach((run, index) => {
    if (!run.id || !run.batchDate) errors.push(`Order Batch Runs row ${index + 2}: id/batchDate မမှန်ပါ။`);
    if (run.batchDate && batchDates.has(run.batchDate)) errors.push(`Order Batch Runs row ${index + 2}: duplicate batchDate ဖြစ်နေပါသည်။`);
    if (run.batchDate) batchDates.add(run.batchDate);
  });

  return errors.slice(0, 100);
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
  return { mode, data: normalize(workbook), sheetNames: workbook.SheetNames };
}

function keyForCustomer(customer) {
  return `${customer.name.trim().toLowerCase()}|${customer.phone || ""}`;
}

function keyForOrderMessage(order) {
  if (order?.sourceChatId == null || order?.sourceMessageId == null || String(order.sourceChatId).trim() === "" || String(order.sourceMessageId).trim() === "") return null;
  return `${String(order.sourceChatId)}|${String(order.sourceMessageId)}`;
}

export async function POST(request) {
  try {
    await ensureDatabase();
    const { mode, data, sheetNames } = await parseRequest(request);
    const errors = validate(data);
    if (errors.length) return NextResponse.json({ error: "Backup validation မအောင်မြင်ပါ။", details: errors }, { status: 400 });

    const sourceIntegrity = computeIntegrity(data);
    const declaredDifference = data.integrity.totalDifference == null ? null : asNumber(data.integrity.totalDifference, null);
    const integrityWarnings = [];
    if (sourceIntegrity.balanceMismatchCount > 0) {
      integrityWarnings.push(`Customer ${sourceIntegrity.balanceMismatchCount} ယောက်၏ stored balance နှင့် ledger balance မကိုက်ညီပါ။`);
    }
    if (declaredDifference !== null && declaredDifference !== sourceIntegrity.customerBalanceTotal - sourceIntegrity.transactionNetBalance) {
      integrityWarnings.push("Backup Integrity sheet ၏ totalDifference နှင့် raw rows တွက်ချက်မှု မကိုက်ညီပါ။");
    }
    if (mode === "confirm" && integrityWarnings.length) {
      return NextResponse.json({
        error: "Backup integrity မအောင်မြင်သောကြောင့် restore ကို ရပ်ထားပါသည်။ Preview တွင် warning ကိုစစ်ပြီး source backup ကို ပြန်ထုတ်ပါ။",
        details: integrityWarnings,
        data: { sourceIntegrity, integrityWarnings },
      }, { status: 409 });
    }

    const [existingCustomers, existingTransactions, existingAliases, existingPendingKpay, existingAuditLogs, existingOrders, existingOrderLines, existingOrderCaps, existingOrderDeliveries, existingAutomationSetting, existingBatchRuns] = await Promise.all([
      prisma.customer.findMany({ select: { id: true, name: true, phone: true } }),
      prisma.ledger.findMany({ select: { id: true } }),
      prisma.kpayAlias.findMany({ select: { id: true, kpayName: true } }),
      prisma.unverifiedKpay.findMany({ select: { id: true } }),
      prisma.auditLog.findMany({ select: { id: true } }),
      prisma.order.findMany({ select: { id: true, sourceChatId: true, sourceMessageId: true, sourceUpdateId: true } }),
      prisma.orderLine.findMany({ select: { id: true } }),
      prisma.orderCap.findMany({ select: { id: true } }),
      prisma.orderDelivery.findMany({ select: { id: true } }),
      prisma.orderAutomationSetting.findUnique({ where: { id: 1 }, select: { id: true } }),
      prisma.orderBatchRun.findMany({ select: { id: true, batchDate: true } }),
    ]);

    const existingCustomerIds = new Set(existingCustomers.map((item) => item.id));
    const existingCustomerByKey = new Map(existingCustomers.map((item) => [keyForCustomer(item), item.id]));
    const customerIdMap = new Map();
    const toCreateCustomers = [];
    for (const customer of data.customers) {
      const sameId = existingCustomerIds.has(customer.id) ? customer.id : null;
      const sameIdentity = existingCustomerByKey.get(keyForCustomer(customer)) || null;
      const targetId = sameId || sameIdentity || customer.id;
      customerIdMap.set(customer.id, targetId);
      if (!sameId && !sameIdentity) toCreateCustomers.push(customer);
    }

    const existingTransactionIds = new Set(existingTransactions.map((item) => item.id));
    const existingAliasIds = new Set(existingAliases.map((item) => item.id));
    const existingAliasNames = new Set(existingAliases.map((item) => item.kpayName));
    const existingPendingIds = new Set(existingPendingKpay.map((item) => item.id));
    const existingAuditIds = new Set(existingAuditLogs.map((item) => item.id));
    const existingOrderIds = new Set(existingOrders.map((item) => item.id));
    const existingOrderSourceUpdateIds = new Set(existingOrders.map((item) => item.sourceUpdateId).filter(Boolean));
    const existingOrderMessageKeys = new Set(existingOrders.map(keyForOrderMessage).filter(Boolean));
    const existingOrderLineIds = new Set(existingOrderLines.map((item) => item.id));
    const existingOrderCapIds = new Set(existingOrderCaps.map((item) => item.id));
    const existingOrderDeliveryIds = new Set(existingOrderDeliveries.map((item) => item.id));
    const existingBatchRunIds = new Set(existingBatchRuns.map((item) => item.id));
    const existingBatchDates = new Set(existingBatchRuns.map((item) => item.batchDate));

    const toCreateOrders = data.orders
      .filter((item) => item.id && !existingOrderIds.has(item.id) && !(item.sourceUpdateId && existingOrderSourceUpdateIds.has(item.sourceUpdateId)) && !(keyForOrderMessage(item) && existingOrderMessageKeys.has(keyForOrderMessage(item))))
      .map((item) => ({ ...item, customerId: item.customerId ? (customerIdMap.get(item.customerId) || item.customerId) : null }));
    const importOrderIds = new Set(toCreateOrders.map((item) => item.id));
    const toCreateOrderLines = data.orderLines.filter((item) => item.id && importOrderIds.has(item.orderId) && !existingOrderLineIds.has(item.id));
    const toCreateOrderCaps = data.orderCaps.filter((item) => item.id && importOrderIds.has(item.orderId) && !existingOrderCapIds.has(item.id));
    const toCreateOrderDeliveries = data.orderDeliveries.filter((item) => item.id && importOrderIds.has(item.orderId) && !existingOrderDeliveryIds.has(item.id));
    const toCreateAutomationSetting = data.orderAutomationSetting && !existingAutomationSetting ? data.orderAutomationSetting : null;
    const toCreateBatchRuns = data.orderBatchRuns.filter((item) => item.id && item.batchDate && !existingBatchRunIds.has(item.id) && !existingBatchDates.has(item.batchDate));

    const toCreateTransactions = data.transactions
      .filter((item) => item.id && !existingTransactionIds.has(item.id))
      .map((item) => ({ ...item, customerId: customerIdMap.get(item.customerId) || item.customerId }));
    const toCreateAliases = data.kpayAliases
      .filter((item) => item.id && !existingAliasIds.has(item.id) && !existingAliasNames.has(item.kpayName))
      .map((item) => ({ ...item, customerId: customerIdMap.get(item.customerId) || item.customerId }));
    const aliasConflicts = data.kpayAliases.filter((item) => existingAliasNames.has(item.kpayName) && !existingAliasIds.has(item.id));
    const toCreatePendingKpay = data.unverifiedKpay
      .filter((item) => item.id && !existingPendingIds.has(item.id))
      .map((item) => ({ ...item, suggestedCustomerId: item.suggestedCustomerId ? (customerIdMap.get(item.suggestedCustomerId) || item.suggestedCustomerId) : null }));
    const toCreateAudits = data.auditLogs.filter((item) => item.id && !existingAuditIds.has(item.id));

    const customerIdsToRecalculate = [...new Set(data.customers.map((customer) => customerIdMap.get(customer.id) || customer.id))];
    const summary = {
      mode,
      backupInfo: data.info,
      sheets: sheetNames,
      sourceCounts: {
        customers: data.customers.length,
        transactions: data.transactions.length,
        kpayAliases: data.kpayAliases.length,
        unverifiedKpay: data.unverifiedKpay.length,
        auditLogs: data.auditLogs.length,
        orders: data.orders.length,
        orderLines: data.orderLines.length,
        orderCaps: data.orderCaps.length,
        orderDeliveries: data.orderDeliveries.length,
        orderBatchRuns: data.orderBatchRuns.length,
        orderAutomationSetting: data.orderAutomationSetting ? 1 : 0,
      },
      willAdd: {
        customers: toCreateCustomers.length,
        transactions: toCreateTransactions.length,
        kpayAliases: toCreateAliases.length,
        unverifiedKpay: toCreatePendingKpay.length,
        auditLogs: toCreateAudits.length,
        orders: toCreateOrders.length,
        orderLines: toCreateOrderLines.length,
        orderCaps: toCreateOrderCaps.length,
        orderDeliveries: toCreateOrderDeliveries.length,
        orderBatchRuns: toCreateBatchRuns.length,
        orderAutomationSetting: toCreateAutomationSetting ? 1 : 0,
      },
      willSkip: {
        customers: data.customers.length - toCreateCustomers.length,
        transactions: data.transactions.length - toCreateTransactions.length,
        kpayAliases: data.kpayAliases.length - toCreateAliases.length,
        unverifiedKpay: data.unverifiedKpay.length - toCreatePendingKpay.length,
        auditLogs: data.auditLogs.length - toCreateAudits.length,
        orders: data.orders.length - toCreateOrders.length,
        orderLines: data.orderLines.length - toCreateOrderLines.length,
        orderCaps: data.orderCaps.length - toCreateOrderCaps.length,
        orderDeliveries: data.orderDeliveries.length - toCreateOrderDeliveries.length,
        orderBatchRuns: data.orderBatchRuns.length - toCreateBatchRuns.length,
        orderAutomationSetting: data.orderAutomationSetting && !toCreateAutomationSetting ? 1 : 0,
      },
      identityMappedCustomers: data.customers.filter((customer) => {
        const mappedId = customerIdMap.get(customer.id);
        return mappedId && mappedId !== customer.id;
      }).length,
      aliasConflicts: aliasConflicts.map((item) => ({ id: item.id, kpayName: item.kpayName })),
      balanceRecalculation: {
        customers: customerIdsToRecalculate.length,
        sourceIntegrity,
        policy: "After import, each affected customer balance is recalculated from all Ledger rows; no customer is deleted.",
      },
      integrityWarnings,
      policy: "Entities are add-only and duplicate IDs are skipped; customer balances are recalculated from the authoritative Ledger after import.",
    };

    if (mode === "preview") return NextResponse.json({ data: summary });

    const result = await prisma.$transaction(async (tx) => {
      let addedCustomers = 0;
      let addedTransactions = 0;
      let addedAliases = 0;
      let addedPendingKpay = 0;
      let addedAuditLogs = 0;
      let addedOrders = 0;
      let addedOrderLines = 0;
      let addedOrderCaps = 0;
      let addedOrderDeliveries = 0;
      let addedBatchRuns = 0;
      let addedAutomationSetting = 0;
      let correctedBalances = 0;
      const balanceCorrections = [];

      for (const customer of toCreateCustomers) {
        await tx.customer.create({ data: customer });
        addedCustomers += 1;
      }
      for (const alias of toCreateAliases) {
        const customerExists = await tx.customer.findUnique({ where: { id: alias.customerId }, select: { id: true } });
        if (!customerExists) continue;
        await tx.kpayAlias.create({ data: alias });
        addedAliases += 1;
      }
      for (const transaction of toCreateTransactions) {
        const customerExists = await tx.customer.findUnique({ where: { id: transaction.customerId }, select: { id: true } });
        if (!customerExists) continue;
        await tx.ledger.create({ data: transaction });
        addedTransactions += 1;
      }
      for (const item of toCreatePendingKpay) {
        if (item.suggestedCustomerId) {
          const customerExists = await tx.customer.findUnique({ where: { id: item.suggestedCustomerId }, select: { id: true } });
          if (!customerExists) item.suggestedCustomerId = null;
        }
        await tx.unverifiedKpay.create({ data: item });
        addedPendingKpay += 1;
      }
      for (const auditLog of toCreateAudits) {
        await tx.auditLog.create({ data: auditLog });
        addedAuditLogs += 1;
      }
      for (const order of toCreateOrders) {
        const customerExists = order.customerId ? await tx.customer.findUnique({ where: { id: order.customerId }, select: { id: true } }) : null;
        if (order.customerId && !customerExists) continue;
        await tx.order.create({ data: order });
        addedOrders += 1;
      }
      for (const line of toCreateOrderLines) {
        const orderExists = await tx.order.findUnique({ where: { id: line.orderId }, select: { id: true } });
        if (!orderExists) continue;
        await tx.orderLine.create({ data: line });
        addedOrderLines += 1;
      }
      for (const cap of toCreateOrderCaps) {
        const orderExists = await tx.order.findUnique({ where: { id: cap.orderId }, select: { id: true } });
        if (!orderExists) continue;
        await tx.orderCap.create({ data: cap });
        addedOrderCaps += 1;
      }
      for (const delivery of toCreateOrderDeliveries) {
        const orderExists = await tx.order.findUnique({ where: { id: delivery.orderId }, select: { id: true } });
        if (!orderExists) continue;
        await tx.orderDelivery.create({ data: delivery });
        addedOrderDeliveries += 1;
      }
      if (toCreateAutomationSetting) {
        await tx.orderAutomationSetting.create({ data: toCreateAutomationSetting });
        addedAutomationSetting += 1;
      }
      for (const batchRun of toCreateBatchRuns) {
        await tx.orderBatchRun.create({ data: batchRun });
        addedBatchRuns += 1;
      }

      for (const customerId of customerIdsToRecalculate) {
        const [customer, ledgerRows] = await Promise.all([
          tx.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, current_balance: true } }),
          tx.ledger.findMany({ where: { customerId }, select: { type: true, amount: true } }),
        ]);
        if (!customer) continue;
        const recomputedBalance = ledgerRows.reduce((sum, row) => sum + (row.type === "CREDIT" ? row.amount : -row.amount), 0);
        if (customer.current_balance !== recomputedBalance) {
          await tx.customer.update({ where: { id: customerId }, data: { current_balance: recomputedBalance } });
          correctedBalances += 1;
          balanceCorrections.push({ customerId, name: customer.name, before: customer.current_balance, after: recomputedBalance });
        }
      }

      await writeAuditLog({
        db: tx,
        actorName: getActorName(request),
        action: "IMPORT",
        entityType: "Backup",
        summary: `Backup restore: customer ${addedCustomers}, transaction ${addedTransactions}, KPay ${addedAliases + addedPendingKpay}, order ${addedOrders}`,
        metadata: {
          sourceCounts: summary.sourceCounts,
          added: { addedCustomers, addedTransactions, addedAliases, addedPendingKpay, addedAuditLogs, addedOrders, addedOrderLines, addedOrderCaps, addedOrderDeliveries, addedAutomationSetting, addedBatchRuns },
          correctedBalances,
          balanceCorrections,
          aliasConflicts: summary.aliasConflicts,
        },
      });
      return { addedCustomers, addedTransactions, addedAliases, addedPendingKpay, addedAuditLogs, addedOrders, addedOrderLines, addedOrderCaps, addedOrderDeliveries, addedAutomationSetting, addedBatchRuns, correctedBalances, balanceCorrections };
    });

    return NextResponse.json({ data: { ...summary, result } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
