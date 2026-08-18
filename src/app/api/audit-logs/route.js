import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { ACTORS } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const actor = searchParams.get("actor");
    const action = searchParams.get("action");
    const limitParam = Number(searchParams.get("limit") || 100);
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? Math.floor(limitParam) : 100, 1), 500);

    const createdAt = {};
    if (dateParam) {
      const start = new Date(`${dateParam}T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      createdAt.gte = start;
      createdAt.lt = end;
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(Object.keys(createdAt).length ? { createdAt } : {}),
        ...(ACTORS.includes(actor) ? { actorName: actor } : {}),
        ...(action ? { action } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });

    return NextResponse.json({ data: logs });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
