"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeActorHeader } from "@/lib/actor-header";

const numberFormat = new Intl.NumberFormat("en-US");
const EMPTY_LIST = [];

function formatDate(value) {
  if (!value) return "မရရှိသေးပါ";
  const timestamp = Number(value);
  const date = new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1000);
  return Number.isNaN(date.getTime()) ? "မရရှိသေးပါ" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function deploymentLabel(deployment) {
  const shortSha = deployment?.commitSha ? ` · ${deployment.commitSha.slice(0, 7)}` : "";
  return `${deployment?.readyState || "UNKNOWN"} · ${deployment?.name || deployment?.uid || "မသတ်မှတ်ရသေး"}${shortSha}`;
}

function eventClass(event) {
  if (event?.level === "error" || event?.type === "stderr" || event?.type === "fatal") return "border-rose-200 bg-rose-50 text-rose-950";
  if (event?.type === "warning") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

export default function VercelBuildLogsPage() {
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadLogs = useCallback(async (deploymentId = "", isRefresh = false) => {
    setError("");
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const actorName = window.localStorage.getItem("actorName") || "";
      const query = deploymentId ? `?deploymentId=${encodeURIComponent(deploymentId)}` : "";
      const response = await fetch(`/api/vercel/build-logs${query}`, {
        cache: "no-store",
        headers: { "x-actor-name": encodeActorHeader(actorName) },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "Vercel build logs ရယူ၍ မရပါ။");
      setData(body.data || { deployments: [], events: [] });
      setSelectedId(body.data?.selectedDeploymentId || "");
    } catch (requestError) {
      setError(requestError.message || "Vercel build logs ရယူ၍ မရပါ။");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const deployments = data?.deployments || EMPTY_LIST;
  const events = data?.events || EMPTY_LIST;
  const selectedDeployment = useMemo(() => deployments.find((deployment) => deployment.uid === selectedId) || null, [deployments, selectedId]);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
                <Link href="/" className="text-cyan-700">← Dashboard</Link>
                <Link href="/auto-report-status" className="text-amber-700">Auto Report အခြေအနေ</Link>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">Vercel Build Logs</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Production deployment များ၏ build အခြေအနေ၊ warning နှင့် error စာသားများကို read-only ဖြင့် ကြည့်ရန် ဖြစ်ပါသည်။</p>
            </div>
            <button type="button" onClick={() => loadLogs(selectedId, true)} disabled={loading || refreshing} className="min-h-11 shrink-0 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60">
              {refreshing ? "ပြန်လည်ရယူနေသည်..." : "Build Logs ပြန်ရယူမည်"}
            </button>
          </div>
        </header>

        {error ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900 shadow-sm">
            <h2 className="font-semibold">Build Logs ရယူ၍ မရပါ</h2>
            <p className="mt-2 text-sm leading-6">{error}</p>
            <p className="mt-2 text-xs leading-5 text-rose-800">Vercel API setting မထည့်ရသေးပါက server environment တွင်သာ `VERCEL_API_TOKEN` နှင့် `VERCEL_PROJECT_ID` ကို ထည့်ပြီး Production deployment ပြန်တင်ပါ။ Token ကို Website code သို့မဟုတ် Browser သို့ မပို့ပါ။</p>
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm">Production deployments နှင့် build logs ရယူနေသည်...</section>
        ) : !error && deployments.length === 0 ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
            <h2 className="text-lg font-semibold">Production deployment မတွေ့ရသေးပါ</h2>
            <p className="mt-2 text-sm leading-6">Vercel project ID၊ team setting နှင့် token ခွင့်ပြုချက်ကို ပြန်စစ်ပြီး Build Logs ပြန်ရယူမည်ကို နှိပ်ပါ။</p>
          </section>
        ) : !error ? (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <label className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-slate-800">Production deployment ရွေးရန်</span>
                  <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); loadLogs(event.target.value, true); }} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100">
                    {deployments.map((deployment) => <option key={deployment.uid} value={deployment.uid}>{deploymentLabel(deployment)}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2 sm:min-w-64">
                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2"><p className="text-xs text-blue-700">Deployment များ</p><p className="mt-1 font-bold tabular-nums text-blue-900">{numberFormat.format(deployments.length)}</p></div>
                  <div className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2"><p className="text-xs text-violet-700">Log lines</p><p className="mt-1 font-bold tabular-nums text-violet-900">{numberFormat.format(events.length)}</p></div>
                </div>
              </div>
            </section>

            {selectedDeployment ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-700">ရွေးထားသော Production deployment</p>
                    <h2 className="mt-1 break-all text-lg font-bold text-slate-900">{selectedDeployment.name || selectedDeployment.uid}</h2>
                    <p className="mt-1 text-sm text-slate-500">Build စတင်/တင်ချိန်: {formatDate(selectedDeployment.createdAt)}{selectedDeployment.branch ? ` · Branch: ${selectedDeployment.branch}` : ""}</p>
                  </div>
                  <span className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-sm font-semibold ${selectedDeployment.readyState === "READY" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : selectedDeployment.readyState === "ERROR" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{selectedDeployment.readyState}</span>
                </div>
                {selectedDeployment.errorMessage ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{selectedDeployment.errorMessage}</p> : null}
                {selectedDeployment.inspectorUrl ? <a href={selectedDeployment.inspectorUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Vercel deployment ကို ဖွင့်ရန် ↗</a> : null}
              </section>
            ) : null}

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="text-lg font-semibold text-slate-900">Build output</h2><p className="mt-1 text-sm text-slate-500">Vercel မှ ပြန်လာသော log များကို ဖတ်ရန်သာ ပြထားပါသည်။</p></div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{numberFormat.format(events.length)} lines</span>
              </div>
              <div className="mt-4 max-h-[34rem] space-y-2 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 sm:text-sm">
                {events.length ? events.map((event) => <div key={event.id} className={`rounded-md border px-3 py-2 ${eventClass(event)}`}><div className="mb-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-wide opacity-70"><span>{event.type}</span><span>{formatDate(event.created)}</span></div><pre className="whitespace-pre-wrap break-words font-mono">{event.text || "(စာသားမရှိပါ)"}</pre></div>) : <p className="p-4 text-slate-300">ဒီ deployment အတွက် build log မရှိသေးပါ။</p>}
              </div>
            </section>
          </>
        ) : null}

        <p className="rounded-lg border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500 shadow-sm">ဤစာမျက်နှာသည် Vercel deployment status နှင့် redacted build logs ကိုသာ ဖတ်ရှုပါသည်။ Customer၊ Ledger၊ balance၊ Order သို့မဟုတ် Telegram action မည်သည့်အရာကိုမျှ မဖတ်/မပြောင်းပါ။ API token သည် server-side environment တွင်သာ ရှိပါသည်။</p>
      </div>
    </main>
  );
}
