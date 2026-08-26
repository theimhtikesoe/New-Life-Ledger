import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { getMyanmarDateInputValue } from "@/lib/myanmar-time";
import {
  calculateCapWarnings,
  calculateMissingStatus,
  calculateOrderTotals,
  normalizeExtractedOrder,
  normalizeDateInput,
} from "@/lib/order-utils";

export const ORDER_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true, routeTag: true, deletedAt: true } },
  lines: { orderBy: [{ lineNumber: "asc" }, { id: "asc" }] },
  caps: { orderBy: [{ capType: "asc" }, { id: "asc" }] },
  deliveries: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
};

function normalizeName(value) {
  return String(value || "").normalize("NFC").replace(/\s+/g, "").toLocaleLowerCase("my-MM");
}

function customerNameKeys(value) {
  const normalized = normalizeName(value);
  if (!normalized) return [];
  const withoutParenthetical = normalized.replace(/\([^)]*\)/g, "");
  const base = normalized.replace(/[()\[\]{}]/g, "");
  return Array.from(new Set([normalized, withoutParenthetical, base].map((item) => item.trim()).filter(Boolean)));
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d၀-၉+]/g, "").replace(/[၀-၉]/g, (digit) => String("၀၁၂၃၄၅၆၇၈၉".indexOf(digit))).replace(/^\+95/, "0");
}

function normalizeMissingFields(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function removeCustomerMissingFields(value) {
  return normalizeMissingFields(value).filter((item) => !/^(?:Customer|ဖောက်သည်)/iu.test(item));
}

function serializeOrder(order) {
  if (!order) return null;
  const lines = (order.lines || []).map((line) => ({
    ...line,
    capacityMl: line.capacityMl == null ? null : Number(line.capacityMl),
    bottlesPerCard: line.bottlesPerCard == null ? null : Number(line.bottlesPerCard),
    cardCount: line.cardCount == null ? null : Number(line.cardCount),
    totalBottles: line.totalBottles == null ? null : Number(line.totalBottles),
    quotedRate: line.quotedRate == null ? null : Number(line.quotedRate),
    quotedAmount: line.quotedAmount == null ? null : Number(line.quotedAmount),
  }));
  const caps = (order.caps || []).map((cap) => ({
    ...cap,
    normalPcs: Number(cap.normalPcs || 0),
    extraPcs: Number(cap.extraPcs || 0),
    requestedTotalPcs: Number(cap.requestedTotalPcs || 0),
    expectedPcs: cap.expectedPcs == null ? null : Number(cap.expectedPcs),
  }));
  const normalized = {
    ...order,
    missingFields: normalizeMissingFields(order.missingFields),
    lines,
    caps,
    customer: order.customer?.deletedAt ? null : order.customer,
    isArchived: Boolean(order.archivedAt),
  };
  return {
    ...normalized,
    totals: calculateOrderTotals(normalized),
    capWarnings: calculateCapWarnings(normalized).filter((cap) => cap.warningText),
  };
}

async function findCustomerMatch({ name, phone }) {
  const trimmedName = String(name || "").trim();
  const trimmedPhone = String(phone || "").trim();
  if (!trimmedName && !trimmedPhone) return { customer: null, candidates: [] };
  const nameKeys = customerNameKeys(trimmedName);
  const nameSearchTerms = Array.from(new Set([trimmedName, nameKeys[0], Array.from(trimmedName).slice(0, 1).join("")].filter(Boolean)));
  const candidates = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      OR: [
        ...nameSearchTerms.flatMap((term) => [
          { name: { equals: term, mode: "insensitive" } },
          { name: { contains: term, mode: "insensitive" } },
        ]),
        ...(trimmedPhone ? [{ phone: { contains: trimmedPhone, mode: "insensitive" } }] : []),
      ],
    },
    select: { id: true, name: true, phone: true, routeTag: true, deletedAt: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 50,
  });
  const normalizedInputPhone = normalizePhone(trimmedPhone);
  const exactMatches = candidates.filter((candidate) => {
    const candidateNameKeys = customerNameKeys(candidate.name);
    const nameMatch = nameKeys.length > 0 && nameKeys.some((key) => candidateNameKeys.includes(key));
    const phoneMatch = normalizedInputPhone && normalizePhone(candidate.phone) === normalizedInputPhone;
    return nameMatch || phoneMatch;
  });
  return { customer: exactMatches.length === 1 ? exactMatches[0] : null, candidates };
}

function mergeCaps(caps) {
  const merged = new Map();
  for (const cap of caps || []) {
    const capType = String(cap.capType || "အဖုံး မသတ်မှတ်ရသေး").trim();
    const current = merged.get(capType) || { capType, normalPcs: 0, extraPcs: 0, notes: [] };
    current.normalPcs += Number(cap.normalPcs || 0);
    current.extraPcs += Number(cap.extraPcs || 0);
    if (cap.notes) current.notes.push(String(cap.notes).trim());
    merged.set(capType, current);
  }
  return Array.from(merged.values()).map((cap) => ({
    ...cap,
    requestedTotalPcs: cap.normalPcs + cap.extraPcs,
    notes: cap.notes.join("; ") || null,
  }));
}

export async function createOrderDraft({
  sourceChatId = null,
  sourceMessageId = null,
  sourceUpdateId = null,
  sourceText,
  source = "telegram",
  extracted,
} = {}) {
  if (!String(sourceText || "").trim()) throw new Error("Order စာသား မရှိသေးပါ။");
  await ensureDatabase();

  const hasSourceUpdateId = sourceUpdateId !== null && sourceUpdateId !== undefined && String(sourceUpdateId).trim() !== "";
  const hasSourceMessageKey = sourceChatId !== null && sourceChatId !== undefined && sourceMessageId !== null && sourceMessageId !== undefined && String(sourceChatId).trim() !== "" && String(sourceMessageId).trim() !== "";
  const existing = hasSourceUpdateId
    ? await prisma.order.findUnique({ where: { sourceUpdateId: String(sourceUpdateId) }, include: ORDER_INCLUDE })
    : hasSourceMessageKey
      ? await prisma.order.findUnique({ where: { sourceChatId_sourceMessageId: { sourceChatId: String(sourceChatId), sourceMessageId: String(sourceMessageId) } }, include: ORDER_INCLUDE })
      : null;
  if (existing) return { order: serializeOrder(existing), duplicate: true };

  const normalized = normalizeExtractedOrder(extracted, sourceText);
  const { customer, candidates } = await findCustomerMatch({ name: normalized.customerName, phone: normalized.customerPhone });
  const mergedCaps = mergeCaps(normalized.caps);
  const withWarnings = { ...normalized, caps: mergedCaps };
  const capWarnings = calculateCapWarnings(withWarnings);
  const status = customer ? calculateMissingStatus({ ...normalized, customerId: customer.id }) : "NEEDS_CUSTOMER";

  let created;
  try {
    created = await prisma.order.create({
    data: {
      status,
      requestedDate: normalized.requestedDate || "",
      sourceChatId: sourceChatId == null ? null : String(sourceChatId),
      sourceMessageId: sourceMessageId == null ? null : String(sourceMessageId),
      sourceUpdateId: sourceUpdateId == null ? null : String(sourceUpdateId),
      sourceText: String(sourceText).slice(0, 12000),
      customerId: customer?.id || null,
      draftCustomerName: customer ? null : normalized.customerName,
      draftCustomerPhone: customer ? null : normalized.customerPhone,
      customerPhone: normalized.customerPhone,
      missingFields: normalized.missingFields,
      aiConfidence: normalized.confidence,
      aiNotes: normalized.notes,
      destination: normalized.destination,
      paymentType: normalized.paymentType,
      paymentNote: normalized.paymentNote,
      receiptNote: normalized.receiptNote,
      notificationMode: "IMMEDIATE",
      lines: {
        create: normalized.lines.map((line, index) => ({
          lineNumber: index + 1,
          bottleType: line.bottleType,
          capacityMl: line.capacityMl,
          capacityLabel: line.capacityLabel,
          bottlesPerCard: line.bottlesPerCard,
          cardCount: line.cardCount,
          totalBottles: line.totalBottles,
          quotedRate: line.quotedRate,
          quotedAmount: line.quotedAmount,
          notes: line.notes,
        })),
      },
      caps: {
        create: capWarnings.map((cap) => ({
          capType: cap.capType,
          normalPcs: cap.normalPcs,
          extraPcs: cap.extraPcs,
          requestedTotalPcs: cap.requestedTotalPcs,
          expectedPcs: cap.expectedPcs,
          warningText: cap.warningText,
          notes: cap.notes,
        })),
      },
    },
    include: ORDER_INCLUDE,
    });
  } catch (error) {
    if (error?.code === "P2002" && (hasSourceUpdateId || hasSourceMessageKey)) {
      const duplicate = hasSourceUpdateId
        ? await prisma.order.findUnique({ where: { sourceUpdateId: String(sourceUpdateId) }, include: ORDER_INCLUDE })
        : await prisma.order.findUnique({ where: { sourceChatId_sourceMessageId: { sourceChatId: String(sourceChatId), sourceMessageId: String(sourceMessageId) } }, include: ORDER_INCLUDE });
      if (duplicate) return { order: serializeOrder(duplicate), duplicate: true };
    }
    throw error;
  }

  const normalizedSource = String(source || "telegram").trim().toLowerCase();
  const sourceLabel = normalizedSource === "viber" ? "Viber" : normalizedSource === "telegram" ? "Telegram" : "Manual";
  await writeAuditLog({
    actorName: "Staff",
    action: "ORDER_DRAFT",
    entityType: "Order",
    entityId: created.id,
    entityLabel: normalized.customerName || "Customer မသတ်မှတ်ရသေး",
    summary: `${sourceLabel} order Draft ဖန်တီး`,
    metadata: {
      source: normalizedSource,
      sourceChatId: sourceChatId == null ? null : String(sourceChatId),
      sourceMessageId: sourceMessageId == null ? null : String(sourceMessageId),
      lineCount: normalized.lines.length,
      capCount: mergedCaps.length,
      candidateCount: candidates.length,
      matchedCustomer: Boolean(customer),
    },
  });

  return { order: serializeOrder(created), duplicate: false };
}

export async function refreshOrderFromAi({ orderId, extracted, actorName = "Staff" } = {}) {
  await ensureDatabase();
  const current = await prisma.order.findUnique({ where: { id: String(orderId) }, include: ORDER_INCLUDE });
  if (!current) throw new Error("Order မတွေ့ပါ။");
  if (current.archivedAt) throw new Error("Archive လုပ်ပြီး Order ကို AI ဖြင့် ပြန်မစစ်နိုင်ပါ။ အရင် Restore လုပ်ပါ။");
  if (["CONFIRMED", "BATCH_QUEUED", "FACTORY_NOTIFIED", "PREPARED", "COMPLETED", "CANCELLED"].includes(current.status)) {
    throw new Error("ဒီ Order status မှာ AI ဖြင့် ပြန်စစ်၍မရပါ။");
  }

  const initial = normalizeExtractedOrder(extracted, current.sourceText);
  const existingCustomer = current.customer?.deletedAt ? null : current.customer;
  const normalized = normalizeExtractedOrder({
    ...extracted,
    customerName: initial.customerName || existingCustomer?.name || current.draftCustomerName,
    customerPhone: initial.customerPhone || current.customerPhone,
    requestedDate: initial.requestedDate || current.requestedDate,
    destination: initial.destination || current.destination,
    lines: initial.lines.length ? initial.lines : current.lines || [],
    caps: initial.caps.length ? initial.caps : current.caps || [],
    missingFields: [],
    notes: initial.notes || current.aiNotes,
  }, current.sourceText);
  const { customer: matchedCustomer, candidates } = await findCustomerMatch({ name: normalized.customerName, phone: normalized.customerPhone });
  const customer = matchedCustomer || existingCustomer;
  const mergedCaps = mergeCaps(normalized.caps);
  const withWarnings = { ...normalized, caps: mergedCaps };
  const capWarnings = calculateCapWarnings(withWarnings);
  const status = customer ? calculateMissingStatus({ ...normalized, customerId: customer.id }) : "NEEDS_CUSTOMER";

  const updated = await prisma.$transaction(async (tx) => {
    await tx.orderLine.deleteMany({ where: { orderId: current.id } });
    await tx.orderCap.deleteMany({ where: { orderId: current.id } });
    return tx.order.update({
      where: { id: current.id },
      data: {
        status,
        requestedDate: normalized.requestedDate || "",
        customerId: customer?.id || null,
        draftCustomerName: customer ? null : normalized.customerName,
        draftCustomerPhone: customer ? null : normalized.customerPhone,
        customerPhone: normalized.customerPhone,
        missingFields: normalized.missingFields,
        aiConfidence: normalized.confidence,
        aiNotes: normalized.notes,
        destination: normalized.destination,
        paymentType: normalized.paymentType,
        paymentNote: normalized.paymentNote,
        receiptNote: normalized.receiptNote,
        lines: { create: normalized.lines.map((line, index) => ({
          lineNumber: index + 1,
          bottleType: line.bottleType,
          capacityMl: line.capacityMl,
          capacityLabel: line.capacityLabel,
          bottlesPerCard: line.bottlesPerCard,
          cardCount: line.cardCount,
          totalBottles: line.totalBottles,
          quotedRate: line.quotedRate,
          quotedAmount: line.quotedAmount,
          notes: line.notes,
        })) },
        caps: { create: capWarnings.map((cap) => ({
          capType: cap.capType,
          normalPcs: cap.normalPcs,
          extraPcs: cap.extraPcs,
          requestedTotalPcs: cap.requestedTotalPcs,
          expectedPcs: cap.expectedPcs,
          warningText: cap.warningText,
          notes: cap.notes,
        })) },
      },
      include: ORDER_INCLUDE,
    });
  });

  await writeAuditLog({
    actorName,
    action: "ORDER_AI_RETRY",
    entityType: "Order",
    entityId: updated.id,
    entityLabel: updated.customer?.name || updated.draftCustomerName || "Order",
    summary: "Order ကို AI ဖြင့် ပြန်စစ်",
    metadata: { candidateCount: candidates.length, matchedCustomer: Boolean(customer) },
  });
  return serializeOrder(updated);
}

async function withCancelledAuditDates(orders) {
  const cancelledOrders = orders.filter((order) => order.status === "CANCELLED" && !order.cancelledAt);
  if (!cancelledOrders.length) return orders;
  const logs = await prisma.auditLog.findMany({
    where: { entityType: "Order", action: "ORDER_CANCEL", entityId: { in: cancelledOrders.map((order) => String(order.id)) } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { entityId: true, actorName: true, createdAt: true },
  });
  const latestByOrder = new Map();
  logs.forEach((log) => { if (log.entityId && !latestByOrder.has(String(log.entityId))) latestByOrder.set(String(log.entityId), log); });
  return orders.map((order) => {
    const fallback = latestByOrder.get(String(order.id));
    return fallback ? { ...order, cancelledAt: fallback.createdAt, cancelledBy: fallback.actorName, cancelledDateSource: "audit" } : order;
  });
}

export async function listOrders({ status = null, includeArchived = false, archivedOnly = false, view = "active", limit = 100 } = {}) {
  await ensureDatabase();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const normalizedView = ["active", "history", "trash"].includes(view) ? view : "active";
  const where = {};
  if (normalizedView === "trash") {
    if (status === "CANCELLED") where.status = "CANCELLED";
    else where.OR = [
      { status: "CANCELLED", historyTrashedAt: null },
      { historyTrashedAt: { not: null } },
    ];
  } else if (status === "CANCELLED") {
    where.status = "CANCELLED";
    where.historyTrashedAt = null;
  } else if (normalizedView === "history") {
    where.status = status || { not: "CANCELLED" };
    where.archivedAt = { not: null };
    where.historyTrashedAt = null;
  } else if (archivedOnly) {
    where.archivedAt = { not: null };
    where.historyTrashedAt = null;
    where.status = status || { not: "CANCELLED" };
  } else if (includeArchived) {
    where.status = status || { not: "CANCELLED" };
    where.historyTrashedAt = null;
  } else {
    where.archivedAt = null;
    where.historyTrashedAt = null;
    where.status = status || { not: "CANCELLED" };
  }
  const orders = await prisma.order.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: safeLimit,
    include: ORDER_INCLUDE,
  });
  return withCancelledAuditDates(orders.map(serializeOrder));
}

export async function getOrderById(id) {
  await ensureDatabase();
  const order = await prisma.order.findUnique({ where: { id: String(id) }, include: ORDER_INCLUDE });
  return serializeOrder(order);
}

export async function getOrderBySourceUpdateId(sourceUpdateId) {
  if (sourceUpdateId === null || sourceUpdateId === undefined || String(sourceUpdateId).trim() === "") return null;
  await ensureDatabase();
  const order = await prisma.order.findUnique({ where: { sourceUpdateId: String(sourceUpdateId) }, include: ORDER_INCLUDE });
  return serializeOrder(order);
}

export async function saveTelegramDraftMessage({ orderId, chatId, messageId } = {}) {
  await ensureDatabase();
  const normalizedChatId = String(chatId || "").trim();
  const normalizedMessageId = String(messageId || "").trim();
  if (!orderId || !normalizedChatId || !normalizedMessageId) return null;
  const current = await prisma.order.findUnique({ where: { id: String(orderId) }, include: ORDER_INCLUDE });
  if (!current) return null;
  if (current.telegramDraftChatId && current.telegramDraftMessageId) return serializeOrder(current);
  const updated = await prisma.order.update({
    where: { id: current.id },
    data: { telegramDraftChatId: normalizedChatId, telegramDraftMessageId: normalizedMessageId },
    include: ORDER_INCLUDE,
  });
  return serializeOrder(updated);
}

export async function archiveOrder({ orderId, actorName = "Staff" } = {}) {
  await ensureDatabase();
  const current = await prisma.order.findUnique({ where: { id: String(orderId) }, include: ORDER_INCLUDE });
  if (!current) throw new Error("Order မတွေ့ပါ။");
  if (current.archivedAt) return serializeOrder(current);
  if (!["FACTORY_NOTIFIED", "PREPARED", "COMPLETED"].includes(current.status)) {
    throw new Error("Active သို့မဟုတ် ပို့ရန်စောင့်နေသော Order ကို တိုက်ရိုက်ဖျက်၍မရပါ။ အရင် Cancel လုပ်ပြီးမှ Archive လုပ်ပါ။");
  }
  const archived = await prisma.order.update({
    where: { id: current.id },
    data: { archivedAt: new Date(), archivedBy: actorName },
    include: ORDER_INCLUDE,
  });
  await writeAuditLog({
    actorName,
    action: "ORDER_ARCHIVE",
    entityType: "Order",
    entityId: archived.id,
    entityLabel: archived.customer?.name || archived.draftCustomerName || "Order",
    summary: "Order ကို History ထဲ Archive လုပ်ပြီး",
    metadata: { previousStatus: current.status },
  });
  return serializeOrder(archived);
}

export async function archiveExpiredOrders({ actorName = "System", now = new Date() } = {}) {
  await ensureDatabase();
  const today = getMyanmarDateInputValue(now);
  const candidates = (await prisma.order.findMany({
    where: {
      archivedAt: null,
      historyTrashedAt: null,
      status: { not: "CANCELLED" },
      requestedDate: { not: "", lt: today },
    },
    select: { id: true, status: true, requestedDate: true, customer: { select: { name: true } }, draftCustomerName: true },
    orderBy: [{ requestedDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  })).filter((order) => normalizeDateInput(order.requestedDate) === order.requestedDate && order.requestedDate < today);
  if (!candidates.length) return { archivedCount: 0, skippedCount: 0, cutoffDate: today };
  let archivedCount = 0;
  await prisma.$transaction(async (tx) => {
    for (const order of candidates) {
      const archived = await tx.order.updateMany({
        where: { id: order.id, archivedAt: null, historyTrashedAt: null, status: { not: "CANCELLED" } },
        data: { archivedAt: now, archivedBy: actorName },
      });
      if (!archived.count) continue;
      archivedCount += archived.count;
      await writeAuditLog({
        db: tx,
        actorName,
        action: "ORDER_AUTO_ARCHIVE",
        entityType: "Order",
        entityId: order.id,
        entityLabel: order.customer?.name || order.draftCustomerName || "Order",
        summary: "ထုတ်ရမည့်ရက်ကျော်ပြီး Order ကို History ထဲ အလိုအလျောက်ရွှေ့",
        metadata: { requestedDate: order.requestedDate, cutoffDate: today, previousStatus: order.status },
      });
    }
  });
  return { archivedCount, skippedCount: candidates.length - archivedCount, cutoffDate: today };
}

export async function moveHistoryOrderToTrash({ orderId, actorName = "Staff", now = new Date() } = {}) {
  await ensureDatabase();
  const current = await prisma.order.findUnique({ where: { id: String(orderId) }, include: ORDER_INCLUDE });
  if (!current) throw new Error("Order မတွေ့ပါ။");
  if (!current.archivedAt || current.status === "CANCELLED") throw new Error("History ထဲရှိ Order သာ အမှိုက်ပုံးသို့ ရွှေ့နိုင်ပါသည်။");
  if (current.historyTrashedAt) return serializeOrder(current);
  const trashed = await prisma.order.update({
    where: { id: current.id },
    data: { historyTrashedAt: now, historyTrashedBy: actorName },
    include: ORDER_INCLUDE,
  });
  await writeAuditLog({
    actorName,
    action: "ORDER_HISTORY_TRASH",
    entityType: "Order",
    entityId: trashed.id,
    entityLabel: trashed.customer?.name || trashed.draftCustomerName || "Order",
    summary: "History Order ကို အမှိုက်ပုံးထဲ ရွှေ့",
    metadata: { previousStatus: current.status, archivedAt: current.archivedAt },
  });
  return serializeOrder(trashed);
}

export async function restoreHistoryTrashOrder({ orderId, actorName = "Staff" } = {}) {
  await ensureDatabase();
  const current = await prisma.order.findUnique({ where: { id: String(orderId) }, include: ORDER_INCLUDE });
  if (!current) throw new Error("Order မတွေ့ပါ။");
  if (!current.historyTrashedAt) return serializeOrder(current);
  const restored = await prisma.order.update({
    where: { id: current.id },
    data: { historyTrashedAt: null, historyTrashedBy: null },
    include: ORDER_INCLUDE,
  });
  await writeAuditLog({
    actorName,
    action: "ORDER_HISTORY_TRASH_RESTORE",
    entityType: "Order",
    entityId: restored.id,
    entityLabel: restored.customer?.name || restored.draftCustomerName || "Order",
    summary: "History Trash မှ Order ကို ပြန်ယူ",
    metadata: { restoredStatus: restored.status },
  });
  return serializeOrder(restored);
}

export async function deleteHistoryTrashOrderPermanently({ orderId, actorName = "Staff" } = {}) {
  await ensureDatabase();
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId) throw new Error("Order ID လိုအပ်ပါသည်။");
  const current = await prisma.order.findUnique({
    where: { id: normalizedOrderId },
    include: { customer: { select: { id: true, name: true } } },
  });
  if (!current) throw new Error("Order မတွေ့ပါ။");
  if (!current.historyTrashedAt) throw new Error("History Trash ထဲရှိ Order သာ အပြီးဖျက်နိုင်ပါသည်။");
  await prisma.$transaction(async (tx) => {
    await writeAuditLog({
      db: tx,
      actorName,
      action: "ORDER_HISTORY_TRASH_DELETE",
      entityType: "Order",
      entityId: current.id,
      entityLabel: current.customer?.name || current.draftCustomerName || "Order",
      summary: "History Trash ထဲရှိ Order ကို အပြီးဖျက်",
      metadata: { previousStatus: current.status, archivedAt: current.archivedAt, historyTrashedAt: current.historyTrashedAt },
    });
    await tx.order.delete({ where: { id: current.id } });
  });
  return { id: current.id, deleted: true };
}

export async function purgeExpiredHistoryTrash({ actorName = "System", now = new Date() } = {}) {
  await ensureDatabase();
  const cutoff = new Date(now.getTime() - CANCELLED_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const expired = await prisma.order.findMany({
    where: { historyTrashedAt: { not: null, lt: cutoff } },
    select: { id: true, customer: { select: { name: true } }, draftCustomerName: true, historyTrashedAt: true },
  });
  if (!expired.length) return { deletedCount: 0 };
  await prisma.$transaction(async (tx) => {
    for (const order of expired) {
      await writeAuditLog({
        db: tx,
        actorName,
        action: "ORDER_HISTORY_TRASH_AUTO_CLEAR",
        entityType: "Order",
        entityId: order.id,
        entityLabel: order.customer?.name || order.draftCustomerName || "Order",
        summary: "History Trash ထဲရှိ Order ကို ၁၅ ရက်ကျော်၍ Auto Clear လုပ်",
        metadata: { retentionDays: CANCELLED_RETENTION_DAYS, historyTrashedAt: order.historyTrashedAt },
      });
      await tx.order.delete({ where: { id: order.id } });
    }
  });
  return { deletedCount: expired.length };
}

export async function restoreOrder({ orderId, actorName = "Staff" } = {}) {
  await ensureDatabase();
  const current = await prisma.order.findUnique({ where: { id: String(orderId) }, include: ORDER_INCLUDE });
  if (!current) throw new Error("Order မတွေ့ပါ။");
  if (!current.archivedAt) return serializeOrder(current);
  const restored = await prisma.order.update({
    where: { id: current.id },
    data: { archivedAt: null, archivedBy: null },
    include: ORDER_INCLUDE,
  });
  await writeAuditLog({
    actorName,
    action: "ORDER_RESTORE",
    entityType: "Order",
    entityId: restored.id,
    entityLabel: restored.customer?.name || restored.draftCustomerName || "Order",
    summary: "Order ကို History မှ ပြန်ယူပြီး",
    metadata: { restoredStatus: restored.status },
  });
  return serializeOrder(restored);
}

const CANCELLED_RETENTION_DAYS = 15;

function cancellationCutoff(now = new Date()) {
  return new Date(new Date(now).getTime() - CANCELLED_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export async function restoreCancelledOrder({ orderId, actorName = "Staff", now = new Date() } = {}) {
  await ensureDatabase();
  const current = await prisma.order.findUnique({ where: { id: String(orderId) }, include: ORDER_INCLUDE });
  if (!current) throw new Error("Order မတွေ့ပါ။");
  if (current.status !== "CANCELLED") return serializeOrder(current);
  const [enriched] = await withCancelledAuditDates([serializeOrder(current)]);
  if (enriched.cancelledAt && new Date(enriched.cancelledAt) < cancellationCutoff(now)) throw new Error("ဒီ Cancelled Order သည် ၁၅ ရက်ကျော်သွားပါပြီ။ Restore မလုပ်နိုင်တော့ပါ။");
  const restored = await prisma.order.update({
    where: { id: current.id },
    data: { status: "DRAFT", cancelledAt: null, cancelledBy: null, archivedAt: null, archivedBy: null, confirmedAt: null, confirmedBy: null, notificationMode: "IMMEDIATE" },
    include: ORDER_INCLUDE,
  });
  await writeAuditLog({
    actorName,
    action: "ORDER_TRASH_RESTORE",
    entityType: "Order",
    entityId: restored.id,
    entityLabel: restored.customer?.name || restored.draftCustomerName || "Order",
    summary: "Cancelled Order ကို Trash မှ Restore လုပ်ပြီး Draft အဖြစ် ပြန်ထား",
    metadata: { restoredStatus: restored.status },
  });
  return serializeOrder(restored);
}

export async function deleteCancelledOrderPermanently({ orderId, actorName = "Staff" } = {}) {
  await ensureDatabase();
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId) throw new Error("Order ID လိုအပ်ပါသည်။");
  const current = await prisma.order.findUnique({
    where: { id: normalizedOrderId },
    include: { customer: { select: { id: true, name: true } } },
  });
  if (!current) throw new Error("Order မတွေ့ပါ။");
  if (current.status !== "CANCELLED") throw new Error("Trash ထဲရှိ Cancelled Order သာ အပြီးဖျက်နိုင်ပါသည်။");

  await prisma.$transaction(async (tx) => {
    await writeAuditLog({
      db: tx,
      actorName,
      action: "ORDER_PERMANENT_DELETE",
      entityType: "Order",
      entityId: current.id,
      entityLabel: current.customer?.name || current.draftCustomerName || "Order",
      summary: "Cancelled Order ကို Trash မှ အပြီးဖျက်",
      metadata: { previousStatus: current.status, sourceMessageId: current.sourceMessageId || null },
    });
    // OrderLine, OrderCap, and OrderDelivery use onDelete: Cascade.
    // Customer, Ledger, and balance rows are not touched by this delete.
    await tx.order.delete({ where: { id: current.id } });
  });
  return { id: current.id, deleted: true };
}

export async function purgeExpiredCancelledOrders({ actorName = "System", now = new Date() } = {}) {
  await ensureDatabase();
  const candidates = await prisma.order.findMany({
    where: { status: "CANCELLED" },
    select: { id: true, customerId: true, cancelledAt: true },
  });
  if (!candidates.length) return { deletedCount: 0, skippedUndatedCount: 0 };
  const undated = candidates.filter((order) => !order.cancelledAt);
  const dated = candidates.filter((order) => order.cancelledAt);
  const auditLogs = undated.length ? await prisma.auditLog.findMany({
    where: { entityType: "Order", action: "ORDER_CANCEL", entityId: { in: undated.map((order) => String(order.id)) } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { entityId: true, createdAt: true },
  }) : [];
  const latestCancelAt = new Map();
  auditLogs.forEach((log) => { if (log.entityId && !latestCancelAt.has(String(log.entityId))) latestCancelAt.set(String(log.entityId), log.createdAt); });
  const cutoff = cancellationCutoff(now);
  const expired = candidates.filter((order) => {
    const cancelledAt = order.cancelledAt || latestCancelAt.get(String(order.id));
    return cancelledAt && new Date(cancelledAt) < cutoff;
  });
  const skippedUndatedCount = undated.filter((order) => !latestCancelAt.has(String(order.id))).length;
  if (!expired.length) return { deletedCount: 0, skippedUndatedCount };
  await prisma.$transaction(async (tx) => {
    for (const order of expired) {
      await writeAuditLog({ db: tx, actorName, action: "ORDER_AUTO_CLEAR", entityType: "Order", entityId: order.id, entityLabel: "Cancelled Order", summary: "၁၅ ရက်ကျော် Cancelled Order ကို Trash မှ Auto Clear လုပ်", metadata: { retentionDays: CANCELLED_RETENTION_DAYS } });
      await tx.order.delete({ where: { id: order.id } });
    }
  });
  return { deletedCount: expired.length, skippedUndatedCount };
}

async function getActiveCustomer(customerId) {
  if (!customerId) return null;
  return prisma.customer.findFirst({
    where: { id: String(customerId), deletedAt: null },
    select: { id: true, name: true, phone: true, routeTag: true, deletedAt: true },
  });
}

export async function getOrderCustomerCandidates({ orderId } = {}) {
  await ensureDatabase();
  const order = await prisma.order.findUnique({ where: { id: String(orderId) }, include: ORDER_INCLUDE });
  if (!order) throw new Error("Order မတွေ့ပါ။");
  if (order.archivedAt) throw new Error("Archive လုပ်ပြီး Order ကို Customer ပြန်ချိတ်၍မရပါ။ အရင် Restore လုပ်ပါ။");
  if (["FACTORY_NOTIFIED", "COMPLETED", "CANCELLED"].includes(order.status)) throw new Error("ပို့ပြီး/ပြီးစီး/ပယ်ဖျက်ပြီး Order ကို Customer ပြန်ချိတ်၍မရပါ။");
  const { candidates } = await findCustomerMatch({ name: order.draftCustomerName || order.customer?.name, phone: order.draftCustomerPhone || order.customerPhone });
  return { order: serializeOrder(order), candidates };
}

export async function linkOrderCustomer({ orderId, customerId, actorName = "Staff" } = {}) {
  await ensureDatabase();
  const customer = await getActiveCustomer(customerId);
  if (!customer) throw new Error("ရွေးထားသော active Customer မတွေ့ပါ။");
  const current = await prisma.order.findUnique({ where: { id: String(orderId) }, select: { id: true, status: true, archivedAt: true, requestedDate: true, destination: true, customerPhone: true, missingFields: true } });
  if (!current) throw new Error("Order မတွေ့ပါ။");
  if (current.archivedAt) throw new Error("Archive လုပ်ပြီး Order ကို ပြန်ချိတ်၍မရပါ။ အရင် Restore လုပ်ပါ။");
  if (["FACTORY_NOTIFIED", "COMPLETED", "CANCELLED"].includes(current.status)) throw new Error("ပို့ပြီး/ပြီးစီး/ပယ်ဖျက်ပြီး Order ကို Customer ပြန်ချိတ်၍မရပါ။");
  const missingSet = new Set(removeCustomerMissingFields(current.missingFields));
  if (current.requestedDate) Array.from(missingSet).filter((item) => item.includes("ထုတ်ရမည့်ရက်")).forEach((item) => missingSet.delete(item));
  else missingSet.add("ထုတ်ရမည့်ရက်");
  if (current.destination) Array.from(missingSet).filter((item) => item.includes("ကားဂိတ်/နေရာ")).forEach((item) => missingSet.delete(item));
  else missingSet.add("ကားဂိတ်/နေရာ");
  const linkedPhone = String(customer.phone || current.customerPhone || "").trim() || null;
  if (linkedPhone) Array.from(missingSet).filter((item) => /ဖုန်း|phone/i.test(item)).forEach((item) => missingSet.delete(item));
  const remainingMissingFields = Array.from(missingSet);
  const order = await prisma.order.update({
    where: { id: String(orderId) },
    data: {
      customerId: customer.id,
      draftCustomerName: null,
      draftCustomerPhone: null,
      customerPhone: linkedPhone,
      missingFields: remainingMissingFields,
      status: remainingMissingFields.length ? "NEEDS_REVIEW" : "DRAFT",
    },
    include: ORDER_INCLUDE,
  });
  await writeAuditLog({
    actorName,
    action: "ORDER_CUSTOMER_LINK",
    entityType: "Order",
    entityId: order.id,
    entityLabel: customer.name,
    summary: `Order ကို Customer ${customer.name} နှင့် ချိတ်ဆက်`,
    metadata: { customerId: customer.id },
  });
  return serializeOrder(order);
}

export async function createCustomerForOrder({ orderId, name, phone = null, routeTag = null, actorName = "Staff" } = {}) {
  await ensureDatabase();
  const order = await prisma.order.findUnique({ where: { id: String(orderId) }, include: ORDER_INCLUDE });
  if (!order) throw new Error("Order မတွေ့ပါ။");
  if (order.archivedAt) throw new Error("Archive လုပ်ပြီး Order ကို Customer ပြန်ချိတ်၍မရပါ။ အရင် Restore လုပ်ပါ။");
  if (["FACTORY_NOTIFIED", "COMPLETED", "CANCELLED"].includes(order.status)) throw new Error("ပို့ပြီး/ပြီးစီး/ပယ်ဖျက်ပြီး Order ကို Customer ပြန်ချိတ်၍မရပါ။");
  if (order.customerId && order.customer?.id && !order.customer.deletedAt) return serializeOrder(order);
  const customerName = String(name || order.draftCustomerName || "").trim();
  if (!customerName) throw new Error("Customer အမည် လိုအပ်ပါသည်။");
  const created = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: { name: customerName, phone: String(phone || order.draftCustomerPhone || "").trim() || null, routeTag: String(routeTag || "").trim() || null, current_balance: 0 },
      select: { id: true, name: true, phone: true, routeTag: true, deletedAt: true },
    });
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { customerId: customer.id, draftCustomerName: null, draftCustomerPhone: null, missingFields: removeCustomerMissingFields(order.missingFields), status: "DRAFT" },
      include: ORDER_INCLUDE,
    });
    return { customer, order: updated };
  });
  await writeAuditLog({
    actorName,
    action: "ORDER_CUSTOMER_CREATE",
    entityType: "Order",
    entityId: created.order.id,
    entityLabel: created.customer.name,
    summary: `Order အတွက် Customer အသစ်ဖန်တီး: ${created.customer.name}`,
    metadata: { customerId: created.customer.id },
  });
  return serializeOrder(created.order);
}

export async function updateOrderDetails({ orderId, requestedDate, destination, customerPhone, actorName = "Staff" } = {}) {
  await ensureDatabase();
  const current = await prisma.order.findUnique({ where: { id: String(orderId) }, include: ORDER_INCLUDE });
  if (!current) throw new Error("Order မတွေ့ပါ။");
  if (current.archivedAt) throw new Error("Archive လုပ်ပြီး Order ကို ပြင်၍မရပါ။ အရင် Restore လုပ်ပါ။");
  if (["FACTORY_NOTIFIED", "COMPLETED", "CANCELLED"].includes(current.status)) throw new Error("ပို့ပြီး/ပြီးစီး/ပယ်ဖျက်ပြီး Order ကို ပြင်၍မရပါ။");
  const nextDate = requestedDate === undefined ? current.requestedDate : (normalizeDateInput(requestedDate) || "");
  if (requestedDate !== undefined && !nextDate) throw new Error("ထုတ်ရမည့်ရက် မမှန်ကန်ပါ။");
  const nextDestination = destination === undefined ? current.destination : String(destination || "").trim() || null;
  const nextPhone = customerPhone === undefined ? current.customerPhone : String(customerPhone || "").trim() || null;
  const missingSet = new Set(current.customerId ? removeCustomerMissingFields(current.missingFields) : normalizeMissingFields(current.missingFields));
  if (nextDate) Array.from(missingSet).filter((item) => item.includes("ထုတ်ရမည့်ရက်")).forEach((item) => missingSet.delete(item));
  else missingSet.add("ထုတ်ရမည့်ရက်");
  if (nextDestination) Array.from(missingSet).filter((item) => item.includes("ကားဂိတ်/နေရာ")).forEach((item) => missingSet.delete(item));
  else missingSet.add("ကားဂိတ်/နေရာ");
  if (nextPhone) Array.from(missingSet).filter((item) => /ဖုန်း|phone/i.test(item)).forEach((item) => missingSet.delete(item));
  const missing = Array.from(missingSet);
  const nextStatus = current.customerId ? (missing.length ? "NEEDS_REVIEW" : "DRAFT") : "NEEDS_CUSTOMER";
  const updated = await prisma.order.update({
    where: { id: current.id },
    data: { requestedDate: nextDate, destination: nextDestination, customerPhone: nextPhone, missingFields: missing, status: nextStatus },
    include: ORDER_INCLUDE,
  });
  await writeAuditLog({ actorName, action: "ORDER_DETAILS_UPDATE", entityType: "Order", entityId: updated.id, entityLabel: updated.customer?.name || updated.draftCustomerName || "Order", summary: "Order အချက်အလက် ပြင်ဆင်", metadata: { requestedDate: nextDate, destination: nextDestination } });
  return serializeOrder(updated);
}

export async function updateOrderStatus({ orderId, status, mode = null, actorName = "Staff", auditMetadata = null } = {}) {
  await ensureDatabase();
  const allowed = new Set(["CANCELLED", "DRAFT", "NEEDS_REVIEW", "NEEDS_CUSTOMER", "CONFIRMED", "BATCH_QUEUED"]);
  if (!allowed.has(status)) throw new Error("Order status မမှန်ကန်ပါ။");
  const current = await prisma.order.findUnique({ where: { id: String(orderId) }, include: ORDER_INCLUDE });
  if (!current) throw new Error("Order မတွေ့ပါ။");
  if (current.archivedAt) throw new Error("Archive လုပ်ပြီး Order တွင် status မပြောင်းနိုင်ပါ။ အရင် Restore လုပ်ပါ။");
  if (status === "CANCELLED" && current.status === "CANCELLED") return serializeOrder(current);
  if (status === "CANCELLED" && ["FACTORY_NOTIFIED", "COMPLETED"].includes(current.status)) throw new Error("ပို့ပြီး/ပြီးစီးပြီး Order ကို Cancel မလုပ်နိုင်ပါ။");
  if (status === "CANCELLED" && current.deliveries?.some((delivery) => delivery.destinationType === "FACTORY" && ["SENDING", "SENT"].includes(delivery.status))) throw new Error("Factory notification ပို့နေ/ပို့ပြီး Order ကို Cancel မလုပ်နိုင်ပါ။");
  if (status === "CONFIRMED" || status === "BATCH_QUEUED") {
    if (!current.customerId || current.customer?.deletedAt) throw new Error("Active Customer မချိတ်ရသေးပါ။");
    if (removeCustomerMissingFields(current.missingFields).length) throw new Error("Order အချက်အလက် မပြည့်စုံသေးပါ။");
  }
  const nextMode = mode === "MORNING_BATCH" ? "MORNING_BATCH" : "IMMEDIATE";
  if (status === "CONFIRMED" || status === "BATCH_QUEUED") {
    if (["FACTORY_NOTIFIED", "COMPLETED"].includes(current.status)) return serializeOrder(current);
    const existingDelivery = current.deliveries?.find((delivery) => delivery.destinationType === "FACTORY" && delivery.mode === nextMode);
    if (current.status === status && current.notificationMode === nextMode && existingDelivery && ["PENDING", "SENDING", "SENT"].includes(existingDelivery.status)) {
      return serializeOrder(current);
    }
  }
  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: current.id },
      data: {
        status,
        notificationMode: status === "CONFIRMED" || status === "BATCH_QUEUED" ? nextMode : undefined,
        confirmedAt: status === "CONFIRMED" || status === "BATCH_QUEUED" ? new Date() : status === "CANCELLED" ? null : undefined,
        confirmedBy: status === "CONFIRMED" || status === "BATCH_QUEUED" ? actorName : status === "CANCELLED" ? null : undefined,
        cancelledAt: status === "CANCELLED" ? new Date() : status === "DRAFT" || status === "NEEDS_REVIEW" || status === "NEEDS_CUSTOMER" ? null : undefined,
        cancelledBy: status === "CANCELLED" ? actorName : status === "DRAFT" || status === "NEEDS_REVIEW" || status === "NEEDS_CUSTOMER" ? null : undefined,
      },
      include: ORDER_INCLUDE,
    });
    if (status === "CONFIRMED" || status === "BATCH_QUEUED") {
      await tx.orderDelivery.upsert({
        where: { orderId_destinationType_mode: { orderId: current.id, destinationType: "FACTORY", mode: nextMode } },
        create: { orderId: current.id, destinationType: "FACTORY", mode: nextMode, status: "PENDING" },
        update: { status: "PENDING", errorMessage: null },
      });
    }
    if (status === "CANCELLED") {
      await tx.orderDelivery.updateMany({ where: { orderId: current.id, status: "PENDING" }, data: { status: "CANCELLED", errorMessage: "Order cancelled" } });
    }
    return order;
  });
  await writeAuditLog({
    actorName,
    action: status === "CANCELLED" ? "ORDER_CANCEL" : status === "CONFIRMED" || status === "BATCH_QUEUED" ? "ORDER_CONFIRM" : "ORDER_UPDATE",
    entityType: "Order",
    entityId: updated.id,
    entityLabel: updated.customer?.name || updated.draftCustomerName || "Order",
    summary: `Order status: ${status}`,
    metadata: { mode: status === "CONFIRMED" || status === "BATCH_QUEUED" ? nextMode : null, ...(auditMetadata && typeof auditMetadata === "object" ? auditMetadata : {}) },
  });
  return serializeOrder(updated);
}

export async function setDeliveryResult({ deliveryId, status, telegramChatId = null, telegramMessageId = null, errorMessage = null } = {}) {
  await ensureDatabase();
  return prisma.orderDelivery.update({
    where: { id: String(deliveryId) },
    data: {
      status,
      telegramChatId: telegramChatId == null ? undefined : String(telegramChatId),
      telegramMessageId: telegramMessageId == null ? undefined : String(telegramMessageId),
      sentAt: status === "SENT" ? new Date() : undefined,
      errorMessage: errorMessage || null,
    },
  });
}

export async function getQueuedOrdersForDate(date) {
  await ensureDatabase();
  const orders = await prisma.order.findMany({
    where: { archivedAt: null, status: "BATCH_QUEUED", requestedDate: String(date), deliveries: { some: { mode: "MORNING_BATCH", destinationType: "FACTORY", status: "PENDING" } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: ORDER_INCLUDE,
  });
  return orders.map(serializeOrder);
}
