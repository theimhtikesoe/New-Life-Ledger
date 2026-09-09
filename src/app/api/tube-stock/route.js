import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDatabase();
    const rows = await prisma.productionReport.findMany({
      where: { category: "tube" },
      orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
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
        recent: rows.slice(0, 30).map((row) => ({
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
