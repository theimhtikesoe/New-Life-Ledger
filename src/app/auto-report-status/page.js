'use client';

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatMyanmarDateTime } from "@/lib/myanmar-time-client";

const money = new Intl.NumberFormat("en-US");

function formatRunTime(value) {
  if (!value) return "မရရှိသေးပါ";
  try {
    return `${formatMyanmarDateTime(value)} (မြန်မာစံတော်ချိန်)`;
  } catch {
    return "မရရှိသေးပါ";
  }
}

function formatCount(value) {
  return money.format(Number(value || 0));
}

function triggerLabel(trigger) {
  const value = String(trigger || "");
  if (value === "manual" || value.startsWith("manual-")) return "Manual ပို့မှု";
  if (value.includes("catch-up")) return "Auto Catch-up";
  return "Auto Scheduled";
}

function triggerClassName(trigger) {
  const value = String(trigger || "");
  if (value === "manual" || value.startsWith("manual-")) return "border-violet-200 bg-violet-50 text-violet-800";
  if (value.includes("catch-up")) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-cyan-200 bg-cyan-50 text-cyan-800";
}

function TriggerBadge({ trigger }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${triggerClassName(trigger)}`}>
      {triggerLabel(trigger)}
    </span>
  );
}

function statusInfo(status) {
  if (status === "SUCCESS") {
    return {
      label: "အောင်မြင်စွာ ပို့ပြီး",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      dotClassName: "bg-emerald-500",
    };
  }
  if (status === "FAILED") {
    return {
      label: "ပို့မှု မအောင်မြင်ပါ",
      className: "border-rose-200 bg-rose-50 text-rose-800",
      dotClassName: "bg-rose-500",
    };
  }
  if (status === "RUNNING") {
    return {
      label: "ပို့နေဆဲဖြစ်ပါသည်",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      dotClassName: "bg-amber-500",
    };
  }
  return {
    label: "မစစ်ရသေးပါ",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    dotClassName: "bg-slate-400",
  };
}

function StatusBadge({ status }) {
  const info = statusInfo(status);
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${info.className}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${info.dotClassName}`} />
      {info.label}
    </span>
  );
}

function MetricCard({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    violet: "border-violet-200 bg-violet-50 text-violet-900",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.slate}`}>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default function AutoReportStatusPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState(null);

  const loadStatus = useCallback(async (isRefresh = false) => {
    setError("");
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch("/api/auto-report-status", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Status ရယူ၍ မရပါ။");
      setData(body.data || { latest: null, history: [] });
      setCheckedAt(new Date());
    } catch (requestError) {
      setError(requestError.message || "Auto Report status ရယူ၍ မရပါ။");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const latest = data?.latest;
  const history = data?.history || [];
  const counts = latest?.counts || {};

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link href="/" className="text-sm font-medium text-cyan-700">← Dashboard</Link>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Auto Report အခြေအနေ</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                နောက်ဆုံး Auto Report run၊ report ရက်စွဲ၊ ပို့မှုအခြေအနေနှင့် လက်ခံရရှိသည့်နေရာအရေအတွက်ကိုသာ ကြည့်နိုင်ပါသည်။
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadStatus(true)}
              disabled={loading || refreshing}
              className="min-h-11 shrink-0 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "ပြန်လည်ရယူနေသည်..." : "ပြန်လည်ရယူမည်"}
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            {checkedAt ? `နောက်ဆုံးစစ်ဆေးချိန် — ${formatRunTime(checkedAt)}` : "အခြေအနေ ရယူနေသည်..."}
          </p>
        </header>

        {error ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
            <h2 className="font-semibold">အခြေအနေ ရယူ၍ မရပါ</h2>
            <p className="mt-2 text-sm">{error}</p>
            <p className="mt-2 text-xs text-rose-700">ပြန်လည်ရယူမည် ခလုတ်ကို နှိပ်ပြီး ထပ်စမ်းနိုင်ပါသည်။</p>
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm">Auto Report အခြေအနေ ရယူနေသည်...</section>
        ) : !latest ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
            <h2 className="text-lg font-semibold">Auto Report run မှတ်တမ်း မရှိသေးပါ</h2>
            <p className="mt-2 text-sm leading-6">နောက်လာမည့် scheduled run ပြီးမှ အောင်မြင်/မအောင်မြင် အခြေအနေကို ဒီနေရာမှာ ပြပါမည်။ ဒီစာမျက်နှာကို ပြန်လည်ရယူမည် ခလုတ်ဖြင့် ပြန်စစ်နိုင်ပါသည်။</p>
          </section>
        ) : (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-700">နောက်ဆုံး Report run</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">{latest.reportDate || "Report date မရရှိသေးပါ"}</h2>
                    <TriggerBadge trigger={latest.trigger} />
                  </div>
                </div>
                <StatusBadge status={latest.status} />
              </div>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Run အချိန်" value={formatRunTime(latest.createdAt)} />
                <MetricCard label="လက်ခံရရှိသည့်နေရာ" value={`${formatCount(latest.recipientCount)} နေရာ`} tone="blue" />
                <MetricCard label="Run ကြာချိန်" value={latest.elapsedMs ? `${formatCount(latest.elapsedMs)} ms` : "မရရှိသေးပါ"} tone="violet" />
                <MetricCard label="စုစုပေါင်းစာရင်း" value={`${formatCount(counts.transactions)} ခု`} tone="emerald" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MetricCard label="ငွေချေ" value={`${formatCount(counts.paid)} ခု`} />
                <MetricCard label="အကြွေးတိုး" value={`${formatCount(counts.debtIncrease)} ခု`} />
                <MetricCard label="လုပ်ဆောင်ချက်" value={`${formatCount(counts.activityActions)} ခု`} />
              </div>
              {latest.errorMessage ? (
                <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <p className="font-semibold">အမှားအကျဉ်း</p>
                  <p className="mt-1">{latest.errorMessage}</p>
                </div>
              ) : latest.trigger === "manual" || String(latest.trigger || "").startsWith("manual-") ? (
                <p className="mt-5 rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-800">ဒီ report ကို Manual ဖြင့် ပို့ပြီးပါပြီ။ နောက် Auto scheduled run တွင် report အပြည့်ကို ထပ်မပို့ဘဲ status notice သာ ပို့ပါမည်။</p>
              ) : (
                <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">Telegram ပို့မှုအတွက် Auto scheduled run က အောင်မြင်ပြီး လက်ခံရရှိသည့်နေရာ {formatCount(latest.recipientCount)} နေရာကို မှတ်တမ်းတင်ထားပါသည်။</p>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">နောက်ဆုံး run မှတ်တမ်းများ</h2>
                  <p className="mt-1 text-sm text-slate-500">Manual နှင့် Scheduled Auto Report ပို့မှုများ၏ read-only မှတ်တမ်း</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{history.length} ခု</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Run အချိန်</th>
                      <th className="px-3 py-3">Report ရက်စွဲ</th>
                      <th className="px-3 py-3">ပို့သည့်နည်း</th>
                      <th className="px-3 py-3">အခြေအနေ</th>
                      <th className="px-3 py-3 text-right">လက်ခံရရှိသည့်နေရာ</th>
                      <th className="px-3 py-3 text-right">စာရင်း</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((run) => (
                      <tr key={run.id}>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-700">{formatRunTime(run.createdAt)}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-800">{run.reportDate || "မသတ်မှတ်ရသေးပါ"}</td>
                        <td className="px-3 py-3"><TriggerBadge trigger={run.trigger} /></td>
                        <td className="px-3 py-3"><StatusBadge status={run.status} /></td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatCount(run.recipientCount)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatCount(run.counts?.transactions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <p className="rounded-lg border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500 shadow-sm">
          ဤစာမျက်နှာသည် Auto Report scheduled run status ကိုသာ ဖတ်ရှုရန်ဖြစ်ပြီး Customer၊ Ledger၊ Backup၊ Restore သို့မဟုတ် Telegram send action မည်သည့်အရာကိုမျှ မလုပ်ဆောင်ပါ။
        </p>
      </div>
    </main>
  );
}
