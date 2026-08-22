export const MYANMAR_TIME_ZONE = "Asia/Yangon";
export const MYANMAR_OFFSET_MS = (6 * 60 + 30) * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, "0");
}

function isDateInput(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function getMyanmarDateParts(value = new Date()) {
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

export function getMyanmarDayRange(value = new Date()) {
  const dateInput = getMyanmarDateInputValue(value);
  const [year, month, day] = dateInput.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new Error("ရွေးထားသော report date မမှန်ကန်ပါ။");
  }
  const start = new Date(calendarDate.getTime() - MYANMAR_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, dateLabel: dateInput };
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

export function getPreviousMyanmarDayRange(value = new Date()) {
  const { year, month, day } = getMyanmarDateParts(value);
  const previousCalendarDate = new Date(Date.UTC(year, month - 1, day));
  previousCalendarDate.setUTCDate(previousCalendarDate.getUTCDate() - 1);
  const previousDate = `${previousCalendarDate.getUTCFullYear()}-${pad(previousCalendarDate.getUTCMonth() + 1)}-${pad(previousCalendarDate.getUTCDate())}`;
  return getMyanmarDayRange(previousDate);
}
