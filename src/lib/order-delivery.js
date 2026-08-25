import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { getMyanmarDateInputValue } from "@/lib/myanmar-time";
import { formatFactoryBatchMessage, formatFactoryOrderMessage } from "@/lib/order-utils";
import { getOrderById, getQueuedOrdersForDate, setDeliveryResult } from "@/lib/order-service";
import { getTelegramOrderConfig, sendTelegramTextToChat } from "@/lib/telegram";

function safeError(error) {
  const message = String(error?.message || "Telegram notification မအောင်မြင်ပါ။").replace(/\s+/g, " ").trim();
  return message.replace(/https?:\/\/\S+/gi, "[hidden]").slice(0, 300);
}

export async function getOrderAutomationSetting() {
  await ensureDatabase();
  return prisma.orderAutomationSetting.upsert({
    where: { id: 1 },
    create: { id: 1, morningBatchEnabled: true, morningBatchTime: "08:10" },
    update: { morningBatchTime: "08:10" },
  });
}

export async function updateOrderAutomationSetting({ morningBatchEnabled } = {}) {
  await ensureDatabase();
  const time = "08:10";
  return prisma.orderAutomationSetting.upsert({
    where: { id: 1 },
    create: { id: 1, morningBatchEnabled: Boolean(morningBatchEnabled), morningBatchTime: time },
    update: { morningBatchEnabled: Boolean(morningBatchEnabled), morningBatchTime: time },
  });
}

async function claimDelivery(deliveryId) {
  await ensureDatabase();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`new-life-ledger-order-delivery:${deliveryId}`}))`;
    const delivery = await tx.orderDelivery.findUnique({ where: { id: String(deliveryId) } });
    if (!delivery) throw new Error("Order delivery record မတွေ့ပါ။");
    if (delivery.status === "SENT") return { delivery, shouldSend: false, reason: "already_sent" };
    if (delivery.status === "SENDING") return { delivery, shouldSend: false, reason: "already_sending" };
    if (delivery.status === "CANCELLED") return { delivery, shouldSend: false, reason: "cancelled" };
    const claimed = await tx.orderDelivery.update({ where: { id: delivery.id }, data: { status: "SENDING", errorMessage: null } });
    return { delivery: claimed, shouldSend: true, reason: "claimed" };
  });
}

export async function sendFactoryNotificationForOrder(orderId, { actorName = "Staff" } = {}) {
  await ensureDatabase();
  const { token, factoryChatId } = getTelegramOrderConfig();
  if (!token || !factoryChatId) throw new Error("TELEGRAM_BOT_TOKEN နှင့် TELEGRAM_FACTORY_GROUP_CHAT_ID မပြည့်စုံသေးပါ။");
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order မတွေ့ပါ။");
  if (order.status === "CANCELLED") throw new Error("Cancel လုပ်ပြီး Order ကို စက်ရုံသို့ မပို့နိုင်ပါ။");
  const delivery = order.deliveries?.find((item) => item.destinationType === "FACTORY" && item.mode === "IMMEDIATE")
    || await prisma.orderDelivery.findFirst({ where: { orderId: String(orderId), destinationType: "FACTORY", mode: "IMMEDIATE" } });
  if (!delivery) throw new Error("Factory delivery record မတွေ့ပါ။");
  const claim = await claimDelivery(delivery.id);
  if (!claim.shouldSend) return { sent: claim.reason === "already_sent", duplicate: true, reason: claim.reason, order };

  try {
    const result = await sendTelegramTextToChat({ chatId: factoryChatId, text: formatFactoryOrderMessage(order) });
    await setDeliveryResult({ deliveryId: delivery.id, status: "SENT", telegramChatId: factoryChatId, telegramMessageId: result.messageId });
    const updated = await prisma.order.update({ where: { id: String(orderId) }, data: { status: "FACTORY_NOTIFIED" }, include: { customer: true, lines: true, caps: true, deliveries: true } });
    await writeAuditLog({
      actorName,
      action: "ORDER_FACTORY_NOTIFIED",
      entityType: "Order",
      entityId: orderId,
      entityLabel: order.customer?.name || order.draftCustomerName || "Order",
      summary: "Order ကို စက်ရုံ Telegram group သို့ ပို့ပြီး",
      metadata: { mode: "IMMEDIATE", deliveryId: delivery.id },
    });
    return { sent: true, duplicate: false, messageId: result.messageId, order: updated };
  } catch (error) {
    await setDeliveryResult({ deliveryId: delivery.id, status: "FAILED", errorMessage: safeError(error) });
    throw error;
  }
}

export async function runMorningOrderBatch({ batchDate = null, actorName = "Staff" } = {}) {
  await ensureDatabase();
  const setting = await getOrderAutomationSetting();
  if (!setting.morningBatchEnabled) return { skipped: true, reason: "disabled", batchDate: batchDate || getMyanmarDateInputValue() };
  const date = batchDate || getMyanmarDateInputValue();
  const { token, factoryChatId } = getTelegramOrderConfig();
  if (!token || !factoryChatId) throw new Error("TELEGRAM_BOT_TOKEN နှင့် TELEGRAM_FACTORY_GROUP_CHAT_ID မပြည့်စုံသေးပါ။");

  const claim = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`new-life-ledger-order-batch:${date}`}))`;
    const existing = await tx.orderBatchRun.findUnique({ where: { batchDate: date } });
    if (existing?.status === "SUCCESS") return { shouldRun: false, reason: "already_sent", run: existing };
    if (existing?.status === "RUNNING") return { shouldRun: false, reason: "already_running", run: existing };
    if (existing?.status === "FAILED") return { shouldRun: false, reason: "failed_requires_review", run: existing };
    const run = existing
      ? await tx.orderBatchRun.update({ where: { id: existing.id }, data: { status: "RUNNING", errorMessage: null } })
      : await tx.orderBatchRun.create({ data: { batchDate: date, status: "RUNNING" } });
    return { shouldRun: true, run };
  });
  if (!claim.shouldRun) return { skipped: true, reason: claim.reason, batchDate: date };

  const orders = await getQueuedOrdersForDate(date);
  try {
    if (!orders.length) {
      await prisma.orderBatchRun.update({ where: { id: claim.run.id }, data: { status: "SUCCESS", orderCount: 0, sentAt: new Date() } });
      return { sent: false, empty: true, batchDate: date, orderCount: 0 };
    }
    const result = await sendTelegramTextToChat({ chatId: factoryChatId, text: formatFactoryBatchMessage(orders) });
    await prisma.$transaction(async (tx) => {
      for (const order of orders) {
        const delivery = order.deliveries.find((item) => item.destinationType === "FACTORY" && item.mode === "MORNING_BATCH" && item.status === "PENDING");
        if (!delivery) continue;
        await tx.orderDelivery.update({ where: { id: delivery.id }, data: { status: "SENT", telegramChatId: factoryChatId, telegramMessageId: String(result.messageId || ""), sentAt: new Date() } });
        await tx.order.update({ where: { id: order.id }, data: { status: "FACTORY_NOTIFIED" } });
      }
      await tx.orderBatchRun.update({ where: { id: claim.run.id }, data: { status: "SUCCESS", orderCount: orders.length, sentAt: new Date() } });
    });
    await writeAuditLog({ actorName, action: "ORDER_BATCH_NOTIFIED", entityType: "OrderBatch", entityId: claim.run.id, entityLabel: date, summary: "စက်ရုံ မနက် batch order များ ပို့ပြီး", metadata: { orderCount: orders.length, batchDate: date } });
    return { sent: true, batchDate: date, orderCount: orders.length, messageId: result.messageId };
  } catch (error) {
    await prisma.orderBatchRun.update({ where: { id: claim.run.id }, data: { status: "FAILED", errorMessage: safeError(error) } }).catch(() => null);
    throw error;
  }
}

export async function listOrderBatchRuns(limit = 20) {
  await ensureDatabase();
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  return prisma.orderBatchRun.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: safeLimit });
}
