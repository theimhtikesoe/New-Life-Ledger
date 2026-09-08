'use client';

import { useEffect, useState } from "react";

function todayValue() {
  const now = new Date();
  const local = new Date(now.getTime() + (6 * 60 + 30) * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

function money(value) {
  return `${Number(value || 0).toLocaleString()} Ks`;
}

export default function DailyBottleSalesPage() {
  const [date, setDate] = useState(() => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("date") : "") || todayValue());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/daily-bottle-sales?date=${encodeURIComponent(date)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "ဗူးရောင်းစာရင်း ရယူ၍မရပါ။");
        setData(body.data);
      })
      .catch((fetchError) => { if (fetchError.name !== "AbortError") setError(fetchError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [date]);

  return (
    <main className="app-page-main">
      <div className="app-page-container space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Daily Bottle Sales</p>
              <h2 className="mt-1 text-2xl font-black text-slate-900">တစ်နေ့တာ ဗူးရောင်းစာရင်း</h2>
              <p className="mt-2 text-sm text-slate-600">Customer တစ်ဦးချင်းအလိုက် ရောင်းထားသော item၊ ဆံ့၊ ဗူးအရေအတွက်နှင့် စုစုပေါင်းငွေ</p>
            </div>
            <label className="shrink-0 text-sm font-bold text-slate-700">ရက်စွဲ<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 h-12 rounded-xl border-2 border-slate-300 bg-slate-50 px-3 text-base font-black" /></label>
          </div>
        </section>

        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Customer</p><p className="mt-1 text-2xl font-black text-slate-900">{loading ? "—" : Number(data?.totalCustomers || 0).toLocaleString()} ယောက်</p></div>
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4"><p className="text-xs font-bold text-cyan-700">စုစုပေါင်း ဗူး</p><p className="mt-1 text-2xl font-black text-cyan-900">{loading ? "—" : Number(data?.totalBottles || 0).toLocaleString()} ဗူး</p></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-700">စုစုပေါင်းငွေ</p><p className="mt-1 text-2xl font-black text-amber-900">{loading ? "—" : money(data?.totalAmount)}</p></div>
        </section>

        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">ဗူးရောင်းစာရင်း ရယူနေသည်...</div> : null}
        {!loading && !data?.customers?.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center font-bold text-slate-500">ဒီရက်အတွက် ဗူးရောင်းစာရင်း မရှိသေးပါ။</div> : null}
        <section className="space-y-3">
          {data?.customers?.map((customerRow) => (
            <article key={customerRow.customer.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="text-lg font-black text-slate-900">{customerRow.customer.name}</h3><p className="text-xs text-slate-500">{customerRow.customer.phone || "ဖုန်းမရှိ"} · {customerRow.transactions} ကြိမ်</p></div>
                <div className="text-left sm:text-right"><p className="text-sm font-black text-cyan-700">{customerRow.totalBottles.toLocaleString()} ဗူး</p><p className="text-sm font-black text-amber-700">{money(customerRow.totalAmount)}</p></div>
              </div>
              <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="px-2 py-2">Item</th><th className="px-2 py-2">ဆံ့/ကဒ်</th><th className="px-2 py-2 text-right">ဗူး</th><th className="px-2 py-2 text-right">ငွေ</th></tr></thead><tbody>{customerRow.items.map((item) => <tr key={item.productKey} className="border-b border-slate-100 last:border-0"><td className="px-2 py-2 font-bold text-slate-800">{item.productName}</td><td className="px-2 py-2"><span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-black text-sky-800">{item.capacity} ဆံ့/ကဒ်</span></td><td className="px-2 py-2 text-right font-black text-cyan-700">{item.bottleCount.toLocaleString()}</td><td className="px-2 py-2 text-right font-black text-amber-700">{money(item.totalAmount)}</td></tr>)}</tbody></table></div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
