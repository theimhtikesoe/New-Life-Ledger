import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createReadonlyMcpServer } from "@/lib/mcp-readonly";

const MAX_TOOL_ROUNDS = 4;
const MAX_MESSAGES = 12;
const DEFAULT_MODEL = "gpt-5-mini";

function providerConfig() {
  const base = String(process.env.MANUS_LLM_API_BASE || process.env.BUILT_IN_FORGE_API_URL || "").trim().replace(/\/$/, "");
  const apiKey = String(process.env.MANUS_LLM_API_KEY || process.env.BUILT_IN_FORGE_API_KEY || "").trim();
  const model = String(process.env.MANUS_LLM_MODEL || DEFAULT_MODEL).trim();
  if (!base || !apiKey) throw new Error("AI Assistant အတွက် MANUS_LLM_API_BASE နှင့် MANUS_LLM_API_KEY ကို သတ်မှတ်ပေးပါ။");
  return { endpoint: `${base}/chat/completions`, apiKey, model };
}

function asOpenAiTools(mcpTools) {
  return mcpTools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description || "New Life Ledger read-only data tool",
      parameters: tool.inputSchema || { type: "object", properties: {} },
    },
  }));
}

function toolText(result) {
  return (result?.content || []).filter((item) => item.type === "text").map((item) => item.text).join("\n") || JSON.stringify(result);
}

async function callModel(messages, tools) {
  const { endpoint, apiKey, model } = providerConfig();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, messages, tools, tool_choice: "auto", max_completion_tokens: 1400 }),
    signal: AbortSignal.timeout(45_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || `AI provider request failed (${response.status})`);
  return body.choices?.[0]?.message;
}

async function createMcpClient() {
  const server = createReadonlyMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "new-life-ledger-assistant", version: "1.0.0" }, { capabilities: {} });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

export async function answerWithMcp({ messages = [] } = {}) {
  const normalizedMessages = Array.isArray(messages)
    ? messages.filter((message) => message?.role === "user" || message?.role === "assistant")
      .map((message) => ({ role: message.role, content: String(message.content || "").slice(0, 4000) }))
      .slice(-MAX_MESSAGES)
    : [];
  if (!normalizedMessages.some((message) => message.role === "user" && message.content.trim())) {
    throw new Error("မေးခွန်းတစ်ခု ထည့်ပေးပါ။");
  }

  const client = await createMcpClient();
  try {
    const listed = await client.listTools();
    const tools = asOpenAiTools(listed.tools || []);
    const conversation = [
      {
        role: "system",
        content: "သင်သည် New Life Ledger ၏ မြန်မာဘာသာ AI Assistant ဖြစ်သည်။ လက်ရှိ MCP tools များသည် read-only ဖြစ်ကြောင်း သိထားပါ။ စျေး၊ အကြွေး၊ customer၊ production၊ packaging နှင့် report data များကို tool ခေါ်ပြီးမှသာ ဖြေပါ။ Data မရလျှင် မခန့်မှန်းပါနှင့်။ ငွေပမာဏနှင့် အရေအတွက်များကို data ထဲရှိ unit အတိုင်း ပြပါ။ အဖြေကို ရှင်းလင်းသော မြန်မာဘာသာဖြင့် တိုတိုနှင့် အသုံးဝင်အောင် ဖြေပါ။",
      },
      ...normalizedMessages,
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const assistant = await callModel(conversation, tools);
      if (!assistant) throw new Error("AI မှ အဖြေမရရှိပါ။");
      if (!assistant.tool_calls?.length) return { answer: String(assistant.content || "အဖြေမရရှိပါ။"), usedTools: [] };
      conversation.push(assistant);
      const usedTools = [];
      for (const toolCall of assistant.tool_calls.slice(0, 4)) {
        const name = toolCall.function?.name;
        let args = {};
        try { args = JSON.parse(toolCall.function?.arguments || "{}"); } catch { /* MCP validation returns a useful error */ }
        const result = await client.callTool({ name, arguments: args });
        usedTools.push(name);
        conversation.push({ role: "tool", tool_call_id: toolCall.id, content: toolText(result) });
      }
      if (round === MAX_TOOL_ROUNDS - 1) return { answer: "အချက်အလက်များ ရယူပြီးပါပြီ။ မေးခွန်းကို ပိုတိုအောင် ပြန်မေးပေးပါ။", usedTools };
      const final = await callModel(conversation, tools);
      if (final && !final.tool_calls?.length) return { answer: String(final.content || "အဖြေမရရှိပါ။"), usedTools };
      if (final) conversation.push(final);
    }
    throw new Error("AI အဖြေရန် အဆင့်များလွန်းနေပါသည်။");
  } finally {
    await client.close().catch(() => {});
  }
}
