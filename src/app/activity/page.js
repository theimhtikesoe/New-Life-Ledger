"use client";

import { useEffect, useState } from "react";

const ACTORS = ["ဖေဖေ", "ပုံ့ပုံ့", "ဆောင်းဦး", "Staff"];
const ACTIONS = ["PAYMENT", "DEBT_INCREASE", "CREATE", "UPDATE", "RESTORE", "DELETE", "PERMANENT_DELETE"];
const today = new Date().toISOString().slice(0, 10);

async function fetchLogs(query) {
  const actorName = localStorage.getItem("actorName") || "";
  const response = await fetch(`/api/audit-logs?${query}`, { headers: { "x-actor-name": actorName } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body.data;
}

function actionLabel(action) {
  return ({ PAYMENT: "ငွေချေ", DEBT_INCREASE: "အကြွေးတိုး", CREATE: "အသစ်ထည့်", UPDATE: "ပြင်ဆင်", RESTORE: "ပြန်ယူ", DELETE: "ဖျက်", PERMANENT_DELETE: "အပြီးဖျက်" })[action] || action;
}

function money(value) {
  return value === null || value === undefined ? "" : `${Number(value).toLocaleString()} Ks`;
}

export default function ActivityPage() {
  const [date, setDate] = useState(today);
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ date, limit: "500" });
    if (actor) params.set("actor", actor);
    if (action) params.set("action", action);
    fetchLogs(params.toString())
      .then((items) => active && setLogs(items))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [date, actor, action]);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="rounded-xl border border-slate-200 bg-white p-5">
          <a href="/" className="text-sm font-medium text-cyan-700">← Dashboard</a>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><h1 className="text-2xl font-bold text-slate-900">Activity History</h1><p className="mt-1 text-sm text-slate-600">အရင်စာရင်းများနှင့် လက်ရှိလုပ်ဆောင်ချက်များကို အသေးစိတ်ကြည့်ရန်</p></div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800" /><select value={actor} onChange={(e) => setActor(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"><option value="">User အားလုံး</option>{ACTORS.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={action} onChange={(e) => setAction(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"><option value="">Action အားလုံး</option>{ACTIONS.map((item) => <option key={item} value={item}>{actionLabel(item)}</option>)}</select></div>
          </div>
        </header>

        {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</p>}
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">{date} Activity</h2><p className="mt-1 text-xs text-slate-500">အရင်စာရင်းများတွင် လုပ်သူအမည်ကို မသိပါက အလွတ်ထားထားပါသည်။</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{logs.length} actions</span></div>
          {loading ? <p className="py-10 text-center text-slate-500">မှတ်တမ်းများ ရယူနေသည်...</p> : <>
            <div className="space-y-3 md:hidden">{logs.length ? logs.map((log) => { const metadata = log.metadata || {}; const isLegacy = log.eventSource === "legacy"; return <article key={`mobile-${log.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString("en-GB")}</p><p className="mt-1 font-medium text-slate-800">{log.actorName || ""}</p></div><span className={`rounded-full px-2 py-1 text-xs font-medium ${log.action === "PAYMENT" ? "bg-emerald-100 text-emerald-700" : log.action === "DEBT_INCREASE" ? "bg-rose-100 text-rose-700" : log.action.includes("DELETE") ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{actionLabel(log.action)}</span></div><div className="mt-3 border-t border-slate-100 pt-3"><p className="font-medium text-slate-800">{log.entityLabel || ""}</p><p className="mt-1 text-sm text-slate-600">{log.summary}</p></div><div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs"><div><p className="text-slate-500">ပမာဏ</p><p className="mt-1 font-medium text-slate-800">{money(metadata.amount) || "-"}</p></div><div><p className="text-slate-500">Payment</p><p className="mt-1 font-medium text-slate-800">{metadata.paymentType || "-"}</p></div></div><div className="mt-3 flex items-center justify-between gap-2 text-xs"><span className="text-slate-600">{metadata.note || ""}</span><span className={`rounded-full px-2 py-1 ${isLegacy ? "bg-slate-100 text-slate-600" : "bg-cyan-100 text-cyan-700"}`}>{isLegacy ? "အရင်စာရင်း" : "အသစ်မှတ်တမ်း"}</span></div></article>; }) : <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">ဒီနေ့လုပ်ဆောင်ချက်မရှိသေးပါ။</div>}</div>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">စာရင်းနေ့/အချိန်</th><th className="px-3 py-3">လုပ်သူ</th><th className="px-3 py-3">လုပ်ဆောင်ချက်</th><th className="px-3 py-3">Customer / အကြောင်းအရာ</th><th className="px-3 py-3 text-right">ပမာဏ</th><th className="px-3 py-3">Payment</th><th className="px-3 py-3">Note</th><th className="px-3 py-3">Source</th></tr></thead><tbody className="divide-y divide-slate-100">{logs.length ? logs.map((log) => { const metadata = log.metadata || {}; const isLegacy = log.eventSource === "legacy"; return <tr key={log.id} className="align-top hover:bg-slate-50"><td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{new Date(log.createdAt).toLocaleString("en-GB")}</td><td className="px-3 py-3 font-medium text-slate-800">{log.actorName || ""}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${log.action === "PAYMENT" ? "bg-emerald-100 text-emerald-700" : log.action === "DEBT_INCREASE" ? "bg-rose-100 text-rose-700" : log.action.includes("DELETE") ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{actionLabel(log.action)}</span></td><td className="max-w-[260px] px-3 py-3 text-slate-800"><div className="font-medium">{log.entityLabel || ""}</div><div className="mt-1 text-xs text-slate-500">{log.summary}</div></td><td className="whitespace-nowrap px-3 py-3 text-right font-medium text-slate-800">{money(metadata.amount)}</td><td className="px-3 py-3 text-slate-600">{metadata.paymentType || ""}</td><td className="max-w-[220px] px-3 py-3 text-slate-600">{metadata.note || ""}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs ${isLegacy ? "bg-slate-100 text-slate-600" : "bg-cyan-100 text-cyan-700"}`}>{isLegacy ? "အရင်စာရင်း" : "အသစ်မှတ်တမ်း"}</span></td></tr>; }) : <tr><td colSpan="8" className="px-3 py-10 text-center text-slate-500">ဒီနေ့လုပ်ဆောင်ချက်မရှိသေးပါ။</td></tr>}</tbody></table></div></>}
        </section>
      </div>
    </main>
  );
}
