'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { encodeActorHeader } from "@/lib/actor-header";

function todayMyanmar() {
  return new Date(Date.now() + (6 * 60 + 30) * 60 * 1000).toISOString().slice(0, 10);
}
function number(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
}
function actorHeaders(extra = {}) {
  const actorName = typeof window === "undefined" ? "" : localStorage.getItem("actorName") || "";
  return { "Content-Type": "application/json", ...(actorName ? { "x-actor-name": encodeActorHeader(actorName) } : {}), ...extra };
}

export default function GlueStockPage() {
  const [date, setDate] = useState(() => todayMyanmar());
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ kg: "", bags: "", note: "" });
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadStock() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/glue-stock?date=${encodeURIComponent(date)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "ကော်စေ့ Stock ရယူ၍မရပါ။");
      setData(body.data || null);
    } catch (loadError) { setError(loadError.message); } finally { setLoading(false); }
  }
  useEffect(() => { loadStock(); }, [date]);

  const manualMovements = useMemo(() => (data?.movements || []).filter((row) => row.sourceType === "GLUE_OPENING"), [data]);

  function resetForm() { setForm({ kg: "", bags: "", note: "" }); setEditing(null); }
  async function saveStock(event) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(editing ? "/api/glue-stock" : "/api/glue-stock", { method: editing ? "PATCH" : "POST", headers: actorHeaders(), body: JSON.stringify(editing ? { id: editing.id, date, ...form } : { date, ...form }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "ကော်စေ့ Stock သိမ်း၍မရပါ။");
      resetForm(); setMessage(editing ? "ကော်စေ့ Stock မှတ်တမ်း ပြင်ပြီးပါပြီ။" : "ကော်စေ့ Stock အသစ် ထည့်ပြီးပါပြီ။"); await loadStock();
    } catch (saveError) { setError(saveError.message); } finally { setSaving(false); }
  }
  function beginEdit(row) {
    setEditing(row); setDate(row.movementDate || date); setForm({ kg: String(Math.abs(Number(row.quantityBottles || 0))), bags: String(Math.abs(Number(row.quantityCards || 0))), note: row.note || "" }); setError(""); setMessage("");
  }
  async function deleteStock(row) {
    if (!window.confirm(`${number(row.quantityBottles)} kg / ${number(row.quantityCards)} အိတ် မှတ်တမ်းကို ဖျက်မလား?`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/glue-stock?id=${encodeURIComponent(row.id)}`, { method: "DELETE", headers: actorHeaders() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "ကော်စေ့ Stock ဖျက်၍မရပါ။");
      setMessage("ကော်စေ့ Stock မှတ်တမ်း ဖျက်ပြီးပါပြီ။"); await loadStock();
    } catch (deleteError) { setError(deleteError.message); } finally { setSaving(false); }
  }

  return <main className="app-page-main"><div className="app-page-container app-page-surface space-y-4 pt-5 sm:pt-6">
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-amber-700">Factory Material Stock</p><h1 className="mt-1 text-2xl font-black text-amber-950">စက်ရုံ ကော်စေ့ လက်ကျန်</h1><p className="mt-1 text-sm font-bold text-amber-800">စက်ရုံမှာ သီးသန့်ရှိတဲ့ ကော်စေ့ Stock ကို အဝင်/သုံးစွဲမှုအလိုက် မှတ်တမ်းတင်ထားပါသည်။</p></div><Link href="/" className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-black text-amber-800 hover:bg-amber-100">Dashboard သို့</Link></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="rounded-xl border border-amber-300 bg-white p-3"><p className="text-xs font-bold text-amber-700">လက်ကျန် kg</p><p className="mt-1 text-2xl font-black text-amber-950">{loading ? "..." : `${number(data?.currentKg)} kg`}</p></div><div className="rounded-xl border border-amber-300 bg-white p-3"><p className="text-xs font-bold text-amber-700">လက်ကျန်အိတ်</p><p className="mt-1 text-2xl font-black text-amber-950">{loading ? "..." : `${number(data?.currentBags)} အိတ်`}</p></div><div className="rounded-xl border border-rose-200 bg-rose-50 p-3"><p className="text-xs font-bold text-rose-700">ရွေးထားသောရက် သုံး</p><p className="mt-1 text-2xl font-black text-rose-950">{loading ? "..." : `${number(data?.dailyUsedKg)} kg`}</p><p className="text-xs font-bold text-rose-700">{number(data?.dailyUsedBags)} အိတ်</p></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-700">ရွေးထားသောရက် ဝင်</p><p className="mt-1 text-2xl font-black text-emerald-950">{loading ? "..." : `${number(data?.dailyAddedKg)} kg`}</p><p className="text-xs font-bold text-emerald-700">{number(data?.dailyAddedBags)} အိတ်</p></div></div>
      <div className="mt-4 flex flex-wrap items-end gap-2"><label className="text-sm font-black text-amber-900">ရက်စွဲ<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 block min-h-10 rounded-lg border-2 border-amber-300 bg-white px-3 py-2 font-bold text-amber-950" /></label>{[-1, 0, 1].map((delta) => { const value = new Date(`${todayMyanmar()}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + delta); const dateValue = value.toISOString().slice(0, 10); const label = delta === -1 ? "မနေ့" : delta === 0 ? "ဒီနေ့" : "မနက်ဖြန်"; return <button key={label} type="button" onClick={() => setDate(dateValue)} className={`rounded-lg border px-3 py-2 text-sm font-black ${date === dateValue ? "border-amber-600 bg-amber-600 text-white" : "border-amber-300 bg-white text-amber-800 hover:bg-amber-100"}`}>{label}</button>; })}</div>
    </section>

    {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}
    {message ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-bold text-emerald-700">{message}</div> : null}

    <section className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-black text-amber-950">Stock အသစ်ထည့်ရန်</h2><p className="mt-1 text-sm font-bold text-slate-500">နေ့စဉ် ကော်စေ့ အသစ်ဝင်လာသည့်အခါ kg နှင့် အိတ်ကို ထည့်ပါ။ Tube ထုတ်လုပ်မှုမှတ်တမ်းထဲက သုံးကော်စေ့ကို အလိုအလျောက် နုတ်ပြပါမည်။</p><form onSubmit={saveStock} className="mt-4 grid gap-3 sm:grid-cols-4"><label className="text-sm font-black text-slate-700">kg<input type="number" min="0" step="0.001" value={form.kg} onChange={(event) => setForm({ ...form, kg: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border-2 border-amber-200 px-3 py-2 font-bold" placeholder="150" /></label><label className="text-sm font-black text-slate-700">အိတ်<input type="number" min="0" step="0.001" value={form.bags} onChange={(event) => setForm({ ...form, bags: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border-2 border-amber-200 px-3 py-2 font-bold" placeholder="4" /></label><label className="text-sm font-black text-slate-700 sm:col-span-2">မှတ်ချက်<input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border-2 border-amber-200 px-3 py-2 font-bold" placeholder="ပေးသွင်းသူ / invoice" /></label><div className="flex items-end gap-2 sm:col-span-4"><button disabled={saving} className="min-h-11 rounded-lg bg-amber-600 px-5 py-2 font-black text-white hover:bg-amber-700 disabled:opacity-50">{saving ? "သိမ်းနေသည်..." : editing ? "ပြင်ဆင်သိမ်းမည်" : "Stock ထည့်သိမ်းမည်"}</button>{editing ? <button type="button" onClick={resetForm} className="min-h-11 rounded-lg border border-slate-300 px-5 py-2 font-black text-slate-700">မပြင်တော့ပါ</button> : null}</div></form></section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black text-slate-950">ကော်စေ့ Stock လှုပ်ရှားမှု</h2><p className="mt-1 text-sm font-bold text-slate-500">အဝင် Stock နှင့် Tube ထုတ်လုပ်မှုမှ အလိုအလျောက်နုတ်ထားသော သုံးစွဲမှုကို ခွဲပြထားပါသည်။</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800">{loading ? "ရယူနေသည်..." : `${data?.movements?.length || 0} မှတ်တမ်း`}</span></div><div className="mt-3 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-100 text-slate-800"><tr><th className="px-3 py-2 text-left">ရက်စွဲ</th><th className="px-3 py-2 text-left">အမျိုးအစား</th><th className="px-3 py-2 text-right">kg</th><th className="px-3 py-2 text-right">အိတ်</th><th className="px-3 py-2 text-left">မှတ်ချက်</th><th className="px-3 py-2 text-right">လုပ်ဆောင်ချက်</th></tr></thead><tbody>{(data?.movements || []).map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2 font-bold">{row.movementDate}</td><td className={`px-3 py-2 font-black ${row.derived ? "text-rose-700" : "text-emerald-700"}`}>{row.derived ? "ထုတ်လုပ်မှုသုံး" : "Stock ဝင်"}</td><td className={`px-3 py-2 text-right font-black ${row.quantityBottles < 0 ? "text-rose-700" : "text-emerald-700"}`}>{row.quantityBottles < 0 ? "−" : "+"}{number(Math.abs(row.quantityBottles))}</td><td className={`px-3 py-2 text-right font-black ${row.quantityCards < 0 ? "text-rose-700" : "text-emerald-700"}`}>{row.quantityCards < 0 ? "−" : "+"}{number(Math.abs(row.quantityCards))}</td><td className="px-3 py-2">{row.note || row.reason || "-"}</td><td className="px-3 py-2 text-right">{row.derived ? <span className="text-xs font-bold text-slate-500">Production မှတ်တမ်း</span> : <span className="inline-flex gap-2"><button type="button" onClick={() => beginEdit(row)} className="rounded border border-amber-300 px-2 py-1 font-bold text-amber-800">ပြင်</button><button type="button" onClick={() => deleteStock(row)} disabled={saving} className="rounded border border-rose-300 px-2 py-1 font-bold text-rose-700">ဖျက်</button></span>}</td></tr>)}</tbody></table>{!loading && !(data?.movements || []).length ? <p className="p-8 text-center font-bold text-slate-500">Stock မှတ်တမ်း မရှိသေးပါ။</p> : null}</div></section>
  </div></main>;
}
