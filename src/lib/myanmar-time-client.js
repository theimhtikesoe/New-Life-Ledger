const MYANMAR_TIME_ZONE = "Asia/Yangon";
const MYANMAR_OFFSET_MS = (6 * 60 + 30) * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, "0");
}

function isDateInput(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getMyanmarDateParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() + MYANMAR_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
  };
}

export function getMyanmarDateInputValue(value = new Date()) {
  if (isDateInput(value)) return value;
  const { year, month, day } = getMyanmarDateParts(value);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function formatMyanmarDateTime(value) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MYANMAR_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(new Date(value));
}

export function formatMyanmarDateLabel(value = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MYANMAR_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function formatMyanmarClock(value = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MYANMAR_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
