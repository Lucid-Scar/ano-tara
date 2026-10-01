// Shared trip validation helpers so date and pax rules stay consistent across every page.

export const MAX_TYPICAL_GUESTS = 10;

// Formats a Date using its LOCAL calendar day (never toISOString, which converts to UTC
// and silently shifts the date backwards by a day in positive UTC-offset timezones like
// Asia/Manila). This is the single source of truth for turning a Date into "YYYY-MM-DD".
export function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayDateString() {
  return toDateString(new Date());
}

// Earliest date a trip may start: today and past dates are not selectable.
export function getMinSelectableDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toDateString(tomorrow);
}

export function isPastOrTodayDate(dateString) {
  if (!dateString) return false;
  return dateString <= getTodayDateString();
}

// Clamps a date so it never falls on or before today.
export function clampToSelectableDate(dateString) {
  const minDate = getMinSelectableDate();
  if (!dateString || dateString < minDate) return minDate;
  return dateString;
}

export function clampGuestCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return 1;
  return Math.floor(numeric);
}

export function isGuestCountUnusual(value) {
  return clampGuestCount(value) > MAX_TYPICAL_GUESTS;
}

export function getGuestWarning(value) {
  return isGuestCountUnusual(value)
    ? `That's a large group (${clampGuestCount(value)} pax). Double-check the number of guests — it can change prices drastically.`
    : "";
}
