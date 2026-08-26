import { describe, expect, it } from "vitest";
import {
  ORDER_STRUCTURED_OUTPUT_SCHEMA,
  calculateCapWarnings,
  buildFallbackOrderExtraction,
  calculateOrderTotals,
  formatFactoryOrderMessage,
  formatOrderDraftMessage,
  normalizeExtractedOrder,
  positiveInteger,
  resolveOrderDate,
  toLatinDigits,
} from "@/lib/order-utils";
import { buildOrderActionKeyboard, buildOrderDraftKeyboard, buildOrderMoreKeyboard, isTelegramOrderAdminStatus } from "@/lib/telegram";

const baseOrder = {
  id: "order-test-1",
  requestedDate: "2026-08-26",
  destination: "ရန်ကုန်ကားဂိတ်",
  lines: [
    { bottleType: "ပလတ်စတစ်ဘူး", capacityLabel: "0.5 Liter", capacityMl: 500, bottlesPerCard: 100, cardCount: 10, totalBottles: 1000 },
    { bottleType: "ပလတ်စတစ်ဘူး", capacityLabel: "1 Liter", capacityMl: 1000, bottlesPerCard: 100, cardCount: 5, totalBottles: 500 },
  ],
  caps: [],
  factoryOrderNumber: 7,
};

describe("order numeric and date normalization", () => {
  it("converts Myanmar digits and accepts positive integer values", () => {
    expect(toLatinDigits("၁၂,၀၀၅")).toBe("12,005");
    expect(positiveInteger("၅၀၀၀")).toBe(5000);
    expect(positiveInteger("၅,၀၀၀ pcs")).toBe(5000);
    expect(positiveInteger("0")).toBeNull();
  });

  it("resolves explicit today/tomorrow phrases and dotted dates into Myanmar-date-shaped values", () => {
    expect(resolveOrderDate(null, "ဒီနေ့ ပို့ပါမယ်")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(resolveOrderDate(null, "မနက်ဖြန် ထုတ်ပါမယ်")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(resolveOrderDate(null, "tmr ပို့ပါမယ်")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(resolveOrderDate(null, "27.8.2026")).toBe("2026-08-27");
  });

  it("does not turn an explicit date line into a second bottle line", () => {
    const fallback = buildFallbackOrderExtraction("မှာယူမှု ကိုသိမ်း\n0.3 Liter အဖြူ\n100 ဆံ့ 20 ကဒ်\nအဖုံးခရမ်း အပို 10\nတောင်ပေါ်ဂိတ်\n27.8.2026");
    expect(fallback.requestedDate).toBe("2026-08-27");
    expect(fallback.lines).toHaveLength(1);
    expect(fallback.lines[0]).toEqual(expect.objectContaining({ bottleType: "အဖြူ", bottlesPerCard: 100, cardCount: 20, totalBottles: 2000 }));
  });

  it("keeps shorthand customer names, factory pickup, pickup time, and cap quantities in fallback extraction", () => {
    const fallback = buildFallbackOrderExtraction(`3ဘီး\nနွားနို့ကြီး အဖြူ\n100 ဆံ့ 30 ကဒ်\nအဖုံး ရောင်စုံ 3000 pcs + အပို 15\nစက်ရုံလာယူမည်\nမနက်ဖြန် မနက် ၇ နာရီ ခွဲ`);
    expect(fallback.customerName).toBe("3ဘီး");
    expect(fallback.destination).toBe("စက်ရုံလာယူမည်");
    expect(fallback.requestedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fallback.lines).toEqual([expect.objectContaining({ bottleType: "နွားနို့ကြီး အဖြူ", bottlesPerCard: 100, cardCount: 30, totalBottles: 3000 })]);
    expect(fallback.caps).toEqual([expect.objectContaining({ capType: "ရောင်စုံ", normalPcs: 3000, extraPcs: 15 })]);
    expect(fallback.notes).toContain("စက်ရုံလာယူမည်");
    expect(fallback.notes).toContain("မနက်ဖြန် မနက် ၇ နာရီ ခွဲ");
  });

  it("parses a comma-separated order message without treating the customer number as card quantity", () => {
    const fallback = buildFallbackOrderExtraction("မှာယူမှု 3ဘီး၊ နွားနို့ကြီး အဖြူ၊ 100 ဆံ့ 30 ကဒ်၊ အဖုံး ရောင်စုံ 3000 pcs + အပို 15၊ စက်ရုံလာယူမည်၊ မနက်ဖြန်");
    expect(fallback.customerName).toBe("3ဘီး");
    expect(fallback.lines).toEqual([expect.objectContaining({ bottleType: "နွားနို့ကြီး အဖြူ", bottlesPerCard: 100, cardCount: 30, totalBottles: 3000 })]);
    expect(fallback.caps[0]).toEqual(expect.objectContaining({ capType: "ရောင်စုံ", normalPcs: 3000, extraPcs: 15 }));
    expect(fallback.destination).toBe("စက်ရုံလာယူမည်");
  });

  it("captures Viber-style multi-line prices, KPay intent, receipt note, and separate cap lines", () => {
    const fallback = buildFallbackOrderExtraction(`ဒို့ရှမ်းပုဂံ
နွားသေး
3ကဒ်x100ဘူးx380k
=114,000 kyats
(အဖုံးအဝါ)
ရှစ်ဒေါင့်ဖြူ
2ကဒ်x250ဘူးx235K
=117,500 Kyats
(အဖုံးအနီ)
Kpay နဲ့ရှင်းမည်
ပစ္စည်းပို့ပြေစာပဲ
ပေးရန်`);
    expect(fallback.customerName).toBe("ဒို့ရှမ်းပုဂံ");
    expect(fallback.lines).toEqual([
      expect.objectContaining({ bottleType: "နွားသေး", cardCount: 3, bottlesPerCard: 100, totalBottles: 300, quotedRate: 380000, quotedAmount: 114000 }),
      expect.objectContaining({ bottleType: "ရှစ်ဒေါင့်ဖြူ", cardCount: 2, bottlesPerCard: 250, totalBottles: 500, quotedRate: 235000, quotedAmount: 117500 }),
    ]);
    expect(fallback.caps).toEqual([
      expect.objectContaining({ capType: "အဝါ", normalPcs: 300, extraPcs: 0 }),
      expect.objectContaining({ capType: "အနီ", normalPcs: 500, extraPcs: 0 }),
    ]);
    expect(fallback.paymentType).toBe("KPay");
    expect(fallback.paymentNote).toBe("Kpay နဲ့ရှင်းမည်");
    expect(fallback.receiptNote).toBe("ပစ္စည်းပို့ပြေစာပဲ ပေးရန်");
  });

  it("normalizes mixed capacity and card abbreviations without guessing missing values", () => {
    const normalized = normalizeExtractedOrder({
      customerName: "မမိုး",
      requestedDate: null,
      destination: "Yangon gate",
      lines: [
        { bottleType: "PET", capacityMl: null, capacityLabel: "0.5L", bottlesPerCard: "100 btl/card", cardCount: "2 cards" },
        { bottleType: "PET", capacityMl: null, capacityLabel: "500ml", bottlesPerCard: 400, cardCount: 10 },
      ],
      caps: [],
      missingFields: [],
      confidence: "medium",
    }, "tmr");
    expect(normalized.requestedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(normalized.lines.map((line) => [line.capacityMl, line.bottlesPerCard, line.cardCount, line.totalBottles])).toEqual([[500, 100, 2, 200], [500, 400, 10, 4000]]);
  });
});

describe("multi-line order totals and cap rules", () => {
  it("keeps multiple bottle lines and calculates each line plus overall totals", () => {
    const normalized = normalizeExtractedOrder({
      customerName: "မမိုး",
      customerPhone: null,
      requestedDate: "2026-08-26",
      destination: "ရန်ကုန်ကားဂိတ်",
      lines: [
        { bottleType: "ဘူး A", capacityMl: 500, capacityLabel: "0.5 Liter", bottlesPerCard: 100, cardCount: 10, notes: null },
        { bottleType: "ဘူး B", capacityMl: 1000, capacityLabel: "1 Liter", bottlesPerCard: 100, cardCount: 5, notes: null },
      ],
      caps: [],
      missingFields: [],
      confidence: "high",
      notes: null,
    }, "");
    expect(normalized.lines).toHaveLength(2);
    expect(normalized.lines.map((line) => line.totalBottles)).toEqual([1000, 500]);
    expect(calculateOrderTotals(normalized)).toMatchObject({ totalCards: 15, totalBottles: 1500 });
    expect(normalized.missingFields).toEqual([]);
  });

  it("defaults normal caps to total bottles when only a cap type is provided", () => {
    const normalized = normalizeExtractedOrder({
      customerName: "ကံလီ",
      customerPhone: null,
      requestedDate: "2026-08-26",
      destination: "ပုလဲဂိတ်",
      lines: [{ bottleType: "အပြာ", capacityMl: 300, capacityLabel: "0.3 Liter", bottlesPerCard: 400, cardCount: 20, notes: null }],
      caps: [{ capType: "အဖုံးပြာ", normalPcs: null, extraPcs: 0, notes: null }],
      missingFields: [],
      confidence: "high",
      notes: null,
    }, "");
    expect(normalized.caps).toEqual([expect.objectContaining({ capType: "အဖုံးပြာ", normalPcs: 8000, extraPcs: 0, requestedTotalPcs: 8000 })]);
    expect(calculateCapWarnings(normalized)).toEqual([expect.objectContaining({ warningText: null })]);
  });

  it("keeps normal caps plus extra caps exactly as requested and only warns on mismatch", () => {
    const order = {
      ...baseOrder,
      caps: [{ capType: "အဖုံးပြာ", normalPcs: 5000, extraPcs: 20, requestedTotalPcs: 5020 }],
    };
    const warning = calculateCapWarnings(order)[0];
    expect(warning.requestedTotalPcs).toBe(5020);
    expect(warning.warningText).toContain("မှာထား 5,020 pcs");
    expect(calculateOrderTotals(order)).toMatchObject({ totalBottles: 1500, totalRequestedCaps: 5020 });
    const websiteMessage = formatFactoryOrderMessage(order, { source: "WEBSITE" });
    expect(websiteMessage).toContain("🟢 စက်ရုံအတွက် Order 7");
    expect(websiteMessage).toContain("Website မှ Confirm ပြီးသော order ဖြစ်ပါသည်။");
    expect(websiteMessage).toContain("5,020");
    expect(websiteMessage).not.toContain("အဖုံးကွာခြားချက် သတိပေးချက်သာ");
    expect(websiteMessage).not.toContain("မျှော်မှန်း 1,500");
    const telegramMessage = formatFactoryOrderMessage(order, { source: "TELEGRAM" });
    expect(telegramMessage).toContain("Telegram မှ Confirm ပြီးသော order ဖြစ်ပါသည်။");
    expect(telegramMessage).not.toContain("Website မှ Confirm ပြီးသော order ဖြစ်ပါသည်။");
  });

  it("formats the Telegram draft without internal missing fields or requested-cap total", () => {
    const normalized = normalizeExtractedOrder({
      customerName: "ကံလီ",
      customerPhone: null,
      requestedDate: "2026-08-26",
      destination: "ပုလဲဂိတ်",
      lines: [{ bottleType: "အပြာ", capacityMl: 300, capacityLabel: "0.3 Liter", bottlesPerCard: 400, cardCount: 20, notes: null }],
      caps: [{ capType: "အဖုံးပြာ", normalPcs: null, extraPcs: 0, notes: null }],
      missingFields: ["phone", "normalCapPcs"],
      confidence: "medium",
      notes: null,
    }, "");
    const message = formatOrderDraftMessage({ ...normalized, status: "NEEDS_REVIEW", sourceText: "/order ကံလီ" }, { includeActions: false, includeSource: true });
    expect(message).toContain("အဖုံးပြာ: 8,000 pcs");
    expect(message).not.toContain("အဖုံးပုံမှန်စုစုပေါင်း: 8,000 pcs");
    expect(message).not.toContain("အဖုံးအပိုစုစုပေါင်း: 0 pcs");
    expect(message).not.toContain("အဖုံးတောင်းဆိုချက်စုစုပေါင်း");
    expect(message).not.toContain("မျှော်မှန်း 8,000");
    expect(message).not.toContain("ကွာ 0 pcs");
    expect(message).not.toContain("ပြန်ဖြည့်ရန်");
    expect(message).not.toContain("phone");
    expect(message).not.toContain("အဖုံးစာရင်း:\nမသတ်မှတ်ရသေး");
    expect(message).toContain("အဖုံးပြာ: 8,000 pcs");
    expect(message).toContain("မူရင်းမှာယူစာ:");
    expect(message).toContain("```\n/order ကံလီ\n```");
  });

  it("shows when Telegram Customer is already linked to the Website Customer record", () => {
    const message = formatOrderDraftMessage({
      ...baseOrder,
      status: "DRAFT",
      customer: { id: "customer-1", name: "ကံလီ" },
      sourceText: "မှာယူမှု ကံလီ",
    }, { includeActions: false, includeSource: false });
    expect(message).toContain("Customer: ကံလီ");
    expect(message).not.toContain("Website မှာရှိပြီးသား");
  });

  it("shows when Telegram Customer is not linked yet", () => {
    const message = formatOrderDraftMessage({
      ...baseOrder,
      status: "NEEDS_CUSTOMER",
      draftCustomerName: "မမိုး",
      customer: null,
      sourceText: "မှာယူမှု မမိုး",
    }, { includeActions: false, includeSource: false });
    expect(message).toContain("Customer: မမိုး");
    expect(message).not.toContain("Customer မချိတ်ရသေး");
  });

  it("omits the cap section when no cap type or quantity was provided", () => {
    const normalized = normalizeExtractedOrder({ customerName: "ကံလီ", requestedDate: "2026-08-26", destination: "ပုလဲဂိတ်", lines: [{ bottleType: "အပြာ", capacityMl: 300, capacityLabel: "0.3 Liter", bottlesPerCard: 400, cardCount: 20 }], caps: [], missingFields: [], confidence: "high" }, "");
    const message = formatOrderDraftMessage({ ...normalized, status: "DRAFT", sourceText: "/order ကံလီ" }, { includeActions: false });
    expect(message).not.toContain("အဖုံးစာရင်း");
    expect(message).not.toContain("အဖုံးပုံမှန်စုစုပေါင်း");
  });
});

describe("missing-field and schema safeguards", () => {
  it("marks missing customer/date/location/line details without inventing values", () => {
    const normalized = normalizeExtractedOrder({ customerName: null, requestedDate: null, destination: null, lines: [{ bottleType: "ဘူး", capacityLabel: "0.5 Liter", bottlesPerCard: null, cardCount: null }], caps: [], missingFields: [], confidence: "low", notes: null }, "");
    expect(normalized.customerName).toBeNull();
    expect(normalized.requestedDate).toBeNull();
    expect(normalized.lines[0].totalBottles).toBeNull();
    expect(normalized.missingFields).toEqual(expect.arrayContaining(["Customer အမည်", "ထုတ်ရမည့်ရက်", "ကားဂိတ်/နေရာ"]));
  });

  it("shows only Confirm and Cancel for a linked complete Draft and keeps Batch in More actions", () => {
    const order = { id: "11111111-1111-4111-8111-111111111111", status: "DRAFT", customer: { id: "customer-1" }, missingFields: [] };
    const keyboard = buildOrderActionKeyboard(order);
    expect(keyboard.inline_keyboard[0]).toEqual([{ text: "✅ Confirm", callback_data: "order|confirm|I|11111111-1111-4111-8111-111111111111" }]);
    expect(keyboard.inline_keyboard[1]).toEqual([{ text: "❌ Cancel", callback_data: "order|cancel|I|11111111-1111-4111-8111-111111111111" }]);
    expect(keyboard.inline_keyboard).toHaveLength(2);
    expect(buildOrderMoreKeyboard(order).inline_keyboard[0]).toEqual([{ text: "📦 08:10 Batch ထည့်ရန်", callback_data: "order|confirm|B|11111111-1111-4111-8111-111111111111" }]);
    expect(buildOrderActionKeyboard({ ...order, status: "NEEDS_CUSTOMER", customer: null, missingFields: [], sourceText: "မှာယူမှု" }, "", { allowRetry: true }).inline_keyboard[0][0].text).toBe("👤 ရှိပြီးသား Customer ချိတ်ရန်");
    const linkedWithLegacyCustomerFlag = buildOrderActionKeyboard({ ...order, missingFields: ["Customer အမည်"] });
    expect(linkedWithLegacyCustomerFlag.inline_keyboard).toHaveLength(2);
    expect(linkedWithLegacyCustomerFlag.inline_keyboard[0][0].text).toBe("✅ Confirm");
  });

  it("builds direct callback controls and recognizes only Telegram admin statuses", () => {
    const keyboard = buildOrderDraftKeyboard({ id: "11111111-1111-4111-8111-111111111111", status: "DRAFT", customer: { id: "customer-1" }, missingFields: [] }, "https://example.test");
    expect(keyboard.inline_keyboard[0]).toEqual([{ text: "✅ Confirm", callback_data: "order|confirm|I|11111111-1111-4111-8111-111111111111" }]);
    expect(keyboard.inline_keyboard[1][0].callback_data).toBe("order|cancel|I|11111111-1111-4111-8111-111111111111");
    expect(isTelegramOrderAdminStatus("administrator")).toBe(true);
    expect(isTelegramOrderAdminStatus("creator")).toBe(true);
    expect(isTelegramOrderAdminStatus("member")).toBe(false);
  });

  it("uses an all-required, closed structured-output schema", () => {
    expect(ORDER_STRUCTURED_OUTPUT_SCHEMA.additionalProperties).toBe(false);
    expect(Object.keys(ORDER_STRUCTURED_OUTPUT_SCHEMA.properties)).toEqual(expect.arrayContaining(["customerName", "requestedDate", "lines", "caps", "missingFields"]));
    expect(ORDER_STRUCTURED_OUTPUT_SCHEMA.required).toEqual(expect.arrayContaining(Object.keys(ORDER_STRUCTURED_OUTPUT_SCHEMA.properties)));
    expect(ORDER_STRUCTURED_OUTPUT_SCHEMA.properties.lines.items.additionalProperties).toBe(false);
    expect(ORDER_STRUCTURED_OUTPUT_SCHEMA.properties.caps.items.additionalProperties).toBe(false);
  });
});
