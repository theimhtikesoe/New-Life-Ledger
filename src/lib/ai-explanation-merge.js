export function cleanAiText(value) {
  return String(value || "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
}

function normalizeExplanationText(value) {
  return cleanAiText(value)
    .replace(/[။.!！?？]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("my-MM");
}

function dedupeRepeatedSentences(value) {
  const seen = new Set();
  const seenGenericDateSummaries = new Set();
  return cleanAiText(value)
    .split(/\n+|(?<=[။.!！?？])\s+/u)
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      const key = normalizeExplanationText(part);
      if (seen.has(key)) return false;
      seen.add(key);

      // AI and code-first summaries sometimes repeat the same date-prefixed
      // boilerplate with slightly different wording (for example, using both
      // "အကျဉ်းချုပ်" and "အလိုအလျောက်"). Keep one such sentence while
      // preserving later sentences that contain actual findings.
      const date = part.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
      const isGenericDateSummary = Boolean(date)
        && /အတွက်/u.test(part)
        && /စာရင်းအချက်အလက်|အနှစ်ချုပ်|အလိုအလျောက်/u.test(part)
        && !/ငွေ|အကြွေး|လက်ငင်း|Customer|ဖောက်သည်|Payment|Ledger/iu.test(part);
      if (isGenericDateSummary) {
        if (seenGenericDateSummaries.has(date)) return false;
        seenGenericDateSummaries.add(date);
      }
      return true;
    })
    .join(" ");
}

export function normalizeAiItems(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map((item) => cleanAiText(item))
    .filter((item) => {
      if (!item) return false;
      const key = normalizeExplanationText(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeReviewItemKey(value) {
  return normalizeExplanationText(value)
    .replace(/(?:ပြန်စစ်ရန်|ပြန်စစ်သင့်သည်|ပြန်စစ်ရန် လိုအပ်နိုင်သည်|ပြန်စစ်ရန် လိုအပ်ပါသည်).*$/u, "")
    .trim();
}

export function normalizeReviewItems(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map((item) => cleanAiText(item))
    .filter((item) => {
      if (!item) return false;
      const key = normalizeReviewItemKey(item) || normalizeExplanationText(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function sanitizeExplanation(explanation) {
  if (!explanation || typeof explanation !== "object") return null;
  return {
    ...explanation,
    overview: dedupeRepeatedSentences(explanation.overview),
    findings: normalizeAiItems(explanation.findings),
    checks: normalizeReviewItems(explanation.checks),
    caution: dedupeRepeatedSentences(explanation.caution),
  };
}

export function mergeOverviewText(codeOverview, aiOverview) {
  const code = dedupeRepeatedSentences(codeOverview);
  const ai = dedupeRepeatedSentences(aiOverview);
  if (!code) return ai;
  if (!ai) return code;
  const normalizedCode = normalizeExplanationText(code);
  const normalizedAi = normalizeExplanationText(ai);
  if (normalizedCode === normalizedAi) return code;
  if (normalizedAi.includes(normalizedCode)) {
    const remaining = dedupeRepeatedSentences(ai.split(code).join(" "));
    return remaining || code;
  }
  if (normalizedCode.includes(normalizedAi)) return code;
  // The page already renders a single overview slot. Keeping both paragraphs here
  // makes code-first and provider summaries look like duplicate explanations,
  // especially when the provider uses different wording for the same day.
  // Detailed differences remain available through findings and checks.
  return ai;
}
