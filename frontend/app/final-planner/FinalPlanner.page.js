"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import GarmentImage from "../../components/GarmentImage";
import ActivityTimePicker from "../../components/ActivityTimePicker";
import Footer from "../footer/Footer";
import Header from "../header/Header";
import { useTravel } from "../TravelContext";
import { clampActivityTime, getGuestWarning, getMinSelectableDate, isPastOrTodayDate, isValidActivityTime, toDateString } from "../tripUtils";

const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const formatShortDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const generateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate || endDate < startDate) return [];
  const dates = []; const current = new Date(`${startDate}T00:00:00`); const last = new Date(`${endDate}T00:00:00`);
  while (current <= last) { dates.push(toDateString(current)); current.setDate(current.getDate() + 1); }
  return dates;
};
const valueFrom = (item, keys) => keys.map((key) => item?.[key]).find((value) => value !== undefined && value !== null && value !== "");
const getTime = (activity) => { const start = valueFrom(activity, ["time", "schedule", "start_time"]); const end = valueFrom(activity, ["end_time"]); return start && end ? `${start} - ${end}` : start || "Time to be confirmed"; };
const getStay = (activity) => { const checkIn = valueFrom(activity, ["check_in", "checkIn", "checkin"]); const checkOut = valueFrom(activity, ["check_out", "checkOut", "checkout"]); return checkIn || checkOut ? `Check-in ${checkIn || "-"} · Check-out ${checkOut || "-"}` : "No check-in details"; };
const fallbackDayImage = (activity) => {
  const name = `${activity?.name || ""} ${activity?.type || ""}`.toLowerCase();
  if (/food|seafood|culinary|dining|tasting|manokan|oyster/.test(name)) return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80";
  if (/museum|gallery|art|heritage|cultural/.test(name)) return "https://images.unsplash.com/photo-1564399579883-451a5d44ec08?auto=format&fit=crop&w=1200&q=80";
  return "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";
};
const dayImage = (activity) => activity?.image || fallbackDayImage(activity);
const describeWeather = (day) => {
  const forecast = day.weather_forecast || {};
  const historical = day.historical_weather || {};
  const condition = String(day.expected_weather || forecast.condition || "unavailable").toLowerCase();
  const tempRange = forecast.temperature_min_c != null && forecast.temperature_max_c != null
    ? `${forecast.temperature_min_c}°C to ${forecast.temperature_max_c}°C`
    : forecast.average_temperature != null ? `around ${forecast.average_temperature}°C` : "a comfortable temperature";
  const rainChance = forecast.precipitation_probability != null ? `${forecast.precipitation_probability}% chance of rain` : "an uncertain chance of rain";
  const rainAmount = forecast.precipitation_sum_mm != null ? ` (${forecast.precipitation_sum_mm} mm expected)` : "";
  const historicalLine = historical.dominant_condition ? ` Historically this date trends ${String(historical.dominant_condition).toLowerCase()}, averaging ${historical.average_temperature_c ?? "-"}°C with ${historical.average_rainfall_mm ?? "-"} mm of rain over ${historical.years || 5} years.` : "";
  return `Expect ${condition} skies, ${tempRange}, with ${rainChance}${rainAmount}.${historicalLine}`;
};
const groupOutfits = (items) => items.reduce((groups, item) => {
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
  return days.flatMap((day, dayIndex) => (day.scheduled_activities || []).map((activity) => ({
    ...activity,
    assignedDay: activity.assignedDay || activity.assigned_day || `Day ${dayIndex + 1}`,
    assigned_day: activity.assigned_day || activity.assignedDay || `Day ${dayIndex + 1}`,
    destination: activity.destination || activity.location || day.destination,
    guests: Number(activity.guests) || 1,
    time: activity.time || activity.schedule || activity.start_time || "10:00",
  })));
};

const assignDaysInOrder = (list) => list.map((activity, index) => {
  const day = `Day ${index + 1}`;
  return { ...activity, assignedDay: day, assigned_day: day };
});

export default function FinalPlannerPage() {
  const { dateRange, setDateRange, guests, setGuests, currentActivities, setCurrentActivities, hasActivityConflict, outfits, setOutfits, savedItineraries, saveItinerary, deleteItinerary, renameItinerary, clearSavedItineraries, clearCurrentPlan } = useTravel();
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

  useEffect(() => { if (dateRange.startDate) setStartDate(dateRange.startDate); if (dateRange.endDate) setEndDate(dateRange.endDate); }, [dateRange.endDate, dateRange.startDate]);
  useEffect(() => { setActivities(currentActivities); }, [currentActivities]);

  const dates = generateDateRange(startDate, endDate);
  const emptyDayCount = Math.max(0, dates.length - activities.length);
  const commitActivities = (nextActivities) => { setActivities(nextActivities); setCurrentActivities(nextActivities); setPlanner(null); };

  const changeActivity = (index, changes) => {
    const nextChanges = Object.prototype.hasOwnProperty.call(changes, "time") ? { ...changes, time: clampActivityTime(changes.time) } : changes;
    const next = activities.map((activity, activityIndex) => activityIndex === index ? { ...activity, ...nextChanges, ...(nextChanges.assignedDay ? { assigned_day: nextChanges.assignedDay } : {}) } : activity);
    if (nextChanges.assignedDay && hasActivityConflict(next[index], index)) {
      const otherIndex = next.findIndex((activity, activityIndex) => activityIndex !== index && activity.assignedDay === changes.assignedDay);
      if (otherIndex >= 0 && activities[index]?.assignedDay) {
        const previousDay = activities[index].assignedDay;
        next[otherIndex] = { ...next[otherIndex], assignedDay: previousDay, assigned_day: previousDay };
      }
    }
    const ordered = next
      .map((activity, originalIndex) => ({ activity, originalIndex, day: Number(String(activity.assignedDay || "").replace("Day ", "")) || Number.MAX_SAFE_INTEGER }))
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

  const changeActivityGuests = (index, amount) => changeActivity(index, { guests: Math.max(1, (Number(activities[index]?.guests) || 1) + amount) });
  const removeOutfit = (id) => setOutfits((current) => current.filter((outfit) => outfit.id !== id));
  const changeOutfitDay = (id, nextDate) => {
    const dayIndex = dates.indexOf(nextDate);
    const updatedOutfits = outfits.map((outfit) => outfit.id === id
      ? { ...outfit, date: nextDate, day: `Day ${dayIndex + 1}` }
      : outfit);
    setOutfits(updatedOutfits);
    setPlanner((current) => current ? { ...current, outfits: updatedOutfits } : current);
  };
  const outfitSetOptions = [...new Map(outfits.map((item) => {
    const id = item.outfitSetId || "outfit-set-1";
    return [id, { id, name: item.outfitSetName || "Outfit 1" }];
  })).values()];
  const changeOutfitSet = (outfitId, nextSet) => setOutfits((current) => current.map((item) => item.id === outfitId ? { ...item, outfitSetId: nextSet.id, outfitSetName: nextSet.name } : item));
  const createOutfitSet = (outfitId) => changeOutfitSet(outfitId, {
    id: `outfit-set-${Date.now()}-${outfitId}`,
    name: `Outfit ${outfitSetOptions.length + 1}`,
  });

  const activeOutfits = (planner?.outfits?.length ? planner.outfits : outfits) || [];
  const outfitsForDay = (date, dayIndex) => activeOutfits.filter((outfit) => outfit.date === date || outfit.day === `Day ${dayIndex + 1}`);

  const openSavedPlanner = (item) => {
    const restored = extractActivitiesFromPlanner(item);
    const firstDay = item.itinerary?.[0]?.date || item.itinerary?.[0]?.day || "";
    const lastDay = item.itinerary?.[item.itinerary.length - 1]?.date || item.itinerary?.[item.itinerary.length - 1]?.day || firstDay;
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
    if (!targetDates.length || isPastOrTodayDate(startDate)) { setErrorMessage("Choose a valid future date range."); return; }
    if (!activities.length) { setErrorMessage("Add at least one activity before generating."); return; }

    let scheduledActivities = activities;
    if (targetDates.length > activities.length) {
      const confirmed = window.confirm(
        `You selected ${targetDates.length} days but only ${activities.length} activit${activities.length === 1 ? "y" : "ies"}.\n\nDays without activities will not appear in the generated planner. Activities will keep their current order as Day 1, Day 2, and so on.\n\nContinue?`
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
    if (hasInvalidSchedule) { setErrorMessage("Each activity needs a valid trip day and a time between 6:00 AM and 11:00 PM."); return; }
    setIsLoading(true);
    try {
      const primaryActivity = scheduledActivities[0];
      const hotelType = primaryActivity.hotel_type || (String(primaryActivity.type).toLowerCase() === "outdoor" ? "Resort Hotel" : "City Hotel");
      const guestCount = Number(primaryActivity.guests) || guests;
      const priceResponse = await fetch("http://localhost:8000/predict-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ check_in: targetDates[0], check_out: targetDates[targetDates.length - 1] || targetDates[0], guests: guestCount, hotel_type: hotelType, room_type: "Standard Room", destination_name: primaryActivity.destination }),
      });
      const priceData = await priceResponse.json();
      if (!priceResponse.ok) throw new Error(priceData?.detail || "Could not fetch the MLR price.");
      const mlrPrice = Number(priceData.total_price ?? priceData.price);
      if (!Number.isFinite(mlrPrice)) throw new Error("The MLR price response was invalid.");

      const response = await fetch("http://localhost:8000/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_dates: targetDates, raw_activities: scheduledActivities.map((activity) => ({ ...activity, assigned_day: activity.assignedDay, room_type: activity.roomType || activity.room_type || "Standard Room" })), mlr_price: mlrPrice, guests: guestCount, outfit: outfits[0] || undefined }),
      });
      const data = await response.json();
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
        priceEstimate: { amount: mlrPrice, perPerson: mlrPrice / Math.max(1, guestCount), source: priceData.source, destination: primaryActivity.destination },
        createdAt: new Date().toLocaleString(),
      };
      setPlanner(newPlanner);
      saveItinerary(newPlanner);
    } catch (error) {
      setErrorMessage(error.message || "Could not connect to the backend.");
    } finally { setIsLoading(false); }
  };

  const printPlanner = () => { if (!planner) return; window.print(); };
  const itineraryDays = (planner?.itinerary || [])
    .filter((day) => (day.scheduled_activities || []).length > 0)
    .map((day, index) => ({
      ...day,
      dayNumber: `Day ${index + 1}`,
      dateLabel: formatDate(day.date || day.day),
      weatherDescription: describeWeather(day),
      activities: (day.scheduled_activities || []).map((activity) => ({
        ...activity,
        location: activity.location || activity.destination,
        price: Number(activity.estimated_price ?? activity.price ?? ((activity.price_range?.min || 0) + (activity.price_range?.max || 0)) / 2),
        guests: Number(activity.guests) || guests,
      })),
    }));
  const totalPrice = itineraryDays.reduce((tripTotal, day) => (
    tripTotal + day.activities.reduce((dayTotal, activity) => dayTotal + Number(activity.price || 0), 0)
  ), 0);
  const initialGuestCount = Math.max(1, Number(planner?.guests) || guests || 1);
  const pricePerPerson = totalPrice / initialGuestCount;
  const plannerStart = planner?.dateRange?.startDate || itineraryDays[0]?.date || itineraryDays[0]?.day || startDate;
  const plannerEnd = planner?.dateRange?.endDate || itineraryDays[itineraryDays.length - 1]?.date || itineraryDays[itineraryDays.length - 1]?.day || endDate;

  return (
    <main className="planner-shell min-h-screen bg-[#f5f7fa] text-slate-900">
      <div className="planner-controls"><Header /></div>
      <div className="w-full py-8">
        <div className="px-4 sm:px-8">
        <div className="planner-controls mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Trip workspace</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">Itinerary planner</h1></div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setShowSavedPlanners((current) => !current)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Saved planners ({savedItineraries.length})</button>
            <button type="button" onClick={() => { clearCurrentPlan(); setActivities([]); setPlanner(null); }} className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700">Clear current plan</button>
          </div>
        </div>

        {showSavedPlanners ? (
          <div className="planner-controls mb-8 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-bold text-slate-700">Previously generated planners</p>
              {savedItineraries.length ? <button type="button" onClick={() => { if (window.confirm("Clear all saved planners? This cannot be undone.")) clearSavedItineraries(); }} className="rounded-md border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700">Clear all</button> : null}
            </div>
            {savedItineraries.length ? (
              <div className="mt-3 space-y-2">
                {savedItineraries.map((item) => (
                  <div key={item.createdAt} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <input aria-label="Saved planner name" value={item.name || ""} onChange={(event) => renameItinerary(item.createdAt, event.target.value)} onBlur={() => { if (!item.name?.trim()) renameItinerary(item.createdAt, "Saved itinerary"); }} className="min-w-48 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold" />
                    <button type="button" onClick={() => openSavedPlanner(item)} className="planner-nav-link shrink-0 text-xs">
                      Load Planner
                    </button>
                    <button type="button" onClick={() => deleteItinerary(item.createdAt)} className="text-xs font-bold text-rose-600">Delete</button>
                  </div>
                ))}
              </div>
            ) : <p className="mt-2 text-sm text-slate-600">No planners have been generated yet.</p>}
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] lg:items-start">
          <form onSubmit={generatePlanner} className="planner-controls rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <section className="border-b border-slate-200 pb-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">01 / Travel details</p>
              <h2 className="mt-2 text-2xl font-black">Selected trip</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold">Start date<input type="date" min={getMinSelectableDate()} value={startDate} onChange={(event) => { const next = event.target.value; const nextEnd = endDate < next ? next : endDate; setStartDate(next); setEndDate(nextEnd); setDateRange({ startDate: next, endDate: nextEnd }); setPlanner(null); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
                <label className="text-sm font-bold">End date<input type="date" min={startDate || getMinSelectableDate()} value={endDate} onChange={(event) => { setEndDate(event.target.value); setDateRange({ startDate, endDate: event.target.value }); setPlanner(null); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
              </div>
              {emptyDayCount > 0 && activities.length > 0 ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  {dates.length} trip days selected but only {activities.length} activit{activities.length === 1 ? "y" : "ies"} assigned. Empty days will be omitted; activities keep their list order as Day 1 onward.
                </p>
              ) : null}
            </section>

            <section className="py-6">
              <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-black uppercase tracking-wider">Activities</h3><Link href="/destinations" className="planner-nav-link text-xs">Choose more Activities</Link></div>
              <p className="mt-2 text-sm text-slate-600">Drag cards to reorder days, or use the day menu to swap.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {activities.map((activity, index) => (
                  <article
                    key={`${activity.name}-${activity.destination}-${index}`}
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(event) => { event.preventDefault(); setDropIndex(index); }}
                    onDragLeave={() => setDropIndex((current) => (current === index ? null : current))}
                    onDrop={(event) => { event.preventDefault(); reorderByDrag(dragIndex, index); setDragIndex(null); setDropIndex(null); }}
                    onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                    className={`min-w-0 overflow-hidden cursor-grab rounded-lg border bg-white p-4 active:cursor-grabbing ${dropIndex === index ? "border-slate-900 ring-2 ring-slate-300" : "border-slate-200"} ${dragIndex === index ? "opacity-60" : ""}`}
                  >
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{activity.assignedDay || `Day ${index + 1}`}</p>
                        <h4 className="truncate font-black">{activity.name}</h4>
                        <p className="mt-1 truncate text-xs text-slate-500">{activity.destination} · {activity.type || "Activity"}</p>
                      </div>
                      <button type="button" onClick={() => commitActivities(activities.filter((_, activityIndex) => activityIndex !== index))} className="shrink-0 text-xs font-bold text-rose-600">Remove</button>
                    </div>
                    <details className="group mt-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
                        <span>Activity settings</span>
                        <span className="planner-nav-link text-xs"><span className="group-open:hidden">Edit</span><span className="hidden group-open:inline">Done</span></span>
                      </summary>
                      <div className="mt-4">
                    <div className="grid gap-3 text-xs font-bold">
                      <div className="flex items-center gap-2"><span>Guests</span><button type="button" onClick={() => changeActivityGuests(index, -1)} className="h-6 w-6 rounded-full border">-</button><span>{activity.guests || 1}</span><button type="button" onClick={() => changeActivityGuests(index, 1)} className="h-6 w-6 rounded-full border">+</button></div>
                      <label className="flex min-w-0 flex-col gap-1 overflow-hidden">
                        Day
                        <select
                          value={dates.some((_, dayIndex) => activity.assignedDay === `Day ${dayIndex + 1}`) ? activity.assignedDay : ""}
                          onChange={(event) => changeActivity(index, { assignedDay: event.target.value })}
                          className="activity-day-select w-full max-w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                        >
                          <option value="" disabled>Select day</option>
                          {dates.map((date, dayIndex) => (
                            <option key={date} value={`Day ${dayIndex + 1}`}>
                              Day {dayIndex + 1} · {new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {warningActivityIndex === index ? <p className="mt-2 text-[11px] font-semibold text-amber-700">{errorMessage}</p> : null}
                    <label className="mt-3 flex min-w-0 flex-col gap-1 text-xs font-bold">
                      Time
                      <ActivityTimePicker value={clampActivityTime(activity.time)} onChange={(time) => changeActivity(index, { time })} />
                    </label>
                    <p className="mt-1 text-xs text-slate-600">{getStay(activity)}</p>
                    {getGuestWarning(activity.guests) ? <p className="mt-1 text-[11px] font-semibold text-amber-700">{getGuestWarning(activity.guests)}</p> : null}
                      </div>
                    </details>
                  </article>
                ))}
              </div>
              {!activities.length ? <p className="mt-4 border border-dashed border-slate-300 p-4 text-sm text-slate-600">Choose an activity to begin.</p> : null}
            </section>

            <section className="border-t border-slate-200 py-6">
              <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-black uppercase tracking-wider">Clothing</h3><Link href="/predict-outfit?from=planner" className="planner-nav-link text-xs">Attach Outfit</Link></div>
              {outfits.length ? (
                <div className="mt-3 space-y-2">
                  {groupOutfits(outfits).map((group) => (
                    <div key={group.key} className="bg-white p-3">
                      <p className="mb-2 text-xs font-black uppercase text-slate-600">{group.name}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((item) => <div key={item.id} className="flex items-center gap-2">
                          <GarmentImage src={item.image} alt={`${item.category} garment`} className="h-10 w-10" />
                          <span className="text-sm font-bold">{item.category}</span>
                          <select aria-label={`Assign ${item.category} outfit to an activity day`} value={dates.includes(item.date) ? item.date : (dates[0] || "")} disabled={!dates.length} onChange={(event) => changeOutfitDay(item.id, event.target.value)} className="max-w-40 rounded border border-slate-300 bg-white px-1 py-1 text-xs">
                            {dates.map((date, dayIndex) => <option key={date} value={date}>Day {dayIndex + 1} · {new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</option>)}
                          </select>
                          <select aria-label={`Assign ${item.category} to an outfit set`} value={item.outfitSetId || "outfit-set-1"} onChange={(event) => {
                            const nextSet = outfitSetOptions.find((set) => set.id === event.target.value);
                            if (nextSet) changeOutfitSet(item.id, nextSet);
                          }} className="max-w-28 rounded border border-slate-300 bg-white px-1 py-1 text-xs">
                            {outfitSetOptions.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}
                          </select>
                          <button type="button" onClick={() => createOutfitSet(item.id)} className="text-xs font-bold text-slate-700 underline">New set</button>
                          <button type="button" onClick={() => removeOutfit(item.id)} aria-label={`Remove ${item.category}`} className="text-xs font-bold text-rose-600">Remove</button>
                        </div>)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-slate-600">No clothing selected. Use Attach outfit to add one.</p>}
            </section>

            <button type="submit" disabled={isLoading || !activities.length} className="w-full rounded-lg bg-slate-900 px-4 py-3 font-black text-white disabled:opacity-50">{isLoading ? "Preparing planner..." : "Generate final planner"}</button>
            {errorMessage && warningActivityIndex < 0 ? <p className="mt-3 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{errorMessage}</p> : null}
          </form>

          <aside className="planner-controls rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">02 / Travel summary</p>
            <h2 className="mt-2 text-2xl font-black">Daily conditions</h2>
            <div className="mt-5 space-y-4">
              <div className="border-b border-slate-200 pb-4">
                <p className="text-xs font-bold uppercase text-slate-500">Clothing</p>
                {outfits.length ? <p className="mt-1 text-sm font-bold">{outfits.length} garment{outfits.length === 1 ? "" : "s"} attached</p> : <Link href="/predict-outfit?from=planner" className="planner-nav-link mt-2 text-xs">Attach Outfit</Link>}
              </div>
              {itineraryDays.map((day, index) => {
                const dayOutfits = outfitsForDay(day.date || day.day, index);
                return (
                  <section key={`${day.date || day.day}-${index}`} className="border-b border-slate-200 pb-4">
                    <div className="flex justify-between gap-3"><h3 className="font-black">{day.dayNumber} · {day.dateLabel}</h3></div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{day.weatherDescription}</p>
                    {dayOutfits.length ? <div className="mt-3 space-y-2">{groupOutfits(dayOutfits).map((group) => <div key={group.key}>
                      <p className="text-xs font-bold text-slate-700">{group.name}</p>
                      <div className="mt-1 flex flex-wrap gap-2">{group.items.map((item) => <GarmentImage key={item.id} src={item.image} alt={`${item.category} for ${day.dayNumber}`} className="h-14 w-14 rounded" />)}</div>
                    </div>)}</div> : null}
                    {day.activities.map((activity) => <p key={activity.name} className="mt-2 text-xs font-semibold">{activity.name} · {activity.location || activity.destination} · {activity.guests} guests · Estimated price: PHP {Number(activity.price || 0).toLocaleString()}</p>)}
                  </section>
                );
              })}
              {!planner ? <p className="text-sm text-slate-600">Generate the planner to see daily weather, clothing, and compiled activity details.</p> : null}
            </div>
          </aside>
        </div>

        <section aria-live="polite" className="planner-document mt-12 bg-[url('/plannerbg.png')] bg-cover bg-center p-0 sm:p-8">
          <div className="planner-print-controls mb-4 flex justify-end">{planner ? <button type="button" onClick={printPlanner} className="rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-900 shadow">Print planner</button> : null}</div>
          {planner ? (
            <div className="planner-landscape mx-auto max-w-7xl p-0 sm:p-4">
              <header className="itinerary-overview-header mb-3 rounded bg-white/95 px-4 py-2 text-center shadow-sm">
                <p className="text-xs font-bold text-slate-700">Ano Tara Travel Plan</p>
                <h2 className="text-2xl font-black leading-tight text-slate-950">Itinerary Planner</h2>
                <div className="mt-1 flex items-start justify-between gap-3 text-left text-xs font-bold text-slate-800">
                  <div>
                    <p>Total Price: PHP {totalPrice.toLocaleString()}</p>
                    <p className="mt-0.5 font-semibold text-slate-600">PHP {Math.round(pricePerPerson).toLocaleString()} / person · {initialGuestCount} guests</p>
                  </div>
                  <div className="text-right">
                    <p>{itineraryDays.length} Planned Days</p>
                    {plannerStart && plannerEnd ? (
                      <p className="mt-0.5 font-semibold text-slate-600">{formatShortDate(plannerStart)} – {formatShortDate(plannerEnd)}</p>
                    ) : null}
                  </div>
                </div>
              </header>
              <div className="itinerary-day-grid">
                {itineraryDays.map((day, index) => {
                  const dayKey = day.date || day.day;
                  const dayOutfits = outfitsForDay(dayKey, index);
                  const outfitItems = dayOutfits.slice(0, 4);
                  const hasOutfit = outfitItems.length > 0;
                  const heroImage = dayImage(day.activities[0]);
                  return (
                    <article key={day.dayNumber} className="itinerary-day-card">
                      <div className="itinerary-day-heading">
                        <h3>{day.dayNumber}</h3>
                        <p>{day.dateLabel}</p>
                      </div>
                      <img src={heroImage} alt={day.activities[0]?.name || day.dayNumber} onError={(event) => { const fallback = fallbackDayImage(day.activities[0]); if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback; else event.currentTarget.style.visibility = "hidden"; }} className="itinerary-day-image" />
                      <div className="itinerary-day-content">
                        <div className="itinerary-activity-details">
                          <p className="itinerary-section-label">Activity Details</p>
                          {day.activities.length ? day.activities.map((activity, activityIndex) => (
                            <div key={`${activity.name}-${activityIndex}`}>
                              {activity.hazard_flag ? <p role="alert" className="mb-1 text-[10px] font-black text-rose-800">Safety alert: rainy outdoor activity</p> : null}
                              <p className="font-bold">{activity.name}</p>
                              <p>{activity.location || activity.destination}</p>
                              <p>Guests: {activity.guests}</p>
                              <p>Estimated price: PHP {Number(activity.price || 0).toLocaleString()}</p>
                              <p>Time: {getTime(activity)}</p>
                            </div>
                          )) : <p>No activity assigned.</p>}
                        </div>
                        {hasOutfit ? (
                          <div className="itinerary-outfit-section">
                            <p className="itinerary-section-label text-right">Outfit</p>
                            <div className="itinerary-outfit-slots">
                              {outfitItems.map((item) => <GarmentImage key={item.id} src={item.image} alt={`${item.category} outfit`} className="h-10 w-10 border border-slate-200 bg-white" />)}
                            </div>
                          </div>
                        ) : null}
                        <div className="itinerary-weather-details">
                          <p className="itinerary-section-label">Weather details</p>
                          <p>{day.weatherDescription}</p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : <p className="bg-white p-6 text-center text-sm text-slate-600">Generate a plan to see the print-ready travel plan.</p>}
        </section>
        </div>
        <div className="planner-controls mt-8 bg-white"><Footer /></div>
      </div>
    </main>
  );
}
