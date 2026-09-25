"use client";

import { BAG_RULES, SALA_SACK_WEIGHT_LB } from "@/lib/packaging-bag-calculator";

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function PackagingBagStockPage() {
  return (
    <main className="app-page-main">
      <div className="app-page-container app-page-surface space-y-4 pt-5 sm:pt-6">
        <section className="rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-bold text-cyan-700">ထုပ်ပိုးအိတ်ခွံ လုံးရေတွက်ချက်ရန်</p>
          <h2 className="mt-1 text-xl font-black text-slate-900">ဆာလာအိတ် {formatNumber(SALA_SACK_WEIGHT_LB)} ပေါင် အခြေခံတွက်ချက်မှု</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
            ဤစာမျက်နှာသည် လက်ရှိစက်ရုံ Stock အဝင်၊ သုံးစွဲမှု၊ လက်ကျန်စာရင်း မဟုတ်ပါ။ အရွယ်အစားတစ်မျိုးလျှင် ဆာလာအိတ်တစ်အိတ် ({formatNumber(SALA_SACK_WEIGHT_LB)} ပေါင်) မှာ ထုပ်နှင့် လုံး ဘယ်လောက်ရနိုင်သည်ကို တွက်ချက်ပြသသော reference table ဖြစ်ပါသည်။
          </p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-cyan-100 bg-cyan-50 px-4 py-3">
            <h2 className="font-black text-cyan-950">အရွယ်အစားအလိုက် ဆာလာအိတ် ၁ အိတ် တွက်ချက်မှု</h2>
            <p className="mt-1 text-xs font-bold text-cyan-700">ထုပ်အရေအတွက် = 100 ÷ တစ်ထုပ်အလေးချိန် · လုံးရေ = ထုပ်အရေအတွက် × တစ်ထုပ်ပါလုံး</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-black text-slate-700">
                <tr>
                  <th className="px-4 py-3">အရွယ်အစား</th>
                  <th className="px-4 py-3 text-right">တစ်ထုပ်ပါ လုံး</th>
                  <th className="px-4 py-3 text-right">တစ်ထုပ်အလေးချိန်</th>
                  <th className="px-4 py-3 text-right">100 ပေါင်တွင် ထုပ်</th>
                  <th className="px-4 py-3 text-right">စုစုပေါင်းလုံး</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {BAG_RULES.map((rule) => (
                  <tr key={rule.bagSize} className="hover:bg-cyan-50/50">
                    <td className="px-4 py-3 font-black text-slate-900">{rule.label}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">{formatNumber(rule.piecesPerBag)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">{formatNumber(rule.weightLb)} ပေါင်</td>
                    <td className="px-4 py-3 text-right font-black text-violet-700">{formatNumber(rule.packsPerSack)}</td>
                    <td className="px-4 py-3 text-right text-lg font-black text-cyan-800">{formatNumber(rule.piecesPerSack)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
