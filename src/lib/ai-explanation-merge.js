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
  return cleanAiText(value)
    .split(/\n+|(?<=[။.!！?？])\s+/u)
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      const key = normalizeExplanationText(part);
      if (seen.has(key)) return false;
      seen.add(key);
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
  return `${code}\n\nAI ထပ်ဖြည့်ရှင်းချက် — ${ai}`;
}
