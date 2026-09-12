'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const number = (value) => Number(value || 0).toLocaleString();
const dateLabel = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Yangon', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
};
const kindLabel = { STOCK_MOVEMENT: 'Stock Movement', PRODUCTION: 'Production', TRANSACTION: 'Ledger', CASH_SALE: 'Cash Sale', AUDIT: 'Activity' };
const kindTone = { STOCK_MOVEMENT: 'border-orange-200 bg-orange-50 text-orange-800', PRODUCTION: 'border-emerald-200 bg-emerald-50 text-emerald-800', TRANSACTION: 'border-cyan-200 bg-cyan-50 text-cyan-800', CASH_SALE: 'border-sky-200 bg-sky-50 text-sky-800', AUDIT: 'border-slate-200 bg-slate-50 text-slate-700' };

function ItemBreakdown({ saleItems }) {
  if (!Array.isArray(saleItems) || !saleItems.length) return null;
  return <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Sale / Consumption Breakdown</p>
    {saleItems.map((item, index) => {
      const caps = Array.isArray(item.capBreakdown) ? item.capBreakdown : [];
      return <div key={`${item.productKey || item.productName || 'item'}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <p className="font-black text-slate-900">{item.productName || item.tubeType || 'Item'} {item.capacity ? `${item.capacity} ဆံ့` : ''}</p>
        <p className="mt-1 text-slate-600">{number(item.bottleCount || item.unitCount || item.cardCount)} {item.unitLabel || (item.productType === 'tube' ? 'pcs' : 'ဗူး')} · {number(item.cardCount)} ကဒ်</p>
        <p className="mt-1 break-all text-[11px] font-bold text-slate-400">Product Key: {item.productKey || '—'}{item.capLocation ? ` · နေရာ: ${item.capLocation}` : ''}</p>
        {caps.length ? <div className="mt-2 flex flex-wrap gap-2">{caps.map((cap, capIndex) => <span key={`${cap.capProductKey || cap.capProductName}-${capIndex}`} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">{cap.capProductName || cap.capProductKey}: {number(cap.count)} ဖုံး</span>)}</div> : null}
        {caps.length ? <p className="mt-2 text-xs font-bold text-slate-500">အဖုံးစုစုပေါင်း: {number(caps.reduce((sum, cap) => sum + Number(cap.count || 0), 0))} ဖုံး · Pack {number(item.capPackSize || 0)}</p> : null}
      </div>;
    })}
  </div>;
}

export default function TracePage() {
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ total: 0, movements: 0, productions: 0, transactions: 0, activities: 0 });
  const [dataSource, setDataSource] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('limit', '300');
      const response = await fetch(`/api/trace?${params.toString()}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Trace data ရယူ၍ မရပါ။');
      setItems(body.data?.items || []);
      setCounts(body.data?.counts || {});
      setDataSource(body.data?.dataSource || '');
      setSelectedId('');
    } catch (loadError) {
      setError(loadError.message || 'Trace data ရယူ၍ မရပါ။');
    } finally {
      setLoading(false);
    }
  }, [from, query, to]);

  useEffect(() => {
    if (query.trim() || from || to) load();
  }, [from, load, query, to]);
  const selected = useMemo(() => items.find((item) => item.id === selectedId), [items, selectedId]);

  return <main className="min-h-screen bg-transparent px-3 pb-10 pt-5 sm:px-6">
    <section className="mx-auto max-w-7xl rounded-3xl border border-cyan-200 bg-white/95 p-4 shadow-xl shadow-cyan-950/5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">Trace / Lineage Center</p><h2 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">ကုန်ပစ္စည်း လမ်းကြောင်းလိုက်ကြည့်ရန်</h2><p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-600">Production → Stock → Sale → အဖုံးအသုံးပြုမှု → Customer အထိ ရှိပြီးသားစာရင်းများကို read-only အနေနဲ့ တစ်နေရာတည်းက ပြန်လိုက်ကြည့်နိုင်ပါသည်။</p></div>
        <Link href="/" className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-center text-sm font-black text-cyan-800 hover:bg-cyan-100">← Dashboard</Link>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_170px_auto]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') load(); }} placeholder="ဗူး / Tube / အဖုံး / Customer / Transaction ရှာရန်" className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none ring-cyan-300 focus:ring-2" />
        <label className="flex min-w-0 flex-col gap-1 text-xs font-black text-slate-600"><span>စတင်ရက်</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900" aria-label="စတင်ရက်" /></label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-black text-slate-600"><span>ပြီးဆုံးရက်</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900" aria-label="ပြီးဆုံးရက်" /></label>
        <button type="button" onClick={load} disabled={loading} className="h-12 rounded-xl bg-cyan-700 px-5 text-sm font-black text-white hover:bg-cyan-800 disabled:opacity-50">{loading ? 'ရှာနေသည်…' : 'Trace ရှာမည်'}</button>
      </div>
      {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[['စုစုပေါင်း', counts.total], ['Stock', counts.movements], ['Production', counts.productions], ['Sale', counts.transactions], ['Activity', counts.activities]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{number(value)}</p></div>)}
      </div>
      <p className="mt-4 text-xs font-bold text-slate-500">Data source: {dataSource || 'loading'} · ရှိပြီးသား data ကို မပြင်ဘဲ ဖတ်ရှုခြင်းသာ ဖြစ်ပါသည်။</p>
    </section>
    <section className="mx-auto mt-5 grid max-w-7xl gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-3">
        {items.length ? items.map((item) => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${selectedId === item.id ? 'border-cyan-500 ring-2 ring-cyan-200' : 'border-slate-200'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[11px] font-black ${kindTone[item.kind] || kindTone.AUDIT}`}>{kindLabel[item.kind] || item.kind}</span><span className="text-xs font-bold text-slate-500">{dateLabel(item.date)}</span></div><p className="mt-2 break-words font-black text-slate-900">{item.title}</p><p className="mt-1 break-words text-xs font-bold text-slate-500">{item.subtitle}</p></div><span className="shrink-0 text-xs font-black text-cyan-700">အသေးစိတ် →</span></div>
        </button>) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><p className="font-black text-slate-800">Trace စတင်ရန် Customer / ဗူး / Tube / အဖုံး သို့မဟုတ် ရက်စွဲ ရွေးပါ</p><p className="mt-2 text-sm font-bold leading-6 text-slate-500">ရှာဖွေမှုမရှိဘဲ stock အားလုံးကို မတင်ထားပါ။ ဒါက database ကို မနှေးစေဖို့နဲ့ ရှိပြီးသား data ကို လုံခြုံစွာ ဖတ်နိုင်ဖို့ ဖြစ်ပါတယ်။</p></div>}
      </div>
      <aside className="h-fit rounded-2xl border border-cyan-200 bg-white p-4 shadow-lg lg:sticky lg:top-4">
        {selected ? <><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-cyan-700">Selected Trace Event</p><h3 className="mt-2 break-words text-lg font-black text-slate-900">{selected.title}</h3></div><button type="button" onClick={() => setSelectedId('')} className="rounded-lg border border-slate-200 px-2 py-1 text-sm font-black text-slate-500">×</button></div><dl className="mt-4 space-y-3 text-sm"><div><dt className="font-black text-slate-500">Date</dt><dd className="font-bold text-slate-900">{dateLabel(selected.date)}</dd></div><div><dt className="font-black text-slate-500">Source</dt><dd className="break-all font-bold text-slate-900">{selected.sourceType} / {selected.sourceId || '—'}</dd></div><div><dt className="font-black text-slate-500">Product / Stock</dt><dd className="font-bold text-slate-900">{selected.productName || selected.productKey || '—'}{selected.stockType ? ` · ${selected.stockType}` : ''}</dd></div><div><dt className="font-black text-slate-500">Quantity</dt><dd className="font-bold text-slate-900">{selected.quantity !== undefined ? `${number(selected.quantity)} ${selected.unit || ''}` : selected.amount !== undefined ? `${number(selected.amount)} Ks` : '—'}</dd></div><div><dt className="font-black text-slate-500">Customer</dt><dd className="font-bold text-slate-900">{selected.customerName || '—'}</dd></div></dl><div className="mt-4 flex flex-wrap gap-2">{selected.sourceType === 'LEDGER' ? <Link href="/ledger" className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800">Ledger သို့သွားရန်</Link> : null}{selected.sourceType === 'CASH_SALE' ? <Link href="/daily-bottle-sales" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black text-sky-800">Cash Sale သို့သွားရန်</Link> : null}{selected.kind === 'STOCK_MOVEMENT' ? <Link href="/factory-stock" className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-800">Factory Stock သို့သွားရန်</Link> : null}{selected.kind === 'AUDIT' ? <Link href="/activity" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">Activity သို့သွားရန်</Link> : null}</div><ItemBreakdown saleItems={selected.saleItems} />{selected.reason || selected.note ? <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"><p className="font-black text-slate-500">မှတ်ချက်</p><p className="mt-1 whitespace-pre-wrap font-bold text-slate-800">{selected.reason || selected.note}</p></div> : null}</> : <div className="py-12 text-center"><p className="text-4xl" aria-hidden="true">🔎</p><p className="mt-3 font-black text-slate-900">Trace row တစ်ကြောင်း ရွေးပါ</p><p className="mt-1 text-sm font-bold leading-6 text-slate-500">Source ID, stock movement, customer နဲ့ အဖုံး breakdown ကို ဒီနေရာမှာ ကြည့်နိုင်ပါမယ်။</p></div>}
      </aside>
    </section>
  </main>;
}
