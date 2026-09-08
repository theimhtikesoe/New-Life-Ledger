'use client';

import { useEffect, useMemo, useState } from "react";
import { BOTTLE_GROUPS } from "@/lib/production-catalog";

function todayValue() {
  const now = new Date();
  const local = new Date(now.getTime() + (6 * 60 + 30) * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

function money(value) {
  return `${Number(value || 0).toLocaleString()} Ks`;
}

export default function PriceSettingsPage() {
  const [date, setDate] = useState(todayValue);
  const [activeCategory, setActiveCategory] = useState(BOTTLE_GROUPS[0]?.key || "");
  const [catalog, setCatalog] = useState([]);
  const [categoryPrices, setCategoryPrices] = useState({});
  const [itemPrices, setItemPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadPrices(nextDate = date) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/price-settings?date=${encodeURIComponent(nextDate)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "စျေးနှုန်းစာရင်း ရယူ၍မရပါ။");
      const data = body.data || {};
      setCatalog(Array.isArray(data.catalog) ? data.catalog : []);
      const nextCategoryPrices = {};
      for (const category of data.categories || []) {
        const exact = data.categoryPrices?.[category.key];
        const effective = data.catalog?.find((item) => item.categoryKey === category.key && item.effectivePrice?.source === "CATEGORY")?.effectivePrice;
        const value = exact?.pricePerBottle ?? effective?.pricePerBottle;
        if (value !== undefined && value !== null) nextCategoryPrices[category.key] = String(value);
      }
      const nextItemPrices = {};
      for (const item of data.catalog || []) {
        const exact = data.itemPrices?.[item.productKey];
        if (exact?.pricePerBottle !== undefined) nextItemPrices[item.productKey] = String(exact.pricePerBottle);
      }
      setCategoryPrices(nextCategoryPrices);
      setItemPrices(nextItemPrices);
    } catch (loadError) {
      setError(loadError.message || "စျေးနှုန်းစာရင်း ရယူ၍မရပါ။");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrices(date);
    // Intentionally load only when the selected date changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const visibleItems = useMemo(() => catalog.filter((item) => item.categoryKey === activeCategory), [catalog, activeCategory]);

  function setCategoryPrice(key, value) {
    setCategoryPrices((current) => ({ ...current, [key]: value }));
  }

  function setItemPrice(key, value) {
    setItemPrices((current) => ({ ...current, [key]: value }));
  }

  function clearItemPrice(key) {
    setItemPrices((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function savePrices(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/price-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceDate: date, categoryPrices, itemPrices }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "စျေးနှုန်းသိမ်း၍မရပါ။");
      setMessage(`${date} အတွက် စျေးနှုန်းများ သိမ်းပြီးပါပြီ။ Category ${body.data?.count || 0} ခု/Item များကို update လုပ်ထားပါတယ်။`);
      await loadPrices(date);
    } catch (saveError) {
      setError(saveError.message || "စျေးနှုန်းသိမ်း၍မရပါ။");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-page-main">
      <div className="app-page-container space-y-4">
        <section className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Cost / Price Settings</p>
              <h2 className="mt-1 text-2xl font-black text-slate-900">နေ့စဉ် စျေးနှုန်းသတ်မှတ်ရန်</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Category စျေးကို အခြေခံစျေးအဖြစ်ထားပြီး item တစ်ခုချင်းစီက စျေးကွာလျှင် Item Override ထည့်ပါ။ Item စျေးရှိလျှင် Category စျေးကို ဦးစားပေးမည်။</p>
            </div>
            <label className="shrink-0 text-sm font-bold text-slate-700">Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 h-12 rounded-xl border-2 border-amber-300 bg-amber-50 px-3 text-base font-black" /></label>
          </div>
        </section>

        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}
        {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-bold text-emerald-700">{message}</div> : null}

        <form onSubmit={savePrices} className="space-y-4">
          <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-lg font-black text-slate-900">1. Category အလိုက် အခြေခံစျေး</h3><p className="mt-1 text-xs leading-5 text-slate-500">ဒီစျေးကို အဲဒီ Category ထဲက item များအားလုံးအတွက် default အဖြစ် သုံးပါမယ်။</p></div>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-800">ဗူးတစ်လုံးစျေး</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BOTTLE_GROUPS.map((category) => (
                <label key={category.key} className="rounded-xl border border-violet-100 bg-violet-50/60 p-3 text-sm font-bold text-slate-800">
                  <span className="block">{category.label}</span><span className="mt-1 block text-[11px] font-normal text-slate-500">{category.description}</span>
                  <div className="mt-2 flex items-center gap-2"><input type="number" min="0" step="1" inputMode="numeric" value={categoryPrices[category.key] || ""} onChange={(event) => setCategoryPrice(category.key, event.target.value)} placeholder="မသတ်မှတ်ရသေး" aria-label={`${category.label} category price`} className="h-11 min-w-0 flex-1 rounded-lg border border-violet-200 bg-white px-3 text-right font-black" /><span className="text-xs font-black">Ks/ဗူး</span></div>
                  {categoryPrices[category.key] ? <p className="mt-1 text-right text-[11px] font-black text-emerald-700">သတ်မှတ်ပြီး: {money(categoryPrices[category.key])}/ဗူး</p> : null}
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><h3 className="text-lg font-black text-slate-900">2. Item တစ်ခုချင်းစီအလိုက် စျေးပြင်ရန်</h3><p className="mt-1 text-xs leading-5 text-slate-500">Item Override မထည့်ထားလျှင် Category စျေးကို အလိုအလျောက်သုံးပါမယ်။ Customer စျေးကွာလျှင် ငွေရှင်းတမ်းထဲမှာ အဲဒီ transaction အတွက် စျေးကို ပြန်ညှိနိုင်ပါမယ်။</p></div>
              <select value={activeCategory} onChange={(event) => setActiveCategory(event.target.value)} className="h-11 rounded-xl border-2 border-cyan-300 bg-cyan-50 px-3 text-sm font-black text-cyan-950">{BOTTLE_GROUPS.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}</select>
            </div>
            {loading ? <p className="py-10 text-center text-sm text-slate-500">Catalog နှင့် စျေးနှုန်းများ ရယူနေသည်...</p> : <div className="mt-4 space-y-2">{visibleItems.map((item) => {
              const categoryPrice = categoryPrices[item.categoryKey];
              const itemPrice = itemPrices[item.productKey] || "";
              const effectivePrice = itemPrice || categoryPrice || item.effectivePrice?.pricePerBottle || "";
              return <div key={item.productKey} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_140px_150px_auto] sm:items-center"><div><p className="font-black text-slate-900">{item.productName}</p><p className="mt-1 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-black text-sky-800">{item.capacity} ဆံ့ / ကဒ်</p><p className="mt-1 text-xs text-slate-500">လက်ရှိ {effectivePrice ? `${money(effectivePrice)}/ဗူး` : "စျေးမသတ်မှတ်ရသေး"}</p></div><div className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">ကဒ်တစ်ကဒ်<br /><span className="font-black">{effectivePrice ? money(Number(effectivePrice) * item.capacity) : "—"}</span></div><label className="text-xs font-bold text-slate-700">Item Override<input type="number" min="0" step="1" inputMode="numeric" value={itemPrice} onChange={(event) => setItemPrice(item.productKey, event.target.value)} placeholder={categoryPrice ? `${categoryPrice} (Category)` : "စျေးထည့်ပါ"} className="mt-1 h-10 w-full rounded-lg border border-cyan-200 bg-white px-2 text-right font-black" />{categoryPrice && !itemPrice ? <span className="mt-1 block text-[10px] font-black text-emerald-700">Category စျေး: {money(categoryPrice)}/ဗူး</span> : null}</label><button type="button" onClick={() => clearItemPrice(item.productKey)} disabled={!itemPrice} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40">Category သုံး</button></div>;
            })}</div>}
          </section>

          <div className="sticky bottom-3 z-10 flex justify-end"><button type="submit" disabled={saving || loading} className="w-full rounded-xl bg-amber-500 px-5 py-4 text-lg font-black text-white shadow-lg shadow-amber-900/20 hover:bg-amber-600 disabled:opacity-50 sm:w-auto">{saving ? "သိမ်းနေသည်..." : "စျေးနှုန်းသတ်မှတ်ချက် သိမ်းမည်"}</button></div>
        </form>
      </div>
    </main>
  );
}
