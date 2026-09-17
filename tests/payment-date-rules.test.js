import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const createRoute = readFileSync(resolve(process.cwd(), "src/app/api/customers/[id]/transactions/route.js"), "utf8");
const editRoute = readFileSync(resolve(process.cwd(), "src/app/api/transactions/[id]/route.js"), "utf8");
const dashboard = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");

describe("Payment date rules", () => {
  it("defaults new ledger entries to today and rejects future dates except explicit prepayments", () => {
    expect(createRoute).toContain("const todayMyanmar = getMyanmarDateInputValue();");
    expect(createRoute).toContain("const ledgerDate = body.date || todayMyanmar;");
    expect(createRoute).toContain("const isPrepayment = type === \"DEBIT\" && String(body.note || \"\").includes(\"__PREPAYMENT__\");");
    expect(createRoute).toContain("if (ledgerDate > todayMyanmar && !isPrepayment)");
    expect(createRoute).toContain("date: getMyanmarDayRange(ledgerDate).start");
  });

  it("rejects future dates when editing an existing ledger entry", () => {
    expect(editRoute).toContain("if (requestedDate > getMyanmarDateInputValue())");
    expect(editRoute).toContain("အနာဂတ်ရက်စွဲဖြင့် စာရင်းသိမ်း၍မရပါ");
  });

  it("does not offer future credit ledgers as payment targets", () => {
    expect(dashboard).toContain("formatMyanmarDateInputValue(ledger.date) <= currentMyanmarDate");
    expect(dashboard).toContain("value={ledgerForm.date || currentMyanmarDate}");
    expect(dashboard).toContain("max={ledgerForm.type === \"DEBIT\" && paymentTargetLedgerId === PREPAYMENT_OPTION ? undefined : currentMyanmarDate}");
    expect(dashboard).toContain("ငွေကြိုချေကို နောက်လာမည့်ရက်အတွက် ကြိုတင်မှတ်တမ်းတင်နိုင်ပါသည်။");
  });

  it("allows a payment on the same date as its credit and rejects later payment dates", () => {
    expect(createRoute).toContain("getMyanmarDateInputValue(target.date) > ledgerDate");
    expect(createRoute).toContain("အကြွေးတိုးသည့်နေ့ သို့မဟုတ် ထိုနောက်ပိုင်းရက်ကိုသာ ရွေးပါ");
  });
});

export {};
