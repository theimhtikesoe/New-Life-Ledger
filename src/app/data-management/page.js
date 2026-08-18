"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

function iso(value) {
  return value ? new Date(value).toISOString() : "";
}

function downloadBackup(data) {
  const workbook = XLSX.utils.book_new();
  const infoRows = [
    ["format", data.format],
    ["version", data.version],
    ["generatedAt", data.generatedAt],
    ["customers", data.counts.customers],
    ["transactions", data.counts.transactions],
    ["auditLogs", data.counts.auditLogs],
  ];
  const customers = data.customers.map((item) => ({ ...item, createdAt: iso(item.createdAt), deletedAt: iso(item.deletedAt) }));
  const transactions = data.transactions.map((item) => ({ ...item, date: iso(item.date), createdAt: iso(item.createdAt) }));
  const auditLogs = data.auditLogs.map((item) => ({ ...item, metadata: item.metadata ? JSON.stringify(item.metadata) : "", createdAt: iso(item.createdAt) }));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(infoRows), "Backup Info");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(customers), "Customers");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(transactions), "Transactions");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(auditLogs), "Audit History");
  workbook.Workbook = { Props: { Title: "New Life Ledger Backup", Subject: "Official restore backup" } };
  XLSX.writeFile(workbook, `New-Life-Ledger-Backup-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function sendRestore(file, mode) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);
  const actorName = localStorage.getItem("actorName") || "";
  const response = await fetch("/api/restore", { method: "POST", body: formData, headers: { "x-actor-name": actorName } });
  const body = await response.json();
  if (!response.ok) throw new Error([body.error, ...(body.details || [])].filter(Boolean).join("\n"));
  return body.data;
}

export default function DataManagementPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cronSecret, setCronSecret] = useState("");

  const handleManualReportTest = async () => {
    if (!cronSecret.trim()) return;
    if (!window.confirm("အရင်နေ့ Daily Summary ကို PDF + image အဖြစ် Telegram private chat နှင့် group နှစ်ခုလုံးသို့ အခုချက်ချင်းပို့မည်။ ဆက်လုပ်မလား?")) return;
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/cron/daily-report", { method: "POST", headers: { Authorization: `Bearer ${cronSecret.trim()}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Telegram report test မအောင်မြင်ပါ။");
      setCronSecret("");
      setMessage(`Telegram test report အောင်မြင်ပါပြီ။ ${body.date} စာရင်းကို private chat နှင့် group နှစ်ခုလုံးသို့ ပို့ပြီးပါပြီ။`);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleBackupExport = async () => {
    setLoading(true); setError(""); setMessage("");
    try {
      const actorName = localStorage.getItem("actorName") || "";
      const response = await fetch("/api/backup", { headers: { "x-actor-name": actorName } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Backup export မအောင်မြင်ပါ။");
      downloadBackup(body.data);
      setMessage(`Backup export အောင်မြင်ပါပြီ။ Customers ${body.data.counts.customers}၊ Transactions ${body.data.counts.transactions}၊ Audit ${body.data.counts.auditLogs} ခု ပါဝင်ပါတယ်။`);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true); setError(""); setMessage(""); setResult(null);
    try { setPreview(await sendRestore(file, "preview")); } catch (err) { setPreview(null); setError(err.message); } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!file || !preview) return;
    setLoading(true); setError("");
    try { setResult(await sendRestore(file, "confirm")); setMessage("Backup restore ပြီးပါပြီ။ ရှိပြီးသား record များကို မပြင်ဘဲ အသစ်မရှိသေးသော record များကိုသာ ထည့်ထားပါတယ်။"); } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="rounded-xl border border-slate-200 bg-white p-5"><a href="/" className="text-sm font-medium text-cyan-700">← Dashboard</a><h1 className="mt-2 text-2xl font-bold text-slate-900">Data Management</h1><p className="mt-1 text-sm text-slate-600">Website backup export နှင့် နောင်တွင် ပြန်တင်ရန် restore စီမံခန့်ခွဲရာနေရာ</p></header>
        {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{message}</p>}
        {error && <pre className="whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</pre>}

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Backup Data အားလုံး Export</h2><p className="mt-2 text-sm text-slate-600">Customers၊ Transactions၊ Activity History ကို restore ပြန်လုပ်နိုင်သော official Excel format ဖြင့် download လုပ်ပါ။</p><button type="button" onClick={handleBackupExport} disabled={loading} className="mt-5 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400">{loading ? "လုပ်ဆောင်နေသည်..." : "Backup Excel Download"}</button></div>
          <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Backup Restore</h2><p className="mt-2 text-sm text-slate-600">ဒီ website က ထုတ်ထားသော `New-Life-Ledger-Backup-*.xlsx` ဖိုင်ကိုသာ ပြန်တင်ပါ။ အရင်ဆုံး preview စစ်ပြီးမှ confirm restore လုပ်ရပါမယ်။</p><input type="file" accept=".xlsx,.xls" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setResult(null); setError(""); }} className="mt-4 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm" /><button type="button" onClick={handlePreview} disabled={!file || loading} className="mt-3 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400">Preview Restore</button></div>
        </section>

        <section className="rounded-xl border border-violet-200 bg-violet-50 p-5">
          <h2 className="text-lg font-semibold text-violet-900">Telegram Report Test</h2>
          <p className="mt-2 text-sm text-violet-800">အခုချက်ချင်း အရင်နေ့စာရင်းကို PDF + summary image အဖြစ် Telegram private chat နှင့် group နှစ်ခုလုံးသို့ စမ်းပို့ရန် အသုံးပြုပါ။ Secret ကို browser ထဲမသိမ်းဘဲ ဒီတစ်ကြိမ်အတွက်သာ အသုံးပြုပါမယ်။</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input type="password" value={cronSecret} onChange={(e) => setCronSecret(e.target.value)} placeholder="CRON_SECRET ကို ထည့်ပါ" autoComplete="off" className="min-w-0 flex-1 rounded-lg border border-violet-300 bg-white px-3 py-3 text-sm" />
            <button type="button" onClick={handleManualReportTest} disabled={!cronSecret.trim() || loading} className="rounded-lg bg-violet-600 px-4 py-3 font-semibold text-white hover:bg-violet-700 disabled:bg-slate-400">Send Test Report</button>
          </div>
          <p className="mt-2 text-xs text-violet-700">မအောင်မြင်ပါက CRON_SECRET မှန်/မမှန်နှင့် Vercel Production environment ထဲ ထည့်ထား/မထား စစ်ပါ။</p>
        </section>

        {preview && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-lg font-semibold text-amber-900">Restore Preview</h2><p className="mt-2 text-sm text-amber-800">အောက်ပါ record များကိုသာ ထည့်မည်။ ရှိပြီးသား record များကို Update/Delete မလုပ်ပါ။</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Customer ထည့်မည်</p><p className="text-xl font-bold text-slate-900">{preview.willAdd.customers}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Transaction ထည့်မည်</p><p className="text-xl font-bold text-slate-900">{preview.willAdd.transactions}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Audit ထည့်မည်</p><p className="text-xl font-bold text-slate-900">{preview.willAdd.auditLogs}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Skip လုပ်မည်</p><p className="text-xl font-bold text-slate-900">{preview.willSkip.customers + preview.willSkip.transactions + preview.willSkip.auditLogs}</p></div></div><button type="button" onClick={handleConfirm} disabled={loading} className="mt-5 rounded-lg bg-amber-600 px-4 py-3 font-semibold text-white hover:bg-amber-700 disabled:bg-slate-400">Confirm Restore</button></section>}
        {result && <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="text-lg font-semibold text-emerald-900">Restore Result</h2><p className="mt-2 text-sm text-emerald-800">Customer {result.result.addedCustomers}၊ Transaction {result.result.addedTransactions}၊ Audit {result.result.addedAuditLogs} ခု ထည့်ပြီးပါပြီ။</p></section>}

        <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold text-slate-900">Backup သုံးစွဲပုံ</h2><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600"><li>အရင်ဆုံး Backup Excel Download ဖြင့် official backup ထုတ်ပါ။</li><li>ဖိုင်ကို လုံခြုံသောနေရာတွင် သိမ်းပါ။</li><li>နောင်တွင် restore လိုပါက file ရွေးပြီး Preview Restore လုပ်ပါ။</li><li>Preview အရေအတွက်မှန်မှသာ Confirm Restore နှိပ်ပါ။</li></ol></section>
      </div>
    </main>
  );
}
