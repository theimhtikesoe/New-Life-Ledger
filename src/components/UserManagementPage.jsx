"use client";

import { useEffect, useMemo, useState } from "react";
import { encodeActorHeader } from "@/lib/actor-header";
import { ACTORS, USER_ROLES, defaultUserRole } from "@/lib/user-permissions";

const ROLE_LABELS = {
  Manager: "စီမံခန့်ခွဲသူ",
  Accountant: "စာရင်းကိုင်",
  Production: "ထုတ်လုပ်မှု",
  Sales: "အရောင်း / Customer",
  Viewer: "ကြည့်ရှုရန်သာ",
};

const ACTION_LABELS = {
  PAYMENT: "ငွေချေ",
  DEBT_INCREASE: "အကြွေးတိုး",
  CASH_SALE: "လက်ငင်းရောင်း",
  CREATE: "အသစ်ထည့်",
  UPDATE: "ပြင်ဆင်",
  DELETE: "ဖျက်",
  RESTORE: "ပြန်ယူ",
};

function formatDate(value) {
  if (!value) return "မရှိသေးပါ";
  return new Intl.DateTimeFormat("my-MM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function money(value) {
  const amount = Number(value || 0);
  return amount ? `${amount.toLocaleString()} Ks` : "—";
}

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [selectedActor, setSelectedActor] = useState(ACTORS[0]);
  const [activities, setActivities] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const selectedUser = users.find((user) => user.actorName === selectedActor) || users[0];
  const visibleUsers = useMemo(() => users.filter((user) => user.actorName.toLowerCase().includes(query.trim().toLowerCase())), [users, query]);
  const activitySummary = useMemo(() => ({
    total: activities.length,
    money: activities.reduce((sum, item) => sum + Number(item.metadata?.amount || 0), 0),
    last: activities[0]?.createdAt || null,
  }), [activities]);

  const actorHeaders = () => ({ "x-actor-name": encodeActorHeader(localStorage.getItem("actorName") || "") });

  useEffect(() => {
    fetch("/api/user-permissions", { headers: actorHeaders(), cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "User data ရယူ၍မရပါ။");
        setUsers((body.data || []).map((user) => ({ ...user, role: user.role || defaultUserRole(user.actorName), active: user.active !== false })));
        setCanManage(Boolean(body.canManage));
      })
      .catch((loadError) => setError(loadError.message || "User data ရယူ၍မရပါ။"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedActor) return;
    setActivityLoading(true);
    fetch(`/api/audit-logs?actor=${encodeURIComponent(selectedActor)}&limit=20`, { headers: actorHeaders(), cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Activity History ရယူ၍မရပါ။");
        setActivities(body.data || []);
      })
      .catch(() => setActivities([]))
      .finally(() => setActivityLoading(false));
  }, [selectedActor]);

  const updateSelected = (field, value) => setUsers((current) => current.map((user) => user.actorName === selectedActor ? { ...user, [field]: value } : user));

  const saveUser = async (event) => {
    event.preventDefault();
    if (!canManage || !selectedUser || saving) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/user-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...actorHeaders() },
        body: JSON.stringify({ permissions: [{ actorName: selectedUser.actorName, role: selectedUser.role, active: selectedUser.active, note: selectedUser.note || "" }] }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "User profile သိမ်း၍မရပါ။");
      const saved = body.data?.[0];
      if (saved) setUsers((current) => current.map((user) => user.actorName === selectedActor ? { ...user, ...saved } : user));
      setMessage(`${selectedUser.actorName} ရဲ့ Role / status ကို သိမ်းပြီးပါပြီ။`);
    } catch (saveError) {
      setError(saveError.message || "User profile သိမ်း၍မရပါ။");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="app-page-main">
      <div className="app-page-container app-page-surface space-y-5">
        <section className="rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-black tracking-[0.16em] text-cyan-700">TEAM · USER MANAGEMENT</p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">User & Activity Management</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Permission checkbox များအစား User တစ်ယောက်ချင်းစီရဲ့ Role, လက်ရှိအသုံးပြုနိုင်မှုနဲ့ လုပ်ဆောင်ချက်မှတ်တမ်းကို စီမံနိုင်ပါပြီ။</p>
        </section>
        {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">User data ရယူနေပါသည်...</section> : error && !users.length ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">{error}</section> : (
          <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between"><h3 className="px-2 text-sm font-black text-slate-700">Users</h3><span className="rounded-full bg-cyan-50 px-2 py-1 text-xs font-black text-cyan-700">{users.length}</span></div>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="User ရှာရန်" className="mb-3 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-cyan-500" />
              <div className="grid gap-2">{visibleUsers.map((user) => <button key={user.actorName} type="button" onClick={() => { setSelectedActor(user.actorName); setMessage(""); setError(""); }} className={`rounded-xl border px-3 py-3 text-left transition ${selectedActor === user.actorName ? "border-cyan-400 bg-cyan-50 shadow-sm" : "border-slate-200 bg-slate-50 hover:border-cyan-200"}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-black text-slate-800">{user.actorName}</span><span className={`h-2.5 w-2.5 rounded-full ${user.active ? "bg-emerald-500" : "bg-slate-300"}`} /></div><div className="mt-1 text-xs font-bold text-slate-500">{ROLE_LABELS[user.role] || user.role}</div></button>)}</div>
            </section>
            <div className="space-y-5">
              <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><p className="text-xs font-black text-violet-700">လက်ရှိ Role</p><p className="mt-2 text-xl font-black text-violet-950">{ROLE_LABELS[selectedUser?.role] || selectedUser?.role || "—"}</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black text-emerald-700">Activity အရေအတွက်</p><p className="mt-2 text-xl font-black text-emerald-950">{activitySummary.total} ခု</p></div><div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4"><p className="text-xs font-black text-cyan-700">Activity ပမာဏ</p><p className="mt-2 text-xl font-black text-cyan-950">{money(activitySummary.money)}</p></div></section>
              <form onSubmit={saveUser} className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-black text-slate-900">{selectedUser?.actorName || "User"}</h3><p className="mt-1 text-xs font-bold text-slate-500">နောက်ဆုံးတွေ့ရှိချိန်: {formatDate(selectedUser?.lastSeenAt)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${selectedUser?.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{selectedUser?.active ? "Active" : "Inactive"}</span></div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-black text-slate-700">Role<select disabled={!canManage} value={selectedUser?.role || "Viewer"} onChange={(event) => updateSelected("role", event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-bold text-slate-800"><option value="">ရွေးပါ</option>{USER_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]} ({role})</option>)}</select></label><label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-black text-slate-700"><input type="checkbox" checked={selectedUser?.active !== false} disabled={!canManage} onChange={(event) => updateSelected("active", event.target.checked)} className="h-5 w-5 accent-emerald-600" /> User Active ဖြစ်သည်</label></div>
                <label className="mt-4 block text-sm font-black text-slate-700">တာဝန် / မှတ်ချက်<textarea disabled={!canManage} value={selectedUser?.note || ""} onChange={(event) => updateSelected("note", event.target.value)} rows={3} placeholder="ဥပမာ — မနက်ပိုင်း production report တာဝန်" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-800 outline-none focus:border-cyan-500" /></label>
                {canManage ? <button type="submit" disabled={saving} className="mt-4 w-full rounded-xl bg-cyan-600 px-4 py-3 font-black text-white hover:bg-cyan-700 disabled:opacity-50">{saving ? "သိမ်းနေပါသည်..." : "User Profile သိမ်းမည်"}</button> : <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">Role / status ပြင်ရန် ဖေဖေ/မေမေ User ဖြင့် ဝင်ပါ။ Activity History ကိုတော့ ကြည့်နိုင်ပါသည်။</p>}
                {message ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p> : null}{error && users.length ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
              </form>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-xl font-black text-slate-900">Activity History</h3><p className="mt-1 text-xs font-bold text-slate-500">{selectedUser?.actorName || "User"} ရဲ့ နောက်ဆုံးလုပ်ဆောင်ချက်များ</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">နောက်ဆုံး {activities.length} ခု</span></div>{activityLoading ? <p className="mt-5 rounded-xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">Activity ရယူနေပါသည်...</p> : activities.length ? <div className="mt-4 grid gap-2">{activities.map((item) => <article key={`${item.id}-${item.createdAt}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-cyan-100 px-2 py-1 text-xs font-black text-cyan-700">{ACTION_LABELS[item.action] || item.action}</span><time className="text-xs font-bold text-slate-500">{formatDate(item.createdAt)}</time></div><p className="mt-2 text-sm font-black text-slate-800">{item.entityLabel || item.entityType || "—"}</p><p className="mt-1 text-xs font-semibold text-slate-600">{item.summary || "—"}</p>{item.metadata?.amount ? <p className="mt-2 text-sm font-black text-slate-900">{money(item.metadata.amount)}</p> : null}</article>)}</div> : <p className="mt-5 rounded-xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">ဒီ User ရဲ့ Activity မရှိသေးပါ။</p>}</section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
