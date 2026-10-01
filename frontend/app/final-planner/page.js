"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Footer from "../footer/Footer";
import Header from "../header/Header";
import { useTravel } from "../TravelContext";
import { clampToSelectableDate, getGuestWarning, getMinSelectableDate, isPastOrTodayDate } from "../tripUtils";

const defaultDate = getMinSelectableDate();
const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const generateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate || endDate < startDate) return [];
  const dates = [];
  const current = new Date(`${startDate}T00:00:00`);
  const last = new Date(`${endDate}T00:00:00`);
  while (current <= last) { dates.push(current.toISOString().split("T")[0]); current.setDate(current.getDate() + 1); }
  return dates;
};
const valueFrom = (item, keys) => keys.map((key) => item?.[key]).find((value) => value !== undefined && value !== null && value !== "");
const getTime = (activity) => { const start = valueFrom(activity, ["time", "schedule", "start_time"]); const end = valueFrom(activity, ["end_time"]); return start && end ? `${start} - ${end}` : start || "Time to be confirmed"; };
const getStay = (activity) => { const checkIn = valueFrom(activity, ["check_in", "checkIn", "checkin"]); const checkOut = valueFrom(activity, ["check_out", "checkOut", "checkout"]); return checkIn || checkOut ? `Check-in ${checkIn || "-"} · Check-out ${checkOut || "-"}` : "No check-in details"; };

export default function FinalPlannerPage() {
  const { dateRange, setDateRange, guests, setGuests, currentActivities, setCurrentActivities, updateActivity, hasActivityConflict, saveItinerary, clearCurrentPlan } = useTravel();
  const [startDate, setStartDate] = useState(defaultDate); const [endDate, setEndDate] = useState(defaultDate); const [activities, setActivities] = useState([]); const [outfit, setOutfit] = useState(null); const [planner, setPlanner] = useState(null); const [savedPlanners, setSavedPlanners] = useState([]); const [isLoading, setIsLoading] = useState(false); const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => { if (dateRange.startDate) setStartDate(dateRange.startDate); if (dateRange.endDate) setEndDate(dateRange.endDate); }, [dateRange.endDate, dateRange.startDate]);
  useEffect(() => {
    try {
      const trip = JSON.parse(window.localStorage.getItem("anoTaraTrip") || "{}");
      const stored = Array.isArray(trip.activities) ? trip.activities : [];
      const targetDates = Array.isArray(trip.targetDates) ? trip.targetDates : [];
      const nextStart = clampToSelectableDate(trip.startDate || targetDates[0] || defaultDate);
      const nextEnd = clampToSelectableDate(trip.endDate || targetDates[targetDates.length - 1] || nextStart);
      const nextActivities = stored.map((activity) => ({ ...activity, guests: Number(activity.guests) || Number(trip.guests) || 1 }));
      setActivities(nextActivities); setCurrentActivities(nextActivities); setStartDate(nextStart); setEndDate(nextEnd); setOutfit(trip.outfit || null);
      const saved = JSON.parse(window.localStorage.getItem("anoTaraSavedPlanners") || "[]"); setSavedPlanners(Array.isArray(saved) ? saved : []);
      if (typeof trip.guests === "number") setGuests(trip.guests);
    } catch { window.localStorage.removeItem("anoTaraTrip"); }
  }, [setCurrentActivities, setGuests]);
  useEffect(() => { if (currentActivities.length) setActivities(currentActivities); }, [currentActivities]);

  const saveTrip = (nextActivities, nextStartDate = startDate, nextEndDate = endDate) => {
    const stored = JSON.parse(window.localStorage.getItem("anoTaraTrip") || "{}");
    window.localStorage.setItem("anoTaraTrip", JSON.stringify({ ...stored, activities: nextActivities, startDate: nextStartDate, endDate: nextEndDate, targetDates: generateDateRange(nextStartDate, nextEndDate), guests }));
    setDateRange({ startDate: nextStartDate, endDate: nextEndDate });
  };
  const commitActivities = (nextActivities) => { setActivities(nextActivities); setCurrentActivities(nextActivities); saveTrip(nextActivities); setPlanner(null); };
  const changeActivity = (index, changes) => {
    const next = activities.map((activity, activityIndex) => activityIndex === index ? { ...activity, ...changes } : activity);
    if (changes.assignedDay && hasActivityConflict(next[index], index)) { setErrorMessage("Only one activity can be assigned to each day."); return; }
    updateActivity(index, changes); commitActivities(next);
  };
  const changeActivityGuests = (index, amount) => { const current = Number(activities[index]?.guests) || 1; changeActivity(index, { guests: Math.max(1, current + amount) }); };
  const removeOutfit = () => { setOutfit(null); const stored = JSON.parse(window.localStorage.getItem("anoTaraTrip") || "{}"); delete stored.outfit; window.localStorage.setItem("anoTaraTrip", JSON.stringify(stored)); };

  const generatePlanner = async (event) => {
    event.preventDefault(); setErrorMessage(""); const targetDates = generateDateRange(startDate, endDate);
    if (!targetDates.length || isPastOrTodayDate(startDate)) { setErrorMessage("Choose a valid future date range."); return; }
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:8000/api/generate-itinerary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target_dates: targetDates, raw_activities: activities.map((activity) => ({ ...activity, assigned_day: activity.assignedDay })), mlr_price: 2999, guests, outfit: outfit || undefined }) });
      const data = await response.json(); if (!response.ok) throw new Error(data?.detail?.[0]?.msg || data?.detail || "Could not generate the planner.");
      setPlanner({ ...data, outfit, createdAt: new Date().toLocaleString() });
    } catch (error) { setErrorMessage(error.message || "Could not connect to the backend."); } finally { setIsLoading(false); }
  };
  const printPlanner = () => { if (!planner) return; saveItinerary(planner); window.print(); };
  const itineraryDays = (planner?.itinerary || []).map((day, index) => ({ ...day, dayNumber: `Day ${index + 1}`, dateLabel: formatDate(day.date || day.day), activities: (day.scheduled_activities || []).map((activity) => ({ ...activity, location: activity.location || activity.destination, price: Number(activity.price ?? ((activity.price_range?.min || 0) + (activity.price_range?.max || 0)) / 2), guests: Number(activity.guests) || guests })) })).filter((day) => day.activities.length);
  const dates = generateDateRange(startDate, endDate);

  return (
    <main className="planner-shell min-h-screen bg-[#f5f7fa] text-slate-900">
      <div className="planner-controls"><Header /></div>
      <div className="w-full px-4 py-8 sm:px-8">
        <div className="planner-controls mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Trip workspace</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">Itinerary planner</h1></div><button type="button" onClick={() => { clearCurrentPlan(); setActivities([]); setPlanner(null); }} className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700">Clear current plan</button></div>
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <form onSubmit={generatePlanner} className="planner-controls max-h-[calc(100vh-9rem)] overflow-y-auto pr-2 lg:sticky lg:top-24">
            <section className="border-b border-slate-200 pb-6"><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">01 / Travel details</p><h2 className="mt-2 text-2xl font-black">Selected trip</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Start date<input type="date" min={getMinSelectableDate()} value={startDate} onChange={(event) => { const next = event.target.value; const nextEnd = endDate < next ? next : endDate; setStartDate(next); setEndDate(nextEnd); saveTrip(activities, next, nextEnd); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label><label className="text-sm font-bold">End date<input type="date" min={startDate || getMinSelectableDate()} value={endDate} onChange={(event) => { setEndDate(event.target.value); saveTrip(activities, startDate, event.target.value); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label></div></section>
            <section className="py-6"><div className="flex items-center justify-between"><h3 className="text-sm font-black uppercase tracking-wider">Activities</h3><Link href="/destinations" className="text-sm font-bold underline">Choose more</Link></div><p className="mt-2 text-sm text-slate-600">Each activity keeps its own day and guest count.</p><div className="mt-4 space-y-3">{activities.map((activity, index) => <article key={`${activity.name}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex justify-between gap-3"><div><h4 className="font-black">{activity.name}</h4><p className="mt-1 text-xs text-slate-500">{activity.destination} · {activity.type || "Activity"}</p></div><button type="button" onClick={() => commitActivities(activities.filter((_, activityIndex) => activityIndex !== index))} className="text-xs font-bold text-rose-600">Remove</button></div><div className="mt-4 grid gap-3 text-xs font-bold sm:grid-cols-2"><div className="flex items-center gap-2"><span>Guests</span><button type="button" onClick={() => changeActivityGuests(index, -1)} className="h-6 w-6 rounded-full border">-</button><span>{activity.guests || 1}</span><button type="button" onClick={() => changeActivityGuests(index, 1)} className="h-6 w-6 rounded-full border">+</button></div><label>Day<select value={activity.assignedDay || "Day 1"} onChange={(event) => changeActivity(index, { assignedDay: event.target.value })} className="ml-2 rounded border border-slate-300 bg-white px-2 py-1">{dates.map((date, dayIndex) => <option key={date} value={`Day ${dayIndex + 1}`}>Day {dayIndex + 1} · {formatDate(date)}</option>)}</select></label></div><p className="mt-3 text-xs text-slate-600">Time: {getTime(activity)} · {getStay(activity)}</p>{getGuestWarning(activity.guests) ? <p className="mt-1 text-[11px] font-semibold text-amber-700">{getGuestWarning(activity.guests)}</p> : null}</article>)}</div>{!activities.length ? <p className="mt-4 border border-dashed border-slate-300 p-4 text-sm text-slate-600">Choose an activity to begin.</p> : null}</section>
            <section className="border-t border-slate-200 py-6"><div className="flex items-center justify-between"><h3 className="text-sm font-black uppercase tracking-wider">Clothing</h3><Link href="/predict-outfit" className="text-sm font-bold underline">Attach outfit</Link></div>{outfit ? <div className="mt-3 flex items-center gap-3 bg-white p-3">{outfit.image ? <img src={outfit.image} alt="Attached outfit" className="h-12 w-12 object-cover" /> : null}<span className="text-sm font-bold">{outfit.category || "Attached outfit"}</span><button type="button" onClick={removeOutfit} className="ml-auto text-xs font-bold text-rose-600">Remove</button></div> : <p className="mt-3 text-sm text-slate-600">No clothing selected. Use Attach outfit to add one.</p>}</section>
            <button type="submit" disabled={isLoading || !activities.length} className="w-full rounded-lg bg-slate-900 px-4 py-3 font-black text-white disabled:opacity-50">{isLoading ? "Preparing planner..." : "Generate final planner"}</button>{errorMessage ? <p className="mt-3 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{errorMessage}</p> : null}
          </form>

          <aside className="planner-controls lg:sticky lg:top-24"><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">02 / Travel summary</p><h2 className="mt-2 text-2xl font-black">Daily conditions</h2><div className="mt-5 space-y-4"><div className="border-b border-slate-200 pb-4"><p className="text-xs font-bold uppercase text-slate-500">Clothing</p>{outfit ? <p className="mt-1 text-sm font-bold">{outfit.category || "Attached outfit"}</p> : <Link href="/predict-outfit" className="mt-1 inline-block text-sm font-bold underline">Add clothing from outfit planner</Link>}</div>{planner?.itinerary?.filter((day) => (day.scheduled_activities || []).length).map((day, index) => <section key={`${day.date}-${index}`} className="border-b border-slate-200 pb-4"><div className="flex justify-between gap-3"><h3 className="font-black">Day {index + 1} · {formatDate(day.date || day.day)}</h3><span className="text-xs font-bold text-slate-500">{day.expected_weather || "Forecast unavailable"}</span></div><p className="mt-2 text-xs text-slate-600">Forecast: {day.weather_forecast?.temperature_min_c ?? "-"}°C - {day.weather_forecast?.temperature_max_c ?? "-"}°C · Rain chance {day.weather_forecast?.precipitation_probability ?? "-"}%</p><p className="mt-1 text-xs text-slate-600">Historical: {day.historical_weather?.dominant_condition || "-"} · Avg {day.historical_weather?.average_temperature_c ?? "-"}°C</p><p className="mt-2 text-xs text-slate-700">{day.outfit_advice || "Comfortable travel clothing"}</p>{day.scheduled_activities.map((activity) => <p key={activity.name} className="mt-2 text-xs font-semibold">{activity.name} · {activity.location || activity.destination} · {activity.guests || guests} guests · PHP {Number(activity.price || 0).toLocaleString()}</p>)}</section>)}{!planner ? <p className="text-sm text-slate-600">Generate the planner to see daily weather comparisons and compiled activity details.</p> : null}</div></aside>
        </div>

        <section aria-live="polite" className="planner-document mt-12 bg-[url('/plannerbg.jpg')] bg-cover bg-center p-4 sm:p-8"><div className="planner-print-controls mb-4 flex justify-end">{planner ? <button type="button" onClick={printPlanner} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-black text-white">Print planner</button> : null}</div>{planner ? <div className="planner-landscape mx-auto max-w-7xl bg-white p-5 text-slate-900 sm:p-8"><div className="flex items-end justify-between border-b border-slate-200 pb-5"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Ano Tara travel plan</p><h2 className="mt-1 text-3xl font-black">Itinerary overview</h2></div><p className="text-sm font-bold text-slate-500">{itineraryDays.length} planned day{itineraryDays.length === 1 ? "" : "s"}</p></div><div className="mt-6 grid auto-cols-[minmax(220px,1fr)] grid-flow-col gap-4 overflow-x-auto">{itineraryDays.map((day) => <article key={day.dayNumber} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">{day.dayNumber}</p><p className="mt-1 text-sm font-bold">{day.dateLabel}</p><p className="mt-2 text-xs text-slate-600">{day.expected_weather || "Forecast unavailable"}</p>{day.activities.map((activity, index) => <div key={`${activity.name}-${index}`} className="mt-4 border-t border-slate-200 pt-3"><h3 className="font-black">{activity.name}</h3><p className="mt-1 text-xs text-slate-600">{activity.location || activity.destination}</p><p className="mt-2 text-xs text-slate-600">{getTime(activity)} · {activity.guests} guests · PHP {Number(activity.price || 0).toLocaleString()}</p><p className="mt-1 text-xs text-slate-600">{getStay(activity)}</p><p className="mt-3 text-xs leading-5 text-slate-700">{activity.description || activity.apparel || "Comfortable travel clothing"}</p></div>)}</article>)}</div><div className="mt-6 border-t border-slate-200 pt-4 text-right text-sm font-black">Total estimated activity cost: PHP {itineraryDays.reduce((total, day) => total + day.activities.reduce((sum, activity) => sum + Number(activity.price || 0), 0), 0).toLocaleString()}</div></div> : <p className="bg-white p-6 text-center text-sm text-slate-600">Generate a plan to see the print-ready travel plan.</p>}</section>
        <div className="planner-controls"><Footer /></div>
      </div>
    </main>
  );
}