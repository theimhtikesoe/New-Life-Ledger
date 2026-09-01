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
  const rows = await fetchJson("/api/customers?includeLedgers=true&includeCashSales=true");
  return Array.isArray(rows) ? rows.filter((customer) => !customer.deletedAt) : [];
}

function saleTypeSummary(customer, saleType) {
  const normalizedType = saleType === "WHOLESALE" ? "WHOLESALE" : "RETAIL";
  const ledgers = Array.isArray(customer?.ledgers) ? customer.ledgers : [];
  const cashSales = Array.isArray(customer?.cashSales) ? customer.cashSales : [];
  const debt = ledgers
    .filter((row) => row.saleType === normalizedType && row.type === "CREDIT")
    .reduce((total, row) => total + Number(row.amount || 0), 0);
  const paid = ledgers
    .filter((row) => row.saleType === normalizedType && row.type === "DEBIT")
    .reduce((total, row) => total + Number(row.amount || 0), 0);
  const cash = cashSales
    .filter((row) => row.saleType === normalizedType)
    .reduce((total, row) => total + Number(row.amount || 0), 0);
  return { debt, paid, cash, balance: debt - paid };
}

function saleTypeLabel(saleType) {
  return saleType === "WHOLESALE" ? "လက်ကား" : "လက်လီ";
}

function CustomerRow({ customer, onEdit, onDelete }) {
  const info = balanceInfo(customer.current_balance);
  const badgeClass = {
    debt: "bg-rose-100 text-rose-800",
    prepaid: "bg-emerald-100 text-emerald-800",
    zero: "bg-slate-100 text-slate-700",
  }[info.key];
  const retail = saleTypeSummary(customer, "RETAIL");
  const wholesale = saleTypeSummary(customer, "WHOLESALE");
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{customer.name}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{customer.phone || "ဖုန်းမရှိ"}{customer.routeTag ? ` · ${customer.routeTag}` : ""}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>{info.label}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {[["RETAIL", retail], ["WHOLESALE", wholesale]].map(([saleType, sale]) => (
          <div key={saleType} className="rounded-lg bg-slate-50 p-2">
            <p className="font-bold text-slate-700">{saleTypeLabel(saleType)}</p>
            <p className="mt-1 text-slate-600">ယူငွေ {formatMoney(sale.debt)}</p>
            <p className="text-slate-600">ပေးပြီး {formatMoney(sale.paid)}</p>
            <p className="text-slate-600">လက်ငင်းရောင်း {formatMoney(sale.cash)}</p>
            <p className="font-semibold text-cyan-700">လက်ရှိယူနေ {formatMoney(sale.balance)}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <Link href={`/ledger?customerId=${encodeURIComponent(customer.id)}`} className="rounded-lg bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-100">Ledger အသေးစိတ်</Link>
        <button type="button" onClick={() => onEdit(customer)} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100">ပြင်ဆင်ရန်</button>
        <button type="button" onClick={() => onDelete(customer)} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100">ဖျက်ရန်</button>
      </div>
    </article>
  );
}

export default function BalanceDetailPage() {
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("amount-desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", routeTag: "" });
  const [savingCustomer, setSavingCustomer] = useState(false);

  useEffect(() => {
    let active = true;
    const cached = readBalanceSnapshot();
    const cachedCustomers = Array.isArray(cached?.customers) ? cached.customers : [];
    if (cachedCustomers.length) {
      setCustomers(cachedCustomers);
      setLoading(false);
    }
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

    return () => { active = false; };
  }, []);

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


  const beginEdit = (customer) => {
    setEditingCustomer(customer);
    setEditForm({ name: customer.name || "", phone: customer.phone || "", routeTag: customer.routeTag || "" });
    setError("");
  };

  const updateCustomer = async (event) => {
    event.preventDefault();
    if (!editingCustomer || savingCustomer) return;
    setSavingCustomer(true);
    try {
      const actorName = localStorage.getItem("actorName") || "";
      const response = await fetch(`/api/customers/${encodeURIComponent(editingCustomer.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-actor-name": encodeActorHeader(actorName) },
        body: JSON.stringify(editForm),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Customer ပြင်ဆင်၍ မရပါ။");
      setCustomers((current) => {
        const next = current.map((customer) => customer.id === editingCustomer.id ? { ...customer, ...body.data } : customer);
        saveBalanceSnapshot({ customers: next });
        return next;
      });
      setEditingCustomer(null);
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Customer ပြင်ဆင်၍ မရပါ။");
    } finally {
      setSavingCustomer(false);
    }
  };

  const deleteCustomer = async (customer) => {
    if (savingCustomer || !window.confirm(`${customer.name} ကို Recycle Bin သို့ ရွှေ့မလား?`)) return;
    setSavingCustomer(true);
    try {
      const actorName = localStorage.getItem("actorName") || "";
      const response = await fetch(`/api/customers/${encodeURIComponent(customer.id)}`, { method: "DELETE", headers: { "x-actor-name": encodeActorHeader(actorName) } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Customer ဖျက်၍ မရပါ။");
      setCustomers((current) => {
        const next = current.filter((row) => row.id !== customer.id);
        saveBalanceSnapshot({ customers: next });
        return next;
      });
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Customer ဖျက်၍ မရပါ။");
    } finally {
      setSavingCustomer(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="rounded-xl border border-slate-200 bg-white p-5">
          <Link href="/" className="text-sm font-medium text-cyan-700">← Dashboard</Link>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Customer Management</h1>
              <p className="mt-1 text-sm text-slate-600">Customer အချက်အလက်၊ လက်လီ/လက်ကား လက်ရှိယူနေငွေနဲ့ Update / Delete လုပ်ဆောင်ချက်များ</p>
            </div>
          </div>
        </header>

        {error ? <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">{error}</section> : null}


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
              <div className="mt-4 grid gap-3 md:hidden">{visibleCustomers.map((customer) => <CustomerRow key={customer.id} customer={customer} onEdit={beginEdit} onDelete={deleteCustomer} />)}</div>
              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Customer</th><th className="px-3 py-3">အခြေအနေ</th><th className="px-3 py-3 text-right">လက်ရှိလက်ကျန်</th><th className="px-3 py-3">လက်လီ / လက်ကား</th><th className="px-3 py-3 text-right">လုပ်ဆောင်ချက်</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{visibleCustomers.map((customer) => {
                    const info = balanceInfo(customer.current_balance);
                    const retail = saleTypeSummary(customer, "RETAIL");
                    const wholesale = saleTypeSummary(customer, "WHOLESALE");
                    const badgeClass = info.key === "debt" ? "bg-rose-100 text-rose-800" : info.key === "prepaid" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700";
                    return <tr key={customer.id} className="hover:bg-slate-50"><td className="px-3 py-3"><p className="font-semibold text-slate-900">{customer.name}</p><p className="mt-1 text-xs text-slate-500">{customer.phone || "ဖုန်းမရှိ"}{customer.routeTag ? ` · ${customer.routeTag}` : ""}</p></td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>{info.label}</span></td><td className={`px-3 py-3 text-right font-bold ${info.key === "debt" ? "text-rose-700" : info.key === "prepaid" ? "text-emerald-700" : "text-slate-700"}`}>{info.amount ? formatMoney(info.amount) : "0 Ks"}</td><td className="px-3 py-3 text-xs"><p className="font-semibold text-violet-700">လက်လီ လက်ရှိယူနေ {formatMoney(retail.balance)}</p><p className="mt-1 font-semibold text-amber-700">လက်ကား လက်ရှိယူနေ {formatMoney(wholesale.balance)}</p><p className="mt-1 text-slate-500">Ledger ယူငွေ {formatMoney(retail.debt + wholesale.debt)}</p><p className="text-slate-500">လက်ငင်းရောင်း {formatMoney(retail.cash + wholesale.cash)}</p></td><td className="px-3 py-3 text-right"><div className="flex flex-wrap justify-end gap-2"><Link href={`/ledger?customerId=${encodeURIComponent(customer.id)}`} className="rounded-lg bg-cyan-50 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100">Ledger</Link><button type="button" onClick={() => beginEdit(customer)} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100">ပြင်</button><button type="button" onClick={() => deleteCustomer(customer)} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">ဖျက်</button></div></td></tr>;
                  })}</tbody>
                </table>
              </div>
            </>
          ) : <div className="mt-4 rounded-xl border border-slate-200 px-4 py-10 text-center text-sm text-slate-500">ကိုက်ညီသော customer မတွေ့ပါ။</div>}
        </section>
      </div>

      {editingCustomer ? (
        <div className="fixed inset-0 z-[140] flex items-start justify-center bg-slate-950/40 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="edit-customer-title">
          <form onSubmit={updateCustomer} className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Customer Management</p>
                <h2 id="edit-customer-title" className="mt-1 text-lg font-bold text-slate-900">Customer အချက်အလက် ပြင်ဆင်ရန်</h2>
              </div>
              <button type="button" onClick={() => setEditingCustomer(null)} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50">ပိတ်</button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-600">အမည်</span><input required value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" /></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-600">ဖုန်း</span><input value={editForm.phone} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" /></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-600">လမ်းကြောင်း / Route</span><input value={editForm.routeTag} onChange={(event) => setEditForm((current) => ({ ...current, routeTag: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" /></label>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">လက်လီ/လက်ကား လက်ရှိယူငွေကို ledger မှတ်တမ်းကနေ တွက်ထားတာဖြစ်လို့ ဒီ form က customer profile အချက်အလက်ကိုသာ ပြင်ပါမယ်။</p>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditingCustomer(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">မလုပ်တော့ပါ</button><button type="submit" disabled={savingCustomer} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50">{savingCustomer ? "သိမ်းနေသည်..." : "Update သိမ်းမည်"}</button></div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
