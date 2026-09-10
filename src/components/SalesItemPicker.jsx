'use client';

import { useMemo, useState } from "react";

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString()} Ks`;
}

function isCapItem(item) {
  return Boolean(item?.isCap || item?.productType === "cap" || item?.categoryKey === "CAP");
}

function isTubeItem(item) {
  return item?.productType === "tube" || item?.categoryKey === "TUBE";
}

function makeLine(item, cardCount) {
  const quantity = Math.max(1, Math.round(Number(cardCount || 0)));
  const isCap = isCapItem(item);
  const isTube = isTubeItem(item);
  const pricePerUnit = Number(item.effectivePrice?.pricePerBottle || 0);
  const bottlesPerCard = Number(item.bottlesPerCard || item.capacity || 0);
  const bottleCount = isCap ? 0 : quantity * bottlesPerCard;
  return {
    id: `${item.productKey}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productKey: item.productKey,
    categoryKey: item.categoryKey,
    categoryLabel: item.categoryLabel,
    productName: item.productName,
    isCap,
    capacity: isCap ? 0 : bottlesPerCard,
    cardCount: quantity,
    bottleCount,
    unitCount: isCap ? quantity : bottleCount,
    unitLabel: isCap ? "အဖုံး" : isTube ? "Tube" : "ဗူး",
    basePricePerBottle: pricePerUnit,
    customerPricePerBottle: pricePerUnit,
    pricePerBottle: pricePerUnit,
    priceSource: item.effectivePrice?.source || null,
    originalPriceSource: item.effectivePrice?.source || null,
    pricePerCard: isCap ? pricePerUnit : pricePerUnit * bottlesPerCard,
    totalAmount: pricePerUnit * (isCap ? quantity : bottleCount),
  };
}

export default function SalesItemPicker({ catalog = [], saleItems = [], onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState("product");
  const [activeCategory, setActiveCategory] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [cardCount, setCardCount] = useState("");
  const [error, setError] = useState("");

  const pickerCatalog = useMemo(() => catalog.filter((item) => pickerMode === "tube" ? isTubeItem(item) : !isTubeItem(item)), [catalog, pickerMode]);
  const categories = useMemo(() => {
    const seen = new Map();
    pickerCatalog.forEach((item) => {
      if (!seen.has(item.categoryKey)) seen.set(item.categoryKey, { key: item.categoryKey, label: item.categoryLabel || item.categoryKey });
    });
    return [...seen.values()];
  }, [pickerCatalog]);

  const currentCategory = activeCategory || categories[0]?.key || "";
  const visibleItems = pickerCatalog.filter((item) => item.categoryKey === currentCategory);
  const selectedItem = pickerCatalog.find((item) => item.productKey === selectedKey) || null;
  const selectedPrice = Number(selectedItem?.effectivePrice?.pricePerBottle || 0);
  const previewCards = Math.max(0, Math.round(Number(cardCount || 0)));
  const previewBottles = isCapItem(selectedItem) ? previewCards : previewCards * Number(selectedItem?.bottlesPerCard || 0);
  const previewTotal = (isCapItem(selectedItem) ? previewCards : previewBottles) * selectedPrice;
  const totalAmount = saleItems.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const totalBottles = saleItems.reduce((sum, item) => sum + Number(item.bottleCount || 0), 0);
  const totalCaps = saleItems.reduce((sum, item) => sum + (isCapItem(item) ? Number(item.cardCount || item.unitCount || 0) : 0), 0);

  function openPicker() {
    setError("");
    setPickerMode("product");
    setActiveCategory((current) => current || categories[0]?.key || "");
    setSelectedKey("");
    setCardCount("");
    setOpen(true);
  }

  function openTubePicker() {
    setError("");
    setPickerMode("tube");
    setActiveCategory("TUBE");
    setSelectedKey("");
    setCardCount("");
    setOpen(true);
  }

  function addItem() {
    if (!selectedItem) return setError("အမျိုးအစား ရွေးပါ။");
    if (!selectedPrice) return setError("ဒီပစ္စည်းအတွက် စျေးနှုန်း မသတ်မှတ်ရသေးပါ။");
    if (!Number(cardCount)) return setError(isCapItem(selectedItem) ? "အဖုံးအရေအတွက် ထည့်ပါ။" : "ကဒ်အရေအတွက် ထည့်ပါ။");
    const line = makeLine(selectedItem, cardCount);
    const existing = saleItems.find((item) => item.productKey === line.productKey && item.pricePerBottle === line.pricePerBottle);
    if (existing) {
      onChange(saleItems.map((item) => item.id === existing.id
        ? makeLine({ ...selectedItem, effectivePrice: { pricePerBottle: line.pricePerBottle, source: line.priceSource } }, Number(item.cardCount || 0) + line.cardCount)
        : item));
    } else {
      onChange([...saleItems, line]);
    }
    setError("");
    setSelectedKey("");
    setCardCount("");
  }

  function updateCards(id, value) {
    const quantity = Math.max(1, Math.round(Number(value || 0)));
    onChange(saleItems.map((item) => {
      if (item.id !== id) return item;
      const isCap = isCapItem(item);
      const bottleCount = isCap ? 0 : quantity * Number(item.capacity || 0);
      const unitCount = isCap ? quantity : bottleCount;
      return {
        ...item,
        cardCount: quantity,
        bottleCount,
        unitCount,
        pricePerCard: Number(item.pricePerBottle || 0) * (isCap ? 1 : Number(item.capacity || 0)),
        totalAmount: Number(item.pricePerBottle || 0) * unitCount,
      };
    }));
  }

  function updatePrice(id, value) {
    const price = Math.max(0, Math.round(Number(value || 0)));
    onChange(saleItems.map((item) => {
      if (item.id !== id) return item;
      const unitCount = isCapItem(item) ? Number(item.cardCount || item.unitCount || 0) : Number(item.bottleCount || 0);
      const basePrice = Number(item.basePricePerBottle || 0);
      return {
        ...item,
        customerPricePerBottle: price,
        pricePerBottle: price,
        priceSource: price === basePrice ? (item.originalPriceSource || item.priceSource || null) : "CUSTOMER_OVERRIDE",
        pricePerCard: price * (isCapItem(item) ? 1 : Number(item.capacity || 0)),
        totalAmount: price * unitCount,
      };
    }));
  }

  return (
    <section className="space-y-3 rounded-xl border-2 border-violet-300 bg-violet-50/80 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-black text-violet-950">ရောင်းသည့်ဗူးများ / အဖုံး</p></div>
        <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={openPicker} disabled={disabled || !catalog.some((item) => !isTubeItem(item))} className="shrink-0 rounded-lg bg-violet-700 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">ဗူး/အဖုံး ထည့်ရန် +</button><button type="button" onClick={openTubePicker} disabled={disabled || !catalog.some(isTubeItem)} className="shrink-0 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">Tube ထည့်ရန် +</button></div>
      </div>

      {saleItems.length ? <div className="space-y-3">{saleItems.map((item) => {
        const isCap = isCapItem(item);
        const count = isCap ? Number(item.cardCount || item.unitCount || 0) : Number(item.bottleCount || 0);
        return <div key={item.id} className="rounded-xl border-2 border-violet-200 bg-white p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{item.productName}{isCap || isTubeItem(item) ? ` · ${isTubeItem(item) ? `${item.capacity} pcs/အိတ်` : ""}` : ` · ${item.capacity} ဆံ့`}</p><p className="mt-1 text-xs font-bold text-slate-600">{count.toLocaleString()} {isCap ? "အဖုံး" : isTubeItem(item) ? "Tube" : "ဗူး"} · {formatMoney(item.pricePerBottle)}/{isCap ? "ဖုံး" : "ဗူး"} · {formatMoney(item.totalAmount)}</p></div><button type="button" onClick={() => onChange(saleItems.filter((line) => line.id !== item.id))} disabled={disabled} className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50">ဖျက်</button></div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-violet-100 pt-3"><label className="text-xs font-bold text-slate-600">{isCap ? "အရေအတွက်" : "ကဒ်"}<input type="number" min="1" step="1" value={item.cardCount} onChange={(event) => updateCards(item.id, event.target.value)} disabled={disabled} className="mt-1 h-10 w-full rounded-lg border-2 border-violet-200 px-2 text-center text-base font-black text-slate-900" /></label><label className="text-xs font-bold text-slate-600">Customer စျေး/{isCap ? "ဖုံး" : "ဗူး"}<input type="number" min="0" step="1" value={item.customerPricePerBottle ?? item.pricePerBottle} onChange={(event) => updatePrice(item.id, event.target.value)} disabled={disabled} className="mt-1 h-10 w-full rounded-lg border-2 border-violet-200 px-2 text-right text-base font-black text-slate-900" /></label></div>
          <p className="mt-2 border-t border-violet-100 pt-2 text-xs font-bold text-slate-500">{isCap ? `${item.cardCount} အဖုံး × ${formatMoney(item.pricePerBottle)} = ${formatMoney(item.totalAmount)}` : `${item.cardCount} ကဒ် × ${item.capacity} = ${count.toLocaleString()} ဗူး`}</p>
        </div>;
      })}</div> : null}

      {open ? <div className="space-y-3 rounded-xl border-2 border-violet-300 bg-white p-3 shadow-inner"><div className="flex items-center justify-between"><p className="text-sm font-black text-slate-900">{pickerMode === "tube" ? "Tube ရွေးရန်" : "ဗူး / အဖုံး ရွေးရန်"}</p><button type="button" onClick={() => setOpen(false)} className="rounded px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100">ပိတ်</button></div>{pickerMode === "product" ? <select value={currentCategory} onChange={(event) => { setActiveCategory(event.target.value); setSelectedKey(""); }} disabled={disabled} className="h-10 w-full rounded-lg border-2 border-violet-200 bg-violet-50 px-3 text-sm font-bold text-slate-900">{categories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}</select> : null}<select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} disabled={disabled || !visibleItems.length} className="h-10 w-full rounded-lg border-2 border-violet-200 bg-white px-3 text-sm font-bold text-slate-900"><option value="">{pickerMode === "tube" ? "Tube အမျိုးအစား ရွေးပါ" : currentCategory === "CAP" ? "အဖုံးအရောင် ရွေးပါ" : "ဗူးအမျိုးအစား ရွေးပါ"}</option>{visibleItems.map((item) => <option key={item.productKey} value={item.productKey}>{item.productName}{isCapItem(item) ? ` · ${formatMoney(item.effectivePrice?.pricePerBottle)}/ဖုံး` : isTubeItem(item) ? ` · ${item.capacity} pcs/အိတ် · ${item.effectivePrice?.pricePerBottle ? `${formatMoney(item.effectivePrice.pricePerBottle)}/Tube` : "စျေးမသတ်မှတ်ရသေး"}` : ` · ${item.capacity} ဆံ့ · ${item.effectivePrice?.pricePerBottle ? `${formatMoney(item.effectivePrice.pricePerBottle)}/ဗူး` : "စျေးမသတ်မှတ်ရသေး"}`}</option>)}</select><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-700">{isCapItem(selectedItem) ? "အဖုံးအရေအတွက်" : isTubeItem(selectedItem) ? "အိတ်အရေအတွက်" : "ကဒ်အရေအတွက်"}<input type="number" min="1" step="1" value={cardCount} onChange={(event) => setCardCount(event.target.value)} disabled={disabled} className="mt-1 h-10 w-full rounded-lg border-2 border-violet-200 px-3 text-center text-base font-black text-slate-900" /></label><div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-950"><p className="font-bold">အလိုအလျောက်တွက်ချက်မှု</p><p className="mt-1">{selectedItem ? (isCapItem(selectedItem) ? `${previewCards.toLocaleString()} အဖုံး × ${selectedPrice} Ks` : `${previewCards} ${isTubeItem(selectedItem) ? "အိတ်" : "ကဒ်"} × ${Number(selectedItem.bottlesPerCard || 0)} = ${previewBottles.toLocaleString()} ${isTubeItem(selectedItem) ? "Tube" : "ဗူး"}`) : "ပစ္စည်းရွေးပါ"}</p><p className="mt-1 text-xl font-black">{formatMoney(previewTotal)}</p></div></div>{error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p> : null}<button type="button" onClick={addItem} disabled={disabled || !selectedItem} className="h-10 w-full rounded-lg bg-violet-700 text-sm font-black text-white hover:bg-violet-800 disabled:opacity-50">ထည့်မည်</button></div> : null}

      {saleItems.length ? <div className="flex flex-col gap-1 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-950 sm:flex-row sm:items-center sm:justify-between"><span>စုစုပေါင်း: {totalBottles.toLocaleString()} ဗူး{totalCaps ? ` · ${totalCaps.toLocaleString()} အဖုံး` : ""}</span><span>သင့်ငွေ: {formatMoney(totalAmount)}</span></div> : null}
    </section>
  );
}
