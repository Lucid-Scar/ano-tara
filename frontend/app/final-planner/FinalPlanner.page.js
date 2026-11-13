"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import GarmentImage from "../../components/GarmentImage";
import { HazardBanner, WeatherCategoryBadge } from "../../components/WeatherSafety";
import ActivityTimePicker from "../../components/ActivityTimePicker";
import Footer from "../footer/Footer";
import Header from "../header/Header";
import { useTravel } from "../TravelContext";
import DynamicMap from "../../components/DynamicMap";
import {
  clampActivityTime,
  getGuestWarning,
  getMinSelectableDate,
  isPastOrTodayDate,
  isValidActivityTime,
  toDateString,
} from "../tripUtils";

const formatDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

const formatShortDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const generateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate || endDate < startDate) return [];
  const dates = [];
  const current = new Date(`${startDate}T00:00:00`);
  const last = new Date(`${endDate}T00:00:00`);
  while (current <= last) {
    dates.push(toDateString(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const valueFrom = (item, keys) =>
  keys.map((key) => item?.[key]).find((value) => value !== undefined && value !== null && value !== "");

const getTime = (activity) => {
  const start = valueFrom(activity, ["time", "schedule", "start_time"]);
  const end = valueFrom(activity, ["end_time"]);
  return start && end ? `${start} - ${end}` : start || "Time to be confirmed";
};

const getAssignedDay = (activity) => activity?.assignedDay || activity?.assigned_day || "";

const parsePriceToPhp = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || /^(not listed|tba|n\/a|na|unknown)$/i.test(text)) return null;
  const numeric = Number(text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(numeric)) return null;
  return text.includes("$") ? numeric * 56 : numeric;
};

const formatActivityPrice = (activity) => {
  const numeric = parsePriceToPhp(
    activity?.price ??
      activity?.estimated_price ??
      activity?.price_per_pax ??
      activity?.real_price_php ??
      activity?.price_display
  );
  if (numeric === 0) return "FREE";
  if (numeric !== null) return `₱${numeric.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
  return activity?.price_display || "Price not listed";
};

const fallbackDayImage = (activity) => {
  const name = `${activity?.name || ""} ${activity?.type || ""}`.toLowerCase();
  if (/food|seafood|culinary|dining|tasting|manokan|oyster/.test(name)) {
    return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80";
  }
  if (/museum|gallery|art|heritage|cultural/.test(name)) {
    return "https://images.unsplash.com/photo-1564399579883-451a5d44ec08?auto=format&fit=crop&w=1200&q=80";
  }
  return "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";
};

const dayImage = (activity) => activity?.image || fallbackDayImage(activity);

const describeWeather = (day) => {
  const forecast = day.weather_forecast || {};
  const historical = day.historical_weather || {};
  const condition = String(forecast.condition || "unavailable").toLowerCase();

  const tempRange =
    forecast.temperature_min_c != null && forecast.temperature_max_c != null
      ? `${forecast.temperature_min_c}°C to ${forecast.temperature_max_c}°C`
      : forecast.average_temperature != null
      ? `around ${forecast.average_temperature}°C`
      : "a comfortable temperature";
  const rainChance =
    forecast.precipitation_probability != null
      ? `${forecast.precipitation_probability}% chance of rain`
      : "an uncertain chance of rain";
  const rainAmount =
    forecast.precipitation_sum_mm != null ? ` (${forecast.precipitation_sum_mm} mm expected)` : "";
  const historicalLine = historical.dominant_condition
    ? ` Historically this date trends ${String(historical.dominant_condition).toLowerCase()}, averaging ${
        historical.average_temperature_c ?? "-"
      }°C with ${historical.average_rainfall_mm ?? "-"} mm of rain over ${historical.years || 5} years.`
    : "";
  return `Expect ${condition} skies, ${tempRange}, with ${rainChance}${rainAmount}.${historicalLine}`;
};

const groupOutfits = (items) =>
  items.reduce((groups, item) => {
    const setId = item.outfitSetId || "outfit-set-1";
    const key = `${item.date || item.day || "unassigned"}-${item.outfitSetName || "Outfit 1"}-${setId}`;
    let group = groups.find((entry) => entry.key === key);
    if (!group) {
      group = { key, name: item.outfitSetName || "Outfit 1", items: [] };
      groups.push(group);
    }
    group.items.push(item);
    return groups;
  }, []);

const extractActivitiesFromPlanner = (item) => {
  if (Array.isArray(item?.activities) && item.activities.length) return item.activities;
  const days = item?.itinerary || [];
  return days.flatMap((day, dayIndex) =>
    (day.scheduled_activities || []).map((activity) => ({
      ...activity,
      assignedDay: activity.assignedDay || activity.assigned_day || `Day ${dayIndex + 1}`,
      assigned_day: activity.assigned_day || activity.assignedDay || `Day ${dayIndex + 1}`,
      destination: activity.destination || activity.location || day.destination,
      guests: Number(activity.guests) || 1,
      time: activity.time || activity.schedule || activity.start_time || "10:00",
    }))
  );
};

const assignDaysInOrder = (list) =>
  list.map((activity, index) => {
    const day = `Day ${index + 1}`;
    return { ...activity, assignedDay: day, assigned_day: day };
  });

export default function FinalPlannerPage() {
  const {
    dateRange,
    setDateRange,
    guests,
    setGuests,
    currentActivities,
    setCurrentActivities,
    hasActivityConflict,
    outfits,
    setOutfits,
    savedItineraries,
    saveItinerary,
    deleteItinerary,
    renameItinerary,
    clearSavedItineraries,
    clearCurrentPlan,
  } = useTravel();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activities, setActivities] = useState([]);
  const [planner, setPlanner] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [warningActivityIndex, setWarningActivityIndex] = useState(-1);
  const [showSavedPlanners, setShowSavedPlanners] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  
  const [activeSettingsIndex, setActiveSettingsIndex] = useState(null);
  const [selectedGarment, setSelectedGarment] = useState(null);

  useEffect(() => {
    if (dateRange.startDate) setStartDate(dateRange.startDate);
    if (dateRange.endDate) setEndDate(dateRange.endDate);
  }, [dateRange.endDate, dateRange.startDate]);

  useEffect(() => {
    setActivities(currentActivities);
  }, [currentActivities]);

  const dates = generateDateRange(startDate, endDate);
  const emptyDayCount = Math.max(0, dates.length - activities.length);

  const commitActivities = (nextActivities) => {
    setActivities(nextActivities);
    setCurrentActivities(nextActivities);
    setPlanner(null);
  };

  const changeActivity = (index, changes) => {
    const nextChanges = Object.prototype.hasOwnProperty.call(changes, "time")
      ? { ...changes, time: clampActivityTime(changes.time) }
      : changes;
    const next = activities.map((activity, activityIndex) =>
      activityIndex === index
        ? {
            ...activity,
            ...nextChanges,
            ...(nextChanges.assignedDay ? { assigned_day: nextChanges.assignedDay } : {}),
          }
        : activity
    );

    if (nextChanges.assignedDay && hasActivityConflict(next[index], index)) {
      const otherIndex = next.findIndex(
        (activity, activityIndex) => activityIndex !== index && getAssignedDay(activity) === changes.assignedDay
      );
      if (otherIndex >= 0 && getAssignedDay(activities[index])) {
        const previousDay = getAssignedDay(activities[index]);
        next[otherIndex] = { ...next[otherIndex], assignedDay: previousDay, assigned_day: previousDay };
      }
    }

    const ordered = next
      .map((activity, originalIndex) => ({
        activity,
        originalIndex,
        day: Number(String(getAssignedDay(activity)).replace("Day ", "")) || Number.MAX_SAFE_INTEGER,
      }))
      .sort((left, right) => left.day - right.day || left.originalIndex - right.originalIndex)
      .map(({ activity }) => activity);

    setWarningActivityIndex(-1);
    setErrorMessage("");
    commitActivities(ordered);
  };

  const reorderByDrag = (fromIndex, toIndex) => {
    if (fromIndex == null || toIndex == null || fromIndex === toIndex) return;
    const next = [...activities];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    commitActivities(assignDaysInOrder(next));
  };

  const changeActivityGuests = (index, amount) => {
    const nextGuests = Math.max(1, (Number(activities[index]?.guests) || 1) + amount);
    if (index === 0) setGuests(nextGuests);
    changeActivity(index, { guests: nextGuests });
  };

  const removeOutfit = (id) => {
    const updatedOutfits = outfits.filter((outfit) => outfit.id !== id);
    setOutfits(updatedOutfits);
    setPlanner((current) => (current ? { ...current, outfits: updatedOutfits } : current));
  };

  const changeOutfitDay = (id, nextDate) => {
    const dayIndex = dates.indexOf(nextDate);
    const updatedOutfits = outfits.map((outfit) =>
      outfit.id === id ? { ...outfit, date: nextDate, day: `Day ${dayIndex + 1}` } : outfit
    );
    setOutfits(updatedOutfits);
    setPlanner((current) => (current ? { ...current, outfits: updatedOutfits } : current));
  };

  const activeOutfits = (planner?.outfits?.length ? planner.outfits : outfits) || [];
  const outfitsForDay = (date, dayIndex) =>
    activeOutfits.filter((outfit) => outfit.date === date || outfit.day === `Day ${dayIndex + 1}`);

  const openSavedPlanner = (item) => {
    const restored = extractActivitiesFromPlanner(item);
    const firstDay = item.itinerary?.[0]?.date || item.itinerary?.[0]?.day || "";
    const lastDay =
      item.itinerary?.[item.itinerary.length - 1]?.date ||
      item.itinerary?.[item.itinerary.length - 1]?.day ||
      firstDay;
    const nextStart = item.dateRange?.startDate || firstDay;
    const nextEnd = item.dateRange?.endDate || lastDay;
    if (nextStart && nextEnd) {
      setStartDate(nextStart);
      setEndDate(nextEnd);
      setDateRange({ startDate: nextStart, endDate: nextEnd });
    }
    if (item.guests) setGuests(item.guests);
    setOutfits(Array.isArray(item.outfits) ? item.outfits : []);
    setActivities(restored);
    setCurrentActivities(restored);
    setPlanner(item);
    setShowSavedPlanners(false);
    setErrorMessage("");
  };

  const generatePlanner = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    
    let targetDates = generateDateRange(startDate, endDate);
    
    // Prevent generating if dates are invalid
    if (!targetDates.length || isPastOrTodayDate(startDate)) {
      setErrorMessage("Choose a valid future date range.");
      return;
    }
    
    if (!activities.length) {
      setErrorMessage("Add at least one activity before generating.");
      return;
    }

    // NEW RULE: Require > 1 activity for 1-day itineraries
    if (targetDates.length === 1 && activities.length <= 1) {
      setErrorMessage("A 1-day itinerary must have more than 1 activity.");
      return;
    }

    let scheduledActivities = activities;
    if (targetDates.length > activities.length) {
      const confirmed = window.confirm(
        `You selected ${targetDates.length} days but only ${activities.length} activit${
          activities.length === 1 ? "y" : "ies"
        }.\n\nDays without activities will not appear in the generated planner. Activities will keep their current order as Day 1, Day 2, and so on.\n\nContinue?`
      );
      if (!confirmed) return;
      scheduledActivities = assignDaysInOrder(activities);
      targetDates = targetDates.slice(0, scheduledActivities.length);
      commitActivities(scheduledActivities);
    }

    const hasInvalidSchedule = scheduledActivities.some((activity) => {
      const dayIndex = Number(String(activity.assignedDay || "").replace("Day ", "")) - 1;
      return !targetDates[dayIndex] || !isValidActivityTime(activity.time);
    });
    if (hasInvalidSchedule) {
      setErrorMessage("Each activity needs a valid trip day and a time between 6:00 AM and 11:00 PM.");
      return;
    }

    setIsLoading(true);
    try {
      const primaryActivity = scheduledActivities[0];
      const hotelType =
        primaryActivity.hotel_type ||
        (String(primaryActivity.type).toLowerCase() === "outdoor" ? "Resort Hotel" : "City Hotel");
      const guestCount = Number(primaryActivity.guests) || guests;
      const lastTripDate = targetDates[targetDates.length - 1];
      const checkOutDate = new Date(`${lastTripDate}T00:00:00`);
      if (lastTripDate === targetDates[0]) checkOutDate.setDate(checkOutDate.getDate() + 1);

      const priceResponse = await fetch("/api/backend/predict-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          check_in: targetDates[0],
          check_out: toDateString(checkOutDate),
          guests: guestCount,
          destination: primaryActivity.destination,
          hotel_type: hotelType,
          room_type: "Standard Room",
        }),
      });
      const priceText = await priceResponse.text();
      let priceData;
      try {
        priceData = priceText ? JSON.parse(priceText) : {};
      } catch {
        throw new Error(`Price service returned an invalid response (${priceResponse.status}).`);
      }
      if (!priceResponse.ok) throw new Error(priceData?.detail || "Could not fetch the MLR price.");
      const mlrPrice = Number(priceData.total_price ?? priceData.price);
      if (!Number.isFinite(mlrPrice)) throw new Error("The MLR price response was invalid.");

      const response = await fetch("/api/backend/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_dates: targetDates,
          raw_activities: scheduledActivities.map((activity) => ({
            ...activity,
            assigned_day: activity.assignedDay,
            room_type: activity.roomType || activity.room_type || "Standard Room",
          })),
          mlr_price: mlrPrice,
          guests: guestCount,
          outfit: outfits[0] || undefined,
        }),
      });
      const responseText = await response.text();
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(`Planner service returned an invalid response (${response.status}).`);
      }
      if (!response.ok) throw new Error(data?.detail?.[0]?.msg || data?.detail || "Could not generate the planner.");

      const filledDays = (data.itinerary || []).filter((day) => (day.scheduled_activities || []).length > 0);
      const newPlanner = {
        ...data,
        itinerary: filledDays.length ? filledDays : data.itinerary,
        name: `${primaryActivity.destination || "Travel"} itinerary - ${formatDate(targetDates[0])}`,
        activities: scheduledActivities,
        dateRange: { startDate: targetDates[0], endDate: targetDates[targetDates.length - 1] },
        guests: guestCount,
        outfits,
        priceEstimate: {
          amount: mlrPrice,
          perPerson: mlrPrice / Math.max(1, guestCount),
          source: priceData.source,
          destination: primaryActivity.destination,
        },
        createdAt: new Date().toLocaleString(),
      };
      setPlanner(newPlanner);
      saveItinerary(newPlanner);
    } catch (error) {
      setErrorMessage(error.message || "Could not connect to the backend.");
    } finally {
      setIsLoading(false);
    }
  };

  const printPlanner = () => {
    if (!planner) return;
    window.print();
  };

  const itineraryDays = (planner?.itinerary || [])
    .filter((day) => (day.scheduled_activities || []).length > 0)
    .map((day, index) => ({
      ...day,
      dayNumber: `Day ${index + 1}`,
      dateLabel: formatDate(day.date || day.day),
      weatherDescription: describeWeather(day),
      scheduled_activities: Array.isArray(day.scheduled_activities) ? day.scheduled_activities : [],
      route_segments: Array.isArray(day.route_segments) ? day.route_segments : [],
      activities: (Array.isArray(day.scheduled_activities) ? day.scheduled_activities : []).map((activity) => ({
        ...activity,
        location: activity.location || activity.destination,
        price: parsePriceToPhp(
          activity.estimated_price ?? activity.price ?? activity.price_per_pax ?? activity.price_display
        ),
        guests: Number(activity.guests) || guests,
      })),
    }));

  const totalPrice = itineraryDays.reduce(
    (tripTotal, day) =>
      tripTotal + day.activities.reduce((dayTotal, activity) => dayTotal + (Number.isFinite(activity.price) ? activity.price : 0), 0),
    0
  );
  const initialGuestCount = Math.max(1, Number(planner?.guests) || guests || 1);
  const pricePerPerson = totalPrice / initialGuestCount;
  const plannerStart =
    planner?.dateRange?.startDate || itineraryDays[0]?.date || itineraryDays[0]?.day || startDate;
  const plannerEnd =
    planner?.dateRange?.endDate ||
    itineraryDays[itineraryDays.length - 1]?.date ||
    itineraryDays[itineraryDays.length - 1]?.day ||
    endDate;
  const allTripActivities = itineraryDays.flatMap((day) => day.activities);
  const allTripRoutes = itineraryDays.flatMap((day) => day.route_segments || []);

  const estimatedAdmissionsTotal = activities.reduce((sum, activity) => {
    const parsed = parsePriceToPhp(
      activity?.price ??
        activity?.estimated_price ??
        activity?.price_per_pax ??
        activity?.real_price_php ??
        activity?.price_display
    );
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);

  return (
    <main className="min-h-screen bg-[#FFFDFB] text-slate-900 flex flex-col">
      <div className="planner-controls print:hidden">
        <Header />
      </div>

      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 mx-auto flex-grow print:hidden">
        
        {/* Workspace Header */}
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-extrabold uppercase text-slate-950 sm:text-4xl">
              Itinerary Planner
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSavedPlanners((current) => !current)}
              title="Archived Plans"
              className={`relative inline-flex items-center justify-center h-10 w-10 rounded-xl border transition-all shadow-sm ${
                showSavedPlanners
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              {savedItineraries.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white shadow-xs">
                  {savedItineraries.length}
                </span>
              )}
            </button>

            <button
              type="button"
              title="Reset Canvas"
              onClick={() => {
                clearCurrentPlan();
                setActivities([]);
                setPlanner(null);
                setErrorMessage("");
                setWarningActivityIndex(-1);
              }}
              className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-rose-200 bg-white text-rose-600 shadow-sm transition hover:bg-rose-50 hover:border-rose-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Saved Planners Drawer */}
        {showSavedPlanners ? (
          <div className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <p className="text-sm font-black text-slate-900">Your Travel Archives</p>
                <p className="text-xs text-slate-500">Restore dates, activities, and outfits to edit or reprint.</p>
              </div>
              {savedItineraries.length ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Clear all saved planners? This cannot be undone.")) {
                      clearSavedItineraries();
                      setPlanner(null);
                    }
                  }}
                  className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
                >
                  Clear all
                </button>
              ) : null}
            </div>
            {savedItineraries.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {savedItineraries.map((item) => (
                  <div key={item.createdAt} className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-[#FFFDFB] p-3 shadow-xs">
                    <input
                      aria-label="Saved planner name"
                      value={item.name || ""}
                      onChange={(event) => {
                        const nextName = event.target.value;
                        renameItinerary(item.createdAt, nextName);
                        if (planner?.createdAt === item.createdAt) {
                          setPlanner((current) => (current ? { ...current, name: nextName } : current));
                        }
                      }}
                      onBlur={() => { if (!item.name?.trim()) renameItinerary(item.createdAt, "Saved itinerary"); }}
                      className="w-full rounded-lg border border-transparent bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white hover:bg-slate-100"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openSavedPlanner(item)}
                        className="flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800"
                      >
                        Load Canvas
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteItinerary(item.createdAt);
                          if (planner?.createdAt === item.createdAt) setPlanner(null);
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-500 italic">The archive is currently empty.</p>
            )}
          </div>
        ) : null}

        <form onSubmit={generatePlanner} className="grid items-start gap-10 lg:grid-cols-[1fr_450px]">
          <div className="space-y-10 min-w-0">
            <section>
              <div className="flex items-end justify-between border-b-2 border-slate-900 pb-2">
                <h2 className="text-lg font-black text-slate-900">Itinerary Flow</h2>
                {dates.length > 0 ? (
                  <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">{dates.length} Days</span>
                ) : null}
              </div>
              <div className="mt-5 flex flex-wrap gap-4">
                <label className="flex flex-1 min-w-[180px] flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Departure</span>
                  <input
                    type="date"
                    min={getMinSelectableDate()}
                    value={startDate}
                    onChange={(event) => {
                      const next = event.target.value;
                      const nextEnd = endDate < next ? next : endDate;
                      setStartDate(next);
                      setEndDate(nextEnd);
                      setDateRange({ startDate: next, endDate: nextEnd });
                      setPlanner(null);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 shadow-xs outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                </label>
                <div className="hidden sm:flex items-center pt-5 text-slate-300">—</div>
                <label className="flex flex-1 min-w-[180px] flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Return</span>
                  <input
                    type="date"
                    min={startDate || getMinSelectableDate()}
                    value={endDate}
                    onChange={(event) => {
                      setEndDate(event.target.value);
                      setDateRange({ startDate, endDate: event.target.value });
                      setPlanner(null);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 shadow-xs outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                </label>
              </div>
            </section>

            <section>
              <div className="flex items-end justify-between pb-2 sticky top-0 bg-[#FFFDFB]/95 backdrop-blur-md z-10 border-b border-slate-100 mb-4">
                <h2 className="text-lg font-black text-slate-900">Activities</h2>
                <Link
                  href="/destinations"
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 transition underline underline-offset-4"
                >
                  + Add Stop
                </Link>
              </div>

              {itineraryDays.map((day) => (
                <div key={day.dayNumber}>
                  <p className="text-sm font-bold text-slate-950">{day.dayNumber} — {day.dateLabel}</p>
                  <WeatherCategoryBadge item={day} />
                  <HazardBanner item={day} />
                </div>
              ))}

              <div className="relative ml-2">
                {activities.length ? (
                  <div className="border-l-2 border-slate-200 pl-5 space-y-4 pb-6">
                    {activities.map((activity, index) => {
                      const dayLabel = getAssignedDay(activity) || `Day ${index + 1}`;
                      const matchedDay = itineraryDays.find(
                        (day, dayIdx) => day.dayNumber === dayLabel || `Day ${dayIdx + 1}` === dayLabel
                      );
                      const matchedActivity = matchedDay?.activities?.find((item) => item.name === activity.name);
                      const activeItem = matchedActivity || activity;
                      const isEditing = activeSettingsIndex === index;

                      return (
                        <article
                          key={`${activity.name}-${activity.destination}-${index}`}
                          draggable
                          onDragStart={() => setDragIndex(index)}
                          onDragOver={(event) => { event.preventDefault(); setDropIndex(index); }}
                          onDragLeave={() => setDropIndex((current) => (current === index ? null : current))}
                          onDrop={(event) => {
                            event.preventDefault();
                            reorderByDrag(dragIndex, index);
                            setDragIndex(null);
                            setDropIndex(null);
                          }}
                          onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                          className={`relative group cursor-grab active:cursor-grabbing transition-all ${dragIndex === index ? "opacity-50 scale-95" : ""}`}
                        >
                          {/* Timeline Node Dot */}
                          <div className={`absolute -left-[27px] top-4 w-[12px] h-[12px] rounded-full border-2 bg-white transition-colors duration-300 ${dropIndex === index ? 'border-emerald-500 scale-125' : 'border-slate-900 group-hover:border-slate-500'}`} />
                          
                          {/* Compact Node Card */}
                          <div className={`rounded-xl border bg-white p-3.5 shadow-sm transition-all duration-300 ${
                            dropIndex === index
                              ? "border-emerald-500 ring-2 ring-emerald-50 translate-x-1"
                              : "border-slate-200 hover:border-slate-300"
                          }`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-600 tracking-wider">
                                    {dayLabel}
                                  </span>
                                  {matchedDay ? (
                                    <WeatherCategoryBadge item={matchedActivity || matchedDay} />
                                  ) : null}
                                </div>
                                <h3 className="truncate text-sm font-black text-slate-900">{activity.name}</h3>
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveSettingsIndex(isEditing ? null : index)}
                                className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition"
                                title="Edit Activity"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            </div>

                            {/* Default non-editing details view minimizing whitespace */}
                            {!isEditing && (
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 font-medium">
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  {clampActivityTime(activity.time) || "10:00"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                  {activity.guests || guests || 1} Pax
                                </span>
                                <span className="flex items-center gap-1 font-bold text-emerald-700">
                                  {formatActivityPrice(activeItem)}
                                </span>
                              </div>
                            )}

                            {/* Inline Editor Drawer requested by user */}
                            {isEditing ? (
                              <div className="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-100 animate-in fade-in slide-in-from-top-2">
                                <div className="grid gap-5 sm:grid-cols-2">
                                  <label className="flex flex-col gap-1.5 text-[10px] font-black uppercase text-slate-500">
                                    Assign Day
                                    <select
                                      value={dates.some((_, dayIndex) => getAssignedDay(activity) === `Day ${dayIndex + 1}`) ? getAssignedDay(activity) : ""}
                                      onChange={(event) => changeActivity(index, { assignedDay: event.target.value })}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-slate-900"
                                    >
                                      <option value="" disabled>Select day</option>
                                      {dates.map((date, dayIndex) => (
                                        <option key={date} value={`Day ${dayIndex + 1}`}>
                                          Day {dayIndex + 1} · {new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <div className="flex flex-col gap-1.5 text-[10px] font-black uppercase text-slate-500">
                                    Time Schedule
                                    <ActivityTimePicker
                                      value={clampActivityTime(activity.time)}
                                      onChange={(time) => changeActivity(index, { time })}
                                    />
                                  </div>
                                  
                                  <div className="flex items-center justify-between gap-4 rounded-lg bg-white border border-slate-200 p-2 sm:col-span-2">
                                    <span className="text-xs font-bold text-slate-700 ml-2">Guest Count</span>
                                    <div className="flex items-center gap-3">
                                      <button type="button" onClick={() => changeActivityGuests(index, -1)} className="h-7 w-7 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700">-</button>
                                      <span className="min-w-[20px] text-center text-sm font-black">{activity.guests || 1}</span>
                                      <button type="button" onClick={() => changeActivityGuests(index, 1)} className="h-7 w-7 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700">+</button>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      commitActivities(activities.filter((_, activityIndex) => activityIndex !== index));
                                      setActiveSettingsIndex(null);
                                    }}
                                    className="text-xs font-bold text-rose-600 hover:text-rose-700 underline underline-offset-2"
                                  >
                                    Remove Stop
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setActiveSettingsIndex(null)}
                                    className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                                  >
                                    Done
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-8 text-center ml-2">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-slate-800">Your canvas is blank</p>
                    <Link href="/destinations" className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 shadow-sm">
                      Browse Destinations
                    </Link>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-8 flex flex-col gap-6 lg:h-[calc(100vh-100px)] lg:overflow-y-auto pr-1">
            
            {/* Wardrobe Module */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs shrink-0">
              <div className="flex items-end justify-between border-b border-slate-100 pb-2.5 mb-3.5">
                <h2 className="text-base font-black text-slate-900">Wardrobe</h2>
                <Link href="/predict-outfit?from=planner" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition underline underline-offset-4">
                  + Add Fit
                </Link>
              </div>

              {outfits.length ? (
                <div className="space-y-4">
                  {groupOutfits(outfits).map((group) => (
                    <div key={group.key} className="space-y-2">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-800">{group.name}</p>
                      
                      <div className="grid grid-cols-3 gap-2">
                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => setSelectedGarment(item)}
                            className="group relative cursor-pointer rounded-xl border border-slate-100 bg-slate-50 p-1.5 transition hover:border-slate-400 hover:shadow-2xs flex flex-col items-center"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeOutfit(item.id);
                              }}
                              className="absolute -right-1 -top-1 z-10 h-4 w-4 rounded-full bg-rose-100 border border-rose-200 text-[9px] font-black text-rose-600 opacity-0 transition group-hover:opacity-100 hover:bg-rose-600 hover:text-white flex items-center justify-center shadow-xs"
                              aria-label="Remove garment"
                            >
                              ✕
                            </button>
                            <div 
                              className="aspect-square w-14 overflow-hidden rounded-lg bg-white border border-slate-100 mb-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGarment(item);
                              }}
                            >
                              <GarmentImage src={item.image} alt={item.category} className="h-full w-full object-cover pointer-events-none" />
                            </div>
                            <p className="truncate w-full px-0.5 text-[8px] font-bold text-slate-700 text-center">{item.category}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="text-xs leading-relaxed text-slate-500">
                    No garments in your digital closet. Pair visual outfits to your travel days for a complete itinerary.
                  </p>
                </div>
              )}
            </div>

            {/* Checkout / Status Module */}
            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 shadow-lg text-white shrink-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Readiness Check</p>
              
              <dl className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400 font-medium">Timeline span</dt>
                  <dd className="font-bold">{dates.length ? `${dates.length} Days` : "—"}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400 font-medium">Plotted nodes</dt>
                  <dd className="font-bold">{activities.length}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800 pt-2.5 mt-2.5">
                  <dt className="text-slate-400 font-medium">Admissions Total</dt>
                  <dd className="font-black text-emerald-400 tracking-wide">
                    ₱{estimatedAdmissionsTotal.toLocaleString("en-PH")}
                  </dd>
                </div>
              </dl>

              <button
                type="submit"
                disabled={isLoading || !activities.length}
                className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-xs font-black tracking-wide text-slate-900 transition hover:bg-slate-100 hover:scale-[1.01] active:scale-100 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,255,255,0.08)]"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Synthesizing...
                  </span>
                ) : "Publish Travel Brochure"}
              </button>
              
              {errorMessage && warningActivityIndex < 0 ? (
                <p className="mt-3 rounded-lg bg-rose-950/50 border border-rose-900/50 p-2.5 text-[11px] font-semibold text-rose-300 text-center">
                  {errorMessage}
                </p>
              ) : null}
            </div>

          </aside>
        </form>
      </div>

      {/* GARMENT ANALYZATION MODAL */}
      {selectedGarment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-2xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <button
              onClick={() => setSelectedGarment(null)}
              className="absolute top-3.5 right-3.5 h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
            >
              ✕
            </button>
            <div className="flex gap-3.5 items-center border-b border-slate-100 pb-3.5 mb-3.5">
              <div className="h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shrink-0">
                <GarmentImage src={selectedGarment.image} alt={selectedGarment.category} className="h-full w-full object-cover" />
              </div>
              <div>
                <span className="rounded bg-slate-900 px-2 py-0.5 text-[8px] font-black uppercase text-white tracking-wider">Analyzation Report</span>
                <h3 className="text-base font-black text-slate-900 mt-0.5">{selectedGarment.category}</h3>
                <p className="text-[11px] text-slate-500">{selectedGarment.outfitSetName || "Outfit Set"}</p>
              </div>
            </div>
            
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <p className="font-bold text-slate-900 mb-0.5 text-[11px]">Weather Adaptability</p>
                <p className="text-[11px]">Optimized for breathable comfort, providing balanced temperature insulation against outdoor tropical shifts.</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <p className="font-bold text-slate-900 mb-0.5 text-[11px]">Style Vibe & Pairing</p>
                <p className="text-[11px]">Matches coquette and minimalist aesthetic styles well. Recommended for walking tours and café visits.</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <p className="font-bold text-slate-900 mb-0.5 text-[11px]">Assigned Timeline</p>
                <p className="text-[11px]">{selectedGarment.date ? `Assigned to ${formatShortDate(selectedGarment.date)}` : "Unassigned to any specific date yet."}</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedGarment(null)}
              className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              Close Report
            </button>
          </div>
        </div>
      ) : null}

      {/* PRINT-FRIENDLY DOWNLOADABLE BROCHURE TEMPLATE */}
      {planner ? (
        <div className="planner-document fixed inset-0 z-50 flex flex-col bg-[#FFFDFB] overflow-y-auto animate-in slide-in-from-bottom-8 fade-in duration-500 print:relative print:w-full print:inset-auto print:block">
          
          {/* FORCES PORTRAIT PRINTING */}
          <style>{`
            @media print {
              @page { 
                size: portrait;
                margin: 0.5in;
              }
            }
          `}</style>

          <div className="sticky top-0 z-40 bg-[#FFFDFB]/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between print:hidden shadow-sm">
            <button
              onClick={() => setPlanner(null)}
              className="group flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-900 transition"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 group-hover:bg-slate-200 transition">←</span>
              Back to Workspace
            </button>
            <button
              onClick={printPlanner}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black tracking-wide text-white shadow-md transition hover:bg-slate-800"
            >
              Print Brochure
            </button>
          </div>

          {/* The Actual Printed Document Canvas */}
          <div className="planner-landscape mx-auto w-full max-w-[850px] p-8 sm:p-12 text-slate-900 relative bg-[#FFFDFB] shadow-2xl print:shadow-none min-h-[1100px]">
            
            {/* Header Area */}
            <div className="mb-4 border-b-2 border-slate-900 pb-3 flex justify-between items-end">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Travel Itinerary</span>
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                {plannerStart && plannerEnd ? `${formatShortDate(plannerStart)} TO ${formatShortDate(plannerEnd)}` : "DATES TBC"}
              </span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-black text-slate-950 uppercase mb-10 text-center tracking-tight">
              ANO TARA?
            </h1>

            {/* Dynamic Column Grid Area (Adapted for Portrait Layout) */}
            <div className="relative">
              <div 
                className={`grid border-t-2 border-l-2 border-slate-200 bg-[#FFFDFB] ${
                  itineraryDays.length === 1 ? "grid-cols-1" : "grid-cols-2"
                }`}
              >
                {itineraryDays.map((day, index) => (
                  <div key={day.dayNumber} className="border-b-2 border-r-2 border-slate-200 p-6 min-h-[260px] relative">
                    {/* Day Header Row */}
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-lg font-black uppercase tracking-wider text-slate-900">Day {index + 1}</span>
                      <WeatherCategoryBadge item={day} />
                    </div>
                    <HazardBanner item={day} />
                    
                    {/* Full Weather Description */}
                    {day.weatherDescription && (
                      <p className="text-[11px] text-slate-500 italic leading-relaxed mb-6 border-b border-slate-100 pb-4">
                        {day.weatherDescription}
                      </p>
                    )}
                    
                    {/* Activities List */}
                    <ul className="space-y-6">
                      {day.activities.map((activity, actIdx) => (
                        <li key={actIdx} className="flex flex-col gap-3 border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                          {/* Image & Destination Header */}
                          <div className="flex gap-4 items-start">
                            <img
                              src={dayImage(activity)}
                              alt={activity.name}
                              className="w-16 h-16 object-cover rounded-lg shadow-sm border border-slate-200 shrink-0"
                            />
                            <div className="flex-1 min-w-0 mt-0.5">
                              <span className="font-black text-slate-900 text-base block leading-tight mb-1">{activity.name}</span>
                              <span className="font-bold text-slate-500 text-xs uppercase tracking-wider block mb-1.5">
                                {clampActivityTime(activity.time) || "10:00 AM"}
                              </span>
                              {activity.location && (
                                <span className="flex items-start gap-1 text-[11px] font-semibold text-slate-600 leading-tight">
                                  <svg className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                  {activity.location}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Details below image */}
                          <div className="mt-1 pl-[80px]">
                            {activity.description && (
                              <p className="text-[13px] text-slate-700 block mb-3 leading-relaxed">
                                {activity.description}
                              </p>
                            )}
                            <span className="inline-flex items-center gap-2 rounded bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600 border border-slate-200 shadow-xs">
                              <span>{activity.guests || 1} Pax</span>
                              <span className="text-slate-300">|</span>
                              <span className="text-emerald-700">{formatActivityPrice(activity)}</span>
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                
                {/* Optional Filler Cell for Odd Number of Days in a 2-Column Grid */}
                {(itineraryDays.length > 1 && itineraryDays.length % 2 !== 0) && (
                   <div className="border-b-2 border-r-2 border-slate-200 p-5 min-h-[260px] bg-slate-50/50"></div>
                )}
              </div>
            </div>

            {/* Footer Metrics */}
            <div className="mt-10 border-t-2 border-slate-900 pt-5 flex justify-between text-xs font-black uppercase tracking-widest text-slate-900">
               <span>Est. Accommodations: {planner?.priceEstimate?.amount == null ? "TBA" : `₱${Number(planner.priceEstimate.amount).toLocaleString()}`}</span>
               <span className="text-emerald-700">Total Admissions: ₱{totalPrice.toLocaleString()}</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="print:hidden mt-4">
        <Footer />
      </div>
    </main>
  );
}
