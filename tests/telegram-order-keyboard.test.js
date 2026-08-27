import { describe, expect, it } from "vitest";
import { buildOrderActionKeyboard, buildOrderCustomerCandidatesKeyboard, buildOrderDateKeyboard, buildOrderDestinationKeyboard, buildOrderDraftKeyboard, buildOrderMoreKeyboard } from "@/lib/telegram";

const order = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "DRAFT",
  customer: { id: "22222222-2222-4222-8222-222222222222", name: "မမိုး" },
  missingFields: [],
  sourceText: "/order မမိုး",
};

describe("Telegram order action keyboards", () => {
  it("shows only Confirm and Cancel for a confirmable order", () => {
    const keyboard = buildOrderActionKeyboard(order, "https://example.test", { allowRetry: true });
    expect(keyboard.inline_keyboard).toEqual([
      [{ text: "✅ Confirm", callback_data: `order|confirm|I|${order.id}` }],
      [{ text: "📋 အသေးစိတ်ကြည့်ရန်", callback_data: `order|menu|I|${order.id}` }],
      [{ text: "❌ Cancel", callback_data: `order|cancel|I|${order.id}` }],
    ]);
    expect(JSON.stringify(keyboard)).not.toContain("AI");
  });

  it("does not add AI retry to the draft keyboard", () => {
    const keyboard = buildOrderDraftKeyboard(order, "https://example.test");
    expect(JSON.stringify(keyboard)).not.toContain("retry");
    expect(JSON.stringify(keyboard)).not.toContain("AI");
  });

  it("asks for missing fields inside Telegram without requiring the website", () => {
    const incomplete = { ...order, customer: null, missingFields: ["ထုတ်ရမည့်ရက်", "ကားဂိတ်/နေရာ"] };
    const keyboard = buildOrderActionKeyboard(incomplete, "https://example.test/", { allowRetry: true });
    expect(keyboard.inline_keyboard).toContainEqual([{ text: "📅 ရက်စွဲရွေးရန်", callback_data: `order|date_menu|I|${order.id}` }]);
    expect(keyboard.inline_keyboard).toContainEqual([{ text: "📍 နေရာရွေးရန်", callback_data: `order|destination_menu|I|${order.id}` }]);
    expect(JSON.stringify(keyboard)).not.toContain("/orders?");
  });

  it("allows confirmation with missing fields once an Order Customer exists", () => {
    const incomplete = { ...order, missingFields: ["ထုတ်ရမည့်ရက်", "ကားဂိတ်/နေရာ"] };
    const keyboard = buildOrderActionKeyboard(incomplete, "https://example.test/", { allowRetry: true });
    expect(keyboard.inline_keyboard).toContainEqual([{ text: "✅ Confirm", callback_data: `order|confirm|I|${order.id}` }]);
    expect(keyboard.inline_keyboard).toContainEqual([{ text: "📅 ရက်စွဲရွေးရန်", callback_data: `order|date_menu|I|${order.id}` }]);
    expect(keyboard.inline_keyboard).toContainEqual([{ text: "📍 နေရာရွေးရန်", callback_data: `order|destination_menu|I|${order.id}` }]);
  });

  it("uses a short candidate index callback that stays within Telegram callback limits", () => {
    const candidates = [{ id: "22222222-2222-4222-8222-222222222222", name: "မမိုး" }];
    const keyboard = buildOrderCustomerCandidatesKeyboard({ id: order.id }, candidates);
    const callbackData = keyboard.inline_keyboard[0][0].callback_data;
    expect(callbackData).toBe(`order|link|I|${order.id}|0`);
    expect(callbackData.length).toBeLessThanOrEqual(64);
  });

  it("builds one-click date and destination menus with custom input choices", () => {
    const dateKeyboard = buildOrderDateKeyboard(order);
    expect(dateKeyboard.inline_keyboard[0][0].callback_data).toBe(`order|set_date|T|${order.id}`);
    expect(dateKeyboard.inline_keyboard[0][1].callback_data).toBe(`order|set_date|N|${order.id}`);
    expect(dateKeyboard.inline_keyboard[1][0].callback_data).toBe(`order|set_date|D2|${order.id}`);
    expect(dateKeyboard.inline_keyboard[1][1].callback_data).toBe(`order|set_date|C|${order.id}`);

    const destinationKeyboard = buildOrderDestinationKeyboard(order);
    expect(destinationKeyboard.inline_keyboard[0][0].callback_data).toBe(`order|set_destination|F|${order.id}`);
    expect(destinationKeyboard.inline_keyboard[1][0].callback_data).toBe(`order|set_destination|G|${order.id}`);
    expect(destinationKeyboard.inline_keyboard[1][1].callback_data).toBe(`order|set_destination|C|${order.id}`);
  });

  it("keeps More actions limited to Batch and Back", () => {
    const keyboard = buildOrderMoreKeyboard(order);
    expect(keyboard.inline_keyboard).toEqual([
      [{ text: "📦 08:10 Batch ထည့်ရန်", callback_data: `order|confirm|B|${order.id}` }],
      [{ text: "⬅️ မူလခလုတ်များ", callback_data: `order|back|I|${order.id}` }],
    ]);
    expect(JSON.stringify(keyboard)).not.toContain("AI");
  });
});
