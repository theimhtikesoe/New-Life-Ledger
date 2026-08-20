"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { encodeActorHeader } from "@/lib/actor-header";
import { formatMyanmarDateTime } from "@/lib/myanmar-time-client";

function iso(value) {
  return value ? new Date(value).toISOString() : "";
}

function downloadBackup(data) {
  const workbook = XLSX.utils.book_new();
  const counts = data.counts || {};
  const infoRows = [
    ["format", data.format],
    ["version", data.version],
    ["generatedAt", data.generatedAt],
    ["customers", counts.customers || 0],
    ["transactions", counts.transactions || 0],
    ["kpayAliases", counts.kpayAliases || 0],
    ["unverifiedKpay", counts.unverifiedKpay || 0],
    ["auditLogs", counts.auditLogs || 0],
  ];
  const customers = (data.customers || []).map((item) => ({ ...item, createdAt: iso(item.createdAt), deletedAt: iso(item.deletedAt) }));
  const transactions = (data.transactions || []).map((item) => ({ ...item, date: iso(item.date), createdAt: iso(item.createdAt) }));
  const kpayAliases = (data.kpayAliases || []).map((item) => ({ ...item }));
  const unverifiedKpay = (data.unverifiedKpay || []).map((item) => ({ ...item, createdAt: iso(item.createdAt) }));
  const auditLogs = (data.auditLogs || []).map((item) => ({ ...item, metadata: item.metadata ? JSON.stringify(item.metadata) : "", createdAt: iso(item.createdAt) }));
  const integrityRows = Object.entries(data.integrity || {}).map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value) : value ?? ""]);

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(infoRows), "Backup Info");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(customers), "Customers");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(transactions), "Transactions");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(kpayAliases), "KPay Aliases");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(unverifiedKpay), "Pending KPay");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(auditLogs), "Audit History");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["key", "value"], ...integrityRows]), "Integrity");
  workbook.Workbook = { Props: { Title: "New Life Ledger Backup", Subject: "Official restore backup with all entities and integrity checks" } };
  XLSX.writeFile(workbook, `New-Life-Ledger-Backup-v${data.version || 2}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function downloadReportExcel(customers) {
  const workbook = XLSX.utils.book_new();

  customers.forEach((customer) => {
    const sortedTransactions = [...(customer.ledgers || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    const rows = [
      ["Customer Name:", customer.name],
      ["Phone:", customer.phone || "-"],
      ["Current Total Balance:", customer.current_balance],
      [],
      ["ရက်စွဲ (Date)", "အမျိုးအစား (Type)", "ငွေပေးချေမှု (Payment)", "ပမာဏ (Amount)", "အကြွေးလက်ကျန် (Balance)", "မှတ်ချက် (Note)"],
    ];

    sortedTransactions.forEach((transaction) => {
      runningBalance += transaction.type === "CREDIT" ? transaction.amount : -transaction.amount;
      rows.push([
        formatMyanmarDateTime(transaction.date),
        transaction.type === "CREDIT" ? "အကြွေးတိုး (+)" : "ငွေချေ (-)",
        transaction.paymentType || "-",
        transaction.amount,
        runningBalance,
        transaction.note || "-",
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 20 },
      { wch: 35 },
    ];

    let sheetName = String(customer.name || `Customer-${customer.id}`).replace(/[\\/?*[\]]/g, "").substring(0, 31) || `Customer-${customer.id.substring(0, 8)}`;
    let finalSheetName = sheetName;
    let counter = 1;
    while (workbook.SheetNames.includes(finalSheetName)) {
      finalSheetName = `${sheetName.substring(0, 28)}-${counter}`;
      counter += 1;
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, finalSheetName);
  });

  XLSX.writeFile(workbook, `New-Life-Ledger-Full-Export-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function sendRestore(file, mode) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);
  const actorName = localStorage.getItem("actorName") || "";
  const response = await fetch("/api/restore", { method: "POST", body: formData, headers: { "x-actor-name": encodeActorHeader(actorName) } });
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
    if (!window.confirm("အရင်နေ့ Daily Summary ကို PDF + image အဖြစ် Telegram group တစ်ခုတည်းသို့ အခုချက်ချင်းပို့မည်။ ဆက်လုပ်မလား?")) return;
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/cron/daily-report", { method: "POST", headers: { Authorization: `Bearer ${cronSecret.trim()}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Telegram report test မအောင်မြင်ပါ။");
      setCronSecret("");
      setMessage(`Telegram test report အောင်မြင်ပါပြီ။ ${body.date} စာရင်း၏ PDF နှင့် image ကို Telegram group တစ်ခုတည်းသို့ ပို့ပြီးပါပြီ။`);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleBackupExport = async () => {
    setLoading(true); setError(""); setMessage("");
    try {
      const actorName = localStorage.getItem("actorName") || "";
      const response = await fetch("/api/backup", { headers: { "x-actor-name": encodeActorHeader(actorName) } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Backup export မအောင်မြင်ပါ။");
      downloadBackup(body.data);
      setMessage(`Backup export အောင်မြင်ပါပြီ။ Customers ${body.data.counts.customers}၊ Transactions ${body.data.counts.transactions}၊ KPay Alias ${body.data.counts.kpayAliases}၊ Pending KPay ${body.data.counts.unverifiedKpay}၊ Audit ${body.data.counts.auditLogs} ခု ပါဝင်ပြီး balance mismatch ${body.data.integrity.balanceMismatchCount} ခု ဖြစ်ပါတယ်။`);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleReportExport = async () => {
    setLoading(true); setError(""); setMessage("");
    try {
      const actorName = localStorage.getItem("actorName") || "";
      const response = await fetch("/api/customers?includeLedgers=true", {
        headers: { "x-actor-name": encodeActorHeader(actorName) },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Report Excel export မအောင်မြင်ပါ။");
      const customers = Array.isArray(body.data) ? body.data : [];
      if (!customers.length) throw new Error("Report Excel ထုတ်ရန် customer data မရှိသေးပါ။");
      downloadReportExcel(customers);
      setMessage(`Report Excel အောင်မြင်စွာ ထွက်လာပါပြီ။ Customers ${customers.length} ယောက် ပါဝင်ပါတယ်။`);
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
          <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Backup Data အားလုံး Export</h2><p className="mt-2 text-sm text-slate-600">Customers၊ Transactions၊ KPay Alias၊ Pending KPay၊ Activity History နှင့် Integrity စစ်ဆေးချက်များအားလုံးပါသော official Excel backup ကို download လုပ်ပါ။</p><button type="button" onClick={handleBackupExport} disabled={loading} className="mt-5 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400">{loading ? "လုပ်ဆောင်နေသည်..." : "Backup Excel Download"}</button></div>
          <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Backup Restore</h2><p className="mt-2 text-sm text-slate-600">ဒီ website က ထုတ်ထားသော `New-Life-Ledger-Backup-*.xlsx` ဖိုင်ကိုသာ ပြန်တင်ပါ။ အရင်ဆုံး preview စစ်ပြီးမှ confirm restore လုပ်ရပါမယ်။</p><input type="file" accept=".xlsx,.xls" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setResult(null); setError(""); }} className="mt-4 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm" /><button type="button" onClick={handlePreview} disabled={!file || loading} className="mt-3 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400">Preview Restore</button></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm md:col-span-2"><h2 className="text-lg font-semibold text-emerald-900">📊 Report Excel</h2><p className="mt-2 text-sm text-emerald-800">Customer တစ်ယောက်ချင်းစီ၏ လက်ကျန်နှင့် ငွေချေ/အကြွေးတိုးစာရင်းများကို Excel ဖိုင်အဖြစ် ထုတ်ယူပါ။</p><button type="button" onClick={handleReportExport} disabled={loading} className="mt-5 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400">{loading ? "လုပ်ဆောင်နေသည်..." : "📊 Report Excel ထုတ်ရန်"}</button></div>
        </section>

        <section className="rounded-xl border border-violet-200 bg-violet-50 p-5">
          <h2 className="text-lg font-semibold text-violet-900">Telegram Report Test</h2>
          <p className="mt-2 text-sm text-violet-800">အခုချက်ချင်း အရင်နေ့စာရင်းကို PDF + summary image အဖြစ် Telegram group တစ်ခုတည်းသို့ စမ်းပို့ရန် အသုံးပြုပါ။ Secret ကို browser ထဲမသိမ်းဘဲ ဒီတစ်ကြိမ်အတွက်သာ အသုံးပြုပါမယ်။</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input type="password" value={cronSecret} onChange={(e) => setCronSecret(e.target.value)} placeholder="CRON_SECRET ကို ထည့်ပါ" autoComplete="off" className="min-w-0 flex-1 rounded-lg border border-violet-300 bg-white px-3 py-3 text-sm" />
            <button type="button" onClick={handleManualReportTest} disabled={!cronSecret.trim() || loading} className="rounded-lg bg-violet-600 px-4 py-3 font-semibold text-white hover:bg-violet-700 disabled:bg-slate-400">Send Test Report</button>
          </div>
          <p className="mt-2 text-xs text-violet-700">မအောင်မြင်ပါက CRON_SECRET မှန်/မမှန်နှင့် Vercel Production environment ထဲ ထည့်ထား/မထား စစ်ပါ။</p>
        </section>

        {preview && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-lg font-semibold text-amber-900">Restore Preview</h2><p className="mt-2 text-sm text-amber-800">Backup ထဲရှိ record များကို စစ်ပြီး မရှိသေးသော record များကိုသာ ထည့်မည်။ ရှိပြီးသား record များကို Update/Delete မလုပ်ပါ။ Restore ပြီးနောက် သက်ဆိုင်ရာ Customer balance များကို Ledger အားလုံးမှ ပြန်တွက်မည်။</p>{preview.integrityWarnings?.length ? <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700"><p className="font-semibold">Integrity warning</p>{preview.integrityWarnings.map((warning) => <p key={warning}>{warning}</p>)}</div> : null}<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Customer ထည့်မည်</p><p className="text-xl font-bold text-slate-900">{preview.willAdd.customers}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Transaction ထည့်မည်</p><p className="text-xl font-bold text-slate-900">{preview.willAdd.transactions}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">KPay Alias ထည့်မည်</p><p className="text-xl font-bold text-slate-900">{preview.willAdd.kpayAliases}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Pending KPay ထည့်မည်</p><p className="text-xl font-bold text-slate-900">{preview.willAdd.unverifiedKpay}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Audit ထည့်မည်</p><p className="text-xl font-bold text-slate-900">{preview.willAdd.auditLogs}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Balance ပြန်တွက်မည်</p><p className="text-xl font-bold text-slate-900">{preview.balanceRecalculation?.customers || 0}</p></div></div>{preview.aliasConflicts?.length ? <p className="mt-3 text-sm text-amber-800">KPay alias တူနေသောကြောင့် မပြောင်းဘဲ skip လုပ်မည့် alias {preview.aliasConflicts.length} ခု ရှိပါသည်။</p> : null}<button type="button" onClick={handleConfirm} disabled={loading || preview.integrityWarnings?.length > 0} className="mt-5 rounded-lg bg-amber-600 px-4 py-3 font-semibold text-white hover:bg-amber-700 disabled:bg-slate-400">{preview.integrityWarnings?.length ? "Integrity ပြန်စစ်ရန်" : "Confirm Restore"}</button></section>}
        {result && <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="text-lg font-semibold text-emerald-900">Restore Result</h2><p className="mt-2 text-sm text-emerald-800">Customer {result.result.addedCustomers}၊ Transaction {result.result.addedTransactions}၊ KPay Alias {result.result.addedAliases}၊ Pending KPay {result.result.addedPendingKpay}၊ Audit {result.result.addedAuditLogs} ခု ထည့်ပြီးပါပြီ။ Customer balance {result.result.correctedBalances} ခုကို Ledger အားလုံးအပေါ်မူတည်ပြီး ပြန်တွက်ထားပါတယ်။</p></section>}

        <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold text-slate-900">Backup သုံးစွဲပုံ</h2><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600"><li>အရင်ဆုံး Backup Excel Download ဖြင့် official backup ထုတ်ပါ။</li><li>ဖိုင်ကို လုံခြုံသောနေရာတွင် သိမ်းပါ။</li><li>နောင်တွင် restore လိုပါက file ရွေးပြီး Preview Restore လုပ်ပါ။</li><li>Preview အရေအတွက်မှန်မှသာ Confirm Restore နှိပ်ပါ။</li></ol></section>
      </div>
    </main>
  );
}
