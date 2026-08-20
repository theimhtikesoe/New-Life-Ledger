import { NextResponse } from "next/server";
import { getAutoReportRuns } from "@/lib/auto-report-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runs = await getAutoReportRuns();
    return NextResponse.json({
      data: {
        latest: runs[0] || null,
        history: runs,
      },
    });
  } catch (error) {
    console.error("Auto Report status read failed", error);
    return NextResponse.json({ error: "Auto Report အခြေအနေ ရယူ၍ မရပါ။" }, { status: 500 });
  }
}
