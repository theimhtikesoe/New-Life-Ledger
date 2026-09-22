"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function currentMonth() {
  const now = new Date(Date.now() + (6 * 60 + 30) * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
function number(value) { return Number(value || 0).toLocaleString(); }
function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export default function MonthlyPackagingBagReportPage() {
  const [month, setMonth] = useState(() => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("month") : "") || currentMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 55000);
    setLoading(true); setError("");
    fetch(`/api/monthly-packaging-bag-report?month=${encodeURIComponent(month)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "လစဉ် ထုပ်ပိုးအိတ်ခွံစာရင်း ရယူ၍မရပါ။"); return body.data; })
      .then(setData)
      .catch((fetchError) => { if (fetchError.name === "AbortError") setError("လစဉ် ထုပ်ပိုးအိတ်ခွံစာရင်း ရယူချိန်ကျော်သွားပါသည်။ Refresh ပြန်လုပ်ပါ။"); else setError(fetchError.message || "လစဉ် ထုပ်ပိုးအိတ်ခွံစာရင်း ရယူ၍မရပါ။"); })
      .finally(() => setLoading(false));
    return () => { window.clearTimeout(timeoutId); controller.abort(); };
  }, [month]);

  const daily = data?.daily || [];
  const dailyBagTotal = daily.reduce((sum, row) => sum + Number(row.totalBags || 0), 0);
  const dailyPieceTotal = daily.reduce((sum, row) => sum + Number(row.totalPieces || 0), 0);
  const dailyRows = useMemo(() => [...daily].sort((a, b) => b.date.localeCompare(a.date)), [daily]);

  function exportCsv() {
    const lines = [
      ["တစ်လစာ ထုပ်ပိုးအိတ်ခွံ", month], [],
      ["ရက်စွဲ", "အိတ်စုစုပေါင်း", "ဗူးစုစုပေါင်း"],
      ...dailyRows.map((row) => [row.date, row.totalBags, row.totalPieces]), [],
      ["အိတ်အရွယ်အစားအလိုက် စုစုပေါင်း", "အိတ်", "ဗူး"],
      ...(data?.groups || []).flatMap((group) => [[group.label, group.cards, group.pieces]]), [],
      ["ဗူးအမျိုးအစားအလိုက် အသေးစိတ်", "ဆံ့", "ကဒ်", "ဗူး"],
      ...(data?.groups || []).flatMap((group) => (group.items || []).map((item) => [item.label, item.capacity, item.quantity, item.quantity * item.capacity])),
    ].map((row) => row.map(csvCell).join(","));
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `monthly-packaging-bag-report-${month}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <main className="app-page-main">
      <div className="app-page-container space-y-4">
        <header className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-violet-50 p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-sm font-black text-cyan-800">နေ့စဉ် ထုပ်ပိုးအိတ်ခွံတွက်ချက်မှုများကို လအလိုက် စုစည်းပြထားပါသည်။</p><p className="mt-1 text-xs font-bold text-slate-500">နေ့စဉ် ဗူးထုတ်လုပ်မှုမှတ်တမ်းများကို ဆွဲယူပြီး အိတ်အရွယ်အစားအလိုက် ပြန်တွက်ထားပါသည်။</p></div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end"><label className="flex flex-col gap-1 text-sm font-black text-slate-700">လ ရွေးရန်<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-12 rounded-xl border-2 border-cyan-300 bg-white px-3 text-base font-black" /></label><button type="button" onClick={exportCsv} disabled={loading || !data} className="h-12 rounded-xl bg-emerald-600 px-5 font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">CSV ပြန်ထုတ်ရန်</button></div>
          </div>
          <div className="mt-3"><Link href={`/packaging-bag-report?date=${encodeURIComponent(`${month}-01`)}`} className="inline-flex rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm font-black text-cyan-800 hover:bg-cyan-50">တစ်နေ့တာ report သို့ ပြန်သွားရန်</Link></div>
        </header>
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">{error}</div> : null}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[["အိတ်စုစုပေါင်း", `${number(data?.totalBags)} အိတ်`, "border-cyan-200 bg-cyan-50 text-cyan-950"], ["ဗူးစုစုပေါင်း", `${number(data?.totalPieces)} ဗူး`, "border-emerald-200 bg-emerald-50 text-emerald-950"], ["ထုတ်လုပ်မှုရှိသည့်ရက်", `${number(data?.days)} ရက်`, "border-violet-200 bg-violet-50 text-violet-950"], ["မှတ်တမ်းအရေအတွက်", `${number(data?.records)} ကြောင်း`, "border-amber-200 bg-amber-50 text-amber-950"]].map(([label, value, className]) => <div key={label} className={`rounded-xl border p-4 ${className}`}><p className="text-xs font-black opacity-70">{label}</p><p className="mt-2 text-2xl font-black">{loading ? "—" : value}</p></div>)}
        </section>
        {loading ? <div className="rounded-xl border bg-white p-10 text-center font-bold text-slate-500">လစဉ် ထုပ်ပိုးအိတ်ခွံစာရင်း ရယူနေသည်... ပထမဆုံးအကြိမ်တွင် database ချိတ်ဆက်ရန် အချိန်အနည်းငယ် ကြာနိုင်ပါသည်။</div> : null}
        {!loading && data ? <>
          <section className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-black text-cyan-950">အိတ်အရွယ်အစားအလိုက် လစဉ်စုစုပေါင်း</h2><p className="mt-1 text-sm font-bold text-cyan-800">လအတွင်း လိုအပ်သော အိတ်အရေအတွက်နှင့် ထုပ်ပိုးမည့်ဗူးအရေအတွက်</p></div><span className="rounded-full bg-white px-3 py-1 text-sm font-black text-cyan-800">{number(data.groups?.length)} မျိုး</span></div><div className="mt-4 overflow-x-auto rounded-xl border border-cyan-100 bg-white"><table className="w-full min-w-[620px] text-sm"><thead className="bg-cyan-100 text-cyan-950"><tr><th className="px-3 py-3 text-left font-black">အိတ်အရွယ်</th><th className="px-3 py-3 text-right font-black">အိတ်စုစုပေါင်း</th><th className="px-3 py-3 text-right font-black">ဗူးစုစုပေါင်း</th></tr></thead><tbody>{(data.groups || []).map((group) => <tr key={group.bagSize} className="border-t border-cyan-100"><td className="px-3 py-3 font-black">{group.label} အိတ်</td><td className="px-3 py-3 text-right font-black text-cyan-700">{number(group.cards)} အိတ်</td><td className="px-3 py-3 text-right font-black text-emerald-700">{number(group.pieces)} ဗူး</td></tr>)}</tbody><tfoot className="border-t-2 border-cyan-200 bg-cyan-50"><tr><td className="px-3 py-3 font-black">လစဉ်စုစုပေါင်း</td><td className="px-3 py-3 text-right font-black text-cyan-800">{number(data.totalBags)} အိတ်</td><td className="px-3 py-3 text-right font-black text-emerald-800">{number(data.totalPieces)} ဗူး</td></tr></tfoot></table></div></section>
          <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm sm:p-5"><h2 className="text-xl font-black text-indigo-950">ရက်စွဲအလိုက် နေ့စဉ်စာရင်း</h2><p className="mt-1 text-sm font-bold text-indigo-800">နေ့စဉ် ထုပ်ပိုးအိတ်ခွံ report များမှ ဆွဲယူထားသော စုစုပေါင်း</p><div className="mt-4 overflow-x-auto rounded-xl border border-indigo-100 bg-white"><table className="w-full min-w-[620px] text-sm"><thead className="bg-indigo-100 text-indigo-950"><tr><th className="px-3 py-3 text-left font-black">ရက်စွဲ</th><th className="px-3 py-3 text-right font-black">အိတ်</th><th className="px-3 py-3 text-right font-black">ဗူး</th></tr></thead><tbody>{dailyRows.length ? dailyRows.map((row) => <tr key={row.date} className="border-t border-indigo-50"><td className="px-3 py-3 font-bold">{row.date}</td><td className="px-3 py-3 text-right font-black text-cyan-700">{number(row.totalBags)} အိတ်</td><td className="px-3 py-3 text-right font-black text-emerald-700">{number(row.totalPieces)} ဗူး</td></tr>) : <tr><td colSpan="3" className="px-3 py-8 text-center font-bold text-slate-500">ဒီလအတွက် ထုပ်ပိုးအိတ်ခွံ data မရှိသေးပါ။</td></tr>}</tbody><tfoot className="border-t-2 border-indigo-200 bg-indigo-50"><tr><td className="px-3 py-3 font-black">ရက်စွဲများပေါင်း</td><td className="px-3 py-3 text-right font-black text-cyan-800">{number(dailyBagTotal)} အိတ်</td><td className="px-3 py-3 text-right font-black text-emerald-800">{number(dailyPieceTotal)} ဗူး</td></tr></tfoot></table></div></section>
          <section className="grid gap-3 lg:grid-cols-2">{(data.groups || []).map((group) => <details key={group.bagSize} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><summary className="cursor-pointer list-none text-lg font-black text-slate-900"><span className="mr-2 inline-block transition-transform group-open:rotate-90">▶</span>{group.label} အိတ် — {number(group.cards)} အိတ်</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead className="bg-slate-100"><tr><th className="px-3 py-2 text-left font-black">ဗူးအမျိုးအစား</th><th className="px-3 py-2 text-right font-black">ဆံ့</th><th className="px-3 py-2 text-right font-black">ကဒ်</th><th className="px-3 py-2 text-right font-black">ဗူး</th></tr></thead><tbody>{(group.items || []).map((item) => <tr key={item.key} className="border-t border-slate-100"><td className="px-3 py-2 font-bold">{item.label}</td><td className="px-3 py-2 text-right">{number(item.capacity)}</td><td className="px-3 py-2 text-right font-black">{number(item.quantity)} {item.unit}</td><td className="px-3 py-2 text-right font-black text-emerald-700">{number(item.quantity * item.capacity)}</td></tr>)}</tbody></table></div></details>)}</section>
          {(data.unassigned || []).length ? <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4"><h2 className="text-lg font-black text-amber-950">အိတ်အရွယ်အစား မသတ်မှတ်ရသေးသော စာရင်း</h2><p className="mt-1 text-sm font-bold text-amber-800">နေ့စဉ် report များထဲမှ mapping မရှိသေးသော ဗူးများ</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.unassigned.map((item) => <div key={`${item.label}|${item.capacity}|${item.unit}`} className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-amber-950">{item.label} · {number(item.capacity)} ဆံ့ · {number(item.quantity)} {item.unit}</div>)}</div></section> : null}
        </> : null}
      </div>
    </main>
  );
}
