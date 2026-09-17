"use client";

import { useEffect, useMemo, useState } from "react";

const money = (value) => `${Math.round(Number(value || 0)).toLocaleString("en-US")} Ks`;
const dateLabel = (value) => value ? new Intl.DateTimeFormat("my-MM", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)) : "—";
const paymentLabel = (payment) => payment?.paymentType || "ငွေချေ";

export default function DebtReconciliationPage() {
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [groundTruth, setGroundTruth] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [showSettled, setShowSettled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/debt-reconciliation", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "စာရင်းရယူ၍မရပါ။");
      setCustomers(body.data || []);
      if (!selectedId && body.data?.length) setSelectedId(body.data[0].id);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => customers.filter((customer) => {
    const haystack = `${customer.name} ${customer.phone || ""} ${customer.routeTag || ""}`.toLocaleLowerCase("my-MM");
    const matches = !query.trim() || haystack.includes(query.trim().toLocaleLowerCase("my-MM"));
    const hasOutstanding = customer.oldDebts.some((debt) => debt.remaining > 0);
    return matches && (showSettled || hasOutstanding || customer.difference !== 0);
  }), [customers, query, showSettled]);
  const selected = customers.find((customer) => customer.id === selectedId) || filtered[0];
  useEffect(() => { if (selected && selected.id !== selectedId) setSelectedId(selected.id); }, [selected, selectedId]);
  useEffect(() => {
    if (selected) {
      setGroundTruth(String(selected.groundTruthBalance));
      setNote(selected.savedNote || "");
    }
  }, [selected?.id]);

  const visibleDebts = useMemo(() => {
    const rows = selected?.oldDebts || [];
    return rows.filter((debt) => showSettled || debt.remaining > 0).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selected, showSettled]);
  const numericGroundTruth = Math.max(0, Math.round(Number(String(groundTruth).replace(/,/g, "")) || 0));
  const difference = numericGroundTruth - Number(selected?.websiteBalance || 0);
  const remainingTotal = selected?.oldDebts.reduce((sum, debt) => sum + debt.remaining, 0) || 0;
  const paymentTotal = selected?.payments.reduce((sum, payment) => sum + Math.round(Number(payment.amount || 0)), 0) || 0;

  const save = async () => {
    if (!selected) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/debt-reconciliation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selected.id, groundTruthBalance: numericGroundTruth, note, links: [] }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "စာရင်းညှိသိမ်း၍မရပါ။");
      setMessage("နောက်ဆုံးလက်ကျန်စာရင်းညှိချက်ကို audit history ထဲ သိမ်းပြီးပါပြီ။ အဟောင်း payment များကို ပြန်မချိတ်ပါ။");
      await load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-5 lg:px-8">
    <div className="mx-auto max-w-[1500px]">
      <div className="rounded-2xl border border-cyan-100 bg-white/80 p-3 shadow-sm sm:p-4">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">New Life Ledger · Control Room</p>
        <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">အရင်က မချိတ်ရသေးသော ငွေချေများကို ပြန်မချိတ်ဘဲ အကြွေးတိုး၊ ငွေချေသမိုင်းကို ဖတ်ရှုပြီး တကယ်ကျန်နေသော နောက်ဆုံးလက်ကျန်အကြွေးကိုသာ စစ်ဆေးပါသည်။</p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]">
        <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-center justify-between gap-2"><h2 className="font-black">လက်ရှိအကြွေးကျန်သူ</h2><span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-black text-rose-700">{filtered.length} ယောက်</span></div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Customer ရှာရန်" className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
          <label className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={showSettled} onChange={(e) => setShowSettled(e.target.checked)} /> စာရင်းညှိပြီးသား / ကျေပြီးသားများပါပြ</label>
          <div className="mt-3 max-h-[58vh] overflow-y-auto pr-1">
            {loading ? <p className="p-3 text-sm text-slate-500">ရယူနေသည်...</p> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((customer) => <button key={customer.id} onClick={() => setSelectedId(customer.id)} className={`min-w-0 rounded-xl border p-3 text-left transition ${selected?.id === customer.id ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-300" : "border-slate-200 bg-slate-50 hover:border-cyan-300 hover:bg-cyan-50/50"}`}>
                <div className="flex items-start justify-between gap-2"><span className="truncate text-sm font-black">{customer.name}</span><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${customer.difference === 0 ? "bg-emerald-500" : "bg-amber-400"}`} /></div>
                <p className="mt-1 truncate text-xs text-slate-500">{customer.routeTag || "လမ်းကြောင်းမရှိ"}</p><p className="mt-1 text-sm font-black text-rose-700">{money(customer.websiteBalance)}</p>
              </button>)}
            </div>}
            {!loading && !filtered.length ? <p className="p-3 text-sm text-slate-500">တွေ့ရှိချက်မရှိပါ။</p> : null}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div> : null}
          {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div> : null}
          {selected ? <>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div><p className="text-xs font-bold text-slate-500">ရွေးထားသော Customer</p><h2 className="mt-1 text-2xl font-black">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">{selected.phone || "ဖုန်းမရှိ"} · {selected.routeTag || "လမ်းကြောင်းမရှိ"}</p></div><div className="rounded-xl bg-rose-50 px-4 py-3 text-right"><p className="text-xs font-bold text-rose-700">Website နောက်ဆုံးလက်ကျန်</p><p className="text-xl font-black text-rose-800">{money(selected.websiteBalance)}</p></div></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">တကယ်ကျန်အကြွေး</p><p className="mt-1 text-lg font-black">{money(remainingTotal)}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-700">မှတ်တမ်းထဲ ငွေချေစုစုပေါင်း</p><p className="mt-1 text-lg font-black text-emerald-800">{money(paymentTotal)}</p></div><div className="rounded-xl bg-cyan-50 p-3"><p className="text-xs font-bold text-cyan-700">စစ်မည့် အကြွေး</p><p className="mt-1 text-lg font-black text-cyan-900">{visibleDebts.filter((debt) => debt.remaining > 0).length} ကြောင်း</p></div><div className={`rounded-xl p-3 ${difference === 0 ? "bg-emerald-50" : "bg-amber-50"}`}><p className="text-xs font-bold">စာရင်းညှိခြားနားချက်</p><p className={`mt-1 text-lg font-black ${difference === 0 ? "text-emerald-800" : "text-amber-800"}`}>{difference > 0 ? "+" : ""}{money(difference)}</p></div></div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-lg font-black">နောက်ဆုံးကျန်နေသော အကြွေးဟောင်း</h3><p className="mt-1 text-sm text-slate-500">နောက်ဆုံးရက်အကြွေးကို အပေါ်ဆုံးတွင်ပြထားသည်။ ကျေပြီးသားအဟောင်းများကို default အနေဖြင့် ဖျောက်ထားသည်။</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{visibleDebts.length} ကြောင်း</span></div>
              <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="px-3 py-3">ရက်စွဲ / မှတ်ချက်</th><th className="px-3 py-3 text-right">အကြွေးတိုး</th><th className="px-3 py-3 text-right">မှတ်တမ်းငွေချေ</th><th className="px-3 py-3 text-right">အဟောင်းငွေချေ</th><th className="px-3 py-3 text-right">နောက်ဆုံးကျန်</th><th className="px-3 py-3">အခြေအနေ</th></tr></thead><tbody>{visibleDebts.map((debt) => <tr key={debt.id} className="border-b border-slate-100"><td className="px-3 py-3"><p className="font-bold">{dateLabel(debt.date)}</p><p className="mt-1 max-w-[280px] truncate text-xs text-slate-500">{debt.note || "အကြွေးတိုး"}</p></td><td className="px-3 py-3 text-right font-black">{money(debt.amount)}</td><td className="px-3 py-3 text-right font-bold text-emerald-700">{money(debt.paid)}</td><td className="px-3 py-3 text-right font-bold text-slate-500">{money(debt.legacyPaid)}</td><td className="px-3 py-3 text-right font-black text-rose-700">{money(debt.remaining)}</td><td className="px-3 py-3"><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-700">စစ်ရန်ကျန်</span></td></tr>)}</tbody></table>{!visibleDebts.length ? <p className="p-8 text-center text-sm text-slate-500">တကယ်ကျန်နေသော အကြွေးမရှိပါ။</p> : null}</div>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-lg font-black text-violet-950">ငွေချေမှတ်တမ်းများ</h3><p className="mt-1 text-sm text-violet-800">အဟောင်းငွေချေများကို ပြန်မချိတ်ပါ။ အောက်ပါစာရင်းကို အကြွေးကျေပြီးသား အထောက်အထားအဖြစ်သာ ပြထားသည်။</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet-800">{selected.payments.length} ကြောင်း</span></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-violet-200 text-xs text-violet-800"><th className="px-3 py-2">ရက်စွဲ</th><th className="px-3 py-2 text-right">ငွေချေ</th><th className="px-3 py-2">အမျိုးအစား</th><th className="px-3 py-2">မှတ်ချက် / ချိတ်ဆက်မှု</th></tr></thead><tbody>{selected.payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((payment) => <tr key={payment.id} className="border-b border-violet-100"><td className="px-3 py-2">{dateLabel(payment.date)}</td><td className="px-3 py-2 text-right font-black text-emerald-700">{money(payment.amount)}</td><td className="px-3 py-2">{paymentLabel(payment)}</td><td className="max-w-[360px] truncate px-3 py-2 text-xs text-slate-600">{payment.note || "အဟောင်းငွေချေ — ပြန်မချိတ်ပါ"}</td></tr>)}</tbody></table></div></div>

            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 shadow-sm sm:p-5"><h3 className="text-lg font-black text-cyan-950">မြေပြင်နောက်ဆုံးလက်ကျန် သတ်မှတ်ရန်</h3><p className="mt-1 text-sm text-cyan-800">ယနေ့ မြေပြင်စာအုပ်မှာ တကယ်ကျန်နေသောပမာဏကို ထည့်ပါ။ Website နဲ့ ကွာခြားချက်ကို အလိုအလျောက်တွက်ပြပါမယ်။</p><div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,280px)_1fr] md:items-end"><label className="block text-sm font-black text-slate-800">မြေပြင်နောက်ဆုံးလက်ကျန် (Ks)<input inputMode="numeric" value={numericGroundTruth.toLocaleString("en-US")} onChange={(e) => setGroundTruth(e.target.value.replace(/[^0-9]/g, ""))} className="mt-2 w-full rounded-xl border border-cyan-300 bg-white px-4 py-3 text-xl font-black outline-none focus:ring-2 focus:ring-cyan-200" /></label><label className="block text-sm font-black text-slate-800">စာရင်းညှိမှတ်ချက်<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ဥပမာ - အဟောင်းငွေချေများကို မပြန်ချိတ်ဘဲ နောက်ဆုံးအကြွေးကိုသာ စစ်ထားသည်" rows={3} className="mt-2 w-full rounded-xl border border-cyan-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-200" /></label></div><div className="mt-4 flex flex-col justify-between gap-3 rounded-xl bg-white p-4 sm:flex-row sm:items-center"><div><p className="text-xs font-bold text-slate-500">နောက်ဆုံးစာရင်းညှိပြီး လက်ကျန်</p><p className="text-2xl font-black text-cyan-900">{money(numericGroundTruth)}</p><p className={`mt-1 text-sm font-bold ${difference === 0 ? "text-emerald-700" : "text-amber-700"}`}>Website နှင့်ခြားနားချက်: {difference > 0 ? "+" : ""}{money(difference)}</p></div><button onClick={save} disabled={saving} className="rounded-xl bg-cyan-700 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-cyan-800 disabled:opacity-50">{saving ? "သိမ်းနေသည်..." : "နောက်ဆုံးစာရင်းညှိ သိမ်းမည်"}</button></div></div>
          </> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Customer မရှိသေးပါ။</div>}
        </section>
      </div>
    </div>
  </main>;
}
