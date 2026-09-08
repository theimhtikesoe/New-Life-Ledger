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

function differenceMeta(value) {
  const difference = Number(value || 0);
  if (difference < 0) return { label: "ကွာဟချက်ပိုငွေ", amount: Math.abs(difference), className: "text-emerald-700", softClassName: "bg-emerald-50 text-emerald-800", borderClassName: "border-emerald-200" };
  return { label: "ကွာဟချက်လိုငွေ", amount: difference, className: "text-rose-700", softClassName: "bg-rose-50 text-rose-800", borderClassName: "border-rose-200" };
}

export default function DailyBottleSalesPage() {
  const [date, setDate] = useState(() => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("date") : "") || todayValue());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [differenceModalOpen, setDifferenceModalOpen] = useState(false);

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

  const totalDifferenceMeta = differenceMeta(data?.totalDifference);

  return (
    <main className="app-page-main">
      <div className="app-page-container space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-slate-600">Customer တစ်ဦးချင်းအလိုက် ရောင်းထားသော item၊ ဆံ့၊ ဗူးအရေအတွက်နှင့် စုစုပေါင်းငွေ</p>
            </div>
            <label className="flex shrink-0 flex-col gap-2 text-sm font-bold text-slate-700">ရက်စွဲ<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-12 rounded-xl border-2 border-slate-300 bg-slate-50 px-3 text-base font-black" /></label>
          </div>
        </section>

        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}
        <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Customer</p><p className="mt-1 text-2xl font-black text-slate-900">{loading ? "—" : Number(data?.totalCustomers || 0).toLocaleString()} ယောက်</p></div>
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4"><p className="text-xs font-bold text-cyan-700">စုစုပေါင်း ဗူး</p><p className="mt-1 text-2xl font-black text-cyan-900">{loading ? "—" : Number(data?.totalBottles || 0).toLocaleString()} ဗူး</p></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-700">သတ်မှတ်ငွေ</p><p className="mt-1 text-2xl font-black text-amber-900">{loading ? "—" : money(data?.totalAmount)}</p></div>
          <button type="button" onClick={() => setDifferenceModalOpen(true)} disabled={loading || !Number(data?.totalDifference || 0)} className={`rounded-xl border p-4 text-left transition hover:shadow-sm disabled:cursor-default disabled:opacity-100 ${loading ? "border-orange-200 bg-orange-50" : `${totalDifferenceMeta.borderClassName} ${totalDifferenceMeta.softClassName}`}`}><p className={`text-xs font-bold ${loading ? "text-orange-700" : totalDifferenceMeta.className}`}>{loading ? "ကွာဟချက်" : totalDifferenceMeta.label}</p><p className={`mt-1 text-2xl font-black ${loading ? "text-orange-900" : totalDifferenceMeta.className}`}>{loading ? "—" : money(totalDifferenceMeta.amount)}</p><p className={`mt-1 text-[11px] font-bold ${loading ? "text-orange-700" : totalDifferenceMeta.className}`}>{loading ? "" : "အသေးစိတ်ကြည့်ရန် →"}</p></button>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">တကယ်ရှင်းငွေ</p><p className="mt-1 text-2xl font-black text-emerald-900">{loading ? "—" : money(data?.totalPaidAmount)}</p></div>
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4"><p className="text-xs font-bold text-violet-700">အကြွေးတိုးဗူး (သီးခြား)</p><p className="mt-1 text-2xl font-black text-violet-900">{loading ? "—" : Number(data?.creditBottleSales?.totalBottles || 0).toLocaleString()} ဗူး</p></div>
        </section>

        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">ဗူးရောင်းစာရင်း ရယူနေသည်...</div> : null}
        {!loading && !data?.customers?.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center font-bold text-slate-500">ဒီရက်အတွက် ဗူးရောင်းစာရင်း မရှိသေးပါ။</div> : null}
        {!loading && Number(data?.paidBottleSales?.totalBottles || 0) > 0 ? (
        <section className="space-y-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm"><div className="flex flex-col gap-1 border-b border-emerald-100 pb-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-lg font-black text-emerald-950">ငွေချေထားသော ဗူးများ</h3><p className="text-xs text-emerald-700">အကြွေးစာရင်းမှ ပြန်လည်ငွေချေထားသော ဗူးရောင်းစာရင်း</p></div><div className="text-left sm:text-right"><p className="text-sm font-black text-emerald-800">{Number(data?.paidBottleSales?.totalBottles || 0).toLocaleString()} ဗူး</p><p className="text-xs font-bold text-emerald-700">သတ်မှတ်ငွေ {money(data?.paidBottleSales?.totalAmount)}</p><p className="text-sm font-black text-emerald-800">တကယ်ရှင်းငွေ {money(data?.paidBottleSales?.totalPaidAmount)}</p></div></div>
          <div className="mt-3">
          {data?.paidBottleSales?.customers?.map((customerRow) => (
            <article key={customerRow.customer.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="text-lg font-black text-slate-900">{customerRow.customer.name}</h3><p className="text-xs text-slate-500">{customerRow.customer.phone || "ဖုန်းမရှိ"} · {customerRow.transactions} ကြိမ်</p></div>
                <div className="text-left sm:text-right"><p className="text-sm font-black text-cyan-700">{Number(customerRow.totalCards || 0).toLocaleString()} ကဒ် · {customerRow.totalBottles.toLocaleString()} ဗူး</p><p className="text-sm font-black text-amber-700">သတ်မှတ်ငွေ {money(customerRow.totalAmount)}</p>{customerRow.difference ? (() => { const meta = differenceMeta(customerRow.difference); return <p className={`text-sm font-black ${meta.className}`}>{meta.label} {money(meta.amount)}</p>; })() : null}<p className="text-sm font-black text-emerald-700">တကယ်ရှင်းငွေ {money(customerRow.totalPaidAmount)}</p></div>
              </div>
              {customerRow.items.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[600px] table-fixed text-sm"><colgroup><col className="w-[38%]" /><col className="w-[22%]" /><col className="w-[14%]" /><col className="w-[12%]" /><col className="w-[14%]" /></colgroup><thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="px-2 py-2">Item</th><th className="px-2 py-2">ဆံ့/ကဒ်</th><th className="px-2 py-2 text-right">ကဒ်</th><th className="px-2 py-2 text-right">ဗူး</th><th className="px-2 py-2 text-right">ငွေ</th></tr></thead><tbody>{customerRow.items.map((item) => <tr key={item.productKey} className="border-b border-slate-100 last:border-0"><td className="truncate px-2 py-2 font-bold text-slate-800">{item.productName}</td><td className="px-2 py-2"><span className="inline-block whitespace-nowrap rounded-full bg-sky-100 px-2 py-1 text-xs font-black text-sky-800">{item.capacity} ဆံ့/ကဒ်</span></td><td className="px-2 py-2 text-right font-black text-slate-700">{Number(item.cardCount || 0).toLocaleString()}</td><td className="px-2 py-2 text-right font-black text-cyan-700">{item.bottleCount.toLocaleString()}</td><td className="px-2 py-2 text-right font-black text-amber-700">{money(item.totalAmount)}</td></tr>)}</tbody></table></div>
              : <p className="mt-3 rounded-lg border border-dashed border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">ငွေချေမှုရှိပါသည်။ ဗူးအသေးစိတ်ကို ထိုမှတ်တမ်းတွင် မသိမ်းထားပါ။</p>}
            </article>
          ))}
          </div></div>
        </section>
        ) : null}
        <section className="space-y-3">
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm"><div className="flex flex-col gap-1 border-b border-cyan-100 pb-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-lg font-black text-cyan-950">လက်ငင်းချေထားသော ဗူးများ</h3><p className="text-xs text-cyan-700">လက်ငင်းရောင်းစာရင်းထဲမှ ဗူးရောင်းအား</p></div><div className="text-left sm:text-right"><p className="text-sm font-black text-cyan-800">{Number(data?.cashBottleSales?.totalBottles || 0).toLocaleString()} ဗူး</p><p className="text-xs font-bold text-cyan-700">သတ်မှတ်ငွေ {money(data?.cashBottleSales?.totalAmount)}</p><p className="text-sm font-black text-cyan-800">တကယ်ရှင်းငွေ {money(data?.cashBottleSales?.totalPaidAmount)}</p></div></div>
          <div className="mt-3">
          {data?.cashBottleSales?.customers?.map((customerRow) => (
            <article key={customerRow.customer.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="text-lg font-black text-slate-900">{customerRow.customer.name}</h3><p className="text-xs text-slate-500">{customerRow.customer.phone || "ဖုန်းမရှိ"} · {customerRow.transactions} ကြိမ်</p></div>
                <div className="text-left sm:text-right"><p className="text-sm font-black text-cyan-700">{Number(customerRow.totalCards || 0).toLocaleString()} ကဒ် · {customerRow.totalBottles.toLocaleString()} ဗူး</p><p className="text-sm font-black text-amber-700">သတ်မှတ်ငွေ {money(customerRow.totalAmount)}</p><p className="text-sm font-black text-emerald-700">တကယ်ရှင်းငွေ {money(customerRow.totalPaidAmount)}</p>{customerRow.difference ? (() => { const meta = differenceMeta(customerRow.difference); return <p className={`text-sm font-black ${meta.className}`}>{meta.label} {money(meta.amount)}</p>; })() : null}</div>
              </div>
              <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[600px] table-fixed text-sm"><colgroup><col className="w-[38%]" /><col className="w-[22%]" /><col className="w-[14%]" /><col className="w-[12%]" /><col className="w-[14%]" /></colgroup><thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="px-2 py-2">Item</th><th className="px-2 py-2">ဆံ့/ကဒ်</th><th className="px-2 py-2 text-right">ကဒ်</th><th className="px-2 py-2 text-right">ဗူး</th><th className="px-2 py-2 text-right">ငွေ</th></tr></thead><tbody>{customerRow.items.map((item) => <tr key={item.productKey} className="border-b border-slate-100 last:border-0"><td className="truncate px-2 py-2 font-bold text-slate-800">{item.productName}</td><td className="px-2 py-2"><span className="inline-block whitespace-nowrap rounded-full bg-sky-100 px-2 py-1 text-xs font-black text-sky-800">{item.capacity} ဆံ့/ကဒ်</span></td><td className="px-2 py-2 text-right font-black text-slate-700">{Number(item.cardCount || 0).toLocaleString()}</td><td className="px-2 py-2 text-right font-black text-cyan-700">{item.bottleCount.toLocaleString()}</td><td className="px-2 py-2 text-right font-black text-amber-700">{money(item.totalAmount)}</td></tr>)}</tbody></table></div>
            </article>
          ))}
          </div></div>
        </section>
        {!loading && Number(data?.creditBottleSales?.totalBottles || 0) > 0 ? (
          <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
            <div className="flex flex-col gap-1 border-b border-violet-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h3 className="text-lg font-black text-violet-950">အကြွေးတိုးထားသော ဗူးများ</h3><p className="text-xs text-violet-700">အကြွေးစာရင်းအဖြစ် သီးခြားမှတ်ထားပြီး ငွေချေသည့်အခါ အထက်ပါ ဗူးရောင်းစာရင်းထဲမှသာ ပါဝင်ပါမည်။</p></div>
              <div className="text-left sm:text-right"><p className="text-sm font-black text-violet-800">{Number(data.creditBottleSales.totalBottles).toLocaleString()} ဗူး</p><p className="text-sm font-black text-violet-800">{money(data.creditBottleSales.totalAmount)}</p></div>
            </div>
              <div className="mt-3 space-y-3">{(data.creditBottleSales.customers || []).map((customerRow) => <div key={customerRow.customer.id} className="rounded-xl border border-violet-100 bg-white/70 p-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="font-black text-violet-950">{customerRow.customer.name}</p><p className="text-xs font-bold text-violet-700">{Number(customerRow.totalCards || 0).toLocaleString()} ကဒ် · {customerRow.totalBottles.toLocaleString()} ဗူး · {money(customerRow.totalAmount)}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[600px] table-fixed text-sm"><colgroup><col className="w-[38%]" /><col className="w-[22%]" /><col className="w-[14%]" /><col className="w-[12%]" /><col className="w-[14%]" /></colgroup><thead><tr className="border-b border-violet-200 text-left text-xs text-violet-700"><th className="px-2 py-2">Item</th><th className="px-2 py-2">ဆံ့/ကဒ်</th><th className="px-2 py-2 text-right">ကဒ်</th><th className="px-2 py-2 text-right">ဗူး</th><th className="px-2 py-2 text-right">သတ်မှတ်ငွေ</th></tr></thead><tbody>{customerRow.items.map((item) => <tr key={`${customerRow.customer.id}-${item.productKey}`} className="border-b border-violet-100 last:border-0"><td className="truncate px-2 py-2 font-bold text-violet-950">{item.productName}</td><td className="px-2 py-2"><span className="inline-block whitespace-nowrap rounded-full bg-white px-2 py-1 text-xs font-black text-violet-800">{item.capacity} ဆံ့/ကဒ်</span></td><td className="px-2 py-2 text-right font-black text-violet-800">{Number(item.cardCount || 0).toLocaleString()}</td><td className="px-2 py-2 text-right font-black text-violet-800">{item.bottleCount.toLocaleString()}</td><td className="px-2 py-2 text-right font-black text-violet-800">{money(item.totalAmount)}</td></tr>)}</tbody></table></div></div>)}</div>
            </section>
          ) : null}
        {differenceModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="difference-modal-title">
            <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-orange-200 bg-white p-4 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
                <div><h2 id="difference-modal-title" className="text-lg font-black text-slate-900">ကွာဟချက် အသေးစိတ်</h2><p className="mt-1 text-xs font-bold text-slate-500">သတ်မှတ်ငွေနဲ့ တကယ်ရှင်းငွေ မတူတဲ့ Customer များသာ ပြထားပါသည်။</p></div>
                <button type="button" onClick={() => setDifferenceModalOpen(false)} className="rounded-lg px-3 py-2 text-sm font-black text-slate-500 hover:bg-slate-100">ပိတ်</button>
              </div>
              <div className="mt-4 space-y-3">
                {(data?.customers || []).filter((customerRow) => Number(customerRow.difference || 0) !== 0).map((customerRow) => (
                  <article key={`difference-${customerRow.customer.id}`} className="rounded-xl border border-orange-200 bg-orange-50/60 p-3">
                    {(() => { const meta = differenceMeta(customerRow.difference); return <><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-black text-slate-900">{customerRow.customer.name}</h3><p className="text-xs text-slate-500">{Number(customerRow.totalCards || 0).toLocaleString()} ကဒ် · {customerRow.totalBottles.toLocaleString()} ဗူး</p></div><p className={`rounded-lg px-2 py-1 text-base font-black ${meta.softClassName}`}>{meta.label} {money(meta.amount)}</p></div><div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3"><div className="rounded-lg bg-white p-2"><p className="text-xs font-bold text-slate-500">သတ်မှတ်ငွေ</p><p className="font-black text-slate-900">{money(customerRow.totalAmount)}</p></div><div className="rounded-lg bg-white p-2"><p className="text-xs font-bold text-slate-500">တကယ်ရှင်းငွေ</p><p className="font-black text-emerald-700">{money(customerRow.totalPaidAmount)}</p></div><div className="rounded-lg bg-white p-2"><p className="text-xs font-bold text-slate-500">{meta.label}</p><p className={`font-black ${meta.className}`}>{money(meta.amount)}</p></div></div></>; })()}
                    <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-xs"><thead><tr className="border-b border-orange-200 text-left text-orange-800"><th className="px-2 py-2">Item</th><th className="px-2 py-2">ဆံ့/ကဒ်</th><th className="px-2 py-2 text-right">ကဒ်</th><th className="px-2 py-2 text-right">ဗူး</th><th className="px-2 py-2 text-right">ငွေ</th></tr></thead><tbody>{customerRow.items.map((item) => <tr key={`difference-${customerRow.customer.id}-${item.productKey}`} className="border-b border-orange-100 last:border-0"><td className="px-2 py-2 font-bold text-slate-800">{item.productName}</td><td className="px-2 py-2">{item.capacity}</td><td className="px-2 py-2 text-right font-bold">{Number(item.cardCount || 0).toLocaleString()}</td><td className="px-2 py-2 text-right font-bold">{item.bottleCount.toLocaleString()}</td><td className="px-2 py-2 text-right font-bold">{money(item.totalAmount)}</td></tr>)}</tbody></table></div>
                  </article>
                ))}
                {!(data?.customers || []).some((customerRow) => Number(customerRow.difference || 0) !== 0) ? <p className="rounded-xl bg-emerald-50 p-4 text-center font-bold text-emerald-700">ကွာဟချက်ရှိတဲ့ Customer မရှိပါ။</p> : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
