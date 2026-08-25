import { NextResponse } from "next/server";
import { getTelegramPendingUpdates } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function chatFromUpdate(update) {
  return update?.message?.chat
    || update?.my_chat_member?.chat
    || update?.chat_member?.chat
    || update?.callback_query?.message?.chat
    || null;
}

function classifyChat(chat) {
  const title = String(chat?.title || "").trim();
  const normalized = title.toLocaleLowerCase("en-US").replace(/\s+/g, " ");
  if (normalized === "orders of new life") return "order";
  if (normalized === "factory of new life") return "factory";
  return null;
}

export async function GET() {
  try {
    const updates = await getTelegramPendingUpdates();
    const found = new Map();
    for (const update of updates) {
      const chat = chatFromUpdate(update);
      const kind = classifyChat(chat);
      if (!kind || chat?.id === undefined || chat?.id === null) continue;
      const key = `${kind}:${String(chat.id)}`;
      const current = found.get(key) || {
        kind,
        title: String(chat.title || "").slice(0, 120),
        chatId: String(chat.id),
        type: String(chat.type || ""),
        updateIds: [],
      };
      if (Number.isInteger(Number(update?.update_id)) && !current.updateIds.includes(Number(update.update_id))) {
        current.updateIds.push(Number(update.update_id));
      }
      found.set(key, current);
    }
    const matches = Array.from(found.values()).sort((a, b) => a.kind.localeCompare(b.kind));
    return NextResponse.json({
      ok: true,
      data: {
        matches,
        missing: ["order", "factory"].filter((kind) => !matches.some((item) => item.kind === kind)),
        hint: matches.length < 2 ? "သက်ဆိုင်ရာ group တစ်ခုချင်းစီတွင် message တစ်ကြောင်း ပို့ပြီး ထပ်စစ်ပါ။ Message စာသားကို helper က မပြပါ။" : null,
      },
    });
  } catch (error) {
    console.error("Telegram chat ID helper failed", error);
    return NextResponse.json({ ok: false, error: "Telegram chat ID ကို ယာယီဖတ်မရသေးပါ။ Webhook မချိတ်ထားသေးကြောင်းနှင့် bot setting ကို စစ်ပါ။" }, { status: 502 });
  }
}
