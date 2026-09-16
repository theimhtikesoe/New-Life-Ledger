"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const money = (value) => `${Math.round(Number(value || 0)).toLocaleString("en-US")} Ks`;
const dateLabel = (value) => value ? new Intl.DateTimeFormat("my-MM", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)) : "—";

export default function DebtReconciliationPage() {
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [groundTruth, setGroundTruth] = useState("");
  const [note, setNote] = useState("");
  const [verifiedLinks, setVerifiedLinks] = useState({});
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
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);
  useEffect(() => {
    if (selected) {
      setGroundTruth(String(selected.groundTruthBalance));
      setNote(selected.savedNote || "");
      setVerifiedLinks(Object.fromEntries(selected.oldDebts.flatMap((debt) => debt.linkedPaymentIds.map((id) => [id, true]))));
    }
  }, [selected?.id]);

  const numericGroundTruth = Math.max(0, Math.round(Number(String(groundTruth).replace(/,/g, "")) || 0));
  const difference = numericGroundTruth - Number(selected?.websiteBalance || 0);
  const remainingTotal = selected?.oldDebts.reduce((sum, debt) => sum + debt.remaining, 0) || 0;
  const linkedPaymentTotal = selected?.oldDebts.reduce((sum, debt) => sum + debt.paid, 0) || 0;

  const save = async () => {
    if (!selected) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/debt-reconciliation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selected.id, groundTruthBalance: numericGroundTruth, note, links: Object.entries(verifiedLinks).filter(([, value]) => value).map(([paymentId]) => ({ paymentId })) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "စာရင်းညှိသိမ်း၍မရပါ။");
      setMessage("စာရင်းညှိချက်ကို audit history ထဲ သိမ်းပြီးပါပြီ။ မူရင်း ledger မဖျက်ထားပါ။");
      await load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div><p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">New Life Ledger · Control Room</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">အကြွေးဟောင်း စာရင်းညှိခြင်း</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">မူရင်း အကြွေးတိုး/ငွေချေ ledger ကို မဖျက်ဘဲ Customer တစ်ယောက်ချင်းစီ၏ ငွေချေပြီးသား အကြွေးဟောင်း၊ မြေပြင်လက်ကျန်နှင့် website လက်ကျန်ကို တိုက်စစ်ပြီး audit history အဖြစ် သိမ်းပါ။</p></div>
        <Link href="/" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-100">Dashboard သို့ပြန်ရန်</Link>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="font-black">လက်ရှိအကြွေးကျန်သူ</h2><span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-black text-rose-700">{customers.length} ယောက်</span></div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Customer ရှာရန်" className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
          <label className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={showSettled} onChange={(e) => setShowSettled(e.target.checked)} /> စာရင်းညှိပြီးသားများပါပြ</label>
          <div className="mt-3 max-h-[62vh] space-y-1 overflow-y-auto pr-1">{loading ? <p className="p-3 text-sm text-slate-500">ရယူနေသည်...</p> : filtered.map((customer) => <button key={customer.id} onClick={() => setSelectedId(customer.id)} className={`w-full rounded-xl p-3 text-left transition ${selected?.id === customer.id ? "bg-cyan-50 ring-2 ring-cyan-400" : "hover:bg-slate-50"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-black">{customer.name}</span><span className={`h-2.5 w-2.5 rounded-full ${customer.difference === 0 ? "bg-emerald-500" : "bg-amber-400"}`} /></div><p className="mt-1 text-xs text-slate-500">{customer.routeTag || "လမ်းကြောင်းမရှိ"}</p><p className="mt-1 text-sm font-black text-rose-700">{money(customer.websiteBalance)}</p></button>)}{!loading && !filtered.length ? <p className="p-3 text-sm text-slate-500">တွေ့ရှိချက်မရှိပါ။</p> : null}</div>
        </aside>
        <section className="space-y-5">
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div> : null}{message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div> : null}
          {selected ? <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-bold text-slate-500">ရွေးထားသော Customer</p><h2 className="mt-1 text-2xl font-black">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">{selected.phone || "ဖုန်းမရှိ"} · {selected.routeTag || "လမ်းကြောင်းမရှိ"}</p></div><div className="rounded-xl bg-rose-50 px-4 py-3 text-right"><p className="text-xs font-bold text-rose-700">Website လက်ရှိလက်ကျန်</p><p className="text-xl font-black text-rose-800">{money(selected.websiteBalance)}</p></div></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">အကြွေးဟောင်းကျန်စုစုပေါင်း</p><p className="mt-1 text-lg font-black">{money(remainingTotal)}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-700">ချိတ်ထားပြီး ငွေချေစုစုပေါင်း</p><p className="mt-1 text-lg font-black text-emerald-800">{money(linkedPaymentTotal)}</p></div><div className={`rounded-xl p-3 ${difference === 0 ? "bg-emerald-50" : "bg-amber-50"}`}><p className="text-xs font-bold">စာရင်းညှိ ခြားနားချက်</p><p className={`mt-1 text-lg font-black ${difference === 0 ? "text-emerald-800" : "text-amber-800"}`}>{difference > 0 ? "+" : ""}{money(difference)}</p></div></div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div><h3 className="text-lg font-black">ငွေချေဖို့ကျန်တဲ့ အကြွေးဟောင်းများ</h3><p className="mt-1 text-sm text-slate-500">ငွေချေပြီးသားတစ်ခုကို ဖျောက်မယ့်အစား ချိတ်ဆက်ပြီးသားအဖြစ် သတ်မှတ်ထားပါ။ မူရင်း transaction မပျက်ပါ။</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{selected.oldDebts.length} ကြောင်း</span></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="px-3 py-3">ရက်စွဲ / မှတ်ချက်</th><th className="px-3 py-3 text-right">အကြွေးတိုး</th><th className="px-3 py-3 text-right">ချိတ်ထားပြီးငွေချေ</th><th className="px-3 py-3 text-right">လက်ကျန်</th><th className="px-3 py-3">စစ်ဆေးချက်</th></tr></thead><tbody>{selected.oldDebts.map((debt) => <tr key={debt.id} className={`border-b border-slate-100 ${debt.remaining === 0 ? "bg-emerald-50/50" : ""}`}><td className="px-3 py-3"><p className="font-bold">{dateLabel(debt.date)}</p><p className="mt-1 max-w-[250px] truncate text-xs text-slate-500">{debt.note || "အကြွေးတိုး"}</p><p className="mt-1 text-[11px] text-slate-400">ID: {debt.id.slice(0, 8)}</p></td><td className="px-3 py-3 text-right font-black">{money(debt.amount)}</td><td className="px-3 py-3 text-right font-bold text-emerald-700">{money(debt.paid)}{debt.linkedPayments?.map((payment) => <label key={payment.id} className="mt-1 flex items-center justify-end gap-1 text-[11px] font-normal text-slate-500"><input type="checkbox" checked={Boolean(verifiedLinks[payment.id])} onChange={(e) => setVerifiedLinks((old) => ({ ...old, [payment.id]: e.target.checked }))} /> {dateLabel(payment.date)}</label>)}</td><td className={`px-3 py-3 text-right font-black ${debt.remaining ? "text-rose-700" : "text-emerald-700"}`}>{money(debt.remaining)}</td><td className="px-3 py-3">{debt.remaining === 0 ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700">ငွေချေပြီး / မဖျက်</span> : <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-700">ကျန်နေသေး</span>}</td></tr>)}</tbody></table></div>{selected.unlinkedPayments.length ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><p className="font-black text-amber-800">မချိတ်ရသေးသော ငွေချေ {selected.unlinkedPayments.length} ကြောင်း</p><p className="mt-1 text-amber-700">အောက်က မြေပြင်လက်ကျန်ကိုသတ်မှတ်ပြီး Note ထဲမှာ ဘယ်အကြွေးဟောင်းနဲ့ညှိထားသည်ကို မှတ်ရေးပါ။ နောက်တစ်ဆင့်မှာ ledger payment ကို သက်ဆိုင်ရာ အကြွေးတိုးနဲ့ ချိတ်နိုင်ပါတယ်။</p></div> : null}</div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5 shadow-sm"><h3 className="text-lg font-black text-cyan-950">မြေပြင်နောက်ဆုံးလက်ကျန် သတ်မှတ်ရန်</h3><p className="mt-1 text-sm text-cyan-800">မြေပြင်စာအုပ်အတိုင်း ငွေချေဖို့ တကယ်ကျန်တဲ့ပမာဏကို ထည့်ပါ။ Website နဲ့ ကွာခြားချက်ကို အလိုအလျောက်တွက်ပြပါမယ်။</p><div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,280px)_1fr] md:items-end"><label className="block text-sm font-black text-slate-800">မြေပြင်နောက်ဆုံးလက်ကျန် (Ks)<input inputMode="numeric" value={numericGroundTruth.toLocaleString("en-US")} onChange={(e) => setGroundTruth(e.target.value.replace(/[^0-9]/g, ""))} className="mt-2 w-full rounded-xl border border-cyan-300 bg-white px-4 py-3 text-xl font-black outline-none focus:ring-2 focus:ring-cyan-200" /></label><label className="block text-sm font-black text-slate-800">စာရင်းညှိမှတ်ချက်<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ဥပမာ - May အကြွေးဟောင်း ၂ ကြောင်းကို June ငွေချေနဲ့ မြေပြင်မှာ ကျေပြီးသား" rows={3} className="mt-2 w-full rounded-xl border border-cyan-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-200" /></label></div><div className="mt-4 flex flex-col justify-between gap-3 rounded-xl bg-white p-4 sm:flex-row sm:items-center"><div><p className="text-xs font-bold text-slate-500">နောက်ဆုံးစာရင်းညှိပြီး လက်ကျန်</p><p className="text-2xl font-black text-cyan-900">{money(numericGroundTruth)}</p><p className={`mt-1 text-sm font-bold ${difference === 0 ? "text-emerald-700" : "text-amber-700"}`}>Website နှင့်ခြားနားချက်: {difference > 0 ? "+" : ""}{money(difference)}</p></div><button onClick={save} disabled={saving} className="rounded-xl bg-cyan-700 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-cyan-800 disabled:opacity-50">{saving ? "သိမ်းနေသည်..." : "စာရင်းညှိ သိမ်းမည်"}</button></div></div>
          </> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Customer မရှိသေးပါ။</div>}
        </section>
      </div>
    </div>
  </main>;
}
