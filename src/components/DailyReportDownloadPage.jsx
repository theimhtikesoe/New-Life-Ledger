"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPreviousMyanmarDayRange } from "@/lib/myanmar-time";
import { formatMyanmarClock, formatMyanmarDateLabel } from "@/lib/myanmar-time-client";

export default function DailyReportDownloadPage() {
  const [date, setDate] = useState(() => getPreviousMyanmarDayRange().dateLabel);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const downloadPdf = async () => {
    if (!date || loading) return;
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/telegram/daily-report-pdf?date=${encodeURIComponent(date)}`, { cache: "no-store" });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("application/pdf")) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "PDF ရယူ၍မရပါ။");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `New-Life-Ledger-Daily-${date}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage(`${date} PDF ကို download လုပ်ပြီးပါပြီ။`);
    } catch (downloadError) {
      setError(downloadError.message || "PDF ရယူ၍မရပါ။");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-6 sm:px-6 sm:py-10">
      <section className="mx-auto max-w-2xl rounded-2xl border border-violet-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div><p className="text-xs font-bold text-slate-500">ယနေ့ရက်စွဲ</p><p className="mt-1 text-sm font-black text-slate-800">{formatMyanmarDateLabel(currentTime)}</p><p className="mt-1 font-mono text-xl font-black tracking-wider text-cyan-700">{formatMyanmarClock(currentTime)}</p><p className="text-[11px] text-slate-500">Myanmar Time (UTC+06:30)</p></div>
          <Link href="/" className="rounded-lg border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-black text-cyan-700 hover:bg-cyan-100">← Dashboard သို့</Link>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-violet-600">NEW LIFE LEDGER</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">နေ့စွဲအလိုက် Daily PDF Download</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Website ထဲက ရွေးထားသောရက်စွဲအတိုင်း Telegram report PDF ကို ပြန်ထုတ်ပြီး download လုပ်နိုင်ပါသည်။</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
          <label htmlFor="daily-report-download-date" className="block text-sm font-black text-violet-900">PDF ရက်စွဲရွေးပါ</label>
          <input id="daily-report-download-date" type="date" value={date} onChange={(event) => { setDate(event.target.value); setMessage(""); setError(""); }} className="mt-2 min-h-12 w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-base font-bold text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
          <p className="mt-2 text-xs text-violet-700">ရက်စွဲရွေးပြီး အောက်က Download ခလုတ်ကိုနှိပ်ပါ။ PDF ထဲမှာ sales, production, Tube details နဲ့ bottle sales စာရင်းများ ပါဝင်ပါမည်။</p>
        </div>

        {message ? <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-4 whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}

        <button type="button" onClick={downloadPdf} disabled={!date || loading} className="mt-6 w-full rounded-xl bg-violet-600 px-4 py-3 text-base font-black text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? "PDF ပြင်ဆင်နေသည်..." : "📄 PDF Download လုပ်မည်"}
        </button>
        <p className="mt-3 text-center text-xs text-slate-500">ရွေးထားတဲ့ရက်စွဲကိုသာ အသုံးပြုပြီး data အသစ်နဲ့ PDF ပြန်ထုတ်ပေးပါမည်။</p>
      </section>
    </main>
  );
}
