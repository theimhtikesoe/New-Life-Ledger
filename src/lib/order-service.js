import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
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

function normalizePhone(value) {
  return String(value || "").replace(/[^\d၀-၉+]/g, "").replace(/[၀-၉]/g, (digit) => String("၀၁၂၃၄၅၆၇၈၉".indexOf(digit))).replace(/^\+95/, "0");
}

function normalizeMissingFields(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function serializeOrder(order) {
  if (!order) return null;
  const lines = (order.lines || []).map((line) => ({
    ...line,
    capacityMl: line.capacityMl == null ? null : Number(line.capacityMl),
    bottlesPerCard: line.bottlesPerCard == null ? null : Number(line.bottlesPerCard),
    cardCount: line.cardCount == null ? null : Number(line.cardCount),
    totalBottles: line.totalBottles == null ? null : Number(line.totalBottles),
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
  const candidates = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      OR: [
        ...(trimmedName ? [
          { name: { equals: trimmedName, mode: "insensitive" } },
          { name: { contains: trimmedName, mode: "insensitive" } },
        ] : []),
        ...(trimmedPhone ? [{ phone: { contains: trimmedPhone, mode: "insensitive" } }] : []),
      ],
    },
    select: { id: true, name: true, phone: true, routeTag: true, deletedAt: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 20,
  });
  const normalizedInputName = normalizeName(trimmedName);
  const normalizedInputPhone = normalizePhone(trimmedPhone);
  const exactMatches = candidates.filter((candidate) => {
    const nameMatch = normalizedInputName && normalizeName(candidate.name) === normalizedInputName;
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

  await writeAuditLog({
    actorName: "Staff",
    action: "ORDER_DRAFT",
    entityType: "Order",
    entityId: created.id,
    entityLabel: normalized.customerName || "Customer မသတ်မှတ်ရသေး",
    summary: "Telegram order Draft ဖန်တီး",
    metadata: {
      source: "telegram",
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

export async function listOrders({ status = null, limit = 100 } = {}) {
  await ensureDatabase();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const orders = await prisma.order.findMany({
    where: status ? { status } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: safeLimit,
    include: ORDER_INCLUDE,
  });
  return orders.map(serializeOrder);
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

async function getActiveCustomer(customerId) {
  if (!customerId) return null;
  return prisma.customer.findFirst({
    where: { id: String(customerId), deletedAt: null },
    select: { id: true, name: true, phone: true, routeTag: true, deletedAt: true },
  });
}

export async function linkOrderCustomer({ orderId, customerId, actorName = "Staff" } = {}) {
  await ensureDatabase();
  const customer = await getActiveCustomer(customerId);
  if (!customer) throw new Error("ရွေးထားသော active Customer မတွေ့ပါ။");
  const current = await prisma.order.findUnique({ where: { id: String(orderId) }, select: { id: true, status: true } });
  if (!current) throw new Error("Order မတွေ့ပါ။");
  if (["FACTORY_NOTIFIED", "COMPLETED", "CANCELLED"].includes(current.status)) throw new Error("ပို့ပြီး/ပြီးစီး/ပယ်ဖျက်ပြီး Order ကို Customer ပြန်ချိတ်၍မရပါ။");
  const order = await prisma.order.update({
    where: { id: String(orderId) },
    data: {
      customerId: customer.id,
      draftCustomerName: null,
      draftCustomerPhone: null,
      status: "DRAFT",
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
  if (["FACTORY_NOTIFIED", "COMPLETED", "CANCELLED"].includes(order.status)) throw new Error("ပို့ပြီး/ပြီးစီး/ပယ်ဖျက်ပြီး Order ကို Customer ပြန်ချိတ်၍မရပါ။");
  const customerName = String(name || order.draftCustomerName || "").trim();
  if (!customerName) throw new Error("Customer အမည် လိုအပ်ပါသည်။");
  const created = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: { name: customerName, phone: String(phone || order.draftCustomerPhone || "").trim() || null, routeTag: String(routeTag || "").trim() || null, current_balance: 0 },
      select: { id: true, name: true, phone: true, routeTag: true, deletedAt: true },
    });
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { customerId: customer.id, draftCustomerName: null, draftCustomerPhone: null, status: "DRAFT" },
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
  if (["FACTORY_NOTIFIED", "COMPLETED", "CANCELLED"].includes(current.status)) throw new Error("ပို့ပြီး/ပြီးစီး/ပယ်ဖျက်ပြီး Order ကို ပြင်၍မရပါ။");
  const nextDate = requestedDate === undefined ? current.requestedDate : (normalizeDateInput(requestedDate) || "");
  if (requestedDate !== undefined && !nextDate) throw new Error("ထုတ်ရမည့်ရက် မမှန်ကန်ပါ။");
  const nextDestination = destination === undefined ? current.destination : String(destination || "").trim() || null;
  const nextPhone = customerPhone === undefined ? current.customerPhone : String(customerPhone || "").trim() || null;
  const missingSet = new Set(normalizeMissingFields(current.missingFields));
  if (nextDate) Array.from(missingSet).filter((item) => item.includes("ထုတ်ရမည့်ရက်")).forEach((item) => missingSet.delete(item));
  else missingSet.add("ထုတ်ရမည့်ရက်");
  if (nextDestination) Array.from(missingSet).filter((item) => item.includes("ကားဂိတ်/နေရာ")).forEach((item) => missingSet.delete(item));
  else missingSet.add("ကားဂိတ်/နေရာ");
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
  if (status === "CANCELLED" && current.status === "CANCELLED") return serializeOrder(current);
  if (status === "CANCELLED" && ["FACTORY_NOTIFIED", "COMPLETED"].includes(current.status)) throw new Error("ပို့ပြီး/ပြီးစီးပြီး Order ကို Cancel မလုပ်နိုင်ပါ။");
  if (status === "CANCELLED" && current.deliveries?.some((delivery) => delivery.destinationType === "FACTORY" && ["SENDING", "SENT"].includes(delivery.status))) throw new Error("Factory notification ပို့နေ/ပို့ပြီး Order ကို Cancel မလုပ်နိုင်ပါ။");
  if (status === "CONFIRMED" || status === "BATCH_QUEUED") {
    if (!current.customerId || current.customer?.deletedAt) throw new Error("Active Customer မချိတ်ရသေးပါ။");
    if (normalizeMissingFields(current.missingFields).length) throw new Error("Order အချက်အလက် မပြည့်စုံသေးပါ။");
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
    where: { status: "BATCH_QUEUED", requestedDate: String(date), deliveries: { some: { mode: "MORNING_BATCH", destinationType: "FACTORY", status: "PENDING" } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: ORDER_INCLUDE,
  });
  return orders.map(serializeOrder);
}
