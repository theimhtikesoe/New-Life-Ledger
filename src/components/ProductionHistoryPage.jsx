"use client";

import { useEffect, useMemo, useState } from "react";
import { getBottleDisplayName } from "@/lib/production-catalog";

function todayMyanmar() {
  const now = new Date(Date.now() + (6 * 60 + 30) * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function shiftDate(value, delta) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function rowLabel(row) {
  if (row.category === "tube") return `${row.tubeG || "Tube"} ${row.tubeColor || ""}`.trim();
  return getBottleDisplayName(row.bottleType) || "ဗူးအမျိုးအစား မသတ်မှတ်ရသေးပါ";
}

function normalizeWorkerNames(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((name) => String(name || "").trim()).filter(Boolean))];
}

export default function ProductionHistoryPage() {
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
    setLoading(true);
    setError("");
    fetch(`/api/production-reports?date=${encodeURIComponent(date)}&category=bottle`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "ထုတ်လုပ်မှုမှတ်တမ်း ရယူ၍မရပါ။");
        return body.data;
      })
      .then((data) => setRows(Array.isArray(data) ? data.filter((row) => row.category === "bottle") : []))
      .catch((loadError) => {
        if (loadError.name !== "AbortError") {
          setRows([]);
          setError(loadError.message || "ထုတ်လုပ်မှုမှတ်တမ်း ရယူ၍မရပါ။");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [date]);

  const groups = useMemo(() => {
    const grouped = new Map();
    rows.forEach((row) => {
      const key = row.submissionId || row.id;
      const current = grouped.get(key) || {
        key,
        reportDate: row.reportDate,
        machineName: row.machineName || row.machineCode,
        actorName: row.actorName,
        workers: [],
        rows: [],
        totalPieces: 0,
        wasteQuantity: 0,
        tubeDamageQuantity: 0,
        tubeQuantityValue: "0",
        tubeQuantityUnit: row.tubeQuantityUnit || "အိတ်",
        tubeMetrics: {},
      };
      current.workers = [...new Set([...current.workers, ...normalizeWorkerNames(row.involvedWorkers)])];
      current.tubeMetrics = { ...(current.tubeMetrics || {}), ...(row.tubeMetrics && typeof row.tubeMetrics === "object" ? row.tubeMetrics : {}) };
      current.rows.push(row);
      current.totalPieces += Number(row.outputQuantity || 0) * Number(row.outputCapacity || 0);
      current.wasteQuantity = Math.max(current.wasteQuantity, Number(row.wasteQuantity || 0));
      current.tubeDamageQuantity = Math.max(current.tubeDamageQuantity, Number(row.tubeDamageQuantity || 0));
      if (Number(row.tubeQuantity || 0) || String(row.tubeQuantityValue || "0") !== "0") {
        current.tubeQuantityValue = String(row.tubeQuantityValue ?? row.tubeQuantity ?? 0);
        current.tubeQuantityUnit = row.tubeQuantityUnit || "အိတ်";
      }
      grouped.set(key, current);
    });
    return [...grouped.values()];
  }, [rows]);

  const totalPieces = groups.reduce((sum, group) => sum + group.totalPieces, 0);
  const totalWaste = groups.reduce((sum, group) => sum + group.wasteQuantity, 0);
  const summaries = useMemo(() => {
    const bottles = new Map();
    const tubes = new Map();
    rows.forEach((row) => {
      const quantity = Number(row.outputQuantity || 0);
      const capacity = Number(row.outputCapacity || 0);
      const pieces = quantity * capacity;
      if (row.category === "tube") {
        const label = `${row.tubeG || "Tube"} ${row.tubeColor || ""}`.trim();
        const key = `${label}|${capacity}`;
        const current = tubes.get(key) || { label, capacity, quantity: 0, pieces: 0, unit: row.outputUnit || "အိတ်" };
        current.quantity += quantity;
        current.pieces += pieces;
        tubes.set(key, current);
      } else {
        const label = getBottleDisplayName(row.bottleType) || "ဗူးအမျိုးအစား မသတ်မှတ်ရသေးပါ";
        const key = `${label}|${capacity}`;
        const current = bottles.get(key) || { label, capacity, quantity: 0, pieces: 0, unit: row.outputUnit || "ကဒ်" };
        current.quantity += quantity;
        current.pieces += pieces;
        bottles.set(key, current);
      }
    });
    return { bottles: [...bottles.values()], tubes: [...tubes.values()] };
  }, [rows]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 px-3 pb-8 sm:px-6">
      <section className="rounded-2xl border border-orange-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mt-1 text-sm text-slate-500">ရက်စွဲအလိုက် ထုတ်လုပ်မှုမှတ်တမ်းများကို သီးသန့်ကြည့်ရှုနိုင်ပါသည်။</p>
          </div>
          <label className="text-sm font-black text-orange-900">မှတ်တမ်း Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 block min-h-11 rounded-xl border-2 border-orange-200 bg-orange-50 px-3 py-2 font-bold text-orange-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[-1, 0, 1].map((delta) => {
            const label = delta === -1 ? "မနေ့" : delta === 0 ? "ဒီနေ့" : "မနက်ဖြန်";
            const value = shiftDate(todayMyanmar(), delta);
            return <button key={label} type="button" onClick={() => setDate(value)} className={`rounded-lg border px-4 py-2 text-sm font-black ${date === value ? "border-orange-500 bg-orange-500 text-white" : "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100"}`}>{label}</button>;
          })}
        </div>
      </section>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-bold text-emerald-700">ဗူးစုစုပေါင်းထွက်ရှိ</p><p className="mt-1 text-2xl font-black text-emerald-800">{formatNumber(totalPieces)} ဗူး</p></div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-sm font-bold text-red-700">ဗူးပျက်</p><p className="mt-1 text-2xl font-black text-red-800">{formatNumber(totalWaste)} ဗူး</p></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-bold text-slate-700">ဗူးထုတ်လုပ်မှုမှတ်တမ်း</p><p className="mt-1 text-2xl font-black text-slate-800">{formatNumber(groups.length)} ကြိမ်</p></div>
      </section>

      {summaries.bottles.length ? <section className="production-book-summary rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-black text-indigo-950">ဗူးစာအုပ်မှတ်တမ်းအကျဉ်းချုပ်</h2><p className="mt-1 text-sm text-indigo-800">ရွေးထားသောနေ့၏ ဗူး Product နှင့် ဆံ့အရွယ်အစားအလိုက် စုစည်းပြထားပါသည်။</p></div>
        </div>
        {summaries.bottles.length ? <div className="mt-4 overflow-x-auto rounded-xl border border-indigo-200 bg-white"><table className="w-full table-fixed text-left text-sm"><thead className="bg-indigo-100 text-indigo-950"><tr><th className="px-3 py-2 font-black">ဗူးအမျိုးအစား</th><th className="px-3 py-2 font-black">ဆံ့</th><th className="px-3 py-2 text-right font-black">အရေအတွက်</th><th className="px-3 py-2 text-right font-black">စုစုပေါင်းဗူး</th></tr></thead><tbody>{summaries.bottles.map((item) => <tr key={`${item.label}|${item.capacity}`} className="border-t border-slate-100"><td className="px-3 py-2 font-bold">{item.label}</td><td className="px-3 py-2 font-bold">{formatNumber(item.capacity)} ဆံ့</td><td className="px-3 py-2 text-right font-black">{formatNumber(item.quantity)} {item.unit}</td><td className="px-3 py-2 text-right font-black text-emerald-700">{formatNumber(item.pieces)} ဗူး</td></tr>)}</tbody><tfoot className="border-t-2 border-indigo-200 bg-indigo-50"><tr><td colSpan="3" className="px-3 py-2 font-black">ဗူးစုစုပေါင်း</td><td className="px-3 py-2 text-right font-black text-emerald-800">{formatNumber(summaries.bottles.reduce((sum, item) => sum + item.pieces, 0))} ဗူး</td></tr></tfoot></table></div> : null}

      </section> : null}

      {loading ? <div className="rounded-2xl border border-dashed p-10 text-center font-bold text-slate-500">ထုတ်လုပ်မှုမှတ်တမ်း ရယူနေသည်...</div> : groups.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center font-bold text-slate-500">{date} အတွက် ထုတ်လုပ်မှုမှတ်တမ်း မရှိသေးပါ။</div> : <section className="space-y-4">{groups.map((group) => <article key={group.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black text-slate-900">{group.machineName}</h3><p className="text-sm text-slate-500">{group.reportDate}</p><p className="mt-1 text-xs font-bold text-slate-500">မှတ်တမ်းတင်သူ — {group.actorName || "User"}</p></div><div className="min-w-[220px] rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-blue-900"><p className="text-xs font-black uppercase tracking-wide text-blue-700">ပူးတွဲဆင်းသူများ</p><div className="mt-1 flex flex-wrap gap-1.5">{group.workers.length ? group.workers.map((worker) => <span key={worker} className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-black text-white">{worker}</span>) : <span className="text-sm font-bold text-blue-700">မရှိ</span>}</div></div></div><div className="mt-4 grid gap-2">{group.rows.map((row) => <div key={row.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800"><span>{rowLabel(row)} · {row.category === "tube" ? `${formatNumber(row.outputCapacity)} pcs/အိတ်` : `${row.outputCapacity} ဆံ့`}</span><span className="float-right">{formatNumber(row.outputQuantity)} {row.outputUnit || (row.category === "tube" ? "အိတ်" : "ကဒ်")} × {formatNumber(Number(row.outputCapacity || 0))} = {formatNumber(Number(row.outputQuantity || 0) * Number(row.outputCapacity || 0))} {row.category === "tube" ? "pcs" : "ဗူး"}</span></div>)}</div><div className="mt-4 grid gap-2 text-sm font-black sm:grid-cols-2 lg:grid-cols-4"><p className="text-emerald-700">စုစုပေါင်း {formatNumber(group.totalPieces)} {group.rows[0]?.category === "tube" ? "pcs" : "ဗူး"}</p><p className="text-red-700">ဗူးပျက် {formatNumber(group.wasteQuantity)} ဗူး</p></div></article>)}</section>}
    </main>
  );
}
