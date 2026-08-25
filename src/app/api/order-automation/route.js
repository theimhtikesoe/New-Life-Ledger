import { NextResponse } from "next/server";
import { databaseErrorResponse } from "@/lib/database";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { getOrderAutomationSetting, updateOrderAutomationSetting } from "@/lib/order-delivery";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const setting = await getOrderAutomationSetting();
    return NextResponse.json({ ok: true, data: setting });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const setting = await updateOrderAutomationSetting({ morningBatchEnabled: body.morningBatchEnabled, morningBatchTime: body.morningBatchTime });
    await writeAuditLog({
      actorName: getActorName(request),
      action: "ORDER_BATCH_SETTING",
      entityType: "OrderAutomationSetting",
      entityId: String(setting.id),
      entityLabel: setting.morningBatchTime,
      summary: `Order မနက် batch ${setting.morningBatchEnabled ? "ဖွင့်" : "ပိတ်"}`,
      metadata: { morningBatchEnabled: setting.morningBatchEnabled, morningBatchTime: setting.morningBatchTime },
    });
    return NextResponse.json({ ok: true, data: setting });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
