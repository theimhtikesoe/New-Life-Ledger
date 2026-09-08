'use client';

import { useMemo, useState } from "react";

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString()} Ks`;
}

function makeLine(item, cardCount) {
  const cards = Math.max(1, Math.round(Number(cardCount || 0)));
  const pricePerBottle = Number(item.effectivePrice?.pricePerBottle || 0);
  const bottlesPerCard = Number(item.bottlesPerCard || item.capacity || 0);
  const bottleCount = cards * bottlesPerCard;
  return {
    id: `${item.productKey}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productKey: item.productKey,
    categoryKey: item.categoryKey,
    categoryLabel: item.categoryLabel,
    productName: item.productName,
    capacity: bottlesPerCard,
    cardCount: cards,
    bottleCount,
    basePricePerBottle: pricePerBottle,
    customerPricePerBottle: pricePerBottle,
    pricePerBottle,
    priceSource: item.effectivePrice?.source || null,
    originalPriceSource: item.effectivePrice?.source || null,
    pricePerCard: pricePerBottle * bottlesPerCard,
    totalAmount: pricePerBottle * bottleCount,
  };
}

export default function SalesItemPicker({ catalog = [], saleItems = [], onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [cardCount, setCardCount] = useState("");
  const [error, setError] = useState("");

  const categories = useMemo(() => {
    const seen = new Map();
    catalog.forEach((item) => {
      if (!seen.has(item.categoryKey)) seen.set(item.categoryKey, { key: item.categoryKey, label: item.categoryLabel || item.categoryKey });
    });
    return [...seen.values()];
  }, [catalog]);

  const currentCategory = activeCategory || categories[0]?.key || "";
  const visibleItems = catalog.filter((item) => item.categoryKey === currentCategory);
  const selectedItem = catalog.find((item) => item.productKey === selectedKey) || null;
  const previewItem = selectedItem || visibleItems[0] || null;
  const selectedPrice = Number(selectedItem?.effectivePrice?.pricePerBottle || 0);
  const previewCards = Math.max(0, Math.round(Number(cardCount || 0)));
  const previewBottles = previewCards * Number(previewItem?.bottlesPerCard || 0);
  const previewTotal = previewBottles * selectedPrice;
  const totalAmount = saleItems.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const totalBottles = saleItems.reduce((sum, item) => sum + Number(item.bottleCount || 0), 0);

  function openPicker() {
    setError("");
    setActiveCategory((current) => current || categories[0]?.key || "");
    setSelectedKey("");
    setCardCount("");
    setOpen(true);
  }

  function addItem() {
    if (!selectedItem) return setError("ဗူးအမျိုးအစား ရွေးပါ။");
    if (!selectedPrice) return setError("ဒီဗူးအတွက် Cost စျေးနှုန်း မသတ်မှတ်ရသေးပါ။ Cost Page မှာ အရင်သတ်မှတ်ပါ။");
    if (!Number(cardCount)) return setError("ကဒ်အရေအတွက် ထည့်ပါ။");
    const line = makeLine(selectedItem, cardCount);
    const existing = saleItems.find((item) => item.productKey === line.productKey && item.pricePerBottle === line.pricePerBottle);
    if (existing) {
          onChange(saleItems.map((item) => item.id === existing.id ? makeLine({ ...selectedItem, effectivePrice: { pricePerBottle: line.pricePerBottle, source: line.priceSource } }, Number(item.cardCount || 0) + line.cardCount) : item));
    } else {
      onChange([...saleItems, line]);
    }
    setError("");
    // Keep the picker open so one cash-sale entry can immediately add
    // another size/type (for example .3 and .6) as another sale-item line.
    setSelectedKey("");
    setCardCount("");
  }

  function updateCards(id, value) {
    const cards = Math.max(1, Math.round(Number(value || 0)));
    onChange(saleItems.map((item) => {
      if (item.id !== id) return item;
      const bottleCount = cards * Number(item.capacity || 0);
      return { ...item, cardCount: cards, bottleCount, pricePerCard: Number(item.pricePerBottle || 0) * Number(item.capacity || 0), totalAmount: Number(item.pricePerBottle || 0) * bottleCount };
    }));
  }

  function updatePrice(id, value) {
    const price = Math.max(0, Math.round(Number(value || 0)));
    onChange(saleItems.map((item) => {
      if (item.id !== id) return item;
      const bottleCount = Number(item.bottleCount || 0);
      const basePrice = Number(item.basePricePerBottle || 0);
      return {
        ...item,
        customerPricePerBottle: price,
        pricePerBottle: price,
        priceSource: price === basePrice ? (item.originalPriceSource || item.priceSource || null) : "CUSTOMER_OVERRIDE",
        pricePerCard: price * Number(item.capacity || 0),
        totalAmount: price * bottleCount,
      };
    }));
  }

  return (
    <section className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-violet-950">ရောင်းသည့်ဗူးများ</p>
          <p className="mt-1 text-[11px] leading-4 text-violet-800">ဗူးအမျိုးအစား မျိုးစုံ (ဥပမာ .3 နှင့် .6) ကို တစ်ခါတည်း ထည့်နိုင်ပါသည်။ ကဒ်အရေအတွက်၊ စျေးနှုန်းနှင့် သင့်ငွေကို အလိုအလျောက်တွက်မည်။</p>
        </div>
        <button type="button" onClick={openPicker} disabled={disabled || !catalog.length} className="shrink-0 rounded-lg bg-violet-700 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">ဗူးထည့်ရန် +</button>
      </div>

      {saleItems.length ? <div className="space-y-2">{saleItems.map((item) => <div key={item.id} className="rounded-lg border border-violet-200 bg-white p-2.5"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-black text-slate-900">{item.productName} · {item.capacity} ဆံ့</p><p className="mt-0.5 text-[11px] text-slate-600">{Number(item.bottleCount || 0).toLocaleString()} ဗူး · {formatMoney(item.pricePerBottle)}/ဗူး · {formatMoney(item.totalAmount)}</p></div><button type="button" onClick={() => onChange(saleItems.filter((line) => line.id !== item.id))} disabled={disabled} className="rounded px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50">ဖျက်</button></div><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[11px] font-bold text-slate-600">ကဒ်<input type="number" min="1" step="1" value={item.cardCount} onChange={(event) => updateCards(item.id, event.target.value)} disabled={disabled} className="mt-1 h-9 w-full rounded-lg border border-violet-200 px-2 text-center text-sm font-black text-slate-900" /></label><label className="text-[11px] font-bold text-slate-600">Customer စျေး/ဗူး<input type="number" min="0" step="1" value={item.customerPricePerBottle ?? item.pricePerBottle} onChange={(event) => updatePrice(item.id, event.target.value)} disabled={disabled} className="mt-1 h-9 w-full rounded-lg border border-violet-200 px-2 text-right text-sm font-black text-slate-900" /></label></div><p className="mt-1 text-[11px] text-slate-500">{item.cardCount} ကဒ် × {item.capacity} = {Number(item.bottleCount || 0).toLocaleString()} ဗူး</p></div>)}</div> : <p className="rounded-lg border border-dashed border-violet-300 bg-white/70 px-3 py-2 text-xs text-violet-800">ဗူးမရွေးရသေးပါ။ `ဗူးထည့်ရန် +` ကိုနှိပ်ပါ။</p>}

      {open ? <div className="space-y-3 rounded-xl border border-violet-300 bg-white p-3 shadow-inner"><div className="flex items-center justify-between"><p className="text-sm font-black text-slate-900">ဗူးရွေးရန်</p><button type="button" onClick={() => setOpen(false)} className="rounded px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100">ပိတ်</button></div><select value={currentCategory} onChange={(event) => { setActiveCategory(event.target.value); setSelectedKey(""); }} disabled={disabled} className="h-10 w-full rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-bold text-slate-900">{categories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}</select><select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} disabled={disabled || !visibleItems.length} className="h-10 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm font-bold text-slate-900"><option value="">ဗူးအမျိုးအစား ရွေးပါ</option>{visibleItems.map((item) => <option key={item.productKey} value={item.productKey}>{item.productName} · {item.capacity} ဆံ့ {item.effectivePrice?.pricePerBottle ? `· ${formatMoney(item.effectivePrice.pricePerBottle)}/ဗူး` : "· စျေးမသတ်မှတ်ရသေး"}</option>)}</select><div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold text-slate-700">ကဒ်အရေအတွက်<input type="number" min="1" step="1" value={cardCount} onChange={(event) => setCardCount(event.target.value)} disabled={disabled} className="mt-1 h-10 w-full rounded-lg border border-violet-200 px-3 text-center font-black text-slate-900" /></label><div className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-950"><p className="font-bold">အလိုအလျောက်တွက်ချက်မှု</p><p className="mt-1">{selectedItem ? `${previewCards} ကဒ် × ${Number(selectedItem.bottlesPerCard || 0)} = ${previewBottles.toLocaleString()} ဗူး` : "ဗူးအမျိုးအစား ရွေးပါ"}</p><p className="font-black">{formatMoney(previewTotal)}</p></div></div>{error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p> : null}<button type="button" onClick={addItem} disabled={disabled || !selectedItem} className="h-10 w-full rounded-lg bg-violet-700 text-sm font-black text-white hover:bg-violet-800 disabled:opacity-50">ဒီဗူးကို ထည့်မည်</button></div> : null}

      {saleItems.length ? <div className="flex flex-col gap-1 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-950 sm:flex-row sm:items-center sm:justify-between"><span>စုစုပေါင်း: {totalBottles.toLocaleString()} ဗူး</span><span>သင့်ငွေ: {formatMoney(totalAmount)}</span></div> : null}
    </section>
  );
}
