import { NextResponse } from "next/server";
import { databaseErrorResponse } from "@/lib/database";
import { getActorName } from "@/lib/audit";
import { sendFactoryNotificationForOrder } from "@/lib/order-delivery";
import {
  createCustomerForOrder,
  createOrderDraft,
  updateOrderDetails,
  linkOrderCustomer,
  listOrders,
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
    const limit = searchParams.get("limit");
    const orders = await listOrders({ status, limit });
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
        try {
          const delivery = await sendFactoryNotificationForOrder(orderId, { actorName });
          if (delivery.sent) return NextResponse.json({ ok: true, data: delivery.order || data, delivery: { sent: true, duplicate: Boolean(delivery.duplicate), messageId: delivery.messageId } });
          return NextResponse.json({ ok: true, data: delivery.order || data, warning: "Order ကို Confirm လုပ်ပြီးပါပြီ။ Factory notification သည် ယခင် send လုပ်နေဆဲဖြစ်သောကြောင့် ထပ်မပို့ပါ။" });
        } catch (deliveryError) {
          console.error("Immediate factory notification is pending", deliveryError);
          return NextResponse.json({ ok: true, data, warning: "Order ကို Confirm လုပ်ပြီးပါပြီ။ Factory group မသတ်မှတ်ရသေးခြင်း သို့မဟုတ် ပို့ရာတွင်အခက်အခဲရှိသောကြောင့် notification ကို Pending ထားပါသည်။" });
        }
      }
      return NextResponse.json({ ok: true, data, warning: "Order ကို မနက် batch queue ထဲ ထည့်ပြီးပါပြီ။ Website setting ဖွင့်ထားမှ 08:10 တွင် စက်ရုံသို့ ပို့ပါမယ်။" });
    }
    if (action === "cancel") {
      const data = await updateOrderStatus({ orderId, status: "CANCELLED", actorName });
      return NextResponse.json({ ok: true, data });
    }
    if (action === "reset_review") {
      const data = await updateOrderStatus({ orderId, status: "DRAFT", actorName });
      return NextResponse.json({ ok: true, data });
    }
    return errorResponse(new Error("မသိသော order action ဖြစ်ပါသည်။"), 400);
  } catch (error) {
    return errorResponse(error, error?.message?.includes("မတွေ့") || error?.message?.includes("လိုအပ်") || error?.message?.includes("မမှန်") ? 400 : 500);
  }
}
