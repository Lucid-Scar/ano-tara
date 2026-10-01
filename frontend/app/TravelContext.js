"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
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

export function TravelProvider({ children }) {
  const [dateRange, setDateRangeState] = useState({ startDate: "", endDate: "" });
  const [guests, setGuestsState] = useState(1);
  const [currentActivities, setCurrentActivities] = useState([]);
  const [savedItineraries, setSavedItinerariesState] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const trip = JSON.parse(window.localStorage.getItem(TRIP_STORAGE_KEY) || "{}");
      const targetDates = Array.isArray(trip.targetDates) ? trip.targetDates : [];
      setDateRangeState(sanitizeDateRange({
        startDate: trip.startDate || targetDates[0] || "",
        endDate: trip.endDate || targetDates[targetDates.length - 1] || targetDates[0] || "",
      }));
      setGuestsState(clampGuestCount(trip.guests || 1));
      setCurrentActivities(Array.isArray(trip.activities) ? trip.activities : []);

      const saved = JSON.parse(window.localStorage.getItem(SAVED_STORAGE_KEY) || "[]");
      setSavedItinerariesState(Array.isArray(saved) ? saved : []);
    } catch {
      window.localStorage.removeItem(TRIP_STORAGE_KEY);
      window.localStorage.removeItem(SAVED_STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const current = JSON.parse(window.localStorage.getItem(TRIP_STORAGE_KEY) || "{}");
    window.localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify({
      ...current,
      ...dateRange,
      guests,
      activities: currentActivities,
    }));
    window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(savedItineraries));
  }, [currentActivities, dateRange, guests, isHydrated, savedItineraries]);

  // Single source of truth: any page that updates the date range updates it everywhere.
  const setDateRange = (nextRange) => {
    setDateRangeState((current) => sanitizeDateRange({ ...current, ...nextRange }));
  };

  // Single source of truth for pax; always kept at a sane, non-zero whole number.
  const setGuests = (nextGuests) => {
    setGuestsState((current) => clampGuestCount(typeof nextGuests === "function" ? nextGuests(current) : nextGuests));
  };

  const addActivity = (activity) => {
    setCurrentActivities((current) => {
      const exists = current.some((item) => item.name === activity.name && item.destination === activity.destination);
      return exists ? current : [...current, activity];
    });
  };

  const removeActivity = (index) => {
    setCurrentActivities((current) => current.filter((_, activityIndex) => activityIndex !== index));
  };

  const updateActivity = (index, changes) => {
    setCurrentActivities((current) => current.map((activity, activityIndex) => activityIndex === index ? { ...activity, ...changes } : activity));
  };

  const hasActivityConflict = (activity, ignoreIndex = -1) => {
    if (!activity?.assignedDay) return false;
    return currentActivities.some((item, index) => index !== ignoreIndex && item.assignedDay === activity.assignedDay);
  };

  const saveItinerary = (itinerary) => {
    setSavedItinerariesState((current) => [itinerary, ...current]);
  };

  const deleteItinerary = (createdAt) => {
    setSavedItinerariesState((current) => current.filter((itinerary) => itinerary.createdAt !== createdAt));
  };

  const clearCurrentPlan = () => {
    setDateRangeState({ startDate: "", endDate: "" });
    setGuestsState(1);
    setCurrentActivities([]);
    window.localStorage.removeItem(TRIP_STORAGE_KEY);
  };

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
    savedItineraries,
    saveItinerary,
    deleteItinerary,
    clearCurrentPlan,
  }), [dateRange, guests, currentActivities, savedItineraries]);

  return <TravelContext.Provider value={value}>{children}</TravelContext.Provider>;
}

export function useTravel() {
  const context = useContext(TravelContext);
  if (!context) throw new Error("useTravel must be used inside TravelProvider");
  return context;
}
