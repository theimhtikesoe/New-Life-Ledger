import { NextResponse } from "next/server";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { calculatePackagingBags } from "@/lib/packaging-bag-calculator";
import { getMyanmarDateInputValue } from "@/lib/myanmar-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseMonth(value) {
  const month = String(value || getMyanmarDateInputValue().slice(0, 7)).trim();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("လ ရွေးချယ်မှု ပုံစံ မမှန်ပါ။");
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) throw new Error("လ ရွေးချယ်မှု ပုံစံ မမှန်ပါ။");
  const firstDate = `${month}-01`;
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return { month, firstDate, nextDate: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01` };
}

function serialize(row) {
  return {
    id: row.id,
    reportDate: row.reportDate,
    category: row.category,
    outputQuantity: Number(row.outputQuantity || 0),
    outputCapacity: row.outputCapacity == null ? null : String(row.outputCapacity),
    outputUnit: row.outputUnit || null,
    bottleType: row.bottleType || null,
  };
}

export async function GET(request) {
  try {
    await ensureDatabase();
    const { month, firstDate, nextDate } = parseMonth(new URL(request.url).searchParams.get("month"));
    const rows = await prisma.productionReport.findMany({
      where: { category: "bottle", reportDate: { gte: firstDate, lt: nextDate } },
      select: { id: true, reportDate: true, category: true, outputQuantity: true, outputCapacity: true, outputUnit: true, bottleType: true },
      orderBy: [{ reportDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    const serializedRows = rows.map(serialize);
    const monthly = calculatePackagingBags(serializedRows);
    const dailyMap = new Map();
    for (const row of serializedRows) {
      const current = dailyMap.get(row.reportDate) || [];
      current.push(row);
      dailyMap.set(row.reportDate, current);
    }
    const daily = [...dailyMap.entries()].map(([date, dateRows]) => {
      const report = calculatePackagingBags(dateRows);
      return { date, totalBags: report.totalBags, totalPieces: report.totalPieces, groups: report.groups, unassigned: report.unassigned };
    });
    const unassignedMap = new Map();
    for (const item of monthly.unassigned) {
      const key = `${item.label}|${item.capacity}|${item.unit}`;
      const current = unassignedMap.get(key) || { ...item, quantity: 0 };
      current.quantity += Number(item.quantity || 0);
      unassignedMap.set(key, current);
    }
    return NextResponse.json({ data: { month, days: daily.length, records: serializedRows.length, totalBags: monthly.totalBags, totalPieces: monthly.totalPieces, groups: monthly.groups, unassigned: [...unassignedMap.values()], daily } });
  } catch (error) {
    console.error("Monthly packaging bag report read failed", error);
    return NextResponse.json(databaseErrorResponse(error), { status: 400 });
  }
}
