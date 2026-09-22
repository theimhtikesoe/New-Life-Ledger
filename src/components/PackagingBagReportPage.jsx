"use client";

import { useEffect, useMemo, useState } from "react";
import { calculatePackagingBags } from "@/lib/packaging-bag-calculator";

function todayMyanmar() {
  const now = new Date(Date.now() + (6 * 60 + 30) * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}
function shiftDate(value, delta) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + delta); return date.toISOString().slice(0, 10); }
function formatNumber(value) { return Number(value || 0).toLocaleString(); }

export default function PackagingBagReportPage() {
  const [date, setDate] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const queryDate = new URLSearchParams(window.location.search).get("date");
    setDate(/^\d{4}-\d{2}-\d{2}$/.test(queryDate || "") ? queryDate : todayMyanmar());
  }, []);
  useEffect(() => {
    if (!date) return undefined;
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/production-reports?date=${encodeURIComponent(date)}&category=bottle`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "ထုတ်လုပ်မှုမှတ်တမ်း ရယူ၍မရပါ။"); return body.data; })
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((loadError) => { if (loadError.name !== "AbortError") { setRows([]); setError(loadError.message || "ထုတ်လုပ်မှုမှတ်တမ်း ရယူ၍မရပါ။"); } })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [date]);

  const report = useMemo(() => calculatePackagingBags(rows), [rows]);
  return (
    <main data-layout-version="shared-header-width-v4" className="shared-report-route-main mx-auto w-full space-y-4 px-3 pb-8 sm:px-6">
      <section className="rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-bold text-cyan-700">ဗူးထွက်ရှိမှုမှတ်တမ်းကို အိတ်ခွံအရွယ်အစားအလိုက် ပြန်တွက်ထားသော စာရင်း</p><p className="mt-1 text-xs text-slate-500">ကဒ် ၁ ကဒ် = အိတ် ၁ အိတ်ဟု သတ်မှတ်တွက်ချက်ထားပါသည်။</p></div>
          <label className="text-sm font-black text-cyan-900">မှတ်တမ်း Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 block min-h-11 rounded-xl border-2 border-cyan-200 bg-cyan-50 px-3 py-2 font-bold text-cyan-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200" /></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">{[-1, 0, 1].map((delta) => { const value = shiftDate(todayMyanmar(), delta); const label = delta === -1 ? "မနေ့" : delta === 0 ? "ဒီနေ့" : "မနက်ဖြန်"; return <button key={label} type="button" onClick={() => setDate(value)} className={`rounded-lg border px-4 py-2 text-sm font-black ${date === value ? "border-cyan-600 bg-cyan-600 text-white" : "border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"}`}>{label}</button>; })}</div>
      </section>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}
      <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4"><p className="text-sm font-bold text-cyan-700">ယနေ့ အိတ်ခွံ စုစုပေါင်း</p><p className="mt-1 text-2xl font-black text-cyan-900">{loading ? "—" : `${formatNumber(report.totalBags)} အိတ်`}</p></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-bold text-emerald-700">ယနေ့ ထုပ်ပိုးသည့် ဗူး</p><p className="mt-1 text-2xl font-black text-emerald-900">{loading ? "—" : `${formatNumber(report.totalPieces)} ဗူး`}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-bold text-slate-700">အိတ်အရွယ်အစား</p><p className="mt-1 text-2xl font-black text-slate-900">{loading ? "—" : `${formatNumber(report.groups.length)} မျိုး`}</p></div></section>
      {loading ? <div className="rounded-2xl border border-dashed p-10 text-center font-bold text-slate-500">ထုပ်ပိုးအိတ်ခွံစာရင်း ရယူနေသည်...</div> : report.groups.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center font-bold text-slate-500">{date} အတွက် တွက်ချက်နိုင်သော ဗူးထွက်ရှိမှု မရှိသေးပါ။</div> : <section className="space-y-3">{report.groups.map((group) => <article key={group.bagSize} className="rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-black text-slate-900">{group.label} အိတ်</h2><p className="text-xs font-bold text-slate-500">ဒီအရွယ်အစားအိတ်နဲ့ ထုပ်ပိုးရမယ့် ကဒ်စာရင်း</p></div><div className="rounded-xl bg-cyan-600 px-4 py-2 text-right text-white"><p className="text-xs font-bold">အိတ်ကုန်သည့်အရေအတွက်</p><p className="text-xl font-black">{formatNumber(group.cards)} အိတ်</p></div></div><div className="mt-3 overflow-x-auto rounded-xl border border-slate-100"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-slate-100 text-slate-700"><tr><th className="px-3 py-2 font-black">ဗူးအမျိုးအစား</th><th className="px-3 py-2 font-black">ဆံ့</th><th className="px-3 py-2 text-right font-black">ကဒ်</th><th className="px-3 py-2 text-right font-black">ဗူး</th></tr></thead><tbody>{group.items.map((item) => <tr key={item.key} className="border-t border-slate-100"><td className="px-3 py-2 font-bold">{item.label}</td><td className="px-3 py-2 font-bold">{formatNumber(item.capacity)} ဆံ့</td><td className="px-3 py-2 text-right font-black">{formatNumber(item.quantity)} {item.unit}</td><td className="px-3 py-2 text-right font-black text-emerald-700">{formatNumber(item.quantity * item.capacity)}</td></tr>)}</tbody></table></div></article>)}</section>}
      {report.unassigned.length ? <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4"><h2 className="font-black text-amber-950">အိတ်အရွယ်အစား မသတ်မှတ်ရသေးသော စာရင်း</h2><p className="mt-1 text-sm font-bold text-amber-800">အောက်ပါဗူးများအတွက် user ပေးထားသော mapping ထဲတွင် အိတ်အရွယ်အစား မပါသေးပါ။</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{report.unassigned.map((item, index) => <div key={`${item.label}|${item.capacity}|${index}`} className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-amber-950">{item.label} · {formatNumber(item.capacity)} ဆံ့ · {formatNumber(item.quantity)} {item.unit}</div>)}</div></section> : null}
    </main>
  );
}
