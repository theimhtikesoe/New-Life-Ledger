import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function DELETE(request, { params }) {
  try {
    await ensureDatabase();
    const auditLog = await prisma.auditLog.findUnique({
      where: { id: params.id },
      select: { id: true, hiddenAt: true },
    });

    if (!auditLog) {
      return NextResponse.json({ error: "Activity မှတ်တမ်း မတွေ့ပါ။" }, { status: 404 });
    }

    if (auditLog.hiddenAt) {
      return NextResponse.json({ data: { id: auditLog.id, hidden: true, alreadyHidden: true } });
    }

    const updated = await prisma.auditLog.update({
      where: { id: auditLog.id },
      data: {
        hiddenAt: new Date(),
        hiddenBy: getActorName(request),
      },
      select: { id: true, hiddenAt: true, hiddenBy: true },
    });

    return NextResponse.json({ data: { ...updated, hidden: true } });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
