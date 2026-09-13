"use client";
import { useEffect, useMemo, useState } from "react";
import { encodeActorHeader } from "@/lib/actor-header";

const money = (value) => `${Number(value || 0).toLocaleString("en-US")} Ks`;
const initialExpenses = [
  ["ဆန်", "ဆန် ၉ အိတ်နှင့် ၈ ပြည်", 1359375],
  ["ဟင်းချက်ဆီ", "၂၅ ပိဿာ ၅၀သား", 499800],
  ["အသား", "အသား", 1817500],
  ["အသီးအရွက်နှင့် ဟင်းထဲထည့်သည့် အစာပလာဘိုး", "အသီးအရွက်နှင့် ဟင်းထဲထည့်သည့် အစာပလာဘိုး", 1713000],
];
const apiOptions = (options = {}) => ({ ...options, headers: { ...(options.headers || {}), "x-actor-name": encodeActorHeader(typeof window === "undefined" ? "" : localStorage.getItem("actorName") || "") } });

export default function ExpensesPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ expenseDate: "2026-08-31", category: "စားသောက်စာရိတ်", description: "", amount: "", note: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const response = await fetch("/api/expenses?month=2026-08", apiOptions({ cache: "no-store" }));
    const body = await response.json();
    const existing = Array.isArray(body.data) ? body.data : [];
    if (existing.length) {
      setRows(existing);
    } else {
      const seeded = await Promise.all(initialExpenses.map(([, description, amount]) => fetch("/api/expenses", apiOptions({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseDate: "2026-08-31", category: "စားသောက်စာရိတ်", description, amount }),
      })).then((result) => result.json()).then((result) => result.data).catch(() => null)));
      setRows(seeded.filter(Boolean));
    }
  }

  useEffect(() => {
    load().catch(() => setError("စာရင်းရယူ၍ မရပါ။")).finally(() => setLoading(false));
  }, []);

  const total = useMemo(() => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0), [rows]);

  async function save(event) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/expenses", apiOptions({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }));
    const body = await response.json();
    if (!response.ok) return setError(body.error || "သိမ်း၍ မရပါ။");
    setRows((current) => [body.data, ...current]);
    setForm((current) => ({ ...current, description: "", amount: "", note: "" }));
  }

  async function remove(id) {
    if (!window.confirm("ဤအသုံးစားရိတ်ကို ဖျက်မည်လား။")) return;
    const response = await fetch(`/api/expenses?id=${encodeURIComponent(id)}`, apiOptions({ method: "DELETE" }));
    if (response.ok) setRows((current) => current.filter((row) => row.id !== id));
  }

  return (
    <main className="app-page-main">
      <div className="app-page-container app-page-surface">
        <section className="page-toolbar">
          <div className="page-toolbar-row items-start">
            <div>
              <p className="page-toolbar-description">စားသောက်စာရိတ်နှင့် အခြားအသုံးစရိတ်များကို မှတ်တမ်းတင်ရန်</p>
              <p className="mt-2 text-xs font-semibold text-slate-500">ငွေပမာဏများကို comma format ဖြင့် အလိုအလျောက် ပြသပါမည်။</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
              <p className="text-xs font-bold text-emerald-700">ဩဂုတ်လ စုစုပေါင်း</p>
              <p className="mt-1 text-xl font-black text-emerald-900">{money(total)}</p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-slate-900">အသုံးစားရိတ် ထည့်ရန်</h2>
          <form onSubmit={save} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-bold text-slate-700">ရက်စွဲ<input type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label>
            <label className="text-sm font-bold text-slate-700">အမျိုးအစား<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label>
            <label className="text-sm font-bold text-slate-700">အသုံးစရိတ်အမည်<input required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="ဥပမာ - ဆန်" className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label>
            <label className="text-sm font-bold text-slate-700">ငွေပမာဏ (Ks)<input required inputMode="numeric" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value.replace(/[^0-9,]/g, "") })} placeholder="1,359,375" className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-2">မှတ်ချက်<textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 p-3" rows="2" /></label>
            <button disabled={loading} className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white transition hover:bg-emerald-700 disabled:opacity-50 md:col-span-2">သိမ်းမည်</button>
          </form>
          {error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black text-slate-900">ဩဂုတ်လ စားသောက်စာရိတ်</h2><span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-800">{money(total)}</span></div>
          {loading ? <p className="py-10 text-center text-sm text-slate-500">စာရင်းရယူနေသည်...</p> : <div className="mt-4 space-y-2">{rows.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="font-black text-slate-900">{row.description}</p><p className="text-xs text-slate-500">{row.category} · {row.expenseDate || "ဩဂုတ်လ"}</p></div><div className="flex items-center gap-3"><b className="text-emerald-700">{money(row.amount)}</b><button type="button" onClick={() => remove(row.id)} className="text-xs font-bold text-rose-600">ဖျက်</button></div></div>)}</div>}
          <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-center font-black text-emerald-900">စာရင်းအရ စုစုပေါင်း — {money(total)}</div>
        </section>
      </div>
    </main>
  );
}
