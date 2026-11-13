"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clampGuestCount, clampToSelectableDate, getMinSelectableDate, getTodayDateString } from "./tripUtils";

// Shared schedule validation and archive rules live with travel state.
export function isCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateActivitySchedules(activities, dates) {
  return activities.map((activity, index) => {
    const errors = {};
    const assignedDay = activity.assignedDay || activity.assigned_day || "";
    const match = /^Day ([1-9]\d*)$/.exec(assignedDay);
    if (!assignedDay) errors.day = "Select a trip day.";
    else if (!match || !isCalendarDate(dates[Number(match[1]) - 1])) {
      errors.day = `${assignedDay} is outside the trip duration. Select a day within the departure and return dates.`;
    }
    const time = activity.time;
    if (time == null || String(time).trim() === "") errors.time = "Select an activity time.";
    else if (typeof time !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      errors.time = "Select a valid activity time.";
    } else if (time < "06:00" || time > "23:00") {
      errors.time = "Time must be between 6:00 AM and 11:00 PM.";
    } else if (Number(time.slice(3)) % 15 !== 0) {
      errors.time = "Select a time in 15-minute intervals.";
    }
    return { index, name: activity.name || `Activity ${index + 1}`, errors };
  }).filter(({ errors }) => Object.keys(errors).length > 0);
}


export function archiveActivities(plan) {
  if (Array.isArray(plan.activities)) return plan.activities;
  const start = plan.dateRange?.startDate;
  return (plan.itinerary || []).flatMap((day) => (day.scheduled_activities || []).map((activity) => ({
    ...activity,
    assignedDay: activity.assignedDay || activity.assigned_day || (isCalendarDate(start) && isCalendarDate(day.date || day.day)
      ? `Day ${Math.round((Date.parse(day.date || day.day) - Date.parse(start)) / 86400000) + 1}` : ""),
    time: activity.time || activity.schedule || activity.start_time || "",
  })));
}

export function validateArchivePlan(plan, today) {
  const start = plan?.dateRange?.startDate;
  const end = plan?.dateRange?.endDate;
  if (!isCalendarDate(start) || !isCalendarDate(end) || end < start || start <= today) {
    return { ok: false, message: "Choose a valid future departure and return date before saving to the archive." };
  }
  const dates = [];
  for (let date = Date.parse(start); date <= Date.parse(end); date += 86400000) dates.push(new Date(date).toISOString().slice(0, 10));
  const activities = archiveActivities(plan);
  if (!activities.length) return { ok: false, message: "Add at least one activity before saving to the archive." };
  const errors = validateActivitySchedules(activities, dates);
  if (errors.length) return { ok: false, message: errors.map(({ index, name, errors }) => `${index + 1}. ${name}: ${Object.values(errors).join(" ")}`).join("\n") };
  if (dates.length === 1 && activities.length <= 1) return { ok: false, message: "A 1-day itinerary must have more than 1 activity." };
  return { ok: true };
}

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};

// Ignore generated forecasts, estimates, names and timestamps when detecting duplicates.
export function archivePlanKey(plan) {
  return JSON.stringify(canonical({
    dateRange: plan.dateRange,
    guests: plan.guests,
    activities: archiveActivities(plan).map(({ assigned_day, ...activity }) => ({ ...activity, assignedDay: activity.assignedDay || assigned_day || "" })),
    outfits: plan.outfits || [],
  }));
}

export function upsertArchivedPlan(current, plan) {
  const key = archivePlanKey(plan);
  const index = current.findIndex((saved) => saved.createdAt === plan.createdAt || archivePlanKey(saved) === key);
  if (index < 0) return [plan, ...current];
  return current.map((saved, savedIndex) => savedIndex === index
    ? { ...plan, createdAt: saved.createdAt, name: saved.name || plan.name }
    : saved);
}

const TravelContext = createContext(null);
const TRIP_STORAGE_KEY = "anoTaraTrip";
const SAVED_STORAGE_KEY = "anoTaraSavedPlanners";

// Ensures a start/end pair never includes today or a past date, and end is never before start.
function sanitizeDateRange({ startDate, endDate }) {
  const minDate = getMinSelectableDate();
  const nextStart = startDate ? clampToSelectableDate(startDate) : "";
  let nextEnd = endDate ? clampToSelectableDate(endDate) : "";
  if (nextStart && nextEnd && nextEnd < nextStart) nextEnd = nextStart;
  if (!nextStart && nextEnd && nextEnd < minDate) nextEnd = "";
  return { startDate: nextStart, endDate: nextEnd };
}

function defaultPlannerName(planner) {
  const firstDay = planner?.itinerary?.[0];
  const destination = firstDay?.scheduled_activities?.[0]?.destination || firstDay?.destination;
  const date = firstDay?.date;
  return [destination, date].filter(Boolean).join(" - ") || "Saved itinerary";
}

function getAssignedDay(activity) {
  return activity?.assignedDay || activity?.assigned_day || null;
}

export function TravelProvider({ children }) {
  const [dateRange, setDateRangeState] = useState({ startDate: "", endDate: "" });
  const [guests, setGuestsState] = useState(1);
  const [currentActivities, setCurrentActivities] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [savedItineraries, setSavedItinerariesState] = useState([]);
  const [savedItinerariesLoaded, setSavedItinerariesLoaded] = useState(false);

  const [tripLoaded, setTripLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(TRIP_STORAGE_KEY) || "null");
      if (saved) {
        setDateRangeState(sanitizeDateRange(saved.dateRange || {}));
        setGuestsState(clampGuestCount(saved.guests));
        setCurrentActivities(Array.isArray(saved.currentActivities) ? saved.currentActivities : []);
        setOutfits(Array.isArray(saved.outfits) ? saved.outfits : []);
      }
    } catch { /* Start with an empty trip if saved data cannot be read. */ }
    finally { setTripLoaded(true); }
  }, []);

  useEffect(() => {
    if (!tripLoaded) return;
    try {
      window.localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify({ dateRange, guests, currentActivities, outfits }));
    } catch { /* The current trip remains usable if storage is full. */ }
  }, [tripLoaded, dateRange, guests, currentActivities, outfits]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SAVED_STORAGE_KEY) || "[]");
      setSavedItinerariesState(Array.isArray(saved) ? saved.map((planner) => ({
        ...planner,
        name: typeof planner.name === "string" && planner.name.trim() ? planner.name : defaultPlannerName(planner),
      })) : []);
    } catch {
      window.localStorage.removeItem(SAVED_STORAGE_KEY);
      setSavedItinerariesState([]);
    } finally {
      setSavedItinerariesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !savedItinerariesLoaded) return;
    window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(savedItineraries));
  }, [savedItineraries, savedItinerariesLoaded]);

  // Single source of truth: any page that updates the date range updates it everywhere.
  const setDateRange = useCallback((nextRange) => {
    setDateRangeState((current) => sanitizeDateRange({ ...current, ...nextRange }));
  }, []);

  // Single source of truth for pax; always kept at a sane, non-zero whole number.
  const setGuests = useCallback((nextGuests) => {
    setGuestsState((current) => clampGuestCount(typeof nextGuests === "function" ? nextGuests(current) : nextGuests));
  }, []);

  const addActivity = useCallback((activity) => {
    setCurrentActivities((current) => {
      const targetDay = getAssignedDay(activity);
      const exists = current.some((item) => {
        const itemDay = getAssignedDay(item);
        return item.name === activity.name && item.destination === activity.destination && itemDay === targetDay;
      });
      return exists ? current : [...current, activity];
    });
  }, []);

  const removeActivity = useCallback((index) => {
    setCurrentActivities((current) => current.filter((_, activityIndex) => activityIndex !== index));
  }, []);

  const updateActivity = useCallback((index, changes) => {
    setCurrentActivities((current) => current.map((activity, activityIndex) => activityIndex === index ? { ...activity, ...changes } : activity));
  }, []);

  const hasActivityConflict = useCallback((activity, ignoreIndex = -1) => {
    const targetDay = getAssignedDay(activity);
    if (!targetDay) return false;
    return currentActivities.some((item, index) => index !== ignoreIndex && getAssignedDay(item) === targetDay);
  }, [currentActivities]);

  const saveItinerary = useCallback((itinerary) => {
    const validation = validateArchivePlan(itinerary, getTodayDateString());
    if (!validation.ok) return validation;
    setSavedItinerariesState((current) => upsertArchivedPlan(current, itinerary));
    return { ok: true };
  }, []);

  const deleteItinerary = useCallback((createdAt) => {
    setSavedItinerariesState((current) => current.filter((itinerary) => itinerary.createdAt !== createdAt));
  }, []);

  const renameItinerary = useCallback((createdAt, name) => {
    setSavedItinerariesState((current) => current.map((itinerary) => itinerary.createdAt === createdAt ? { ...itinerary, name } : itinerary));
  }, []);

  const clearSavedItineraries = useCallback(() => {
    setSavedItinerariesState([]);
  }, []);

  const clearCurrentPlan = useCallback(() => {
    setDateRangeState({ startDate: "", endDate: "" });
    setGuestsState(1);
    setCurrentActivities([]);
    setOutfits([]);
    window.localStorage.removeItem(TRIP_STORAGE_KEY);
  }, []);

  const value = useMemo(() => ({
    tripLoaded,
    dateRange,
    setDateRange,
    guests,
    setGuests,
    currentActivities,
    setCurrentActivities,
    addActivity,
    removeActivity,
    updateActivity,
    hasActivityConflict,
    outfits,
    setOutfits,
    savedItineraries,
    saveItinerary,
    deleteItinerary,
    renameItinerary,
    clearSavedItineraries,
    clearCurrentPlan,
  }), [tripLoaded, dateRange, guests, currentActivities, outfits, savedItineraries, setDateRange, setGuests, addActivity, removeActivity, updateActivity, hasActivityConflict, saveItinerary, deleteItinerary, renameItinerary, clearSavedItineraries, clearCurrentPlan]);

  return <TravelContext.Provider value={value}>{children}</TravelContext.Provider>;
}

export function useTravel() {
  const context = useContext(TravelContext);
  if (!context) throw new Error("useTravel must be used inside TravelProvider");
  return context;
}
