import { NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { normalizeTubeTypes } from "@/lib/production-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseMonth(value) {
  const month = String(value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("လ ရွေးချယ်မှု မမှန်ကန်ပါ။");
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) throw new Error("လ ရွေးချယ်မှု မမှန်ကန်ပါ။");
  const firstDate = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const nextDateValue = new Date(Date.UTC(year, monthNumber, 1));
  const nextDate = `${nextDateValue.getUTCFullYear()}-${String(nextDateValue.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return { month, firstDate, nextDate };
}

function numeric(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function metricsOf(row) {
  const metrics = row.tubeMetrics && typeof row.tubeMetrics === "object" ? row.tubeMetrics : {};
  return {
    usedGlueKg: numeric(metrics.usedGlueKg),
    usedGlueBags: numeric(metrics.usedGlueBags),
    remainingGlueKg: numeric(metrics.remainingGlueKg),
    remainingGlueBags: numeric(metrics.remainingGlueBags),
    scrapKg: numeric(metrics.scrapKg),
    tubeDamageKg: numeric(metrics.tubeDamageKg),
    glueWasteKg: numeric(metrics.glueWasteKg),
    scrapTubeCount: numeric(metrics.scrapTubeCount),
    scrapGlueCount: numeric(metrics.scrapGlueCount),
  };
}

function blankMaterial() {
  return { usedGlueKg: 0, usedGlueBags: 0, remainingGlueKg: 0, remainingGlueBags: 0, scrapKg: 0, tubeDamageKg: 0, glueWasteKg: 0, scrapTubeCount: 0, scrapGlueCount: 0 };
}

function addMaterial(target, source) {
  for (const key of Object.keys(target)) target[key] += numeric(source[key]);
  return target;
}

function tubeLabel(row) {
  return normalizeTubeTypes(`${row.tubeG || "Tube"} ${row.tubeColor || ""}`)[0] || "Tube";
}

function serializeRow(row) {
  const outputQuantity = numeric(row.outputQuantity);
  const outputCapacity = numeric(row.outputCapacity);
  return {
    id: row.id,
    submissionId: row.submissionId,
    reportDate: row.reportDate,
    actorName: row.actorName,
    machineCode: row.machineCode,
    machineName: row.machineName,
    tubeG: row.tubeG,
    tubeColor: row.tubeColor,
    tubeType: tubeLabel(row),
    outputQuantity,
    outputCapacity,
    pieces: outputQuantity * outputCapacity,
    tubeMetrics: row.tubeMetrics && typeof row.tubeMetrics === "object" ? row.tubeMetrics : {},
    involvedWorkers: Array.isArray(row.involvedWorkers) ? row.involvedWorkers : [],
    notes: row.notes,
  };
}

export async function GET(request) {
  try {
    await ensureDatabase();
    const { month, firstDate, nextDate } = parseMonth(new URL(request.url).searchParams.get("month"));
    const rows = await prisma.productionReport.findMany({
      where: { category: "tube", reportDate: { gte: firstDate, lt: nextDate } },
      orderBy: [{ reportDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    const serializedRows = rows.map(serializeRow);
    const totals = { packs: 0, pieces: 0, reports: serializedRows.length, tubeDamageKg: 0 };
    const materialTotals = blankMaterial();
    const byType = new Map();
    const byDate = new Map();
    const byMachine = new Map();

    for (const row of serializedRows) {
      const material = metricsOf(row);
      totals.packs += row.outputQuantity;
      totals.pieces += row.pieces;
      totals.tubeDamageKg += material.tubeDamageKg;
      addMaterial(materialTotals, material);

      const typeKey = `${row.tubeType}::${row.outputCapacity}`;
      const typeSummary = byType.get(typeKey) || { tubeType: row.tubeType, capacity: row.outputCapacity, packs: 0, pieces: 0, reports: 0 };
      typeSummary.packs += row.outputQuantity; typeSummary.pieces += row.pieces; typeSummary.reports += 1;
      byType.set(typeKey, typeSummary);

      const dateSummary = byDate.get(row.reportDate) || { date: row.reportDate, reports: 0, packs: 0, pieces: 0, material: blankMaterial() };
      dateSummary.reports += 1; dateSummary.packs += row.outputQuantity; dateSummary.pieces += row.pieces; addMaterial(dateSummary.material, material);
      byDate.set(row.reportDate, dateSummary);

      const machineKey = row.machineCode || row.machineName || "မသတ်မှတ်ရသေး";
      const machineSummary = byMachine.get(machineKey) || { machineCode: row.machineCode, machineName: row.machineName || row.machineCode || "မသတ်မှတ်ရသေး", reports: 0, packs: 0, pieces: 0 };
      machineSummary.reports += 1; machineSummary.packs += row.outputQuantity; machineSummary.pieces += row.pieces;
      byMachine.set(machineKey, machineSummary);
    }

    return NextResponse.json({
      data: {
        month,
        firstDate,
        nextDate,
        totals,
        materialTotals,
        typeSummaries: [...byType.values()].sort((a, b) => a.tubeType.localeCompare(b.tubeType) || a.capacity - b.capacity),
        dailySummaries: [...byDate.values()],
        machineSummaries: [...byMachine.values()].sort((a, b) => a.machineName.localeCompare(b.machineName)),
        rows: serializedRows,
      },
    });
  } catch (error) {
    console.error("Monthly Tube production read failed", error);
    return NextResponse.json({ error: error.message || "တစ်လစာ Tube ထွက်ရှိမှု ရယူ၍မရပါ။" }, { status: 400 });
  }
}

export { addMaterial, metricsOf, parseMonth, serializeRow };
