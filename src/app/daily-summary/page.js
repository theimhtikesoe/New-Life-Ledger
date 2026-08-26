"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatMyanmarDateLabel } from "@/lib/myanmar-time-client";
import { encodeActorHeader } from "@/lib/actor-header";
import { buildDailySummaryReviewChecks, transactionsToDailySummaryEvents } from "@/lib/daily-summary-review";
import { cashSaleTypeLabel } from "@/lib/cash-sale-utils";
import {
  recordDailyAiSuccess,
  resetDailyAiUsage,
  getAiActivityReviewHref,
  getDailyAiUsage,
  MAX_DAILY_AI_REQUESTS,
  readAiExplanationCache,
  saveAiExplanationCache,
} from "@/lib/ai-explanation-storage";

const money = new Intl.NumberFormat("en-US");

function formatMyanmarDateInputValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() + (6 * 60 + 30) * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

const today = formatMyanmarDateInputValue(new Date());

function getInitialReportDate() {
  if (typeof window === "undefined") return today;
  const requestedDate = new URLSearchParams(window.location.search).get("date") || "";
  return isValidDateInput(requestedDate) ? requestedDate : today;
}

function formatMoney(value) {
  return `${money.format(Number(value || 0))} Ks`;
}

function isValidDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00+06:30`);
  return !Number.isNaN(date.getTime());
}

function safeMyanmarDateLabel(value) {
  return isValidDateInput(value) ? formatMyanmarDateLabel(`${value}T00:00:00+06:30`) : "ရက်စွဲ မရွေးရသေးပါ";
}

function formatDateControlLabel(value) {
  if (!isValidDateInput(value)) return "ရက်စွဲ မရွေးရသေးပါ";
  const [year, month, day] = value.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${monthNames[Number(month) - 1]} ${year}`;
}

function cleanAiText(value) {
  return String(value || "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
}

function normalizeAiItems(items = []) {
  return Array.from(new Set((Array.isArray(items) ? items : []).map((item) => cleanAiText(item)).filter(Boolean)));
}

function getReviewTarget(text) {
  const value = cleanAiText(text);
  const customerMatch = value.match(/Customer\s+(.+?)(?=\s*(?:၏|အတွက်|သည်|နှင့်|တွင်|ကို|တူ|ရှိ|အကြွေး|ငွေချေ|ငွေပြန်|payment)|\s+[0-9,]+\s*Ks|$)/iu);
  const amountMatch = value.match(/([0-9][0-9,]*)\s*Ks/iu);
  const action = /ငွေချေ|ပေးချေ|ငွေပြန်/iu.test(value) ? "PAYMENT" : /အကြွေး/iu.test(value) ? "DEBT_INCREASE" : "";
  return {
    customerName: customerMatch?.[1]?.trim() || "",
    amount: amountMatch?.[1] || "",
    action,
    targetText: value,
  };
}

function buildCodeBasedExplanation(report, reportDate) {
  const summary = report?.summary;
  if (!summary) return null;
  const totalTransactions = Number(summary.totalTransactions || 0);
  const paidCount = Number(summary.paidCount || 0);
  const debtCount = Number(summary.unpaidCount ?? summary.debtCount ?? 0);
  const activityCount = Number(summary.activityCount ?? summary.auditCount ?? 0);
  const customers = Array.isArray(report?.customers) ? report.customers : [];
  const cashTypeFinding = Object.entries(summary.cashSaleTypes || {})
    .filter(([, detail]) => Number(detail?.count || 0) > 0)
    .map(([type, detail]) => `${cashSaleTypeLabel(type)} ${Number(detail.count).toLocaleString("en-US")} ခု / ${formatMoney(detail.amount)}`)
    .join("၊ ");
  const checks = buildDailySummaryReviewChecks({
    totalTransactions,
    activityTotal: activityCount,
    events: transactionsToDailySummaryEvents(report?.transactions),
    summary,
    customers,
  });
  return {
    overview: `${reportDate} အတွက် စာရင်းအချက်အလက်ကို အလိုအလျောက် အကျဉ်းချုပ်ပြထားပါသည်။ AI service ပြန်ကောင်းလာသောအခါ အသေးစိတ် ပြန်ရှင်းနိုင်ပါသည်။`,
    findings: normalizeAiItems([
      `${reportDate} တွင် စာရင်းမှတ်တမ်း ${totalTransactions.toLocaleString("en-US")} ခု ရှိပါသည်။`,
      `ငွေချေမှု ${paidCount.toLocaleString("en-US")} ခု၊ အကြွေးတိုးမှု ${debtCount.toLocaleString("en-US")} ခု ရှိပါသည်။`,
      Number(summary.cashCount || 0) > 0 ? `လက်ငင်းရောင်း ${Number(summary.cashCount).toLocaleString("en-US")} ခု၊ ${formatMoney(summary.cashAmount)} ရှိပါသည်။` : null,
      cashTypeFinding ? `လက်ငင်းအမျိုးအစား — ${cashTypeFinding}။` : null,
      customers.length ? `Customer စာရင်း ${customers.length.toLocaleString("en-US")} ဦး ပါဝင်ပါသည်။` : "ဒီရက်အတွက် Customer အလိုက် စာရင်းမရှိပါ။",
    ]),
    checks,
    caution: "ဤအဖြေသည် AI မရသေးချိန်တွင် စာရင်း data အပေါ်အခြေခံ၍ အလိုအလျောက်ပြထားခြင်းသာ ဖြစ်ပါသည်။ အရေးကြီးသောစာရင်းကို Website တွင် ပြန်စစ်ပါ။",
  };
}

function mergeExplanations(codeExplanation, aiExplanation) {
  if (!codeExplanation) return aiExplanation || null;
  if (!aiExplanation) return codeExplanation;
  const unique = (items = []) => normalizeAiItems(items);
  const aiOverview = cleanAiText(aiExplanation.overview);
  return {
    overview: [cleanAiText(codeExplanation.overview), aiOverview && `AI ထပ်ဖြည့်ရှင်းချက် — ${aiOverview}`].filter(Boolean).join("\n\n"),
    findings: unique([...(codeExplanation.findings || []), ...(aiExplanation.findings || [])]),
    checks: unique([...(codeExplanation.checks || []), ...(aiExplanation.checks || [])]),
    caution: aiExplanation.caution || codeExplanation.caution,
  };
}

const AI_CLIENT_TIMEOUT_MS = 50_000;
const AI_CACHE_CHECK_TIMEOUT_MS = 10_000;

async function fetchJson(path, { timeoutMs = 15_000 } = {}) {
  const actorName = localStorage.getItem("actorName") || "";
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, { headers: { "x-actor-name": encodeActorHeader(actorName) }, signal: controller.signal, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Request မအောင်မြင်ပါ။ ပြန်စမ်းကြည့်ပါ။");
    return body.data;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("စာရင်းရယူရန် အချိန်ကြာသွားပါပြီ။ ပြန်စမ်းကြည့်ပါ။");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchAiJson(path, { timeoutMs = AI_CLIENT_TIMEOUT_MS, signal: externalSignal } = {}) {
  const actorName = localStorage.getItem("actorName") || "";
  const controller = new AbortController();
  const abortFromOutside = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", abortFromOutside, { once: true });
  }
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      headers: { "x-actor-name": encodeActorHeader(actorName) },
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) {
      const error = new Error(body.error || "AI ရှင်းပြချက် ရယူ၍ မရပါ။");
      error.status = response.status;
      throw error;
    }
    return body;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("AI ရှင်းပြချက် ရယူရန် အချိန်ကြာသွားပါပြီ။ ပြန်စမ်းရန်နှိပ်ပါ။");
    if (!error?.message) throw new Error("AI ရှင်းပြချက် ရယူ၍ မရပါ။ ပြန်စမ်းရန်နှိပ်ပါ။");
    throw error;
  } finally {
    window.clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromOutside);
  }
}

function AiListItem({ item, index, tone, date }) {
  const palette = tone === "amber"
    ? "border-amber-200 bg-amber-50/70 text-amber-950"
    : "border-emerald-200 bg-emerald-50/70 text-slate-700";
  const badge = tone === "amber"
    ? "bg-amber-200 text-amber-900"
    : "bg-emerald-200 text-emerald-900";
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-2.5 ${palette}`}>
      <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badge}`}>{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-5 sm:text-sm sm:leading-6">{cleanAiText(item)}</p>
        {tone === "amber" ? (
          <a
            href={`${getAiActivityReviewHref(date, getReviewTarget(item))}#activity-results`}
            className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold text-amber-800 shadow-sm transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            ပြန်စစ်ရန် ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}

function AiDetailSection({ number, title, items, tone, date }) {
  const isAmber = tone === "amber";
  return (
    <details className={`group overflow-hidden rounded-xl border bg-white ${isAmber ? "border-amber-200" : "border-emerald-200"}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 sm:px-4">
        <span className="flex min-w-0 items-center gap-2">
          <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isAmber ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{number}</span>
          <span className="truncate text-sm font-bold text-slate-900 sm:text-base">{title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[11px] font-semibold text-slate-500 sm:text-xs">
          {items.length} ချက် <span aria-hidden="true" className="text-base leading-none transition-transform group-open:rotate-180">⌄</span>
        </span>
      </summary>
      <div className={`border-t p-3 sm:p-4 ${isAmber ? "border-amber-100" : "border-emerald-100"}`}>
        {items.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">{items.map((item, index) => <AiListItem key={`${tone}-${index}`} item={item} index={index} tone={tone} date={date} />)}
</div>
        ) : <p className="text-[13px] text-slate-500 sm:text-sm">မရှိပါ။</p>}
      </div>
    </details>
  );
}

function AiExplanationPanel({ explanation, date, source }) {
  const findings = normalizeAiItems(explanation?.findings);
  const checks = normalizeAiItems(explanation?.checks);
  return (
    <section id="ai-explanation" className="rounded-2xl border border-violet-200 bg-white p-3 shadow-sm sm:p-5" aria-labelledby="ai-summary-title">
      <div className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-3 text-white sm:px-4 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-[11px] font-bold">AI</span>
              <h2 id="ai-summary-title" className="text-base font-bold sm:text-lg">AI ရှင်းပြချက်</h2>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-violet-100 sm:text-xs">နေ့စဉ်စာရင်းနှင့် လုပ်ဆောင်ချက်မှတ်တမ်းကို အကျဉ်းချုပ်ဖတ်ရှုထားခြင်း</p>
          </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-violet-50">{date}</span>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-violet-50">{source === "database" ? "Database မှ ပြန်ပြ" : source === "database-stale" ? "Data ပြောင်းသဖြင့် အဟောင်း" : source === "fresh" ? "AI အသစ်ထုတ်ထားသည်" : source === "automatic" ? "AI မရသေးသဖြင့် အလိုအလျောက်" : source === "code-first" ? "Code စစ်ချက်အရင်ပြ" : source === "code-first-cache" ? "Code + သိမ်းထားသော AI" : "Browser မှ ပြန်ပြ"}</span>
              </div>

        </div>
      </div>

      <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-800">01</span>
          <h3 className="text-sm font-bold text-slate-900 sm:text-base">အနှစ်ချုပ်</h3>
        </div>
        <p className="mt-2 text-[13px] leading-6 text-slate-700 sm:text-sm sm:leading-7">{cleanAiText(explanation?.overview) || "အနှစ်ချုပ် မရရှိပါ။"}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-emerald-800">အဓိကတွေ့ရှိချက်</p>
          <p className="mt-0.5 text-lg font-bold text-emerald-900">{findings.length} <span className="text-[11px] font-medium">ချက်</span></p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-amber-800">ပြန်စစ်ရန်</p>
          <p className="mt-0.5 text-lg font-bold text-amber-900">{checks.length} <span className="text-[11px] font-medium">ချက်</span></p>
        </div>
      </div>

      {findings.length > 0 && <div className="mt-3"><AiDetailSection number="02" title="အဓိကတွေ့ရှိချက်များ" items={findings} tone="emerald" date={date} /></div>}
      {checks.length > 0 && <div className="mt-2"><AiDetailSection number="03" title="ပြန်စစ်သင့်သည့်အချက်များ" items={checks} tone="amber" date={date} /></div>}

      <div className="mt-3 flex items-start gap-2 rounded-xl border-l-4 border-slate-400 bg-slate-50 px-3 py-3 sm:px-4">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">!</span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">သတိပြုရန်</h3>
          <p className="mt-1 text-[13px] leading-5 text-slate-600 sm:text-sm sm:leading-6">{cleanAiText(explanation?.caution) || "အရေးကြီးသည့် စာရင်းများကို Website ထဲတွင် ပြန်စစ်ပါ။"}</p>
        </div>
      </div>
    </section>
  );
}

export default function DailySummaryPage() {
  const [date, setDate] = useState(getInitialReportDate);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiRefreshMessage, setAiRefreshMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUsage, setAiUsage] = useState(0);
  const [aiStale, setAiStale] = useState(false);
  const [aiFallback, setAiFallback] = useState(false);
  const [aiSource, setAiSource] = useState("");
  const aiAbortRef = useRef(null);
  const aiRequestStartedAtRef = useRef(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchJson(`/api/daily-summary?date=${date}`)
      .then((result) => {
        if (!active) return;
        setError("");
        setData(result);
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [date]);

  const paymentEntries = useMemo(() => Object.entries(data?.summary?.paymentTypes || {}), [data]);
  const cashSaleTypeEntries = useMemo(() => Object.entries(data?.summary?.cashSaleTypes || {}).filter(([, detail]) => Number(detail?.count || 0) > 0), [data]);

  useEffect(() => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    aiRequestStartedAtRef.current = 0;
    const actorName = localStorage.getItem("actorName") || "Staff";
    const localExplanation = readAiExplanationCache(date, actorName);
    setAiExplanation(localExplanation);
    setAiSource(localExplanation ? "browser" : "");
    setAiUsage(getDailyAiUsage(actorName, date));
    setAiStale(false);
    setAiFallback(false);
    setAiRefreshMessage("");
    setAiLoading(false);
  }, [date]);

  useEffect(() => {
    const recoverIfStuck = () => {
      if (!aiLoading || !aiRequestStartedAtRef.current) return;
      if (Date.now() - aiRequestStartedAtRef.current <= AI_CLIENT_TIMEOUT_MS + 1_000) return;
      aiAbortRef.current?.abort();
      aiAbortRef.current = null;
      aiRequestStartedAtRef.current = 0;
      const fallback = buildCodeBasedExplanation(data, date);
      if (fallback) {
        setAiExplanation((current) => current || fallback);
        setAiFallback(true);
        setAiStale(false);
        setAiSource("code-first");
        setAiRefreshMessage("AI provider တုံ့ပြန်ရန် အချိန်ကြာသဖြင့် စာရင်း data အပေါ်အခြေခံသော အလိုအလျောက်အနှစ်ချုပ်ကို ပြထားပါသည်။ AI ပြန်ရသောအခါ ပြန်စမ်းနိုင်ပါသည်။");
      } else {
        setAiRefreshMessage("AI ရှင်းပြချက် အချိန်ကြာနေသောကြောင့် ရပ်ထားပါသည်။ အောက်က ပြန်စမ်းရန်ကို နှိပ်နိုင်ပါသည်။");
      }
      setAiLoading(false);
    };
    const interval = window.setInterval(recoverIfStuck, 1_000);
    window.addEventListener("pageshow", recoverIfStuck);
    window.addEventListener("online", recoverIfStuck);
    document.addEventListener("visibilitychange", recoverIfStuck);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pageshow", recoverIfStuck);
      window.removeEventListener("online", recoverIfStuck);
      document.removeEventListener("visibilitychange", recoverIfStuck);
    };
  }, [aiLoading, data, date]);

  useEffect(() => () => {
    aiAbortRef.current?.abort();
  }, []);

  const handleAiExplain = async ({ bypassLimit = false } = {}) => {
    if (aiLoading) return;
    const actorName = localStorage.getItem("actorName") || "Staff";
    const localExplanation = readAiExplanationCache(date, actorName);
    const codeExplanation = buildCodeBasedExplanation(data, date);
    const immediateExplanation = codeExplanation ? mergeExplanations(codeExplanation, localExplanation) : localExplanation;
    if (immediateExplanation) {
      setAiExplanation(immediateExplanation);
      setAiStale(false);
      setAiFallback(Boolean(codeExplanation));
      setAiSource(codeExplanation ? "code-first" : "browser");
      setAiRefreshMessage("Code-based စစ်ချက်ကို အရင်ပြထားပြီး AI ကို နောက်ကွယ်မှာ စစ်ဆေးနေပါသည်။");
    } else {
      setAiRefreshMessage("စာရင်း data ရရှိပြီးမှ AI refresh လုပ်ပါမည်။");
    }
    setAiLoading(true);
    const requestController = new AbortController();
    aiAbortRef.current = requestController;
    aiRequestStartedAtRef.current = Date.now();
    const isCurrentRequest = () => aiAbortRef.current === requestController;

    try {
      // The cache probe is intentionally after the immediate code-based render.
      // It avoids a provider call when the underlying date data is unchanged.
      let cacheBody = null;
      try {
        cacheBody = await fetchAiJson(`/api/ai/daily-summary?date=${encodeURIComponent(date)}&cacheOnly=1`, { timeoutMs: AI_CACHE_CHECK_TIMEOUT_MS, signal: requestController.signal });
      } catch (cacheError) {
        if (requestController.signal.aborted || !isCurrentRequest()) return;
        console.warn("Daily Summary cache probe failed; continuing to explanation request", cacheError);
      }
      if (!isCurrentRequest()) return;
      const cacheData = cacheBody?.data || {};
      if (cacheData.explanation) {
        const mergedCache = mergeExplanations(codeExplanation, cacheData.explanation);
        setAiExplanation(mergedCache);
        setAiStale(Boolean(cacheData.stale));
        setAiFallback(Boolean(codeExplanation));
        setAiSource(cacheData.stale ? "database-stale" : codeExplanation ? "code-first-cache" : "database");
        saveAiExplanationCache(date, cacheData.explanation, actorName);
        if (!cacheData.stale) {
          setAiRefreshMessage("ရှိပြီးသား AI အဖြေကို Code-based စစ်ချက်နှင့် ပေါင်းပြီး ပြထားပါသည်။");
          return;
        }
      }

      const currentUsage = getDailyAiUsage(actorName, date);
      if (currentUsage >= MAX_DAILY_AI_REQUESTS && !bypassLimit) {
        setAiUsage(currentUsage);
        setAiRefreshMessage(`Code-based စစ်ချက်ကို ပြထားပြီး ဒီ Browser ၏ အောင်မြင်သော AI အဖြေ ${MAX_DAILY_AI_REQUESTS} ကြိမ်ကန့်သတ်ချက်ကြောင့် AI အသစ်ကို မစစ်နိုင်သေးပါ။ ဒါသည် Manus account limit မဟုတ်ပါ။`);
        return;
      }

      const body = await fetchAiJson(`/api/ai/daily-summary?date=${encodeURIComponent(date)}`, { signal: requestController.signal });
      if (!isCurrentRequest()) return;
      const explanation = body.data?.explanation || null;
      if (!explanation) throw new Error("AI မှ ရှင်းပြချက် မရရှိပါ။");
      setAiExplanation(mergeExplanations(codeExplanation, explanation));
      setAiStale(Boolean(body.data?.stale));
      setAiFallback(Boolean(body.data?.fallback) || Boolean(codeExplanation));
      setAiSource(body.data?.stale ? "database-stale" : body.data?.cached ? (codeExplanation ? "code-first-cache" : "database") : body.data?.fallback ? "code-first" : "fresh");
      if (!body.data?.fallback) saveAiExplanationCache(date, explanation, actorName);
      if (!body.data?.cached && !body.data?.stale && !body.data?.fallback) {
        setAiUsage(recordDailyAiSuccess(actorName, date));
      }
      setAiRefreshMessage(body.data?.fallback ? "AI မရသေးပါ။ Code-based စစ်ချက်ကို မပျောက်ဘဲ အရင်အဖြေအဖြစ် ပြထားပါသည်။" : body.warning || "AI စစ်ဆေးချက်ကို Code-based စစ်ချက်နှင့် ပေါင်းပြီး ပြထားပါသည်။");
    } catch (err) {
      if (isCurrentRequest()) {
        const fallback = codeExplanation || buildCodeBasedExplanation(data, date);
        if (fallback) {
          setAiExplanation((current) => current || fallback);
          setAiFallback(true);
          setAiStale(false);
          setAiSource("code-first");
          setAiRefreshMessage("AI provider ခဏမရသေးပါ။ Code-based စစ်ချက်ကို မပျောက်ဘဲ ပြထားပါသည်။ နောက်မှ AI ပြန်စစ်နိုင်ပါသည်။");
        } else {
          setAiRefreshMessage(err.message || "AI ရှင်းပြချက် ရယူ၍ မရပါ။");
        }
      }
    } finally {
      if (aiAbortRef.current === requestController) {
        aiAbortRef.current = null;
        aiRequestStartedAtRef.current = 0;
        setAiLoading(false);
      }
    }
  };

  const handleResetAndRetry = async () => {
    const actorName = localStorage.getItem("actorName") || "Staff";
    resetDailyAiUsage(actorName, date);
    setAiUsage(0);
    setAiRefreshMessage("");
    await handleAiExplain({ bypassLimit: true });
  };

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-3 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <a href="/" className="text-xs font-semibold text-cyan-700 sm:text-sm">← Dashboard</a>
              <h1 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">Daily Summary</h1>
              <p className="mt-1 text-[13px] leading-5 text-slate-600 sm:text-sm">ရွေးထားသောနေ့၏ ငွေချေမှုနှင့် အကြွေးတိုးမှု အသေးစိတ်</p>
              <p className="mt-2 text-[11px] font-semibold text-cyan-700 sm:text-xs">Report Date: {safeMyanmarDateLabel(date)}</p>
              <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">Time Range: 00:00–23:59 (Myanmar Time)</p>
            </div>
            <div className="flex min-w-0 w-full max-w-full flex-col gap-2 sm:w-auto sm:min-w-56 sm:items-end">
              <label htmlFor="report-date" className="relative flex min-h-11 min-w-0 w-full max-w-full items-center justify-between gap-3 overflow-hidden rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100 sm:w-56">
                <span className="truncate">{formatDateControlLabel(date)}</span>
                <span aria-hidden="true" className="shrink-0 text-slate-400">▣</span>
                <input id="report-date" type="date" value={date} aria-label="Report Date" onChange={(e) => { const nextDate = e.target.value; if (isValidDateInput(nextDate)) setDate(nextDate); }} className="daily-summary-date-input absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              </label>
              <button type="button" onClick={() => handleAiExplain()} disabled={loading || aiLoading} className="min-h-11 w-full rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98] disabled:bg-slate-400 sm:w-auto sm:text-sm">
                {aiLoading ? "AI ရှင်းပြနေသည်..." : aiExplanation ? "AI ရှင်းပြချက် ပြန်ကြည့်ရန်" : "AI ဖြင့် ရှင်းပြရန်"}
              </button>
              <p className="text-right text-[11px] text-slate-500">ဒီ Browser မှာ အောင်မြင်သော AI အဖြေ {aiUsage}/{MAX_DAILY_AI_REQUESTS} ကြိမ် · Cache/Fallback မတွက်ပါ</p>
            </div>
          </div>
        </header>

        {aiRefreshMessage && <section role="status" className={`rounded-xl border px-3 py-3 sm:p-4 ${aiStale || aiFallback ? "border-amber-200 bg-amber-50" : "border-violet-200 bg-violet-50"}`}><h2 className={`text-sm font-semibold sm:text-base ${aiStale || aiFallback ? "text-amber-900" : "text-violet-900"}`}>{aiStale ? "အဟောင်းရှင်းပြချက်ကို ပြထားပါသည်" : aiFallback ? "Code-based အဖြေကို အရင်ပြထားပါသည်" : "AI background refresh အခြေအနေ"}</h2><p className={`mt-1 text-[13px] leading-5 sm:mt-2 sm:text-sm ${aiStale || aiFallback ? "text-amber-800" : "text-violet-800"}`}>{aiRefreshMessage}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => handleAiExplain()} disabled={aiLoading} className="min-h-9 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-bold text-violet-800 shadow-sm disabled:opacity-60">AI ပြန်စမ်းရန်</button>{aiUsage >= MAX_DAILY_AI_REQUESTS && <button type="button" onClick={handleResetAndRetry} disabled={aiLoading} className="min-h-9 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 shadow-sm disabled:opacity-60">ဒီ Browser limit ပြန်စတင်ပြီး AI ပြန်စမ်းရန်</button>}<button type="button" onClick={() => setAiRefreshMessage("")} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">စာရင်းသာကြည့်ရန်</button></div></section>}
        {aiExplanation && <AiExplanationPanel explanation={aiExplanation} date={date} source={aiSource} />}

        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-[13px] text-rose-700 sm:p-4 sm:text-sm">{error}</p>}
        {loading ? <div className="rounded-xl bg-white p-6 text-center text-[13px] text-slate-600 shadow-sm sm:p-8 sm:text-sm">Summary ရယူနေသည်...</div> : data && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
              <p className="text-[13px] font-semibold text-slate-700 sm:text-sm">စာရင်းရက်စွဲအလိုက် ငွေချေ/အကြွေးတိုး</p>
            </div>
            <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 sm:p-5"><p className="text-[13px] leading-5 text-emerald-700 sm:text-sm">ငွေချေသူ</p><p className="mt-1 text-[26px] font-bold leading-8 text-emerald-800 sm:mt-2 sm:text-3xl">{data.summary.paidCount}</p><p className="mt-1 text-[13px] text-emerald-700 sm:text-sm">{formatMoney(data.summary.paidAmount)}</p></div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 sm:p-5"><p className="text-[13px] leading-5 text-rose-700 sm:text-sm">အကြွေးတိုးသူ</p><p className="mt-1 text-[26px] font-bold leading-8 text-rose-800 sm:mt-2 sm:text-3xl">{data.summary.unpaidCount}</p><p className="mt-1 text-[13px] text-rose-700 sm:text-sm">{formatMoney(data.summary.unpaidAmount)}</p></div>
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3.5 sm:p-5"><p className="text-[13px] leading-5 text-cyan-700 sm:text-sm">လက်ငင်းပေးသူ</p><p className="mt-1 text-[26px] font-bold leading-8 text-cyan-800 sm:mt-2 sm:text-3xl">{data.summary.cashCount || 0}</p><p className="mt-1 text-[13px] text-cyan-700 sm:text-sm">{formatMoney(data.summary.cashAmount)}</p>{cashSaleTypeEntries.length ? <p className="mt-1 text-[11px] leading-4 text-cyan-800 sm:text-xs">{cashSaleTypeEntries.map(([type, detail]) => `${cashSaleTypeLabel(type)} ${detail.count} ခု`).join(" · ")}</p> : null}</div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 sm:p-5"><p className="text-[13px] leading-5 text-blue-700 sm:text-sm">Transaction စုစုပေါင်း</p><p className="mt-1 text-[26px] font-bold leading-8 text-blue-800 sm:mt-2 sm:text-3xl">{data.summary.totalTransactions}</p></div>
              <a href={`/activity?date=${date}`} className="rounded-xl border border-violet-200 bg-violet-50 p-3.5 shadow-sm transition hover:border-violet-300 hover:bg-violet-100 sm:p-5"><p className="text-[13px] leading-5 text-violet-700 sm:text-sm">ရွေးထားသောနေ့ လုပ်ဆောင်ချက်</p><p className="mt-1 text-[26px] font-bold leading-8 text-violet-800 sm:mt-2 sm:text-3xl">{data.summary.activityCount ?? data.summary.auditCount}</p><p className="mt-1 text-[11px] text-violet-700 sm:text-xs">အသေးစိတ်ကြည့်ရန် →</p></a>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5 lg:col-span-2">
                <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Customer အလိုက် စာရင်းချုပ်</h2>
                <div className="mt-3 hidden overflow-x-auto sm:block"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2.5">Customer</th><th className="px-3 py-2.5 text-right">ငွေချေ</th><th className="px-3 py-2.5 text-right">အကြွေးတိုး</th><th className="px-3 py-2.5 text-right">လက်ငင်း</th></tr></thead><tbody className="divide-y divide-slate-100">{data.customers.length ? data.customers.map((customer) => <tr key={customer.customerId}><td className="px-3 py-3 font-medium text-slate-800">{customer.customerName}</td><td className="px-3 py-3 text-right text-emerald-700">{customer.paidCount} / {formatMoney(customer.paidAmount)}</td><td className="px-3 py-3 text-right text-rose-700">{customer.unpaidCount} / {formatMoney(customer.unpaidAmount)}</td><td className="px-3 py-3 text-right text-cyan-700"><div>{customer.cashCount || 0} / {formatMoney(customer.cashAmount)}</div>{customer.cashRetailCount || customer.cashWholesaleCount ? <div className="mt-1 text-[11px] leading-4 text-cyan-800">{customer.cashRetailCount ? `လက်လီ ${customer.cashRetailCount} / ${formatMoney(customer.cashRetailAmount)}` : null}{customer.cashRetailCount && customer.cashWholesaleCount ? " · " : null}{customer.cashWholesaleCount ? `လက်ကား ${customer.cashWholesaleCount} / ${formatMoney(customer.cashWholesaleAmount)}` : null}</div> : null}</td></tr>) : <tr><td colSpan="4" className="px-3 py-8 text-center text-slate-500">ဒီနေ့စာရင်းမရှိသေးပါ။</td></tr>}</tbody></table></div>
                <div className="mt-3 space-y-2 sm:hidden">{data.customers.length ? data.customers.map((customer) => <article key={customer.customerId} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="truncate text-sm font-semibold text-slate-900">{customer.customerName}</p><div className="mt-2 grid grid-cols-2 gap-2 text-[12px]"><div className="rounded-md bg-emerald-50 px-2 py-1.5 text-emerald-800"><span className="block text-[11px] text-emerald-700">ငွေချေ</span><strong>{customer.paidCount} / {formatMoney(customer.paidAmount)}</strong></div><div className="rounded-md bg-rose-50 px-2 py-1.5 text-rose-800"><span className="block text-[11px] text-rose-700">အကြွေးတိုး</span><strong>{customer.unpaidCount} / {formatMoney(customer.unpaidAmount)}</strong></div><div className="rounded-md bg-cyan-50 px-2 py-1.5 text-cyan-800"><span className="block text-[11px] text-cyan-700">လက်ငင်း</span><strong>{customer.cashCount || 0} / {formatMoney(customer.cashAmount)}</strong>{customer.cashRetailCount || customer.cashWholesaleCount ? <span className="mt-1 block text-[10px] leading-4 text-cyan-900">{customer.cashRetailCount ? `လက်လီ ${customer.cashRetailCount}` : null}{customer.cashRetailCount && customer.cashWholesaleCount ? " · " : null}{customer.cashWholesaleCount ? `လက်ကား ${customer.cashWholesaleCount}` : null}</span> : null}</div></div></article>) : <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-[13px] text-slate-500">ဒီနေ့စာရင်းမရှိသေးပါ။</p>}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5"><h2 className="text-base font-semibold text-slate-900 sm:text-lg">Payment Type</h2><div className="mt-3 space-y-2">{paymentEntries.length ? paymentEntries.map(([type, amount]) => <div key={type} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5"><span className="text-[13px] text-slate-700 sm:text-sm">{type}</span><strong className="text-[13px] text-slate-900 sm:text-sm">{formatMoney(amount)}</strong></div>) : <p className="text-[13px] text-slate-500 sm:text-sm">Ledger ငွေချေမှုမရှိသေးပါ။</p>}{Object.entries(data.summary.cashPaymentTypes || {}).length ? <><p className="mt-3 text-xs font-semibold text-cyan-700">လက်ငင်းငွေပေးချေမှု</p>{Object.entries(data.summary.cashPaymentTypes).map(([type, amount]) => <div key={`cash-${type}`} className="flex items-center justify-between rounded-lg bg-cyan-50 px-3 py-2.5"><span className="text-[13px] text-cyan-800 sm:text-sm">{type}</span><strong className="text-[13px] text-cyan-900 sm:text-sm">{formatMoney(amount)}</strong></div>)}</> : null}{cashSaleTypeEntries.length ? <><p className="mt-3 text-xs font-semibold text-cyan-700">လက်ငင်းအမျိုးအစား</p>{cashSaleTypeEntries.map(([type, detail]) => <div key={`cash-sale-type-${type}`} className="flex items-center justify-between rounded-lg bg-cyan-50/70 px-3 py-2.5"><span className="text-[13px] text-cyan-800 sm:text-sm">{cashSaleTypeLabel(type)}</span><strong className="text-[13px] text-cyan-900 sm:text-sm">{detail.count} ခု / {formatMoney(detail.amount)}</strong></div>)}</> : null}</div></div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
