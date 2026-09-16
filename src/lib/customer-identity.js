function toMyanmarDigits(value) {
  return String(value ?? "").replace(/[၀-၉]/g, (digit) => String("၀၁၂၃၄၅၆၇၈၉".indexOf(digit)));
}

export function normalizeCustomerName(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/ဦး/g, "ဦး")
    .replace(/[\s\u200B\u200C\u200D]+/g, "")
    .replace(/[()（）[\]{}.,،/\\_\-—–]/g, "")
    .toLocaleLowerCase("my-MM");
}

export function normalizeCustomerPhone(value) {
  return toMyanmarDigits(value).replace(/[^0-9]/g, "").replace(/^0+/, "");
}

export function normalizeCustomerRoute(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[\s\u200B\u200C\u200D]+/g, "")
    .toLocaleLowerCase("my-MM");
}
