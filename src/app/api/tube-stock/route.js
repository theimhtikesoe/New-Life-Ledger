import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { loadDerivedFactoryStockMovements, normalizeTubeIdentity, STOCK_TYPES } from "@/lib/factory-stock";

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
    const allTubeMovements = (await loadDerivedFactoryStockMovements()).filter((movement) => movement.stockType === STOCK_TYPES.TUBE);
    const movements = tubeType
      ? allTubeMovements.filter((movement) => movement.productName === normalizeTubeIdentity(tubeType).productName).map((movement) => ({
        movementDate: movement.movementDate,
        movementType: movement.movementType,
        sourceType: movement.sourceType,
        quantityBottles: movement.quantityBottles,
        quantityCards: movement.quantityCards,
        capacity: movement.capacity,
        reason: movement.reason,
        note: movement.note,
      }))
      : [];
    const byType = new Map();
    let totalPacks = 0;
    let totalPieces = 0;
    for (const movement of allTubeMovements) {
      const current = byType.get(movement.productKey) || { tubeType: movement.productName, capacity: Number(movement.capacity || 0), productionPacks: 0, productionPieces: 0, usedPieces: 0, adjustmentPieces: 0, currentPieces: 0, currentPacks: 0 };
      const packs = Number(movement.quantityCards || 0);
      const pieces = Number(movement.quantityBottles || 0);
      if (movement.movementType === "PRODUCTION_IN") {
        current.productionPacks += packs;
        current.productionPieces += pieces;
        totalPacks += packs;
        totalPieces += pieces;
      } else if (movement.movementType === "PRODUCTION_USE_OUT") {
        current.usedPieces += Math.abs(pieces);
      } else {
        current.adjustmentPieces += pieces;
      }
      current.currentPieces += pieces;
      current.currentPacks = current.capacity ? Math.floor(current.currentPieces / current.capacity) : 0;
      byType.set(movement.productKey, current);
    }
    const byTypeRows = [...byType.values()].sort((a, b) => b.currentPieces - a.currentPieces);
    return NextResponse.json({
      data: {
        totalPacks,
        totalPieces,
        records: rows.length,
        byType: byTypeRows,
        recentDate: validDate || null,
        recentType: tubeType || null,
        recentLimit: validLimit,
        movements,
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
