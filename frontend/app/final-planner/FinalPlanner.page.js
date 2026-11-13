"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import GarmentImage from "../../components/GarmentImage";
import { getActivityImagePath, DESTINATION_PLACEHOLDER } from "../../lib/resolveActivityImage";
import { HazardBanner, WeatherCategoryBadge } from "../../components/WeatherSafety";
import ActivityTimePicker from "../../components/ActivityTimePicker";
import Footer from "../footer/Footer";
import Header from "../header/Header";
import { useTravel, isCalendarDate, validateActivitySchedules, archivePlanKey } from "../TravelContext";
import DynamicMap from "../../components/DynamicMap";
import {
  getGuestWarning,
  getMinSelectableDate,
  isPastOrTodayDate,
  isValidActivityTime,
  toDateString,
  WeatherIcon,
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
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate) || endDate < startDate) return [];
  const dates = [];
  const current = new Date(`${startDate}T00:00:00`);
  const last = new Date(`${endDate}T00:00:00`);
  while (current <= last) {
    dates.push(toDateString(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const getActivityWeather = (activity) =>
  activity?.weather_forecast?.condition || activity?.weather || activity?.weather_condition || "";

const getAssignedDay = (activity) => activity?.assignedDay || activity?.assigned_day || "";
const getAssignedDayNumber = (activity) => {
  const match = /^Day ([1-9]\d*)$/.exec(getAssignedDay(activity));
  return match ? Number(match[1]) : 0;
};

const parsePriceToPhp = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || /^(not listed|tba|n\/a|na|unknown)$/i.test(text)) return null;
  const numeric = Number(text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(numeric)) return null;
  return /USD|\$/i.test(text) ? numeric * 63.78 : numeric;
};

const getActivityPricePerGuestPhp = (activity) => {
  const pricePerGuest = parsePriceToPhp(activity?.price_per_pax);
  const prices = [pricePerGuest, activity?.real_price_php, activity?.price_display, activity?.price]
    .map(parsePriceToPhp);
  const publishedPrice = prices.find((price) => price !== null && price > 0);
  if (publishedPrice !== undefined) return publishedPrice;

  const estimatedTotal = parsePriceToPhp(activity?.estimated_price);
  const guestCount = Math.max(1, Number(activity?.guests) || 1);
  if (estimatedTotal !== null && estimatedTotal > 0) return estimatedTotal / guestCount;
  if (pricePerGuest !== null) return pricePerGuest;
  if (prices.some((price) => price === 0) || /^free(?:\s*\(|$)/i.test(activity?.price_display || "")) return 0;
  return null;
};

const getActivityTotalPricePhp = (activity) => {
  const pricePerGuest = getActivityPricePerGuestPhp(activity);
  return pricePerGuest === null
    ? null
    : pricePerGuest * Math.max(1, Number(activity?.guests) || 1);
};

const formatActivityPrice = (activity) => {
  const numeric = getActivityTotalPricePhp(activity);
  if (numeric === 0) return "FREE";
  if (numeric !== null) return `₱${numeric.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
  return activity?.price_display || "Price not listed";
};

const describeWeather = (day) => {
  const forecast = day.weather_forecast || {};
  const historical = day.historical_weather || {};
  if (!forecast.condition && !day.expected_weather) {
    return "Weather details are unavailable for this day. Check the local forecast before departure.";
  }
  const condition = String(forecast.condition || day.expected_weather).toLowerCase();

  const tempRange =
    forecast.temperature_min_c != null && forecast.temperature_max_c != null
      ? `${forecast.temperature_min_c}°C to ${forecast.temperature_max_c}°C`
      : forecast.average_temperature != null
      ? `around ${forecast.average_temperature}°C`
      : "temperature data unavailable";
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
      time: activity.time || activity.schedule || activity.start_time || "",
    }))
  );
};

const assignDaysInOrder = (list) =>
  list.map((activity, index) => {
    const day = `Day ${index + 1}`;
    return { ...activity, assignedDay: day, assigned_day: day };
  });

// Print layouts are kept with their owning planner page.
function PlannerOverview({ days, formatPrice, getWeather, guests }) {
  return (
    <div className="overview-day-list">
      {days.map((day) => {
        return (
          <section key={day.dayNumber} className="overview-day-card">
            <header className="overview-day-heading"><h2>{day.dayNumber}</h2><p>{day.dateLabel}</p></header>
              <ol className="overview-stops">{day.activities.map((activity, index) => (
                <li key={index}>
                  <div className="overview-location"><h3>{activity.name}</h3>
                  <p>{activity.location || activity.destination || "Location not listed"}</p></div>
                  <dl className="overview-facts">
                    <div><dt>Price</dt><dd>{formatPrice(activity)}</dd></div>
                    <div><dt>Weather</dt><dd>{getWeather(activity) || day.weather_forecast?.condition || day.expected_weather || "Unavailable"}</dd></div>
                    <div><dt>Pax</dt><dd>{activity.guests || guests}</dd></div>
                  </dl>
                </li>
              ))}</ol>
          </section>
        );
      })}
    </div>
  );
}


const hasCoordinates = (activity) =>
  activity.exact_latitude != null && activity.exact_latitude !== "" &&
  activity.exact_longitude != null && activity.exact_longitude !== "" &&
  Number.isFinite(Number(activity.exact_latitude)) && Math.abs(Number(activity.exact_latitude)) <= 90 &&
  Number.isFinite(Number(activity.exact_longitude)) && Math.abs(Number(activity.exact_longitude)) <= 180;

function PlannerDetails({ days, formatPrice, getWeather, guests, outfitsForDay }) {
  return <div className="detailed-days">{days.map((day, index) => {
    const outfits = outfitsForDay(day.date || day.day, Number(day.dayNumber.replace("Day ", "")) - 1);
    const mappedActivities = day.activities.filter(hasCoordinates);
    return (
      <section key={day.dayNumber} className="print-day detailed-day">
        <header className="print-day-heading"><h2>{day.dayNumber}</h2><p>{day.dateLabel}</p></header>
        <div className="document-weather"><h3>Weather &amp; what to expect</h3><p>{day.weatherDescription}</p></div>
        <ol className="document-stops">{day.activities.map((activity, activityIndex) => (
          <li key={activityIndex}>
            <div className="document-stop-heading"><span className="stop-number">{String(activityIndex + 1).padStart(2, "0")}</span><div><h3>{activity.name}</h3><p>{activity.location || activity.destination || "Location not listed"}</p></div><strong>{formatPrice(activity)}</strong></div>
            <p className="document-meta">{activity.time || activity.schedule || activity.start_time || "Time to be confirmed"} · {activity.guests || guests} pax · {getWeather(activity) || day.weather_forecast?.condition || day.expected_weather || "Weather unavailable"}</p>
            {activity.description && <p>{activity.description}</p>}
          </li>
        ))}</ol>
        <section className="document-outfits"><h3>What to wear</h3>
          {outfits.length ? <div className="document-outfit-grid">{outfits.map((outfit) => <figure key={outfit.id}><GarmentImage src={outfit.image} alt={outfit.category} className="document-garment" /><figcaption><strong>{outfit.category}</strong><span>{outfit.outfitSetName || "Your outfit"}</span></figcaption></figure>)}</div> : <p>No outfit assigned to this day.</p>}
        </section>
        <section className="document-map"><h3>Destination map</h3>
          {mappedActivities.length ? <DynamicMap activities={mappedActivities} routeSegments={day.route_segments} /> : <p>Map coordinates are unavailable for this day.</p>}
          <div className="document-map-links">{day.activities.map((activity, activityIndex) => <a key={activityIndex} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hasCoordinates(activity) ? `${activity.exact_latitude},${activity.exact_longitude}` : `${activity.name} ${activity.location || activity.destination || ""}`)}` } target="_blank" rel="noreferrer">{activityIndex + 1}. {activity.name}</a>)}</div>
        </section>
      </section>
    );
  })}</div>;
}

export default function FinalPlannerPage() {
  const {
    dateRange,
    setDateRange,
    guests,
    setGuests,
    currentActivities,
    setCurrentActivities,
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
  const [documentView, setDocumentView] = useState("overview");
  const [archiveSource, setArchiveSource] = useState(null);
  const [archiveError, setArchiveError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showScheduleErrors, setShowScheduleErrors] = useState(false);
  const [warningActivityIndex, setWarningActivityIndex] = useState(-1);
  const [showSavedPlanners, setShowSavedPlanners] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  
  const [activeSettingsIndex, setActiveSettingsIndex] = useState(null);
  const [selectedGarment, setSelectedGarment] = useState(null);

  useEffect(() => {
    if (!planner && !selectedGarment) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setPlanner(null);
        setSelectedGarment(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [planner, selectedGarment]);

  useEffect(() => {
    setStartDate(dateRange.startDate || "");
    setEndDate(dateRange.endDate || "");
  }, [dateRange.endDate, dateRange.startDate]);

  useEffect(() => {
    setActivities(currentActivities);
  }, [currentActivities]);

  const dates = generateDateRange(startDate, endDate);
  const scheduleErrors = validateActivitySchedules(activities, dates);
  const editSchedule = (index) => {
    setActiveSettingsIndex(index);
    requestAnimationFrame(() => {
      const card = document.getElementById(`planner-activity-${index}`);
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
      card?.focus({ preventScroll: true });
    });
  };

  const commitActivities = (nextActivities) => {
    setActivities(nextActivities);
    setCurrentActivities(nextActivities);
    setPlanner(null);
  };

  const changeActivity = (index, changes) => {
    const nextChanges = changes;
    const next = activities.map((activity, activityIndex) =>
      activityIndex === index
        ? {
            ...activity,
            ...nextChanges,
            ...(nextChanges.assignedDay ? { assigned_day: nextChanges.assignedDay } : {}),
          }
        : activity
    );

    const ordered = next
      .map((activity, originalIndex) => ({
        activity,
        originalIndex,
        day: getAssignedDayNumber(activity) || Number.MAX_SAFE_INTEGER,
      }))
      .sort((left, right) => left.day - right.day || left.originalIndex - right.originalIndex)
      .map(({ activity }) => activity);

    setWarningActivityIndex(-1);
    setErrorMessage("");
    setActiveSettingsIndex(ordered.indexOf(next[index]));
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
    const activity = activities[index];
    const currentGuests = Math.max(1, Number(activity?.guests) || 1);
    const nextGuests = Math.max(1, currentGuests + amount);
    const changes = { guests: nextGuests };
    const estimatedTotal = parsePriceToPhp(activity?.estimated_price);
    const hasUnitPrice = [
      activity?.price_per_pax,
      activity?.real_price_php,
      activity?.price_display,
      activity?.price,
    ].some((price) => (parsePriceToPhp(price) ?? 0) > 0);
    if (!hasUnitPrice && estimatedTotal !== null && estimatedTotal > 0) {
      changes.estimated_price = (estimatedTotal / currentGuests) * nextGuests;
    }
    if (index === 0) setGuests(nextGuests);
    changeActivity(index, changes);
  };

  const removeOutfit = (id) => {
    const updatedOutfits = outfits.filter((outfit) => outfit.id !== id);
    setOutfits(updatedOutfits);
    setPlanner((current) => (current ? { ...current, outfits: updatedOutfits } : current));
  };

  const changeOutfitDay = (id, nextDate) => {
    const dayIndex = dates.indexOf(nextDate);
    if (nextDate && dayIndex < 0) return;
    const updatedOutfits = outfits.map((outfit) =>
      outfit.id === id ? { ...outfit, date: nextDate, day: nextDate ? `Day ${dayIndex + 1}` : "" } : outfit
    );
    setOutfits(updatedOutfits);
    setSelectedGarment((current) => current?.id === id ? updatedOutfits.find((outfit) => outfit.id === id) : current);
    setPlanner((current) => (current ? { ...current, outfits: updatedOutfits } : current));
  };

  const activeOutfits = (planner?.outfits?.length ? planner.outfits : outfits) || [];
  const outfitsForDay = (date, dayIndex) =>
    activeOutfits.filter((outfit) => outfit.date === date || outfit.day === `Day ${dayIndex + 1}`);

  const openSavedPlanner = (item) => {
    setArchiveSource(item);
    setArchiveError("");
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
    setArchiveError("");
    
    if (isLoading) return;
    setShowScheduleErrors(true);
    const targetDates = generateDateRange(startDate, endDate);
    const invalidSchedules = validateActivitySchedules(activities, targetDates);
    
    // Prevent generating if dates are invalid
    if (!targetDates.length || isPastOrTodayDate(startDate)) {
      setErrorMessage("Choose a valid future date range.");
      return;
    }
    
    if (!activities.length) {
      setErrorMessage("Add at least one activity before generating.");
      return;
    }

    if (invalidSchedules.length) {
      editSchedule(invalidSchedules[0].index);
      return;
    }

    if (targetDates.length === 1 && activities.length <= 1) {
      setErrorMessage("A 1-day itinerary must have more than 1 activity.");
      return;
    }

    // Preserve each selected day; empty days must never shift an activity's date.
    const scheduledActivities = activities;

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
            assigned_day: getAssignedDay(activity),
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
        name: archiveSource?.name || `${primaryActivity.destination || "Travel"} itinerary - ${formatDate(targetDates[0])}`,
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
        createdAt: archiveSource?.createdAt || new Date().toISOString(),
      };
      setPlanner(newPlanner);
    } catch (error) {
      setErrorMessage(error.message || "Could not connect to the backend.");
    } finally {
      setIsLoading(false);
    }
  };

  const archivedPlanner = planner ? savedItineraries.find((saved) => archivePlanKey(saved) === archivePlanKey(planner)) : null;
  const savePlannerToArchive = () => {
    if (!planner) return;
    const result = saveItinerary(planner);
    setArchiveError(result.ok ? "" : result.message);
    if (result.ok) setArchiveSource(archivedPlanner || planner);
  };

  const printPlanner = () => {
    if (!planner) return;
    const previousTitle = document.title;
    document.title = `${planner.name || "Travel itinerary"} - ${documentView}`;
    const restoreTitle = () => { document.title = previousTitle; };
    window.addEventListener("afterprint", restoreTitle, { once: true });
    window.print();
  };

  const itineraryDays = (planner?.itinerary || [])
    .filter((day) => (day.scheduled_activities || []).length > 0)
    .map((day, index) => ({
      ...day,
      dayNumber: `Day ${(dates.indexOf(day.date || day.day) >= 0 ? dates.indexOf(day.date || day.day) : index) + 1}`,
      dateLabel: formatDate(day.date || day.day),
      weatherDescription: describeWeather(day),
      scheduled_activities: Array.isArray(day.scheduled_activities) ? day.scheduled_activities : [],
      route_segments: Array.isArray(day.route_segments) ? day.route_segments : [],
      activities: (Array.isArray(day.scheduled_activities) ? day.scheduled_activities : []).map((activity) => ({
        ...activity,
        location: activity.location || activity.destination,
        price: getActivityTotalPricePhp(activity),
        guests: Number(activity.guests) || guests,
      })),
    }));

  const initialGuestCount = Math.max(1, Number(planner?.guests) || guests || 1);
  const plannerStart =
    planner?.dateRange?.startDate || itineraryDays[0]?.date || itineraryDays[0]?.day || startDate;
  const plannerEnd =
    planner?.dateRange?.endDate ||
    itineraryDays[itineraryDays.length - 1]?.date ||
    itineraryDays[itineraryDays.length - 1]?.day ||
    endDate;
  const estimatedAdmissionsTotal = activities.reduce((sum, activity) => {
    const parsed = getActivityTotalPricePhp(activity);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
  const timelineSpan = activities.reduce(
    (maxDay, activity) => Math.max(maxDay, getAssignedDayNumber(activity)),
    0
  ) || dates.length;

  return (
    <main className="final-planner min-h-screen bg-[#FFFDFB] text-slate-900 flex flex-col">
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
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">Arrange your days, match your outfits, and create a brochure to take with you.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSavedPlanners((current) => !current)}
              title="Saved plans"
              aria-label="Show saved plans"
              aria-expanded={showSavedPlanners}
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
              title="Reset trip"
              aria-label="Reset trip"
              onClick={() => {
                if (!window.confirm("Reset your current trip? This will remove its activities, dates, guest count, and assigned outfits. Your archived trips will remain saved. This cannot be undone.")) return;
                clearCurrentPlan();
                setArchiveSource(null);
                setArchiveError("");
                setActivities([]);
                setPlanner(null);
                setErrorMessage("");
                setWarningActivityIndex(-1);
                setShowScheduleErrors(false);
                setActiveSettingsIndex(null);
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
          <div className="mb-5 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 animate-in fade-in slide-in-from-top-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <p className="text-xs font-bold text-slate-900">Saved trips <span className="ml-1 font-medium text-slate-400">({savedItineraries.length})</span></p>
              </div>
              {savedItineraries.length ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete all ${savedItineraries.length} saved trips from your archive? Your current travel activities will remain. This cannot be undone.`)) {
                      clearSavedItineraries();
                      setArchiveSource(null);
                      setArchiveError("");
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
              <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {savedItineraries.map((item) => {
                  const savedDates = (item.itinerary || []).map((day) => day.date || day.day).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
                  const savedStart = item.dateRange?.startDate || savedDates[0];
                  const savedEnd = item.dateRange?.endDate || savedDates[savedDates.length - 1] || savedStart;
                  const savedDayCount = generateDateRange(savedStart, savedEnd).length;
                  const activityCount = extractActivitiesFromPlanner(item).length;
                  return (
                  <div key={item.createdAt} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-slate-100 px-2.5 py-2 transition hover:border-slate-400">
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
                      title={item.name || "Saved itinerary"}
                      className="w-full min-w-0 truncate rounded border border-transparent bg-transparent px-1 py-1 text-xs font-bold text-slate-900 outline-none transition focus:border-slate-700 hover:bg-slate-50"
                    />
                    <div className="w-full px-1">
                      <p className="text-[11px] leading-relaxed text-slate-500">
                        {savedStart ? `${formatShortDate(savedStart)} - ${formatShortDate(savedEnd)}` : "Dates not set"}
                      </p>
                    </div>
                    <p className="min-w-0 flex-1 px-1 text-[11px] text-slate-500">{savedDayCount} {savedDayCount === 1 ? "day" : "days"} · {activityCount} {activityCount === 1 ? "activity" : "activities"}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openSavedPlanner(item)}
                        className="rounded-md bg-slate-900 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`Delete "${item.name || "Saved itinerary"}" from your saved trips? This cannot be undone.`)) return;
                          deleteItinerary(item.createdAt);
                          if (archiveSource?.createdAt === item.createdAt) setArchiveSource(null);
                          if (planner?.createdAt === item.createdAt) setPlanner(null);
                        }}
                        className="rounded-md px-2 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No saved trips yet.</p>
            )}
          </div>
        ) : null}

        {showScheduleErrors && scheduleErrors.length > 0 && (
          <div role="alert" className="mb-5 rounded-lg border border-slate-400 p-4 text-sm text-slate-800">
            <p className="font-bold">Fix these activity schedules before creating or saving your itinerary.</p>
            <ul className="mt-2 space-y-2">
              {scheduleErrors.map(({ index, name, errors }) => (
                <li key={index}>
                  <button type="button" onClick={() => editSchedule(index)} className="font-semibold underline underline-offset-2">{index + 1}. {name}</button>
                  <span> - {Object.values(errors).join(" ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form noValidate onSubmit={generatePlanner} className="planner-editor grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-10 min-w-0">
            <section className="planner-editor-section">
              <div className="flex items-end justify-between border-b-2 border-slate-900 pb-2">
                <h2 className="text-lg font-black text-slate-900">Trip dates</h2>
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

            <section className="planner-editor-section">
              <div className="flex items-end justify-between pb-2 z-10 border-b border-slate-100 mb-4">
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
                      const dayLabel = getAssignedDay(activity) || "Day not selected";
                      const fieldErrors = showScheduleErrors ? scheduleErrors.find((entry) => entry.index === index)?.errors || {} : {};
                      const matchedDay = itineraryDays.find(
                        (day) => day.dayNumber === dayLabel
                      );
                      const matchedActivity = matchedDay?.activities?.find((item) => item.name === activity.name && item.destination === activity.destination);
                      const activeItem = matchedActivity || activity;
                      const activityWeather = getActivityWeather(activeItem);
                      const isEditing = activeSettingsIndex === index;

                      return (
                        <article
                          id={`planner-activity-${index}`}
                          tabIndex={-1}
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
                          <div className={`absolute -left-[27px] top-4 w-[12px] h-[12px] rounded-full border-2 bg-white transition-colors duration-300 ${dropIndex === index ? 'border-slate-700 scale-125' : 'border-slate-900 group-hover:border-slate-500'}`} />
                          
                          {/* Compact Node Card */}
                          <div className={`activity-surface border-b py-5 transition-all duration-300 ${
                            dropIndex === index
                              ? "border-slate-700 ring-2 ring-slate-200 translate-x-1"
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
                                <h3 className="break-words text-sm font-bold leading-relaxed text-slate-900">{activity.name}</h3>
                                <p className="mt-1 text-xs text-slate-500">{activity.destination || activity.location || "Location not listed"}</p>
                              </div>
                              <div className="activity-highlights ml-auto text-right">
                                <p className="text-2xl font-extrabold tracking-tight text-slate-900">{formatActivityPrice(activeItem)}</p>
                                <span className={`mt-2 inline-flex items-center justify-end gap-2 rounded-lg px-2 py-1 text-base font-bold border border-slate-300 text-slate-700`}>
                                  {activityWeather ? <WeatherIcon condition={activityWeather} className="h-6 w-6 shrink-0" /> : null}
                                  <span>{activityWeather || "Weather unavailable"}</span>
                                </span>
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
                                  {isValidActivityTime(activity.time) ? activity.time : "Time needs attention"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                  {activity.guests || guests || 1} Pax
                                </span>
                              </div>
                            )}

                            {Object.keys(fieldErrors).length > 0 && (
                              <div id={`schedule-error-${index}`} className="mt-3 border-l-2 border-slate-900 pl-3 text-xs text-slate-800">
                                <p className="font-bold">Schedule needs attention</p>
                                {Object.entries(fieldErrors).map(([field, message]) => <p key={field}>{message}</p>)}
                              </div>
                            )}

                            {/* Inline Editor Drawer requested by user */}
                            {isEditing ? (
                              <div className="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-100 animate-in fade-in slide-in-from-top-2">
                                <div className="grid min-w-0 grid-cols-3 items-end gap-2">
                                  <label className="flex flex-col gap-1.5 text-[10px] font-black uppercase text-slate-500">
                                    Assign Day
                                    <select
                                      aria-invalid={Boolean(fieldErrors.day)}
                                      aria-describedby={fieldErrors.day ? `schedule-error-${index}` : undefined}
                                      value={dates.some((_, dayIndex) => getAssignedDay(activity) === `Day ${dayIndex + 1}`) ? getAssignedDay(activity) : ""}
                                      onChange={(event) => changeActivity(index, { assignedDay: event.target.value })}
                                      className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-slate-900"
                                    >
                                      <option value="" disabled>Select day</option>
                                      {dates.map((date, dayIndex) => (
                                        <option key={date} value={`Day ${dayIndex + 1}`}>
                                          Day {dayIndex + 1} · {new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <div className="flex min-w-0 flex-col gap-1.5 text-[10px] font-black uppercase text-slate-500">
                                    Time Schedule
                                    <ActivityTimePicker
                                      value={activity.time}
                                      aria-invalid={Boolean(fieldErrors.time)}
                                      aria-describedby={fieldErrors.time ? `schedule-error-${index}` : undefined}
                                      onChange={(time) => changeActivity(index, { time })}
                                      buttonClassName="flex h-10 w-full min-w-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-left text-xs font-semibold text-slate-900 hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                    />
                                  </div>
                                  
                                  <div className="flex min-w-0 flex-col gap-1.5 text-[10px] font-black uppercase text-slate-500">
                                    Guest Count
                                    <div className="flex h-10 items-center justify-between gap-1 rounded-lg border border-slate-200 bg-white px-1.5">
                                      <button type="button" aria-label={`Decrease guests for ${activity.name}`} onClick={() => changeActivityGuests(index, -1)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"><ChevronLeft aria-hidden="true" size={14} /></button>
                                      <span className="min-w-[20px] text-center text-sm font-black text-slate-900">{activity.guests || 1}</span>
                                      <button type="button" aria-label={`Increase guests for ${activity.name}`} onClick={() => changeActivityGuests(index, 1)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"><ChevronRight aria-hidden="true" size={14} /></button>
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
                    <p className="text-sm font-bold text-slate-800">Start with a place you want to go</p>
                    <Link href="/destinations" className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 shadow-sm">
                      Browse Destinations
                    </Link>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="planner-sidebar flex min-w-0 flex-col gap-5 lg:sticky lg:top-24">
            
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
                      
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {group.items.map((item) => (
                          <div key={item.id} className="relative min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-start gap-3">
                              <button type="button" onClick={() => setSelectedGarment(item)} aria-label={`View ${item.category}`} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700">
                                <GarmentImage src={item.image} alt={item.category} className="h-full w-full object-contain" />
                              </button>
                              <div className="min-w-0 flex-1">
                                <p className="break-words pr-4 text-xs font-bold leading-relaxed text-slate-700">{item.category}</p>
                                <button type="button" onClick={() => setSelectedGarment(item)} className="mt-1 text-[11px] font-semibold text-slate-700 underline underline-offset-2">View details</button>
                              </div>
                              <button type="button" onClick={() => removeOutfit(item.id)} aria-label={`Remove ${item.category}`} className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-rose-100 hover:text-rose-600">&times;</button>
                            </div>
                            <label className="mt-3 block">
                              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Wear on</span>
                              <select
                                aria-label={`Day to wear ${item.category}`}
                                value={dates.includes(item.date) ? item.date : dates[Number(String(item.day || "").replace("Day ", "")) - 1] || ""}
                                onChange={(event) => changeOutfitDay(item.id, event.target.value)}
                                disabled={!dates.length}
                                className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-slate-700 disabled:opacity-50"
                              >
                                <option value="">{dates.length ? "Not assigned" : "Choose trip dates first"}</option>
                                {dates.map((date, index) => <option key={date} value={date}>Day {index + 1} - {formatShortDate(date)}</option>)}
                              </select>
                            </label>
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
            <div className="trip-glance rounded-2xl border border-slate-300 bg-transparent p-5 text-slate-900 shrink-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Your trip at a glance</p>
              
              <dl className="trip-glance-stats grid grid-cols-3 gap-3 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400 font-medium">Timeline span</dt>
                  <dd className="font-bold">{timelineSpan ? `${timelineSpan} ${timelineSpan === 1 ? "Day" : "Days"}` : "—"}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400 font-medium">Activities</dt>
                  <dd className="font-bold">{activities.length}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-slate-400 font-medium">Admissions Total</dt>
                  <dd className="font-black text-slate-900 tracking-wide">
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
                    Creating brochure...
                  </span>
                ) : "Create travel brochure"}
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
        <div className="planner-document fixed inset-0 z-[60] flex flex-col bg-slate-100 overflow-y-auto animate-in slide-in-from-bottom-8 fade-in duration-500 print:relative print:w-full print:inset-auto print:block">
          
          {/* Brochure print styles are defined with the preview in globals.css. */}
          <div className="brochure-toolbar sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-8 print:hidden">
            <button
              onClick={() => setPlanner(null)}
              className="group flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-900 transition"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 group-hover:bg-slate-200 transition"><ChevronLeft aria-hidden="true" className="h-5 w-5" /></span>
              Back to planner
            </button>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Document version">
              {["overview", "details"].map((view) => (
                <button key={view} type="button" aria-pressed={documentView === view} onClick={() => setDocumentView(view)} className={`rounded-lg px-4 py-2 text-sm font-bold ${documentView === view ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                  {view === "overview" ? "01 Overview" : "02 Detailed"}
                </button>
              ))}
            </div>
            <button type="button" onClick={savePlannerToArchive} disabled={Boolean(archivedPlanner)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-900 transition hover:bg-slate-100 disabled:cursor-default disabled:opacity-50">
              {archivedPlanner ? "Saved to archive" : savedItineraries.some((saved) => saved.createdAt === planner.createdAt) ? "Update saved trip" : "Save to archive"}
            </button>
            <button
              onClick={printPlanner}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black tracking-wide text-white shadow-md transition hover:bg-slate-800"
            >
              Print / Save {documentView === "overview" ? "overview" : "details"} PDF
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
                              src={getActivityImagePath(activity, activity.destination || activity.location || day.destination)}
                              alt={activity.name}
                              onError={(event) => {
                                if (event.currentTarget.getAttribute("src") !== DESTINATION_PLACEHOLDER) {
                                  event.currentTarget.src = DESTINATION_PLACEHOLDER;
                                }
                              }}
                              className="w-16 h-16 object-cover rounded-lg shadow-sm border border-slate-200 shrink-0"
                            />
                            <div className="flex-1 min-w-0 mt-0.5">
                              <span className="font-black text-slate-900 text-base block leading-tight mb-1">{activity.name}</span>
                              <span className="font-bold text-slate-500 text-xs uppercase tracking-wider block mb-1.5">
                                {isValidActivityTime(activity.time) ? activity.time : "Time to be confirmed"}
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
              <p className="document-trip-name">{planner.name || "Your next adventure"}</p>
            <Header/>
            {documentView === "overview" ? (
              <PlannerOverview days={itineraryDays} formatPrice={formatActivityPrice} getWeather={getActivityWeather} guests={initialGuestCount} />
            ) : (
              <PlannerDetails days={itineraryDays} formatPrice={formatActivityPrice} getWeather={getActivityWeather} guests={initialGuestCount} outfitsForDay={outfitsForDay} />
            )}
            <footer className="document-footer">ANO TARA? <span>{documentView === "overview" ? "Your journey at a glance" : "Your daily travel companion"} · Prices and weather may change</span></footer>
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
