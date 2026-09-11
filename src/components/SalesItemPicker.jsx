'use client';

import { useMemo, useState } from "react";

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString()} Ks`;
}

function isCapItem(item) {
  return Boolean(item?.isCap || item?.productType === "cap" || item?.categoryKey === "CAP");
}

function capDisplayName(value) {
  return String(value || "").replace(/^အဖုံး\s*[-·:]\s*/, "").trim();
}

function isTubeItem(item) {
  return item?.productType === "tube" || item?.categoryKey === "TUBE";
}

function makeLine(item, cardCount, capItem = null, capLocation = "မန္တလေး", capPackSize = 5000) {
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
    capProductKey: !isCap && !isTube && capItem ? capItem.productKey : null,
    capProductName: !isCap && !isTube && capItem ? capItem.productName : null,
    capLocation: !isCap && !isTube && capItem ? capLocation : null,
    capPackSize: !isCap && !isTube && capItem ? Number(capPackSize || 5000) : 0,
    capNormalCount: !isCap && !isTube ? bottleCount : 0,
    capDeliveryMode: !isCap && !isTube ? "AUTO" : null,
    capActualCount: !isCap && !isTube ? bottleCount : 0,
    capExtraCount: 0,
    capTotalCount: !isCap && !isTube ? bottleCount : 0,
    capBreakdown: !isCap && !isTube && capItem ? [{
      capProductKey: capItem.productKey,
      capProductName: capItem.productName,
      capLocation,
      count: bottleCount,
    }] : [],
  };
}

function CapBreakdownEditor({ item, onUpdate, onAdd, onRemove, capItems, disabled }) {
  if (isCapItem(item) || isTubeItem(item)) return null;
  const breakdown = Array.isArray(item.capBreakdown) && item.capBreakdown.length ? item.capBreakdown : [];
  return <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 sm:col-span-2">
    <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black text-amber-900">အဖုံးအရောင် ခွဲယူမှု</p><p className="mt-1 text-[11px] leading-4 text-amber-800">အဖြူ ၃,၀၀၀ + အမဲ ၃,၀၀၀ လို အရောင်အလိုက် အရေအတွက်ခွဲထည့်ပါ။</p></div><button type="button" onClick={() => onAdd(item.id)} disabled={disabled} className="shrink-0 rounded-md bg-amber-600 px-2 py-1.5 text-[11px] font-black text-white hover:bg-amber-700">+ အရောင်ထည့်</button></div>
    <div className="mt-2 space-y-2">{breakdown.map((entry, index) => <div key={`${item.id}-cap-${index}`} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]"><select value={entry.capProductKey || ""} onChange={(event) => onUpdate(item.id, index, "capProductKey", event.target.value)} disabled={disabled} className="h-10 w-full rounded-md border border-amber-200 bg-white px-2 text-xs font-bold text-slate-900"><option value="">အဖုံးအရောင် ရွေးပါ</option>{capItems.map((cap) => <option key={cap.productKey} value={cap.productKey}>{capDisplayName(cap.productName)}</option>)}</select><input type="number" min="0" step="1" value={entry.count ?? ""} onChange={(event) => onUpdate(item.id, index, "count", event.target.value)} disabled={disabled} placeholder="အဖုံးအရေအတွက်" className="h-10 w-full rounded-md border border-amber-200 px-2 text-center text-sm font-black text-slate-900" /><button type="button" onClick={() => onRemove(item.id, index)} disabled={disabled || breakdown.length <= 1} className="h-10 rounded-md border border-rose-200 bg-white px-3 text-xs font-black text-rose-700 disabled:opacity-40">ဖျက်</button></div>)}</div>
    <p className="mt-2 text-right text-xs font-black text-amber-900">ခွဲထည့်ထားသည်: {breakdown.reduce((sum, entry) => sum + Number(entry.count || 0), 0).toLocaleString()} ဖုံး</p>
  </div>;
}

export default function SalesItemPicker({ catalog = [], saleItems = [], onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState("product");
  const [activeCategory, setActiveCategory] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [cardCount, setCardCount] = useState("");
  const [defaultCapKey, setDefaultCapKey] = useState("");
  const [defaultCapLocation, setDefaultCapLocation] = useState("မန္တလေး");
  const [defaultCapPackSize, setDefaultCapPackSize] = useState("5000");
  const [error, setError] = useState("");
  const [editingItemId, setEditingItemId] = useState("");

  const pickerCatalog = useMemo(() => catalog.filter((item) => pickerMode === "tube" ? isTubeItem(item) : !isTubeItem(item)), [catalog, pickerMode]);
  const capItems = useMemo(() => catalog.filter(isCapItem), [catalog]);
  const capLocations = ["မန္တလေး", "အေးသာယာ", "Soe", "အခြား"];
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
  const selectedCap = capItems.find((item) => item.productKey === defaultCapKey) || capItems[0] || null;
  const editingItem = saleItems.find((item) => item.id === editingItemId) || null;
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
    const line = makeLine(selectedItem, cardCount, selectedCap, defaultCapLocation, defaultCapPackSize);
    const existing = saleItems.find((item) => item.productKey === line.productKey && item.pricePerBottle === line.pricePerBottle);
    if (existing) {
      onChange(saleItems.map((item) => item.id === existing.id
        ? { ...makeLine({ ...selectedItem, effectivePrice: { pricePerBottle: line.pricePerBottle, source: line.priceSource } }, Number(item.cardCount || 0) + line.cardCount, selectedCap, defaultCapLocation, defaultCapPackSize), capExtraCount: Number(item.capExtraCount || 0) }
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
        capNormalCount: !isCap && !isTubeItem(item) ? (item.capDeliveryMode === "PARTIAL" ? Number(item.capActualCount || 0) : bottleCount) : 0,
        capTotalCount: !isCap && !isTubeItem(item) ? (item.capDeliveryMode === "PARTIAL" ? Number(item.capActualCount || 0) : bottleCount) + Number(item.capExtraCount || 0) : 0,
        capBreakdown: !isCap && !isTubeItem(item) && Array.isArray(item.capBreakdown) && item.capBreakdown.length
          ? item.capBreakdown.map((entry, index) => index === 0 ? { ...entry, count: item.capDeliveryMode === "PARTIAL" ? Number(item.capActualCount || 0) : bottleCount } : entry)
          : item.capBreakdown,
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

  function updateCapBreakdown(id, index, field, value) {
    onChange(saleItems.map((item) => {
      if (item.id !== id) return item;
      const breakdown = Array.isArray(item.capBreakdown) ? item.capBreakdown : [];
      return {
        ...item,
        capBreakdown: breakdown.map((entry, entryIndex) => entryIndex !== index ? entry : {
          ...entry,
          [field]: field === "count" ? Math.max(0, Math.round(Number(value || 0))) : value,
          ...(field === "capProductKey" ? { capProductName: capItems.find((cap) => cap.productKey === value)?.productName || null } : {}),
        }),
      };
    }));
  }

  function addCapBreakdown(id) {
    onChange(saleItems.map((item) => item.id !== id ? item : {
      ...item,
      capBreakdown: [...(Array.isArray(item.capBreakdown) ? item.capBreakdown : []), { capProductKey: "", capProductName: "", capLocation: item.capLocation || "မန္တလေး", count: 0 }],
    }));
  }

  function removeCapBreakdown(id, index) {
    onChange(saleItems.map((item) => item.id !== id ? item : {
      ...item,
      capBreakdown: (item.capBreakdown || []).filter((_, entryIndex) => entryIndex !== index),
    }));
  }

  function updateCapConfig(id, field, value) {
    onChange(saleItems.map((item) => {
      if (item.id !== id) return item;
      if (field === "capProductKey") {
        const cap = capItems.find((entry) => entry.productKey === value);
        const capBreakdown = Array.isArray(item.capBreakdown) && item.capBreakdown.length
          ? item.capBreakdown.map((entry, index) => index === 0 ? { ...entry, capProductKey: value || "", capProductName: cap?.productName || null } : entry)
          : item.capBreakdown;
        return { ...item, capProductKey: value || null, capProductName: cap?.productName || null, capBreakdown };
      }
      if (field === "capLocation") {
        const capBreakdown = Array.isArray(item.capBreakdown) ? item.capBreakdown.map((entry) => ({ ...entry, capLocation: value })) : item.capBreakdown;
        return { ...item, capLocation: value, capBreakdown };
      }
      if (field === "capPackSize") return { ...item, capPackSize: Number(value || 5000) };
      if (field === "capDeliveryMode") return { ...item, capDeliveryMode: value, capActualCount: value === "AUTO" ? Number(item.bottleCount || 0) : Number(item.capActualCount || 0), capNormalCount: value === "AUTO" ? Number(item.bottleCount || 0) : Number(item.capActualCount || 0), capTotalCount: (value === "AUTO" ? Number(item.bottleCount || 0) : Number(item.capActualCount || 0)) + Number(item.capExtraCount || 0) };
      if (field === "capActualCount") { const actual = Math.max(0, Math.round(Number(value || 0))); return { ...item, capActualCount: actual, capNormalCount: actual, capTotalCount: actual + Number(item.capExtraCount || 0) }; }
      const extra = Math.max(0, Math.round(Number(value || 0)));
      return { ...item, capExtraCount: extra, capTotalCount: Number(item.capNormalCount || item.bottleCount || 0) + extra };
    }));
  }

  return (
    <section className="space-y-3 rounded-xl border-2 border-violet-300 bg-violet-50/80 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-black text-violet-950">ရောင်းသည့်ဗူးများ / အဖုံး</p></div>
        <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={openPicker} disabled={disabled || !catalog.some((item) => !isTubeItem(item))} className="shrink-0 rounded-lg bg-violet-700 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">ဗူး/အဖုံး ထည့်ရန် +</button><button type="button" onClick={openTubePicker} disabled={disabled || !catalog.some(isTubeItem)} className="shrink-0 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">Tube ထည့်ရန် +</button></div>
      </div>

      {saleItems.length ? <div className="space-y-2">{saleItems.map((item) => {
        const isCap = isCapItem(item);
        const isTube = isTubeItem(item);
        const count = isCap ? Number(item.cardCount || item.unitCount || 0) : Number(item.bottleCount || 0);
        const capSummary = !isCap && !isTube ? `${item.capLocation || "မန္တလေး"} · ${item.capProductName || "အဖုံးမရွေးရသေး"}` : "";
        const cardTone = isCap ? "border-fuchsia-300 bg-fuchsia-50/70 hover:border-fuchsia-500 hover:bg-fuchsia-100" : isTube ? "border-cyan-300 bg-cyan-50/70 hover:border-cyan-500 hover:bg-cyan-100" : "border-violet-300 bg-violet-50/70 hover:border-violet-500 hover:bg-violet-100";
        return <button key={item.id} type="button" onClick={() => setEditingItemId(item.id)} className={`flex min-h-[76px] w-full items-center justify-between gap-3 rounded-xl border-2 px-3 py-3.5 text-left shadow-sm transition ${cardTone} disabled:cursor-not-allowed disabled:opacity-60`} disabled={disabled}>
          <span className="min-w-0"><span className="block whitespace-normal break-words text-base font-black leading-snug text-slate-900">{item.productName}{isCap || isTube ? ` · ${isTube ? `${item.capacity} pcs/အိတ်` : "အဖုံး"}` : ` · ${item.capacity} ဆံ့`}</span><span className="mt-1 block whitespace-normal break-words text-sm font-bold leading-snug text-slate-700">{count.toLocaleString()} {isCap ? "အဖုံး" : isTube ? "Tube" : "ဗူး"} · {formatMoney(item.pricePerBottle)}/{isCap ? "ဖုံး" : "ဗူး"} · {formatMoney(item.totalAmount)}{capSummary ? ` · ${capSummary}` : ""}</span></span><span className="flex shrink-0 items-center gap-2"><span className="rounded-lg bg-violet-100 px-2.5 py-1.5 text-xs font-black text-violet-800">ပြင်ရန်</span><span className="text-slate-400">›</span></span>
        </button>;
      })}</div> : null}

      {editingItem ? <div className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingItemId(""); }}><section role="dialog" aria-modal="true" aria-labelledby="sale-item-edit-title" className="max-h-[90dvh] w-full overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-w-xl"><div className="flex items-start justify-between gap-3 border-b border-violet-100 bg-violet-50 px-4 py-4"><div><h2 id="sale-item-edit-title" className="text-base font-black text-slate-900">{editingItem.productName} အသေးစိတ်ပြင်ရန်</h2><p className="mt-1 text-xs font-bold text-violet-700">အရေအတွက်၊ စျေးနှုန်းနှင့် အဖုံး setting ပြင်နိုင်ပါသည်။</p></div><button type="button" onClick={() => setEditingItemId("")} aria-label="အသေးစိတ်ပိတ်ရန်" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600">ပိတ်</button></div><div className="max-h-[72dvh] space-y-3 overflow-y-auto p-4"><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-600">{isCapItem(editingItem) ? "အရေအတွက်" : "ကဒ်"}<input type="number" min="1" step="1" value={editingItem.cardCount} onChange={(event) => updateCards(editingItem.id, event.target.value)} disabled={disabled} className="mt-1 h-10 w-full rounded-lg border-2 border-violet-200 px-2 text-center text-base font-black text-slate-900" /></label><label className="text-xs font-bold text-slate-600">Customer စျေး/{isCapItem(editingItem) ? "ဖုံး" : "ဗူး"}<input type="number" min="0" step="1" value={editingItem.customerPricePerBottle ?? editingItem.pricePerBottle} onChange={(event) => updatePrice(editingItem.id, event.target.value)} disabled={disabled} className="mt-1 h-10 w-full rounded-lg border-2 border-violet-200 px-2 text-right text-base font-black text-slate-900" /></label></div><p className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-bold text-slate-600">{isCapItem(editingItem) ? `${editingItem.cardCount} အဖုံး × ${formatMoney(editingItem.pricePerBottle)} = ${formatMoney(editingItem.totalAmount)}` : `${editingItem.cardCount} ကဒ် × ${editingItem.capacity} = ${Number(editingItem.bottleCount || 0).toLocaleString()} ဗူး`}</p>{!isCapItem(editingItem) && !isTubeItem(editingItem) && capItems.length ? <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-600">နေရာ<select value={editingItem.capLocation || "မန္တလေး"} onChange={(event) => updateCapConfig(editingItem.id, "capLocation", event.target.value)} disabled={disabled} className="mt-1 h-10 w-full rounded-lg border-2 border-violet-200 bg-white px-2 text-sm font-black text-slate-900">{capLocations.map((location) => <option key={location}>{location}</option>)}</select></label><label className="text-xs font-bold text-slate-600">အဖုံးအရောင်<select value={editingItem.capProductKey || ""} onChange={(event) => updateCapConfig(editingItem.id, "capProductKey", event.target.value)} disabled={disabled} className="mt-1 h-10 w-full rounded-lg border-2 border-violet-200 bg-white px-2 text-sm font-black text-slate-900"><option value="">အဖုံး မသတ်မှတ်ရသေး</option>{capItems.map((cap) => <option key={cap.productKey} value={cap.productKey}>{editingItem.capLocation || "မန္တလေး"} · {cap.productName}</option>)}</select></label><label className="text-xs font-bold text-slate-600">အဖုံးပေးပုံ<select value={editingItem.capDeliveryMode || "AUTO"} onChange={(event) => updateCapConfig(editingItem.id, "capDeliveryMode", event.target.value)} disabled={disabled} className="mt-1 h-10 w-full rounded-lg border-2 border-violet-200 bg-white px-2 text-sm font-black text-slate-900"><option value="AUTO">ဗူးအတိုင်း Auto</option><option value="PARTIAL">အမှန်ပေးသည့်အတိုင်း</option></select></label>{editingItem.capDeliveryMode === "PARTIAL" ? <label className="text-xs font-bold text-slate-600">အမှန်ပေးအဖုံး<input type="number" min="0" step="1" value={editingItem.capActualCount ?? ""} onChange={(event) => updateCapConfig(editingItem.id, "capActualCount", event.target.value)} disabled={disabled} className="mt-1 h-10 w-full rounded-lg border-2 border-violet-200 px-2 text-center text-base font-black text-slate-900" /></label> : null}<label className="text-xs font-bold text-slate-600">တစ်အိတ်ဆံ့<select value={editingItem.capPackSize || 5000} onChange={(event) => updateCapConfig(editingItem.id, "capPackSize", event.target.value)} disabled={disabled} className="mt-1 h-10 w-full rounded-lg border-2 border-violet-200 bg-white px-2 text-sm font-black text-slate-900"><option value="5000">5000 ဆံ့ / အိတ်</option><option value="500">500 ဆံ့ / အိတ်</option><option value="100">100 ဆံ့ / အိတ်</option></select></label><label className="text-xs font-bold text-slate-600">အဖုံးအပို<input type="number" min="0" step="1" value={editingItem.capExtraCount || ""} onChange={(event) => updateCapConfig(editingItem.id, "capExtraCount", event.target.value)} disabled={disabled} className="mt-1 h-10 w-full rounded-lg border-2 border-violet-200 px-2 text-center text-base font-black text-slate-900" /><span className="mt-1 block text-[11px] text-slate-500">ပုံမှန် {Number(editingItem.capNormalCount || editingItem.bottleCount || 0).toLocaleString()} + အပို = {Number(editingItem.capTotalCount || editingItem.bottleCount || 0).toLocaleString()} ဖုံး</span></label></div> : null}<CapBreakdownEditor item={editingItem} onUpdate={updateCapBreakdown} onAdd={addCapBreakdown} onRemove={removeCapBreakdown} capItems={capItems} disabled={disabled} /></div><div className="flex gap-2 border-t border-slate-100 px-1 pb-1 pt-4"><button type="button" onClick={() => { onChange(saleItems.filter((line) => line.id !== editingItem.id)); setEditingItemId(""); }} disabled={disabled} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50">ဖျက်</button><button type="button" onClick={() => setEditingItemId("")} className="flex-1 rounded-lg bg-violet-700 px-4 py-2 text-sm font-black text-white hover:bg-violet-800">ပြီးပါပြီ</button></div></section></div> : null}

      {open ? <div className="space-y-3 rounded-xl border-2 border-violet-300 bg-white p-3 shadow-inner"><div className="flex items-center justify-between"><p className="text-sm font-black text-slate-900">{pickerMode === "tube" ? "Tube ရွေးရန်" : "ဗူး / အဖုံး ရွေးရန်"}</p><button type="button" onClick={() => setOpen(false)} className="rounded px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100">ပိတ်</button></div>{pickerMode === "product" && capItems.length ? <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-700">အဖုံးနေရာ<select value={defaultCapLocation} onChange={(event) => setDefaultCapLocation(event.target.value)} disabled={disabled} className="mt-1 h-10 w-full rounded-lg border-2 border-violet-200 bg-white px-3 text-sm font-bold text-slate-900">{capLocations.map((location) => <option key={location}>{location}</option>)}</select></label><label className="text-xs font-bold text-slate-700">ပုံမှန်အဖုံးအရောင် · {defaultCapLocation}<select value={defaultCapKey} onChange={(event) => setDefaultCapKey(event.target.value)} disabled={disabled} className="mt-1 h-10 w-full rounded-lg border-2 border-violet-200 bg-white px-3 text-sm font-bold text-slate-900"><option value="">အဖုံးအရောင်ရွေးပါ</option>{capItems.map((cap) => <option key={cap.productKey} value={cap.productKey}>{capDisplayName(cap.productName)}</option>)}</select></label></div> : null}{pickerMode === "product" ? <select value={currentCategory} onChange={(event) => { setActiveCategory(event.target.value); setSelectedKey(""); }} disabled={disabled} className="h-10 w-full rounded-lg border-2 border-violet-200 bg-violet-50 px-3 text-sm font-bold text-slate-900">{categories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}</select> : null}<label className="block text-xs font-bold text-slate-700">{pickerMode === "tube" ? "Tube အမျိုးအစား ရွေးပါ" : currentCategory === "CAP" ? "အဖုံးအရောင် ရွေးပါ" : "ဗူးဆံ့ပမာဏ ရွေးပါ"}<select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} disabled={disabled || !visibleItems.length} className="mt-1 h-10 w-full rounded-lg border-2 border-violet-200 bg-white px-3 text-sm font-bold text-slate-900"><option value="">{pickerMode === "tube" ? "Tube အမျိုးအစား ရွေးပါ" : currentCategory === "CAP" ? "အဖုံးအရောင် ရွေးပါ" : "ဗူးဆံ့ပမာဏ ရွေးပါ"}</option>{visibleItems.map((item) => <option key={item.productKey} value={item.productKey}>{isCapItem(item) ? capDisplayName(item.productName) : item.productName}{isCapItem(item) ? ` · ${formatMoney(item.effectivePrice?.pricePerBottle)}/ဖုံး` : isTubeItem(item) ? ` · ${item.capacity} pcs/အိတ် · ${item.effectivePrice?.pricePerBottle ? `${formatMoney(item.effectivePrice.pricePerBottle)}/Tube` : "စျေးမသတ်မှတ်ရသေး"}` : ` · ${item.capacity} ဆံ့ · ${item.effectivePrice?.pricePerBottle ? `${formatMoney(item.effectivePrice.pricePerBottle)}/ဗူး` : "စျေးမသတ်မှတ်ရသေး"}`}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-700">{isCapItem(selectedItem) ? "အဖုံးအရေအတွက်" : isTubeItem(selectedItem) ? "အိတ်အရေအတွက်" : "ကဒ်အရေအတွက်"}<input type="number" min="1" step="1" value={cardCount} onChange={(event) => setCardCount(event.target.value)} disabled={disabled} className="mt-1 h-10 w-full rounded-lg border-2 border-violet-200 px-3 text-center text-base font-black text-slate-900" /></label><div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-950"><p className="font-bold">အလိုအလျောက်တွက်ချက်မှု</p><p className="mt-1">{selectedItem ? (isCapItem(selectedItem) ? `${previewCards.toLocaleString()} အဖုံး × ${selectedPrice} Ks` : `${previewCards} ${isTubeItem(selectedItem) ? "အိတ်" : "ကဒ်"} × ${Number(selectedItem.bottlesPerCard || 0)} = ${previewBottles.toLocaleString()} ${isTubeItem(selectedItem) ? "Tube" : "ဗူး"}`) : "ပစ္စည်းရွေးပါ"}</p><p className="mt-1 text-xl font-black">{formatMoney(previewTotal)}</p></div></div>{error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p> : null}<button type="button" onClick={addItem} disabled={disabled || !selectedItem} className="h-10 w-full rounded-lg bg-violet-700 text-sm font-black text-white hover:bg-violet-800 disabled:opacity-50">ထည့်မည်</button></div> : null}

      {saleItems.length ? <div className="flex flex-col gap-1 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-950 sm:flex-row sm:items-center sm:justify-between"><span>စုစုပေါင်း: {totalBottles.toLocaleString()} ဗူး{totalCaps ? ` · ${totalCaps.toLocaleString()} အဖုံး` : ""}</span><span>သင့်ငွေ: {formatMoney(totalAmount)}</span></div> : null}
    </section>
  );
}
