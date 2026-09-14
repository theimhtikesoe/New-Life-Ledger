import { getDailyReportData, createDailyReportPdf } from "@/lib/daily-report";
import { getMyanmarDayRange } from "@/lib/myanmar-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function validDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("ရွေးထားသော report date မမှန်ကန်ပါ။");
  return date;
}

export async function GET(request) {
  try {
    const requestedDate = validDate(new URL(request.url).searchParams.get("date"));
    const report = await getDailyReportData(getMyanmarDayRange(requestedDate));
    const pdfBuffer = await createDailyReportPdf(report);
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="New-Life-Ledger-Daily-${report.dateLabel}.pdf"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Daily PDF download failed", error);
    return Response.json({ ok: false, error: error.message || "PDF ရယူ၍မရပါ။" }, { status: 400 });
  }
}
