const DEFAULT_DAY_CLOSING_MINUTES = 23 * 60;

export function isAccommodationActivity(activity) {
  const description = [
    activity?.type,
    activity?.category,
    activity?.record_type,
    activity?.name,
  ].filter(Boolean).join(" ");
  return /hotel|accommodation|lodging|room booking|resort stay/i.test(description);
}

export function getActivityDurationMinutes(activity) {
  if (isAccommodationActivity(activity)) return 0;

  const explicitHours = Number(activity?.duration_hours);
  if (Number.isFinite(explicitHours) && explicitHours > 0) return explicitHours * 60;

  const label = String(activity?.activity_duration || activity?.duration || "").trim().toLowerCase();
  if (!label) return 60;
  if (/whole\s*day|all\s*day|full\s*day/.test(label)) return 8 * 60;

  const hourMatches = [...label.matchAll(/(\d+(?:\.\d+)?)\s*(?:\+\s*)?(?:hours?|hrs?|h)\b/g)];
  const minuteMatches = [...label.matchAll(/(\d+(?:\.\d+)?)\s*(?:\+\s*)?(?:minutes?|mins?)\b/g)];
  const maximum = (matches) => matches.reduce((max, match) => Math.max(max, Number(match[1])), 0);
  const hours = maximum(hourMatches);
  const minutes = maximum(minuteMatches);
  const total = hours * 60 + minutes;
  return total > 0 ? total : 60;
}

export function getActivityClosingMinutes(activity) {
  const value = String(activity?.closing_time || "").trim();
  if (!value) return DEFAULT_DAY_CLOSING_MINUTES;
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(value);
  if (!match) return DEFAULT_DAY_CLOSING_MINUTES;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (minutes > 59 || hours > 24) return DEFAULT_DAY_CLOSING_MINUTES;
  const period = match[3]?.toLowerCase();
  if (period) {
    if (hours < 1 || hours > 12) return DEFAULT_DAY_CLOSING_MINUTES;
    hours = (hours % 12) + (period === "pm" ? 12 : 0);
  }
  return hours * 60 + minutes;
}

const getStartMinutes = (value) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ""));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

export function getDayDurationSummary(activities) {
  const timedActivities = activities
    .filter((activity) => !isAccommodationActivity(activity))
    .map((activity) => ({
      activity,
      start: getStartMinutes(activity?.time || activity?.schedule || activity?.start_time),
      duration: getActivityDurationMinutes(activity),
      closing: getActivityClosingMinutes(activity),
    }));
  const totalMinutes = timedActivities.reduce((total, item) => total + item.duration, 0);
  const startMinutes = timedActivities.reduce(
    (earliest, item) => item.start == null ? earliest : Math.min(earliest, item.start),
    Number.POSITIVE_INFINITY,
  );
  const latestScheduledEnd = timedActivities.reduce(
    (latest, item) => item.start == null ? latest : Math.max(latest, item.start + item.duration),
    Number.NEGATIVE_INFINITY,
  );
  const cumulativeEnd = Number.isFinite(startMinutes) ? startMinutes + totalMinutes : null;
  const endMinutes = cumulativeEnd == null
    ? (Number.isFinite(latestScheduledEnd) ? latestScheduledEnd : null)
    : Math.max(cumulativeEnd, Number.isFinite(latestScheduledEnd) ? latestScheduledEnd : cumulativeEnd);
  const exceededVenueClosing = timedActivities.find(
    (item) => item.start != null && item.start + item.duration > item.closing,
  );
  const closingMinutes = exceededVenueClosing?.closing ?? DEFAULT_DAY_CLOSING_MINUTES;
  return {
    totalMinutes,
    endMinutes,
    closingMinutes,
    exceedsClosing: Boolean(exceededVenueClosing) || (endMinutes != null && endMinutes > DEFAULT_DAY_CLOSING_MINUTES),
  };
}

export function formatDurationMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function formatClockMinutes(minutes) {
  if (minutes == null) return "an unknown time";
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}
