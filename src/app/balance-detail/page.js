"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { encodeActorHeader } from "@/lib/actor-header";

const money = new Intl.NumberFormat("en-US");

function formatMoney(value) {
  return `${money.format(Math.round(Number(value || 0)))} Ks`;
}

const BALANCE_SNAPSHOT_KEY = "new-life-ledger:balance-detail-snapshot:v1";

function readBalanceSnapshot() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(BALANCE_SNAPSHOT_KEY);
    const snapshot = raw ? JSON.parse(raw) : null;
    return snapshot && typeof snapshot === "object" ? snapshot : null;
  } catch {
    return null;
  }
}

function saveBalanceSnapshot(partial) {
  if (typeof window === "undefined" || !partial || typeof partial !== "object") return;
  try {
    const current = readBalanceSnapshot() || {};
    window.sessionStorage.setItem(BALANCE_SNAPSHOT_KEY, JSON.stringify({ ...current, ...partial, savedAt: Date.now() }));
  } catch (error) {
    console.warn("Balance Detail snapshot could not be saved:", error);
  }
}

function isTransientError(error) {
  return error?.name === "TypeError" || error?.name === "TimeoutError" || /Failed to fetch|NetworkError|Load failed|Request timed out/i.test(String(error?.message || ""));
}

function waitForRetry(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function fetchJson(path, { timeoutMs = 15_000, maxAttempts = 3 } = {}) {
  const actorName = localStorage.getItem("actorName") || "";
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(path, {
        headers: { "x-actor-name": encodeActorHeader(actorName) },
        signal: controller.signal,
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(body.error || "Data ရယူ၍ မရပါ။");
        error.status = response.status;
        throw error;
      }
      return body.data;
    } catch (error) {
      lastError = error?.name === "AbortError"
        ? Object.assign(new Error("Data ရယူရန် အချိန်ကြာသွားပါပြီ။"), { name: "TimeoutError" })
        : error;
      const isServerFailure = Number(lastError?.status) >= 500;
      if (attempt >= maxAttempts || (!isTransientError(lastError) && !isServerFailure)) throw lastError;
      await waitForRetry(400 * attempt);
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw lastError || new Error("Data ရယူ၍ မရပါ။");
}

function balanceInfo(value) {
  const balance = Number(value || 0);
  if (balance > 0) return { key: "debt", label: "အကြွေး", amount: balance, color: "rose" };
  if (balance < 0) return { key: "prepaid", label: "ကြိုတင်ငွေချေ", amount: Math.abs(balance), color: "emerald" };
  return { key: "zero", label: "လက်ကျန်မရှိ", amount: 0, color: "slate" };
}

async function fetchCustomers() {
  const rows = await fetchJson("/api/customers?includeLedgers=false");
  return Array.isArray(rows) ? rows.filter((customer) => !customer.deletedAt) : [];
}

function SummaryCard({ title, subtitle, value, count, countLabel = "ယောက်", tone }) {
  const tones = {
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
  };
  return (
    <article className={`rounded-xl border p-5 shadow-sm ${tones[tone] || tones.slate}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs opacity-80">{subtitle}</p>
      {count !== undefined ? <p className="mt-3 text-sm font-semibold">{count} {countLabel}</p> : null}
    </article>
  );
}

function CustomerRow({ customer }) {
  const info = balanceInfo(customer.current_balance);
  const badgeClass = {
    debt: "bg-rose-100 text-rose-800",
    prepaid: "bg-emerald-100 text-emerald-800",
    zero: "bg-slate-100 text-slate-700",
  }[info.key];
  return (
    <Link
      href={`/ledger?customerId=${encodeURIComponent(customer.id)}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-cyan-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-400"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{customer.name}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{customer.phone || "ဖုန်းမရှိ"}{customer.routeTag ? ` · ${customer.routeTag}` : ""}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>{info.label}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
        <div>
          <p className="text-xs text-slate-500">လက်ကျန်</p>
          <p className={`mt-1 text-lg font-bold ${info.key === "debt" ? "text-rose-700" : info.key === "prepaid" ? "text-emerald-700" : "text-slate-700"}`}>
            {info.amount ? formatMoney(info.amount) : "0 Ks"}
          </p>
        </div>
        <span className="text-xs font-semibold text-cyan-700">Ledger အသေးစိတ် →</span>
      </div>
    </Link>
  );
}

async function fetchTodaySummary() {
  const data = await fetchJson("/api/daily-summary");
  return data?.summary || {};
}

export default function BalanceDetailPage() {
  const [customers, setCustomers] = useState([]);
  const [cashSummary, setCashSummary] = useState({ cashCount: 0, cashAmount: 0, cashSaleTypes: {} });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("amount-desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showBalanceExplanation, setShowBalanceExplanation] = useState(false);

  useEffect(() => {
    let active = true;
    const cached = readBalanceSnapshot();
    const cachedCustomers = Array.isArray(cached?.customers) ? cached.customers : [];
    if (cachedCustomers.length) {
      setCustomers(cachedCustomers);
      setLoading(false);
    }
    if (cached?.cashSummary && typeof cached.cashSummary === "object") setCashSummary(cached.cashSummary);

    fetchCustomers()
      .then((rows) => {
        if (!active) return;
        setCustomers(rows);
        setError("");
        setLoading(false);
        saveBalanceSnapshot({ customers: rows });
      })
      .catch((err) => {
        if (!active) return;
        if (!cachedCustomers.length) setError(err.message || "Customer စာရင်း ရယူ၍ မရပါ။");
        setLoading(false);
      });

    // CashSale summary is useful but secondary; it never blocks the customer balance list.
    fetchTodaySummary()
      .then((summary) => {
        if (!active) return;
        setCashSummary(summary);
        saveBalanceSnapshot({ cashSummary: summary });
      })
      .catch(() => {});

    return () => { active = false; };
  }, []);

  const totals = useMemo(() => customers.reduce((result, customer) => {
    const balance = Number(customer.current_balance || 0);
    result.customerCount += 1;
    if (balance > 0) {
      result.debtCustomers += 1;
      result.debtTotal += balance;
    } else if (balance < 0) {
      result.prepaidCustomers += 1;
      result.prepaidTotal += Math.abs(balance);
    } else {
      result.zeroCustomers += 1;
    }
    return result;
  }, {
    customerCount: 0,
    debtCustomers: 0,
    debtTotal: 0,
    prepaidCustomers: 0,
    prepaidTotal: 0,
    zeroCustomers: 0,
  }), [customers]);

  const netBalance = totals.debtTotal - totals.prepaidTotal;

  const visibleCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = customers.filter((customer) => {
      const info = balanceInfo(customer.current_balance);
      const matchesStatus = status === "all" || info.key === status;
      const searchText = `${customer.name || ""} ${customer.phone || ""} ${customer.routeTag || ""}`.toLocaleLowerCase();
      return matchesStatus && (!normalizedQuery || searchText.includes(normalizedQuery));
    });
    return filtered.sort((a, b) => {
      const aBalance = Number(a.current_balance || 0);
      const bBalance = Number(b.current_balance || 0);
      if (sortBy === "name") return String(a.name || "").localeCompare(String(b.name || ""), "my");
      if (sortBy === "amount-asc") return Math.abs(aBalance) - Math.abs(bBalance);
      return Math.abs(bBalance) - Math.abs(aBalance);
    });
  }, [customers, query, sortBy, status]);

  const netTone = netBalance > 0 ? "rose" : netBalance < 0 ? "emerald" : "slate";
  const netLabel = netBalance > 0 ? "Customer တွေဆီက အသားတင်ရရန်" : netBalance < 0 ? "Customer တွေက ပိုငွေချေထားခြင်း" : "အသားတင်လက်ကျန် မရှိပါ";

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="rounded-xl border border-slate-200 bg-white p-5">
          <Link href="/" className="text-sm font-medium text-cyan-700">← Dashboard</Link>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Balance Detail</h1>
              <p className="mt-1 text-sm text-slate-600">အသားတင်ရရန်လက်ကျန် ဘယ်ကဖြစ်လာသလဲ အသေးစိတ်ကြည့်ရန်</p>
            </div>
            <nav aria-label="စာမျက်နှာများ" className="flex flex-wrap gap-2 text-xs font-semibold">
              <Link href="/daily-summary" className="rounded-full bg-violet-50 px-3 py-2 text-violet-700 hover:bg-violet-100">Daily Summary</Link>
              <Link href="/activity" className="rounded-full bg-amber-50 px-3 py-2 text-amber-700 hover:bg-amber-100">Activity History</Link>
              <Link href="/ledger" className="rounded-full bg-cyan-50 px-3 py-2 text-cyan-700 hover:bg-cyan-100">Customer Ledger</Link>
            </nav>
          </div>
        </header>

        {error ? <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">{error}</section> : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard title="အသားတင်ရရန်လက်ကျန်" subtitle={netLabel} value={loading && !customers.length ? "ရယူနေသည်..." : formatMoney(Math.abs(netBalance))} tone={netTone} />
          <SummaryCard title="လက်ကျန်အကြွေးစုစုပေါင်း" subtitle="အနီရောင် balance များ" value={loading && !customers.length ? "ရယူနေသည်..." : formatMoney(totals.debtTotal)} count={totals.debtCustomers} tone="rose" />
          <SummaryCard title="လက်ကျန်ကြိုတင်ငွေချေ" subtitle="အစိမ်းရောင် balance များ" value={loading && !customers.length ? "ရယူနေသည်..." : formatMoney(totals.prepaidTotal)} count={totals.prepaidCustomers} tone="emerald" />
          <SummaryCard title="လက်ကျန်မရှိသူ" subtitle="လက်ရှိ balance = 0" value={loading && !customers.length ? "ရယူနေသည်..." : `${totals.zeroCustomers} ယောက်`} tone="blue" />
          <SummaryCard title="ဒီနေ့ လက်ငင်းရောင်း" subtitle="လက်ကျန်အကြွေးထဲ မထည့်ပါ" value={loading && !customers.length && !cashSummary.cashCount ? "ရယူနေသည်..." : formatMoney(cashSummary.cashAmount)} count={cashSummary.cashCount || 0} countLabel="ခု" tone="blue" />
        </section>

        <section className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 sm:p-5">
          <button
            type="button"
            onClick={() => setShowBalanceExplanation((current) => !current)}
            aria-expanded={showBalanceExplanation}
            className="w-full text-left text-base font-bold text-cyan-950 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2"
          >
            အသားတင်ရရန် လက်ကျန် ဘယ်လိုတွက်ထားလဲ
          </button>
          {showBalanceExplanation ? (
            <div className="mt-2">
              <p className="text-sm leading-6 text-cyan-950"><strong>အသားတင်ရရန် = လက်ကျန်အကြွေးစုစုပေါင်း − လက်ကျန်ကြိုတင်ငွေချေ</strong></p>
              <p className="mt-2 text-sm leading-6 text-cyan-900">ဥပမာ အကြွေး 300,000 Ks ရှိပြီး customer တချို့က 100,000 Ks ကြိုတင်ငွေချေထားရင် အသားတင်ရရန် 200,000 Ks ဖြစ်ပါတယ်။ အနီရောင်က customer ဆီက ရရန်ရှိတာ၊ အစိမ်းရောင်က customer က ပိုငွေချေထားတာကို ဆိုလိုပါတယ်။</p>
              <p className="mt-2 text-xs leading-5 text-cyan-800">ဒီနေ့ လက်ငင်းရောင်းမှာ လက်လီ {(cashSummary.cashSaleTypes?.RETAIL?.count || 0)} ခု၊ လက်ကား {(cashSummary.cashSaleTypes?.WHOLESALE?.count || 0)} ခု ပါဝင်ပါတယ်။ လက်ငင်းပမာဏကို အသားတင်ရရန်လက်ကျန်ထဲ မထည့်ပါ။</p>
              <p className="mt-2 text-xs leading-5 text-cyan-800">ဒီစာမျက်နှာက လက်ရှိ active customer balance တွေကိုပဲ စုပါတယ်။ Recycle Bin ထဲက customer များ မပါဝင်ပါ။ ယခင်က အားလုံးပေးချေခဲ့သည့် သမိုင်းပမာဏကို ကြည့်လိုပါက Customer Ledger၊ Daily Summary နှင့် Activity History ကို သုံးပါ။</p>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Customer အလိုက် လက်ကျန်အသေးစိတ်</h2>
              <p className="mt-1 text-sm text-slate-600">Customer တစ်ယောက်ချင်းစီကို နှိပ်ပြီး Ledger ထဲက transaction အသေးစိတ် ဆက်ကြည့်နိုင်ပါတယ်။</p>
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-3 lg:max-w-3xl">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="အမည် / ဖုန်း / လမ်းကြောင်းရှာရန်" className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" />
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-400">
                <option value="all">အားလုံး</option>
                <option value="debt">အကြွေးရှိသူ</option>
                <option value="prepaid">ကြိုတင်ငွေချေသူ</option>
                <option value="zero">လက်ကျန်မရှိသူ</option>
              </select>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-400">
                <option value="amount-desc">ပမာဏအများဆုံး</option>
                <option value="amount-asc">ပမာဏအနည်းဆုံး</option>
                <option value="name">အမည်စဉ်</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>{loading ? "စာရင်းရယူနေသည်..." : `${visibleCustomers.length} / ${customers.length} customer`}</span>
            <span>Active customer only</span>
          </div>

          {loading ? <p className="py-12 text-center text-slate-500">Customer လက်ကျန်များ ရယူနေသည်...</p> : visibleCustomers.length ? (
            <>
              <div className="mt-4 grid gap-3 md:hidden">{visibleCustomers.map((customer) => <CustomerRow key={customer.id} customer={customer} />)}</div>
              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Customer</th><th className="px-3 py-3">အခြေအနေ</th><th className="px-3 py-3 text-right">လက်ကျန်</th><th className="px-3 py-3 text-right">အသေးစိတ်</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{visibleCustomers.map((customer) => {
                    const info = balanceInfo(customer.current_balance);
                    const badgeClass = info.key === "debt" ? "bg-rose-100 text-rose-800" : info.key === "prepaid" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700";
                    return <tr key={customer.id} className="hover:bg-slate-50"><td className="px-3 py-3"><Link href={`/ledger?customerId=${encodeURIComponent(customer.id)}`} className="font-semibold text-cyan-800 hover:underline">{customer.name}</Link><p className="mt-1 text-xs text-slate-500">{customer.phone || "ဖုန်းမရှိ"}{customer.routeTag ? ` · ${customer.routeTag}` : ""}</p></td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>{info.label}</span></td><td className={`px-3 py-3 text-right font-bold ${info.key === "debt" ? "text-rose-700" : info.key === "prepaid" ? "text-emerald-700" : "text-slate-700"}`}>{info.amount ? formatMoney(info.amount) : "0 Ks"}</td><td className="px-3 py-3 text-right"><Link href={`/ledger?customerId=${encodeURIComponent(customer.id)}`} className="font-semibold text-cyan-700 hover:underline">Ledger →</Link></td></tr>;
                  })}</tbody>
                </table>
              </div>
            </>
          ) : <div className="mt-4 rounded-xl border border-slate-200 px-4 py-10 text-center text-sm text-slate-500">ကိုက်ညီသော customer မတွေ့ပါ။</div>}
        </section>
      </div>
    </main>
  );
}
