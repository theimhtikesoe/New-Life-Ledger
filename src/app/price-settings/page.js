'use client';

import ThemedSelect from "@/components/ThemedSelect";


import { useEffect, useMemo, useState } from "react";
import { PRICE_GROUPS, TUBE_PRODUCT_TYPES, normalizeTubeTypes } from "@/lib/production-catalog";

function todayValue() {
  const now = new Date();
  const local = new Date(now.getTime() + (6 * 60 + 30) * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

function money(value) {
  return `${Number(value || 0).toLocaleString()} Ks`;
}

function isPackagingItem(itemOrKey) {
  return itemOrKey?.productType === "packaging-bag" || itemOrKey?.categoryKey === "PACKAGING_BAG";
}

function isGlueItem(itemOrKey) {
  return itemOrKey?.productType === "glue-seed" || itemOrKey?.categoryKey === "GLUE";
}

export default function PriceSettingsPage() {
  const [date, setDate] = useState(todayValue);
  const [categories, setCategories] = useState(PRICE_GROUPS);
  const [activeCategory, setActiveCategory] = useState(PRICE_GROUPS[0]?.key || "");
  const [catalog, setCatalog] = useState([]);
  const [categoryPrices, setCategoryPrices] = useState({});
  const [itemPrices, setItemPrices] = useState({});
  const [tubeMappings, setTubeMappings] = useState({});
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
      const nextCategories = Array.isArray(data.categories) && data.categories.length ? data.categories : PRICE_GROUPS;
      setCategories(nextCategories);
      setActiveCategory((current) => nextCategories.some((category) => category.key === current) ? current : nextCategories[0]?.key || "");
      setCatalog(Array.isArray(data.catalog) ? data.catalog : []);
      const nextCategoryPrices = {};
      for (const category of data.categories || []) {
        const exact = data.categoryPrices?.[category.key];
        const effective = data.catalog?.find((item) => item.categoryKey === category.key && String(item.effectivePrice?.source || "").includes("CATEGORY"))?.effectivePrice;
        const value = exact?.pricePerBottle ?? effective?.pricePerBottle ?? category.defaultPrice;
        if (value !== undefined && value !== null) nextCategoryPrices[category.key] = String(value);
      }
      const nextItemPrices = {};
      const nextTubeMappings = {};
      for (const item of data.catalog || []) {
        const exact = data.itemPrices?.[item.productKey];
        if (isPackagingItem(item) || isGlueItem(item)) {
          const packagingPrice = exact || (String(item.effectivePrice?.source || "").includes("ITEM") ? item.effectivePrice : null);
          if (packagingPrice && (packagingPrice.pricePerBottle || packagingPrice.pricePerPack || packagingPrice.pricePerLb || packagingPrice.pricePerKg || packagingPrice.pricePerSack)) {
            nextItemPrices[item.productKey] = {
              perPiece: String(packagingPrice.pricePerBottle || ""),
              perPack: String(packagingPrice.pricePerPack || ""),
              perLb: String(packagingPrice.pricePerLb || ""),
              perKg: String(packagingPrice.pricePerKg || ""),
              perSack: String(packagingPrice.pricePerSack || ""),
            };
          }
        }
        const effectiveItemPrice = String(item.effectivePrice?.source || "").includes("ITEM") ? Number(item.effectivePrice.pricePerBottle || 0) : 0;
        if (!isPackagingItem(item)) {
          if (Number(exact?.pricePerBottle || 0) > 0) nextItemPrices[item.productKey] = String(exact.pricePerBottle);
          else if (effectiveItemPrice > 0) nextItemPrices[item.productKey] = String(effectiveItemPrice);
        }
        const tubeType = data.tubeMappings?.[item.productKey] || item.tubeType || "";
        if (tubeType) nextTubeMappings[item.productKey] = normalizeTubeTypes(tubeType);
      }
      setCategoryPrices(nextCategoryPrices);
      setItemPrices(nextItemPrices);
      setTubeMappings(nextTubeMappings);
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

  function setPackagingPrice(key, field, value) {
    setItemPrices((current) => ({
      ...current,
      [key]: { perPiece: "", perPack: "", perLb: "", perKg: "", perSack: "", ...(current[key] && typeof current[key] === "object" ? current[key] : {}), [field]: value },
    }));
  }

  function setTubeMapping(key, value) {
    setTubeMappings((current) => ({ ...current, [key]: value }));
  }

  function toggleTubeMapping(key, tubeType, checked) {
    const current = normalizeTubeTypes(tubeMappings[key]);
    const next = checked ? [...new Set([...current, tubeType])] : current.filter((value) => value !== tubeType);
    setTubeMapping(key, next);
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
        body: JSON.stringify({ priceDate: date, categoryPrices, itemPrices, tubeMappings }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "စျေးနှုန်းသိမ်း၍မရပါ။");
      setMessage(`${date} အတွက် စျေးနှုန်းနှင့် သတ်မှတ် Tube များ သိမ်းပြီးပါပြီ။ Category ${body.data?.count || 0} ခု/Item များကို update လုပ်ထားပါတယ်။`);
      window.dispatchEvent(new CustomEvent("new-life-ledger:price-settings-updated", { detail: { priceDate: date } }));
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
              <p className="text-xs font-bold tracking-wide text-amber-700">စျေးသတ်မှတ်ရန်</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Category စျေးကို အခြေခံစျေးအဖြစ်ထားပြီး item တစ်ခုချင်းစီက စျေးကွာလျှင် Item Override ထည့်ပါ။ Item Override ရှိလျှင် အဲဒီ Item စျေးကိုပဲ ဦးစားပေးသုံးပါမယ်။</p>
            </div>
            <label className="flex shrink-0 flex-col gap-1.5 text-sm font-bold text-slate-700">
              <span className="leading-none">Date</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-12 min-w-[170px] rounded-xl border-2 border-amber-300 bg-amber-50 px-3 text-base font-black" />
            </label>
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
              {categories.map((category) => (
                <label key={category.key} className="rounded-xl border border-violet-100 bg-violet-50/60 p-3 text-sm font-bold text-slate-800">
                  <span className="block">{category.label}</span><span className="mt-1 block text-[11px] font-normal text-slate-500">{category.description}</span>
                  <div className="mt-2 flex items-center gap-2"><input type="number" min="0" step="1" inputMode="numeric" value={categoryPrices[category.key] || ""} onChange={(event) => setCategoryPrice(category.key, event.target.value)} placeholder="မသတ်မှတ်ရသေး" aria-label={`${category.label} category price`} className="h-11 min-w-0 flex-1 rounded-lg border border-violet-200 bg-white px-3 text-right font-black" /><span className="text-xs font-black">Ks/{category.key === "CAP" ? "ဖုံး" : category.key === "PACKAGING_BAG" ? "လုံး" : category.key === "GLUE" ? "kg" : category.key === "TUBE" ? "Tube" : "ဗူး"}</span></div>
                  {categoryPrices[category.key] ? <p className="mt-1 text-right text-[11px] font-black text-emerald-700">သတ်မှတ်ပြီး: {money(categoryPrices[category.key])}/{category.key === "CAP" ? "ဖုံး" : category.key === "PACKAGING_BAG" ? "လုံး" : category.key === "GLUE" ? "kg" : category.key === "TUBE" ? "Tube" : "ဗူး"}</p> : null}
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><h3 className="text-lg font-black text-slate-900">2. Item တစ်ခုချင်းစီအလိုက် စျေးပြင်ရန်</h3><p className="mt-1 text-xs leading-5 text-slate-500">Item Override မထည့်ထားလျှင် Category စျေးကို အလိုအလျောက်သုံးပါမယ်။ Customer စျေးကွာလျှင် ငွေရှင်းတမ်းထဲမှာ အဲဒီ transaction အတွက် စျေးကို ပြန်ညှိနိုင်ပါမယ်။</p></div>
              <ThemedSelect value={activeCategory} onChange={(event) => setActiveCategory(event.target.value)} className="h-11 rounded-xl border-2 border-cyan-300 bg-cyan-50 px-3 text-sm font-black text-cyan-950">{categories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}</ThemedSelect>
            </div>
            {loading ? <p className="py-10 text-center text-sm text-slate-500">Catalog နှင့် စျေးနှုန်းများ ရယူနေသည်...</p> : <div className="mt-4 space-y-2">{visibleItems.map((item) => {
              const categoryPrice = categoryPrices[item.categoryKey];
              const isCap = item.productType === "cap" || item.categoryKey === "CAP";
              const isTube = item.productType === "tube" || item.categoryKey === "TUBE";
              const isPackagingBag = isPackagingItem(item);
              const isGlue = isGlueItem(item);
              const isMultiUnitPrice = isPackagingBag || isGlue;
              const itemPrice = isMultiUnitPrice
                ? (itemPrices[item.productKey] && typeof itemPrices[item.productKey] === "object" ? itemPrices[item.productKey] : { perPiece: "", perPack: "", perLb: "", perKg: "", perSack: "" })
                : (itemPrices[item.productKey] ?? "");
              const effectivePrice = isPackagingBag ? (itemPrice.perPiece || categoryPrice || item.effectivePrice?.pricePerBottle || "") : isGlue ? (itemPrice.perKg || categoryPrice || item.effectivePrice?.pricePerBottle || "") : (itemPrice || categoryPrice || item.effectivePrice?.pricePerBottle || "");
              const unitLabel = isCap ? "ဖုံး" : isPackagingBag ? "လုံး" : isGlue ? "kg" : isTube ? "Tube" : "ဗူး";
              const quantityLabel = isCap ? "အဖုံးတစ်ဖုံး" : isPackagingBag ? "တစ်လုံး" : isGlue ? "1 kg" : isTube ? "တစ်ထုပ်" : "ကဒ်တစ်ကဒ်";
              const unitTotal = isCap ? Number(effectivePrice || 0) : Number(effectivePrice || 0) * item.capacity;
              const hasItemPrice = isMultiUnitPrice ? Object.values(itemPrice).some(Boolean) : Boolean(itemPrice);
              const mappedTubeTypes = normalizeTubeTypes(tubeMappings[item.productKey]);
              const packagingDetails = isPackagingBag ? `${item.piecesPerPack} လုံး/ထုပ် · ${item.weightLb} ပေါင်/ထုပ် · 100 ပေါင် = ${item.packsPerSack} ထုပ် / ${item.piecesPerSack} လုံး` : isGlue ? "kg နှင့် အိတ် အလိုက် စျေးသတ်မှတ်ရန်" : "";
              const currentPriceText = isPackagingBag
                ? ([itemPrice.perPiece ? `${money(itemPrice.perPiece)}/လုံး` : categoryPrice ? `${money(categoryPrice)}/လုံး (Category)` : "", itemPrice.perPack && `${money(itemPrice.perPack)}/ထုပ်`, itemPrice.perLb && `${money(itemPrice.perLb)}/ပေါင်`, itemPrice.perSack && `${money(itemPrice.perSack)}/ဆာလာအိတ်`].filter(Boolean).join(" · ") || "စျေးမသတ်မှတ်ရသေး")
                : isGlue
                  ? ([itemPrice.perKg ? `${money(itemPrice.perKg)}/kg` : categoryPrice ? `${money(categoryPrice)}/kg (Category)` : "", itemPrice.perSack && `${money(itemPrice.perSack)}/အိတ်`].filter(Boolean).join(" · ") || "စျေးမသတ်မှတ်ရသေး")
                : (effectivePrice ? `${money(effectivePrice)}/${unitLabel}` : "စျေးမသတ်မှတ်ရသေး");
              return <div key={item.productKey} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_140px_180px_190px_auto] sm:items-center"><div><p className="font-black text-slate-900">{item.productName}</p><p className="mt-1 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-black text-sky-800">{isCap ? "အဖုံး သီးသန့်" : isMultiUnitPrice ? packagingDetails : isTube ? `${item.capacity} pcs / ထုပ်` : `${item.capacity} ဆံ့ / ကဒ်`}</p><p className="mt-1 text-xs text-slate-500">လက်ရှိ {currentPriceText}</p></div><div className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">{quantityLabel}<br /><span className="font-black">{effectivePrice ? money(unitTotal) : "—"}</span></div><>{isMultiUnitPrice ? (isGlue ? <div className="grid grid-cols-2 gap-2 rounded-lg border border-cyan-200 bg-white p-2 text-[11px] font-bold"><label>တစ် kg စျေး<input type="number" min="0" step="1" value={itemPrice.perKg} onChange={(event) => setPackagingPrice(item.productKey, "perKg", event.target.value)} placeholder="မထည့်ရသေး" className="mt-1 h-9 w-full rounded border border-cyan-200 px-2 text-right font-black" /></label><label>တစ်အိတ်စျေး<input type="number" min="0" step="1" value={itemPrice.perSack} onChange={(event) => setPackagingPrice(item.productKey, "perSack", event.target.value)} placeholder="မထည့်ရသေး" className="mt-1 h-9 w-full rounded border border-cyan-200 px-2 text-right font-black" /></label></div> : <div className="grid grid-cols-2 gap-2 rounded-lg border border-cyan-200 bg-white p-2 text-[11px] font-bold"><label>တစ်လုံးစျေး<input type="number" min="0" step="1" value={itemPrice.perPiece} onChange={(event) => setPackagingPrice(item.productKey, "perPiece", event.target.value)} placeholder="မထည့်ရသေး" className="mt-1 h-9 w-full rounded border border-cyan-200 px-2 text-right font-black" /></label><label>တစ်ထုပ်စျေး<input type="number" min="0" step="1" value={itemPrice.perPack} onChange={(event) => setPackagingPrice(item.productKey, "perPack", event.target.value)} placeholder="မထည့်ရသေး" className="mt-1 h-9 w-full rounded border border-cyan-200 px-2 text-right font-black" /></label><label>တစ်ပေါင်စျေး<input type="number" min="0" step="1" value={itemPrice.perLb} onChange={(event) => setPackagingPrice(item.productKey, "perLb", event.target.value)} placeholder="မထည့်ရသေး" className="mt-1 h-9 w-full rounded border border-cyan-200 px-2 text-right font-black" /></label><label>ဆာလာအိတ်စျေး<input type="number" min="0" step="1" value={itemPrice.perSack} onChange={(event) => setPackagingPrice(item.productKey, "perSack", event.target.value)} placeholder="မထည့်ရသေး" className="mt-1 h-9 w-full rounded border border-cyan-200 px-2 text-right font-black" /></label></div>) : <label className="text-xs font-bold text-slate-700">Item Override<input type="number" min="0" step="1" inputMode="numeric" value={itemPrice} onChange={(event) => setItemPrice(item.productKey, event.target.value)} placeholder={categoryPrice ? `${categoryPrice} (Category)` : "စျေးထည့်ပါ"} className="mt-1 h-10 w-full rounded-lg border border-cyan-200 bg-white px-2 text-right font-black" />{categoryPrice && !itemPrice ? <span className="mt-1 block text-[10px] font-black text-emerald-700">Category စျေး: {money(categoryPrice)}/{unitLabel}</span> : null}</label>}</><fieldset disabled={isCap || isTube || isMultiUnitPrice} className="rounded-lg border border-cyan-200 bg-white p-2 disabled:bg-slate-100"><legend className="px-1 text-xs font-bold text-slate-700">သတ်မှတ် Tube</legend><div className="grid grid-cols-1 gap-1">{TUBE_PRODUCT_TYPES.map((tubeType) => <label key={tubeType} className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={mappedTubeTypes.includes(tubeType)} onChange={(event) => toggleTubeMapping(item.productKey, tubeType, event.target.checked)} /><span>{tubeType}</span></label>)}</div></fieldset><button type="button" onClick={() => clearItemPrice(item.productKey)} disabled={!hasItemPrice} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40">Category သုံး</button></div>;
            })}</div>}
          </section>

          <div className="sticky bottom-3 z-10 flex justify-end"><button type="submit" disabled={saving || loading} className="w-full rounded-xl bg-amber-500 px-5 py-4 text-lg font-black text-white shadow-lg shadow-amber-900/20 hover:bg-amber-600 disabled:opacity-50 sm:w-auto">{saving ? "သိမ်းနေသည်..." : "စျေးနှုန်းသတ်မှတ်ချက် နှင့် သတ်မှတ် Tube သိမ်းမည်"}</button></div>
        </form>
      </div>
    </main>
  );
}
