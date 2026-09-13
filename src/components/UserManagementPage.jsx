"use client";

import { useEffect, useMemo, useState } from "react";
import { encodeActorHeader } from "@/lib/actor-header";
import { ACTORS, PERMISSION_PAGES, defaultAllowedPaths } from "@/lib/user-permissions";

export default function UserManagementPage() {
  const [permissions, setPermissions] = useState(() => ACTORS.map((actorName) => ({ actorName, allowedPaths: defaultAllowedPaths(actorName) })));
  const [selectedActor, setSelectedActor] = useState(ACTORS[0]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const actor = permissions.find((row) => row.actorName === selectedActor) || permissions[0];

  useEffect(() => {
    const actorName = localStorage.getItem("actorName") || "";
    fetch("/api/user-permissions", { headers: { "x-actor-name": encodeActorHeader(actorName) }, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Permission မရယူနိုင်ပါ။");
        setPermissions(body.data || []);
        setCanManage(Boolean(body.canManage));
      })
      .catch((loadError) => {
        if (actorName === "ဖေဖေ/မေမေ") {
          setCanManage(true);
          setPermissions(ACTORS.map((name) => ({ actorName: name, allowedPaths: defaultAllowedPaths(name) })));
          setMessage("လက်ရှိ default permission ကို ပြထားပါသည်။ Database connection ပြန်ရသောအခါ သိမ်းနိုင်ပါမည်။");
        } else {
          setError(loadError.message || "Permission မရယူနိုင်ပါ။");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedCount = actor?.allowedPaths?.length || 0;
  const updateSelected = (nextPaths) => setPermissions((current) => current.map((row) => row.actorName === selectedActor ? { ...row, allowedPaths: nextPaths } : row));
  const togglePath = (path) => {
    const current = new Set(actor?.allowedPaths || []);
    if (current.has(path)) current.delete(path); else current.add(path);
    updateSelected([...current]);
  };
  const allSelected = useMemo(() => selectedCount === PERMISSION_PAGES.length, [selectedCount]);
  const savePermissions = async (event) => {
    event.preventDefault();
    if (!canManage || saving) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/user-permissions", { method: "PUT", headers: { "Content-Type": "application/json", "x-actor-name": encodeActorHeader(localStorage.getItem("actorName") || "") }, body: JSON.stringify({ permissions }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Permission သိမ်း၍မရပါ။");
      setPermissions(body.data || permissions);
      setMessage("User permission များ အောင်မြင်စွာ သိမ်းပြီးပါပြီ။");
    } catch (saveError) { setError(saveError.message); } finally { setSaving(false); }
  };

  return (
    <main className="app-page-main">
      <div className="app-page-container app-page-surface space-y-5">
        <section className="rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-black tracking-wide text-cyan-700">SETTINGS · ACCESS CONTROL</p><h2 className="mt-1 text-2xl font-black text-slate-900">User Management</h2><p className="mt-1 text-sm text-slate-600">User တစ်ယောက်ချင်းစီ သုံးခွင့်ရှိတဲ့ Page / Link ကို ရွေးပေးနိုင်ပါပြီ။</p></div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">ပြင်ခွင့်: ဖေဖေ/မေမေ</span>
          </div>
        </section>
        {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">Permission data ရယူနေပါသည်...</section> : error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">{error}</section> : !canManage ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 font-bold text-amber-800">ဒီ Page ကို Permission ပြင်ရန် ဖေဖေ/မေမေ User ဖြင့် ဝင်ပါ။</section> : (
          <form onSubmit={savePermissions} className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><h3 className="px-2 pb-2 text-sm font-black text-slate-700">User များ</h3><div className="grid gap-2">{permissions.map((row) => <button key={row.actorName} type="button" onClick={() => setSelectedActor(row.actorName)} className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left text-sm font-black transition ${selectedActor === row.actorName ? "border-cyan-400 bg-cyan-50 text-cyan-900 shadow-sm" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/50"}`}><span>{row.actorName}</span><span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500">{row.allowedPaths.length}</span></button>)}</div></section>
            <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3"><div><h3 className="text-lg font-black text-slate-900">{selectedActor}</h3><p className="mt-1 text-xs font-bold text-slate-500">{selectedCount} / {PERMISSION_PAGES.length} pages ခွင့်ပြုထားသည်</p></div><div className="flex gap-2"><button type="button" onClick={() => updateSelected(PERMISSION_PAGES.map((page) => page.path))} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">အားလုံးပေးမည်</button><button type="button" onClick={() => updateSelected([])} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">အားလုံးဖြုတ်မည်</button></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{PERMISSION_PAGES.map((page) => { const checked = actor.allowedPaths.includes(page.path); return <label key={page.path} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${checked ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-slate-50"}`}><input type="checkbox" checked={checked} onChange={() => togglePath(page.path)} className="h-5 w-5 accent-cyan-600" /><span><span className="block text-sm font-black text-slate-800">{page.label}</span><span className="block text-[11px] font-bold text-slate-500">{page.path}</span></span></label>; })}</div><button type="submit" disabled={saving} className="mt-5 w-full rounded-xl bg-cyan-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-700 disabled:opacity-50">{saving ? "သိမ်းနေပါသည်..." : "Permission သိမ်းမည်"}</button>{message ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p> : null}</section>
          </form>
        )}
      </div>
    </main>
  );
}
