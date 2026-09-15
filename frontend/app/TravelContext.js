"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const TravelContext = createContext(null);
const TRIP_STORAGE_KEY = "anoTaraTrip";
const SAVED_STORAGE_KEY = "anoTaraSavedPlanners";

export function TravelProvider({ children }) {
  const [dateRange, setDateRangeState] = useState({ startDate: "", endDate: "" });
  const [currentActivities, setCurrentActivities] = useState([]);
  const [savedItineraries, setSavedItinerariesState] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const trip = JSON.parse(window.localStorage.getItem(TRIP_STORAGE_KEY) || "{}");
      const targetDates = Array.isArray(trip.targetDates) ? trip.targetDates : [];
      setDateRangeState({
        startDate: trip.startDate || targetDates[0] || "",
        endDate: trip.endDate || targetDates[targetDates.length - 1] || targetDates[0] || "",
      });
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
      activities: currentActivities,
    }));
    window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(savedItineraries));
  }, [currentActivities, dateRange, isHydrated, savedItineraries]);

  const setDateRange = (nextRange) => {
    setDateRangeState((current) => ({ ...current, ...nextRange }));
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

  const saveItinerary = (itinerary) => {
    setSavedItinerariesState((current) => [itinerary, ...current]);
  };

  const deleteItinerary = (createdAt) => {
    setSavedItinerariesState((current) => current.filter((itinerary) => itinerary.createdAt !== createdAt));
  };

  const clearCurrentPlan = () => {
    setDateRangeState({ startDate: "", endDate: "" });
    setCurrentActivities([]);
    window.localStorage.removeItem(TRIP_STORAGE_KEY);
  };

  const value = useMemo(() => ({
    dateRange,
    setDateRange,
    currentActivities,
    setCurrentActivities,
    addActivity,
    removeActivity,
    savedItineraries,
    saveItinerary,
    deleteItinerary,
    clearCurrentPlan,
  }), [dateRange, currentActivities, savedItineraries]);

  return <TravelContext.Provider value={value}>{children}</TravelContext.Provider>;
}

export function useTravel() {
  const context = useContext(TravelContext);
  if (!context) throw new Error("useTravel must be used inside TravelProvider");
  return context;
}
