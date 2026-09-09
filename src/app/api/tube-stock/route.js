import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const recentDate = String(searchParams.get("date") || "").trim();
    const tubeType = String(searchParams.get("type") || "").trim();
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(recentDate) ? recentDate : "";
    const validLimit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 30) || 30));
    const rows = await prisma.productionReport.findMany({
      where: { category: "tube" },
      orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
      select: { outputQuantity: true, outputCapacity: true, tubeG: true, tubeColor: true },
    });
    const recentRows = await prisma.productionReport.findMany({
      where: { category: "tube", ...(validDate ? { reportDate: validDate } : {}), ...(tubeType ? { OR: [{ tubeG: tubeType.split(" ")[0], tubeColor: tubeType.split(" ").slice(1).join(" ") }, { tubeG: tubeType }] } : {}) },
      orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
      take: validLimit,
      select: { id: true, reportDate: true, tubeG: true, tubeColor: true, outputQuantity: true, outputCapacity: true, machineName: true, machineCode: true, actorName: true, involvedWorkers: true },
    });
    const byType = new Map();
    let totalPacks = 0;
    let totalPieces = 0;
    rows.forEach((row) => {
      const packs = Number(row.outputQuantity || 0);
      const capacity = Number(row.outputCapacity || 0);
      const pieces = packs * capacity;
      const key = `${row.tubeG || "Tube"} ${row.tubeColor || ""}`.trim();
      const current = byType.get(key) || { tubeType: key, packs: 0, pieces: 0, records: 0 };
      current.packs += packs;
      current.pieces += pieces;
      current.records += 1;
      byType.set(key, current);
      totalPacks += packs;
      totalPieces += pieces;
    });
    return NextResponse.json({
      data: {
        totalPacks,
        totalPieces,
        records: rows.length,
        byType: [...byType.values()].sort((a, b) => b.pieces - a.pieces),
        recentDate: validDate || null,
        recentType: tubeType || null,
        recentLimit: validLimit,
        recent: recentRows.map((row) => ({
          id: row.id,
          reportDate: row.reportDate,
          tubeType: `${row.tubeG || "Tube"} ${row.tubeColor || ""}`.trim(),
          packs: Number(row.outputQuantity || 0),
          capacity: Number(row.outputCapacity || 0),
          pieces: Number(row.outputQuantity || 0) * Number(row.outputCapacity || 0),
          machineName: row.machineName || row.machineCode,
          actorName: row.actorName,
          involvedWorkers: Array.isArray(row.involvedWorkers) ? row.involvedWorkers : [],
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
