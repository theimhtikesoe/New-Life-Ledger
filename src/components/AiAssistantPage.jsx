"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMyanmarClock, formatMyanmarDateLabel } from "@/lib/myanmar-time-client";

const STARTER_PROMPTS = [
  "ဒီနေ့ Dashboard အခြေအနေကို အကျဉ်းချုပ်ပေးပါ။",
  "ဒီနေ့ အကြွေးကြာနေတဲ့ Customer တွေ ဘယ်သူတွေလဲ?",
  "ဒီလ အိတ်ခွံသုံးစွဲမှု စုစုပေါင်း ဘယ်လောက်လဲ?",
  "ဒီနေ့ ထုတ်လုပ်မှုအခြေအနေကို ပြောပါ။",
];

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm sm:max-w-[78%] ${isUser ? "rounded-br-md bg-cyan-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800"}`}>
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        {!isUser && message.usedTools?.length ? <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] font-bold text-slate-400">MCP data: {message.usedTools.join(", ")}</div> : null}
      </div>
    </div>
  );
}

export default function AiAssistantPage() {
  const [messages, setMessages] = useState([{ role: "assistant", content: "မင်္ဂလာပါ။ New Life Ledger ထဲက စျေး၊ အကြွေး၊ Customer၊ production၊ အိတ်ခွံနဲ့ report data တွေကို မေးနိုင်ပါတယ်။" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const visibleMessages = useMemo(() => messages.filter((message) => message.role === "user" || message.role === "assistant"), [messages]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function submitQuestion(event) {
    event?.preventDefault();
    const question = input.trim();
    if (!question || loading) return;
    const nextMessages = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.slice(-10) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "AI Assistant အဖြေမရရှိပါ။");
      setMessages((current) => [...current, { role: "assistant", content: body.data.answer, usedTools: body.data.usedTools }]);
    } catch (requestError) {
      setError(requestError.message || "AI Assistant အဖြေမရရှိပါ။");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-5xl flex-col px-3 pb-8 pt-3 sm:px-5">
      <section className="overflow-hidden rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-violet-50 shadow-sm">
        <header className="border-b border-cyan-100 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">New Life Ledger</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">AI Assistant</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">Project data ကို MCP read-only tools နဲ့ ရယူပြီး မြန်မာလို အဖြေပေးပါတယ်။ စျေး၊ အကြွေး၊ Customer၊ production၊ အိတ်ခွံနဲ့ report တွေကို မေးနိုင်ပါတယ်။</p>
            </div>
            <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
              <div className="rounded-2xl border border-cyan-200 bg-white/90 px-3 py-2 text-left shadow-sm sm:min-w-[180px] sm:text-right">
                <p className="text-[11px] font-black text-slate-500">ယနေ့ရက်စွဲ</p>
                <p className="mt-0.5 text-sm font-black text-slate-800">{formatMyanmarDateLabel(currentTime)}</p>
                <p className="mt-0.5 font-mono text-xl font-black tracking-wider text-cyan-700 tabular-nums">{formatMyanmarClock(currentTime)}</p>
                <p className="text-[10px] font-bold text-slate-400">Myanmar Time (UTC+06:30)</p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">MCP Read-only</span>
            </div>
          </div>
        </header>

        <div className="grid gap-4 p-3 sm:p-5 lg:grid-cols-[1fr_260px]">
          <div className="flex min-h-[520px] flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {visibleMessages.map((message, index) => <MessageBubble key={`${message.role}-${index}`} message={message} />)}
              {loading ? <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-cyan-100 bg-white px-4 py-3 text-sm font-bold text-cyan-700">MCP data ရှာပြီး အဖြေပြင်ဆင်နေပါတယ်...</div></div> : null}
            </div>
            {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</p> : null}
            <form onSubmit={submitQuestion} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input value={input} onChange={(event) => setInput(event.target.value)} disabled={loading} placeholder="ဥပမာ - ဒီနေ့ အကြွေးကြာတဲ့ Customer တွေ ပြပါ" className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100" />
              <button type="submit" disabled={loading || !input.trim()} className="min-h-12 rounded-xl bg-cyan-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300">{loading ? "စောင့်ပါ..." : "မေးမည်"}</button>
            </form>
          </div>

          <aside className="rounded-2xl border border-violet-200 bg-white p-4">
            <h2 className="text-base font-black text-violet-950">မေးလို့ကောင်းတဲ့ မေးခွန်းများ</h2>
            <div className="mt-3 space-y-2">
              {STARTER_PROMPTS.map((prompt) => <button key={prompt} type="button" onClick={() => setInput(prompt)} className="w-full rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-3 text-left text-xs font-bold leading-5 text-violet-900 transition hover:border-violet-300 hover:bg-violet-100">{prompt}</button>)}
            </div>
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">လက်ရှိ Assistant က data ကို ဖတ်ပြီးရှင်းပြနိုင်ပါတယ်။ စျေးပြင်ခြင်း၊ Ledger ရေးခြင်း၊ Order အတည်ပြုခြင်းတွေကို မလုပ်သေးပါ။</div>
          </aside>
        </div>
      </section>
    </main>
  );
}
