import { NextResponse } from "next/server";
import { databaseErrorResponse } from "@/lib/database";
import { getActorName } from "@/lib/audit";
import { sendFactoryNotificationForOrder } from "@/lib/order-delivery";
import { syncTelegramOrderMessage } from "@/lib/order-channel-sync";
import {
  createCustomerForOrder,
  createOrderDraft,
  updateOrderDetails,
  linkOrderCustomer,
  listOrders,
  archiveOrder,
  restoreOrder,
  updateOrderStatus,
} from "@/lib/order-service";

export const dynamic = "force-dynamic";

function errorResponse(error, status = 500) {
  const message = String(error?.message || "Order request မအောင်မြင်ပါ။");
  if (status === 500) return NextResponse.json(databaseErrorResponse(error), { status });
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim() || null;
    const archivedMode = searchParams.get("archived");
    const includeArchived = archivedMode === "include" || searchParams.get("includeArchived") === "true";
    const archivedOnly = archivedMode === "only" || searchParams.get("archivedOnly") === "true";
    const limit = searchParams.get("limit");
    const orders = await listOrders({ status, includeArchived, archivedOnly, limit });
    return NextResponse.json({ ok: true, data: orders });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const sourceText = String(body.sourceText || "").trim();
    if (!sourceText) return errorResponse(new Error("sourceText is required"), 400);
    const result = await createOrderDraft({
      sourceChatId: body.sourceChatId || null,
      sourceMessageId: body.sourceMessageId || null,
      sourceUpdateId: body.sourceUpdateId || null,
      sourceText,
      extracted: body.extracted || {},
    });
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const orderId = String(body.orderId || "").trim();
    const action = String(body.action || "").trim();
    const actorName = getActorName(request);
    if (!orderId || !action) return errorResponse(new Error("orderId and action are required"), 400);

    if (action === "link_customer") {
      const data = await linkOrderCustomer({ orderId, customerId: body.customerId, actorName });
      return NextResponse.json({ ok: true, data });
    }
    if (action === "create_customer") {
      const data = await createCustomerForOrder({ orderId, name: body.name, phone: body.phone, routeTag: body.routeTag, actorName });
      return NextResponse.json({ ok: true, data });
    }
    if (action === "update_details") {
      const data = await updateOrderDetails({ orderId, requestedDate: body.requestedDate, destination: body.destination, customerPhone: body.customerPhone, actorName });
      return NextResponse.json({ ok: true, data });
    }
    if (action === "confirm") {
      const mode = body.mode === "MORNING_BATCH" ? "MORNING_BATCH" : "IMMEDIATE";
      const data = await updateOrderStatus({ orderId, status: mode === "MORNING_BATCH" ? "BATCH_QUEUED" : "CONFIRMED", mode, actorName });
      if (mode === "IMMEDIATE") {
        let finalOrder = data;
        let warning = "";
        let delivery = null;
        try {
          delivery = await sendFactoryNotificationForOrder(orderId, { actorName });
          finalOrder = delivery.order || data;
          if (!delivery.sent) warning = "Order ကို Confirm လုပ်ပြီးပါပြီ။ Factory notification သည် ယခင် send လုပ်နေဆဲဖြစ်သောကြောင့် ထပ်မပို့ပါ။";
        } catch (deliveryError) {
          console.error("Immediate factory notification is pending", deliveryError);
          warning = "Order ကို Confirm လုပ်ပြီးပါပြီ။ Factory group မသတ်မှတ်ရသေးခြင်း သို့မဟုတ် ပို့ရာတွင်အခက်အခဲရှိသောကြောင့် notification ကို Pending ထားပါသည်။";
        }
        try {
          await syncTelegramOrderMessage(finalOrder, warning ? "⚠️ Website မှ Confirm လုပ်ပြီးပါပြီ။ Factory notification Pending ဖြစ်နေပါသည်။" : "✅ Website မှ Confirm လုပ်ပြီး Factory group သို့ ပို့ပြီးပါပြီ။");
        } catch (syncError) {
          console.warn("Website confirm Telegram message sync failed", syncError);
          warning = `${warning}${warning ? " " : ""}Telegram မူရင်း message ကို update မလုပ်နိုင်သေးပါ။`;
        }
        return NextResponse.json({ ok: true, data: finalOrder, delivery: delivery ? { sent: Boolean(delivery.sent), duplicate: Boolean(delivery.duplicate), messageId: delivery.messageId } : { sent: false, pending: true }, ...(warning ? { warning } : {}) });
      }
      let warning = "Order ကို မနက် batch queue ထဲ ထည့်ပြီးပါပြီ။ Website setting ဖွင့်ထားမှ 08:10 တွင် စက်ရုံသို့ ပို့ပါမယ်။";
      try {
        await syncTelegramOrderMessage(data, "📦 Website မှ 08:10 morning batch ထဲ ထည့်ပြီးပါပြီ။");
      } catch (syncError) {
        console.warn("Website batch Telegram message sync failed", syncError);
        warning = `${warning} Telegram မူရင်း message ကို update မလုပ်နိုင်သေးပါ။`;
      }
      return NextResponse.json({ ok: true, data, warning });
    }
    if (action === "cancel") {
      const data = await updateOrderStatus({ orderId, status: "CANCELLED", actorName });
      let warning = "";
      try {
        await syncTelegramOrderMessage(data, "❌ Website မှ Cancel လုပ်ပြီးပါပြီ။");
      } catch (syncError) {
        console.warn("Website cancel Telegram message sync failed", syncError);
        warning = "Order ကို Cancel လုပ်ပြီးပါပြီ။ Telegram မူရင်း message ကို update မလုပ်နိုင်သေးပါ။";
      }
      return NextResponse.json({ ok: true, data, ...(warning ? { warning } : {}) });
    }
    if (action === "reset_review") {
      const data = await updateOrderStatus({ orderId, status: "DRAFT", actorName });
      return NextResponse.json({ ok: true, data });
    }
    if (action === "archive") {
      const data = await archiveOrder({ orderId, actorName });
      return NextResponse.json({ ok: true, data });
    }
    if (action === "restore") {
      const data = await restoreOrder({ orderId, actorName });
      return NextResponse.json({ ok: true, data });
    }
    return errorResponse(new Error("မသိသော order action ဖြစ်ပါသည်။"), 400);
  } catch (error) {
    return errorResponse(error, error?.message?.includes("မတွေ့") || error?.message?.includes("လိုအပ်") || error?.message?.includes("မမှန်") ? 400 : 500);
  }
}
