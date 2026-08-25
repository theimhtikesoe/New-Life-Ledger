import { describe, expect, it } from "vitest";
import {
  ORDER_STRUCTURED_OUTPUT_SCHEMA,
  calculateCapWarnings,
  calculateOrderTotals,
  formatFactoryOrderMessage,
  normalizeExtractedOrder,
  positiveInteger,
  resolveOrderDate,
  toLatinDigits,
} from "@/lib/order-utils";
import { buildOrderDraftKeyboard, isTelegramOrderAdminStatus } from "@/lib/telegram";

const baseOrder = {
  id: "order-test-1",
  requestedDate: "2026-08-26",
  destination: "ရန်ကုန်ကားဂိတ်",
  lines: [
    { bottleType: "ပလတ်စတစ်ဘူး", capacityLabel: "0.5 Liter", capacityMl: 500, bottlesPerCard: 100, cardCount: 10, totalBottles: 1000 },
    { bottleType: "ပလတ်စတစ်ဘူး", capacityLabel: "1 Liter", capacityMl: 1000, bottlesPerCard: 100, cardCount: 5, totalBottles: 500 },
  ],
  caps: [],
};

describe("order numeric and date normalization", () => {
  it("converts Myanmar digits and accepts positive integer values", () => {
    expect(toLatinDigits("၁၂,၀၀၅")).toBe("12,005");
    expect(positiveInteger("၅၀၀၀")).toBe(5000);
    expect(positiveInteger("၅,၀၀၀ pcs")).toBe(5000);
    expect(positiveInteger("0")).toBeNull();
  });

  it("resolves explicit today/tomorrow phrases into Myanmar-date-shaped values", () => {
    expect(resolveOrderDate(null, "ဒီနေ့ ပို့ပါမယ်")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(resolveOrderDate(null, "မနက်ဖြန် ထုတ်ပါမယ်")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(resolveOrderDate(null, "tmr ပို့ပါမယ်")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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

  it("keeps normal caps plus extra caps exactly as requested and only warns on mismatch", () => {
    const order = {
      ...baseOrder,
      caps: [{ capType: "အဖုံးပြာ", normalPcs: 5000, extraPcs: 20, requestedTotalPcs: 5020 }],
    };
    const warning = calculateCapWarnings(order)[0];
    expect(warning.requestedTotalPcs).toBe(5020);
    expect(warning.warningText).toContain("မှာထား 5,020 pcs");
    expect(calculateOrderTotals(order)).toMatchObject({ totalBottles: 1500, totalRequestedCaps: 5020 });
    expect(formatFactoryOrderMessage(order)).toContain("5,020");
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

  it("builds direct callback controls and recognizes only Telegram admin statuses", () => {
    const keyboard = buildOrderDraftKeyboard({ id: "11111111-1111-4111-8111-111111111111" }, "https://example.test");
    expect(keyboard.inline_keyboard[0]).toEqual(expect.arrayContaining([
      { text: "✅ Confirm (ချက်ချင်း)", callback_data: "order|confirm|I|11111111-1111-4111-8111-111111111111" },
      { text: "📦 08:10 Batch", callback_data: "order|confirm|B|11111111-1111-4111-8111-111111111111" },
    ]));
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
