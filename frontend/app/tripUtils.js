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

export const EARLIEST_ACTIVITY_TIME = "06:00";
export const LATEST_ACTIVITY_TIME = "23:00";

export const ACTIVITY_TIMES = Array.from({ length: 69 }, (_, index) => {
  const minutes = 6 * 60 + index * 15;
  const hour = Math.floor(minutes / 60);
  return `${String(hour).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

export function formatTimeOption(time) {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

export function isValidActivityTime(value) {
  return typeof value === "string" && ACTIVITY_TIMES.includes(value);
}

export function clampActivityTime(value) {
  if (isValidActivityTime(value)) return value;
  if (typeof value === "string" && value < EARLIEST_ACTIVITY_TIME) return EARLIEST_ACTIVITY_TIME;
  if (typeof value === "string" && value > LATEST_ACTIVITY_TIME) return LATEST_ACTIVITY_TIME;
  return "10:00";
}

// Map the official PAGASA strings directly from the backend to UI badge colors
export function getPAGASABadgeColor(condition) {
  if (condition === "Extreme Heat / Danger") return "bg-red-100 text-red-800 border-red-200";
  if (condition === "Windy / Stormy") return "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200";
  if (condition === "Heavy Rain / Rainy") return "bg-indigo-100 text-indigo-800 border-indigo-200";
  if (condition === "Light Rain / Drizzle") return "bg-sky-100 text-sky-800 border-sky-200";
  if (condition === "Fair / Partly Cloudy") return "bg-orange-100 text-orange-800 border-orange-200";
  if (condition === "Clear / Sunny") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-200 text-slate-800 border-slate-300";
}

export function WeatherIcon({ condition, className = "h-5 w-5" }) {
  const value = String(condition || "").toLowerCase();
  if (value.includes("extreme heat")) {
    return <span className={`${className} inline-flex items-center justify-center font-black`} aria-hidden="true">
      <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-red-500">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1.5m4.243.257-1.06 1.06M18 9h-1.5M7.5 9H6m1.818-3.182-1.06-1.06M14.25 9a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 14.5c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 4.5 0M4.5 18.5c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 4.5 0" />
      </svg>
    </span>;
  }
  if (value.includes("windy") || value.includes("stormy")) {
    return <span className={`${className} inline-flex items-center justify-center text-lg`} aria-hidden="true">
      <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-indigo-600">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="m13 16.5-2.5 3.5h3L11 23" />
      </svg>
    </span>;
  }
  if (value.includes("heavy rain") || value.includes("rainy")) {
    return <span className={`${className} inline-flex items-center justify-center text-lg`} aria-hidden="true">
      <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-blue-500">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 19.5v2m4-2v2m4-2v2" />
      </svg>
    </span>;
  }
  if (value.includes("light rain") || value.includes("drizzle")) {
    return <span className={`${className} inline-flex items-center justify-center text-lg`} aria-hidden="true">
      <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-sky-400">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 19.5v.75m3-.75v.75m3-.75v.75" />
      </svg>
    </span>;
  }
  if (value.includes("fair") || value.includes("cloudy")) {
    return <span className={`${className} inline-flex items-center justify-center text-lg`} aria-hidden="true">
      <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-slate-500">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
      </svg>
    </span>;
  }
  return <span className={`${className} inline-flex items-center justify-center text-lg`} aria-hidden="true">
    <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-amber-500">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
</span>;
}