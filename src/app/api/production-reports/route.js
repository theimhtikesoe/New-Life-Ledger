import { NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { getMyanmarDateInputValue } from "@/lib/myanmar-time";
import { getMachine, MACHINES } from "@/lib/production-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDate(value) {
  const date = String(value || getMyanmarDateInputValue()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("ရက်စွဲပုံစံ မမှန်ပါ။");
  if (date > getMyanmarDateInputValue()) throw new Error("အနာဂတ်ရက်စွဲဖြင့် ထုတ်လုပ်မှုမှတ်တမ်း သိမ်း၍မရပါ။");
  return date;
}

function positiveInt(value, label) {
  const number = Number(value || 0);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} သည် အပေါင်းကိန်း ဖြစ်ရပါမည်။`);
  return number;
}

function normalizeRows(body) {
  if (!Array.isArray(body.rows)) throw new Error("ထွက်ရှိမှုစာရင်း မမှန်ပါ။");
  const rows = body.rows.map((row) => {
    const outputQuantity = positiveInt(row.outputQuantity, "ထွက်ရှိမှုအရေအတွက်");
    const capacity = positiveInt(row.outputCapacity, "ဆံ့ပမာဏ");
    if (!outputQuantity || !capacity) throw new Error("ထွက်ရှိမှုအရေအတွက်နှင့် ဆံ့ပမာဏ ထည့်ပေးပါ။");
    const category = row.category === "tube" ? "tube" : "bottle";
    if (category === "tube" && (!row.tubeG || !row.tubeColor)) throw new Error("Tube အမျိုးအစား မပြည့်စုံပါ။");
    if (category === "bottle" && !row.bottleType) throw new Error("ဗူးအမျိုးအစား မပြည့်စုံပါ။");
    return {
      category,
      outputQuantity,
      outputUnit: category === "tube" ? "အိတ်" : "ကဒ်",
      outputCapacity: String(capacity),
      bottleType: category === "bottle" ? String(row.bottleType) : null,
      tubeG: category === "tube" ? String(row.tubeG) : null,
      tubeColor: category === "tube" ? String(row.tubeColor) : null,
    };
  });
  if (rows.length === 0) throw new Error("ထွက်ရှိမှု အနည်းဆုံးတစ်ခု ထည့်ပေးပါ။");
  return rows;
}

function serialize(row) {
  return {
    ...row,
    outputQuantity: Number(row.outputQuantity),
    outputCapacity: row.outputCapacity == null ? null : String(row.outputCapacity),
    wasteQuantity: Number(row.wasteQuantity || 0),
    damagedPieces: Number(row.damagedPieces || 0),
    involvedWorkers: Array.isArray(row.involvedWorkers) ? row.involvedWorkers : [],
  };
}

export async function GET(request) {
  try {
    await ensureDatabase();
    const date = parseDate(new URL(request.url).searchParams.get("date"));
    const rows = await prisma.productionReport.findMany({
      where: { reportDate: date },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return NextResponse.json({ data: rows.map(serialize) });
  } catch (error) {
    console.error("Production report read failed", error);
    return NextResponse.json({ error: error.message || "ထုတ်လုပ်မှုမှတ်တမ်း ရယူ၍မရပါ။" }, { status: 400 });
  }
}

export async function POST(request) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const reportDate = parseDate(body.reportDate);
    const machineCode = String(body.machineCode || "").trim().toUpperCase();
    const machine = getMachine(machineCode) || MACHINES.find((item) => item.code === machineCode);
    if (!machine) throw new Error("စက်ရွေးပေးပါ။");
    const requestedCategory = body.category === "tube" ? "tube" : "bottle";
    if (machine.category === "tube" && requestedCategory !== "tube") throw new Error("ဤစက်အတွက် Tube အမျိုးအစားကိုရွေးပေးပါ။");
    const rows = normalizeRows({ ...body, rows: body.rows?.map((row) => ({ ...row, category: requestedCategory })) });
    const wasteQuantity = positiveInt(body.wasteQuantity, "ပျက်စီးအရေအတွက်");
    const actorName = getActorName(request);
    const submissionId = crypto.randomUUID();
    const involvedWorkers = Array.isArray(body.involvedWorkers)
      ? body.involvedWorkers.map((value) => String(value).trim()).filter(Boolean).slice(0, 20)
      : [];
    const notes = String(body.notes || "").trim() || null;
    const data = rows.map((row, index) => ({
      submissionId,
      reportDate,
      actorName,
      machineCode: machine.code,
      machineName: machine.name,
      category: row.category,
      outputQuantity: row.outputQuantity,
      outputUnit: row.outputUnit,
      outputCapacity: row.outputCapacity,
      bottleType: row.bottleType,
      tubeG: row.tubeG,
      tubeColor: row.tubeColor,
      wasteQuantity: index === 0 ? wasteQuantity : 0,
      wasteNote: index === 0 ? (String(body.wasteNote || "").trim() || null) : null,
      damagedPieces: index === 0 ? wasteQuantity : 0,
      involvedWorkers,
      notes,
    }));
    const created = await prisma.$transaction((tx) => tx.productionReport.createMany({ data }));
    const totalPieces = rows.reduce((sum, row) => sum + row.outputQuantity * Number(row.outputCapacity), 0);
    await writeAuditLog({
      actorName,
      action: "PRODUCTION_REPORT_SUBMIT",
      entityType: "ProductionReport",
      entityId: submissionId,
      entityLabel: `${machine.code} ${reportDate}`,
      summary: `${machine.code} ထုတ်လုပ်မှုမှတ်တမ်း တင်သွင်း (${totalPieces.toLocaleString()} ဗူး)`,
      metadata: { submissionId, reportDate, machineCode: machine.code, category: requestedCategory, lineCount: rows.length, totalPieces, wasteQuantity, involvedWorkers },
    });
    return NextResponse.json({ data: { submissionId, reportDate, machineCode: machine.code, lineCount: created.count, totalPieces, wasteQuantity } }, { status: 201 });
  } catch (error) {
    console.error("Production report write failed", error);
    return NextResponse.json({ error: error.message || "ထုတ်လုပ်မှုမှတ်တမ်း တင်သွင်း၍မရပါ။" }, { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const submissionId = String(body.submissionId || "").trim();
    if (!submissionId) throw new Error("ပြင်ဆင်မည့် report မတွေ့ပါ။");
    const reportDate = parseDate(body.reportDate);
    const machineCode = String(body.machineCode || "").trim().toUpperCase();
    const machine = getMachine(machineCode);
    if (!machine) throw new Error("စက်ရွေးပေးပါ။");
    const requestedCategory = body.category === "tube" ? "tube" : "bottle";
    if (machine.category === "tube" && requestedCategory !== "tube") throw new Error("ဤစက်အတွက် Tube အမျိုးအစားကိုရွေးပေးပါ။");
    const rows = normalizeRows({ ...body, rows: body.rows?.map((row) => ({ ...row, category: requestedCategory })) });
    const wasteQuantity = positiveInt(body.wasteQuantity, "ပျက်စီးအရေအတွက်");
    const actorName = getActorName(request);
    const involvedWorkers = Array.isArray(body.involvedWorkers) ? body.involvedWorkers.map((value) => String(value).trim()).filter(Boolean).slice(0, 20) : [];
    const notes = String(body.notes || "").trim() || null;
    const data = rows.map((row, index) => ({
      submissionId, reportDate, actorName, machineCode: machine.code, machineName: machine.name,
      category: row.category, outputQuantity: row.outputQuantity, outputUnit: row.outputUnit,
      outputCapacity: row.outputCapacity, bottleType: row.bottleType, tubeG: row.tubeG, tubeColor: row.tubeColor,
      wasteQuantity: index === 0 ? wasteQuantity : 0, wasteNote: index === 0 ? (String(body.wasteNote || "").trim() || null) : null,
      damagedPieces: index === 0 ? wasteQuantity : 0, involvedWorkers, notes,
    }));
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.productionReport.findFirst({ where: { submissionId }, select: { id: true } });
      if (!existing) throw new Error("ပြင်ဆင်မည့် report မတွေ့ပါ။");
      await tx.productionReport.deleteMany({ where: { submissionId } });
      return tx.productionReport.createMany({ data });
    });
    const totalPieces = rows.reduce((sum, row) => sum + row.outputQuantity * Number(row.outputCapacity), 0);
    await writeAuditLog({ actorName, action: "PRODUCTION_REPORT_UPDATE", entityType: "ProductionReport", entityId: submissionId, entityLabel: `${machine.code} ${reportDate}`, summary: `${machine.code} ထုတ်လုပ်မှုမှတ်တမ်း ပြင်ဆင် (${totalPieces.toLocaleString()} ဗူး)`, metadata: { submissionId, reportDate, machineCode: machine.code, lineCount: rows.length, totalPieces, wasteQuantity, involvedWorkers } });
    return NextResponse.json({ data: { submissionId, reportDate, machineCode: machine.code, lineCount: result.count, totalPieces, wasteQuantity } });
  } catch (error) {
    console.error("Production report update failed", error);
    return NextResponse.json({ error: error.message || "ထုတ်လုပ်မှုမှတ်တမ်း ပြင်ဆင်၍မရပါ။" }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    await ensureDatabase();
    const submissionId = String(new URL(request.url).searchParams.get("submissionId") || "").trim();
    if (!submissionId) throw new Error("ဖျက်မည့် report မတွေ့ပါ။");
    const actorName = getActorName(request);
    const result = await prisma.productionReport.deleteMany({ where: { submissionId } });
    if (!result.count) throw new Error("ဖျက်မည့် report မတွေ့ပါ။");
    await writeAuditLog({ actorName, action: "PRODUCTION_REPORT_DELETE", entityType: "ProductionReport", entityId: submissionId, entityLabel: submissionId, summary: "ထုတ်လုပ်မှုမှတ်တမ်း ဖျက်လိုက်သည်", metadata: { submissionId, deletedRows: result.count } });
    return NextResponse.json({ data: { submissionId, deletedRows: result.count } });
  } catch (error) {
    console.error("Production report delete failed", error);
    return NextResponse.json({ error: error.message || "ထုတ်လုပ်မှုမှတ်တမ်း ဖျက်၍မရပါ။" }, { status: 400 });
  }
}
