"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clampGuestCount, clampToSelectableDate, getMinSelectableDate } from "./tripUtils";

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
  const [savedItineraries, setSavedItinerariesState] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = JSON.parse(window.localStorage.getItem(SAVED_STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.map((planner) => ({
        ...planner,
        name: typeof planner.name === "string" && planner.name.trim() ? planner.name : defaultPlannerName(planner),
      })) : [];
    } catch {
      window.localStorage.removeItem(SAVED_STORAGE_KEY);
      return [];
    }
  });

  // Working trip state (dates, guests, activities, outfits) is intentionally kept in memory only,
  // so it clears on every browser refresh. Only generated planners persist across refreshes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TRIP_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(savedItineraries));
  }, [savedItineraries]);

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
    setSavedItinerariesState((current) => [itinerary, ...current]);
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
  }), [dateRange, guests, currentActivities, outfits, savedItineraries, setDateRange, setGuests, addActivity, removeActivity, updateActivity, hasActivityConflict, saveItinerary, deleteItinerary, renameItinerary, clearSavedItineraries, clearCurrentPlan]);

  return <TravelContext.Provider value={value}>{children}</TravelContext.Provider>;
}

export function useTravel() {
  const context = useContext(TravelContext);
  if (!context) throw new Error("useTravel must be used inside TravelProvider");
  return context;
}
