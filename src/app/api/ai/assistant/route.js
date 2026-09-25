import { NextResponse } from "next/server";
import { answerWithMcp } from "@/lib/ai-assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await answerWithMcp({ messages: body.messages });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("AI Assistant request failed", error);
    return NextResponse.json({ error: error.message || "AI Assistant အဖြေမရရှိပါ။" }, { status: 400 });
  }
}
