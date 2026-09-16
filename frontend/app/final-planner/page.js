"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTravel } from "../TravelContext";

const defaultDate = new Date().toISOString().split("T")[0];

const formatDateLabel = (dateString) => new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

const generateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate || endDate < startDate) return [];
  const days = [];
  const current = new Date(`${startDate}T00:00:00`);
  const last = new Date(`${endDate}T00:00:00`);
  while (current <= last) {
    days.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return days;
};

const weatherStyles = {
  Sunny: "border-amber-200 bg-amber-50 text-amber-900",
  Rainy: "border-sky-200 bg-sky-50 text-sky-900",
  Cloudy: "border-slate-200 bg-slate-100 text-slate-800",
};

export default function FinalPlannerPage() {
  const { dateRange, setDateRange, currentActivities, setCurrentActivities, saveItinerary, deleteItinerary, clearCurrentPlan } = useTravel();
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [mlrPrice, setMlrPrice] = useState("2999");
  const [guests, setGuests] = useState(1);
  const [activities, setActivities] = useState([]);
  const [outfit, setOutfit] = useState(null);
  const [planner, setPlanner] = useState(null);
  const [savedPlanners, setSavedPlanners] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (dateRange.startDate) setStartDate(dateRange.startDate);
    if (dateRange.endDate) setEndDate(dateRange.endDate);
  }, [dateRange.endDate, dateRange.startDate]);

  useEffect(() => {
    const savedTrip = window.localStorage.getItem("anoTaraTrip");
    try {
      const saved = JSON.parse(window.localStorage.getItem("anoTaraSavedPlanners") || "[]");
      setSavedPlanners(Array.isArray(saved) ? saved : []);
    } catch {
      window.localStorage.removeItem("anoTaraSavedPlanners");
    }
    if (!savedTrip) return;

    try {
      const trip = JSON.parse(savedTrip);
      const storedDates = Array.isArray(trip.targetDates) ? trip.targetDates : [];
      const savedStartDate = trip.startDate || storedDates[0] || defaultDate;
      const savedEndDate = trip.endDate || storedDates[storedDates.length - 1] || savedStartDate;
      setActivities(Array.isArray(trip.activities) ? trip.activities.map((activity) => ({ ...activity, guests: Number(activity.guests) || Number(trip.guests) || 1 })) : []);
      setCurrentActivities(Array.isArray(trip.activities) ? trip.activities : []);
      setStartDate(savedStartDate);
      setEndDate(savedEndDate);
      if (typeof trip.mlrPrice === "number") setMlrPrice(String(trip.mlrPrice));
      if (typeof trip.guests === "number") setGuests(trip.guests);
      setOutfit(trip.outfit || null);
    } catch {
      window.localStorage.removeItem("anoTaraTrip");
    }
  }, [setCurrentActivities]);

  useEffect(() => {
    if (currentActivities.length) setActivities(currentActivities);
  }, [currentActivities]);

  const saveTrip = (nextActivities, nextStartDate = startDate, nextEndDate = endDate) => {
    const current = JSON.parse(window.localStorage.getItem("anoTaraTrip") || "{}");
    setDateRange({ startDate: nextStartDate, endDate: nextEndDate });
    window.localStorage.setItem("anoTaraTrip", JSON.stringify({
      ...current,
      activities: nextActivities,
      startDate: nextStartDate,
      endDate: nextEndDate,
      targetDates: generateDateRange(nextStartDate, nextEndDate),
      guests: Number(guests) || 1,
      mlrPrice: Number(mlrPrice) || 0,
    }));
  };

  const removeActivity = (index) => {
    const nextActivities = activities.filter((_, activityIndex) => activityIndex !== index);
    setActivities(nextActivities); saveTrip(nextActivities); setPlanner(null);
    setCurrentActivities(nextActivities);
  };

  const removeOutfit = () => {
    setOutfit(null);
    const current = JSON.parse(window.localStorage.getItem("anoTaraTrip") || "{}");
    delete current.outfit;
    window.localStorage.setItem("anoTaraTrip", JSON.stringify(current));
    if (planner) {
      setPlanner((prev) => (prev ? { ...prev, outfit: null } : null));
    }
  };

  const changeActivityGuests = (index, change) => {
    const nextActivities = activities.map((activity, activityIndex) => activityIndex === index ? { ...activity, guests: Math.max(1, (Number(activity.guests) || 1) + change) } : activity);
    setActivities(nextActivities); saveTrip(nextActivities); setPlanner(null);
    setCurrentActivities(nextActivities);
  };

  const changeActivityDay = (index, assignedDay) => {
    const nextActivities = activities.map((activity, activityIndex) => activityIndex === index ? { ...activity, assignedDay } : activity);
    setActivities(nextActivities);
    saveTrip(nextActivities);
    setCurrentActivities(nextActivities);
    setPlanner(null);
  };

  const printAndSavePlanner = () => {
    if (!planner) return;
    const saved = [planner, ...savedPlanners];
    saveItinerary(planner);
    window.localStorage.setItem("anoTaraSavedPlanners", JSON.stringify(saved));
    setSavedPlanners(saved);
    setActivities([]);
    window.localStorage.setItem("anoTaraTrip", JSON.stringify({ startDate, endDate, targetDates: generateDateRange(startDate, endDate), guests, activities: [], mlrPrice: Number(mlrPrice) || 0 }));
    setCurrentActivities([]);
    window.print();
  };

  const deleteCurrentItinerary = () => {
    if (!planner) return;
    deleteItinerary(planner.createdAt);
    setSavedPlanners((current) => current.filter((item) => item.createdAt !== planner.createdAt));
    setPlanner(null);
  };

  const handleClearCurrentPlan = () => {
    clearCurrentPlan();
    setActivities([]);
    setPlanner(null);
    setStartDate("");
    setEndDate("");
  };

  const generatePlanner = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    const targetDates = generateDateRange(startDate, endDate);

    if (!startDate || !endDate || endDate < startDate || !targetDates.length) {
      setErrorMessage("Choose a valid start and end date.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:8000/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_dates: targetDates,
          raw_activities: activities.map((activity) => ({ ...activity, assigned_day: activity.assignedDay })),
          mlr_price: Number(mlrPrice),
          guests: Number(guests),
          outfit: outfit || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail?.[0]?.msg || data?.detail || "Could not generate the planner.");
      }
      if (!data?.itinerary || !data?.total_estimated_price || !data?.destination_totals) {
        throw new Error("The backend returned an incomplete planner response. Restart the backend and try again.");
      }
      const newPlanner = { ...data, outfit, createdAt: new Date().toLocaleString() };
      setPlanner(newPlanner);
    } catch (error) {
      setErrorMessage(error?.message || "Could not connect to the backend.");
    } finally {
      setIsLoading(false);
    }
  };

  const itineraryDays = (planner?.itinerary || []).map((day, dayIndex) => ({
    dayNumber: `Day ${dayIndex + 1}`,
    date: formatDateLabel(day.date || day.day),
    activities: (day.scheduled_activities || []).map((activity) => ({
      ...activity,
      location: activity.location || activity.destination,
      apparel: activity.apparel || day.outfit_advice,
      price: Number(activity.price ?? ((activity.price_range?.min || 0) + (activity.price_range?.max || 0)) / 2),
      image: activity.image,
      hasLongTravelWarning: Boolean(activity.hasLongTravelWarning),
    })),
  }));

  return (
    <main className="planner-shell min-h-screen bg-[#f5f7fa] px-4 py-5 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="planner-controls">
            <Link href="/" className="text-sm font-semibold text-slate-500 hover:text-slate-900">
              Back to home
            </Link>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Final planner</h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600">A print-ready trip plan arranged by forecast, activity type, and estimated cost.</p>
          </div>
          <div className="planner-controls flex items-center gap-3">
            <button type="button" onClick={handleClearCurrentPlan} className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50">
              Clear current plan
            </button>
            <button type="button" disabled={!planner} onClick={printAndSavePlanner} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              Print planner
            </button>
            <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">Decision Tree</span>
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <form onSubmit={generatePlanner} className="planner-controls rounded-2xl bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-bold">Selected trip details</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => { const nextStartDate = event.target.value; const nextEndDate = endDate < nextStartDate ? nextStartDate : endDate; setStartDate(nextStartDate); setEndDate(nextEndDate); saveTrip(activities, nextStartDate, nextEndDate); setPlanner(null); }}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-medium outline-none focus:border-slate-900"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                End date
                <input
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(event) => { setEndDate(event.target.value); saveTrip(activities, startDate, event.target.value); setPlanner(null); }}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-medium outline-none focus:border-slate-900"
                />
              </label>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Clicked activities</h3>
                <Link href="/destinations" className="text-sm font-bold text-slate-700 hover:underline">Choose more</Link>
              </div>
              <p className="mt-4 text-sm text-slate-500">Set guests per activity below. Estimates use each activity's guest count.</p>
              <div className="mt-3 space-y-2">
                {activities.map((activity, index) => (
                  <div key={`${activity.name}-${activity.destination}-${index}`} className="rounded-xl bg-slate-50 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium">{activity.name}</span>
                      <button type="button" onClick={() => removeActivity(index)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50" aria-label={`Remove ${activity.name}`}>Remove</button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold uppercase text-slate-500">
                      <span>{activity.type} · {activity.destination}</span>
                      <span className="flex items-center gap-2 normal-case text-slate-700"><button type="button" onClick={() => changeActivityGuests(index, -1)} className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300">−</button>{activity.guests} guest{activity.guests === 1 ? "" : "s"}<button type="button" onClick={() => changeActivityGuests(index, 1)} className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300">+</button></span>
                    </div>
                    <label className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
                      <span>Assign to</span>
                      <select
                        value={activity.assignedDay || "Day 1"}
                        onChange={(event) => changeActivityDay(index, event.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-slate-900"
                      >
                        {generateDateRange(startDate, endDate).map((date, dayIndex) => (
                          <option key={date} value={`Day ${dayIndex + 1}`}>Day {dayIndex + 1} · {formatDateLabel(date)}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
              {!activities.length ? <p className="mt-3 rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">Choose activities from a destination page first.</p> : null}
              
              {/* Attached Outfit Card */}
              {outfit ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-slate-900 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {outfit.image ? (
                        <img src={outfit.image} alt="Attached outfit" className="h-14 w-14 rounded-xl object-cover border border-emerald-300 bg-white shadow-sm" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-200 text-2xl">👗</div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Attached Outfit</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            outfit.matches ? "bg-emerald-200 text-emerald-900" : "bg-amber-200 text-amber-900"
                          }`}>
                            {outfit.matches ? "Weather Match" : "Needs adjustment"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm font-bold text-slate-900">{outfit.category || "Selected Outfit"}</p>
                        <p className="text-xs text-slate-600">{outfit.destination || "Trip"} · {outfit.weather} weather</p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">{outfit.advice}</p>

                  <div className="mt-3 flex items-center justify-between border-t border-emerald-200/60 pt-2.5 text-xs">
                    <Link href="/predict-outfit" className="font-bold text-emerald-800 hover:underline">
                      Change / Try another outfit
                    </Link>
                    <button
                      type="button"
                      onClick={removeOutfit}
                      className="font-bold text-rose-600 hover:text-rose-800 hover:underline"
                    >
                      Remove outfit
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <span className="text-base">👗</span>
                      <span>No outfit attached yet</span>
                    </div>
                    <Link
                      href="/predict-outfit"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-800 hover:bg-slate-100 transition"
                    >
                      Predict outfit
                    </Link>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Test if your clothing matches your destination's predicted weather before finalizing.
                  </p>
                </div>
              )}
            </div>

            <button type="submit" disabled={isLoading || !activities.length} className="mt-7 w-full rounded-xl bg-[#b9f0c8] px-4 py-3 text-base font-black text-slate-900 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60">
              {isLoading ? "Arranging your trip..." : "Generate final planner"}
            </button>
            {errorMessage ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p> : null}
          </form>

          <section aria-live="polite" className="planner-document">
            {!planner && !isLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                <p className="text-lg font-semibold text-slate-700">Your final planner will appear here.</p>
                <p className="mt-2 text-sm">Generate a plan to see each day, its mock weather, activities, and outfit advice.</p>
              </div>
            ) : null}

            {isLoading ? <div className="rounded-2xl bg-white p-8 text-center text-slate-500">The Decision Tree is arranging your activities...</div> : null}

            {planner ? (
              <div
                className="w-full min-h-screen bg-[url('/plannerbg.jpg')] bg-cover bg-center bg-no-repeat py-12"
                style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
              >
                <div className="max-w-5xl mx-auto px-6 md:px-12 flex flex-col gap-10">
                <div className="flex justify-end">
                  <button type="button" onClick={deleteCurrentItinerary} disabled={!planner} className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">
                    Delete itinerary
                  </button>
                </div>
                {/* Top Section: Pre-Trip Essentials (Outfit & Price) */}
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Outfit Card - Polaroid Style */}
                  <div className="relative flex-1 bg-[#F9F7F4] rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="w-[60%]">
                      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Trip Outfit Match</h3>
                      <h2 className="text-2xl font-extrabold text-[#1E3A8A] mb-2">
                        {(planner.outfit || outfit)?.category || "Recommended Outfit"}
                      </h2>
                      <p className="text-sm text-gray-700">
                        {(planner.outfit || outfit)?.advice || planner.itinerary[0]?.outfit_advice || "Comfortable and weather-appropriate casual travel attire."}
                      </p>
                    </div>
                    {/* Polaroid Outfit Image */}
                    <div className="absolute right-4 w-28 h-28 bg-white p-2 shadow-lg rotate-3 z-10 border border-gray-200">
                      <img 
                        src={(planner.outfit || outfit)?.image || "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80"} 
                        alt="Outfit" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                  </div>

                  {/* Price Card - Clean Summary */}
                  <div className="flex-1 bg-[#F9F7F4] rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Estimated Price</h3>
                    <div className="flex flex-col gap-3 text-sm text-gray-800 font-medium">
                      {planner.destination_totals && Object.keys(planner.destination_totals).length > 0 ? (
                        Object.entries(planner.destination_totals).map(([destination, range]) => (
                          <div key={destination} className="flex justify-between border-b border-gray-200 pb-2">
                            <span>{destination}</span>
                            <span>PHP {Number(range.min).toLocaleString()}–{Number(range.max).toLocaleString()}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between border-b border-gray-200 pb-2">
                          <span>Total Estimate</span>
                          <span>PHP {Number(planner.total_estimated_price?.min || 0).toLocaleString()}–{Number(planner.total_estimated_price?.max || 0).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 font-bold text-[#1E3A8A]">
                        <span>Baseline MLR</span>
                        <span>PHP {Number(planner.final_mlr_price || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {planner.itinerary[0] ? (
                  <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Forecast & Historical Climate Comparison · {planner.itinerary[0].destination}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">Open-Meteo Priority</span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                        <p className="text-[11px] font-bold uppercase text-emerald-900">Current Forecast</p>
                        <p className="mt-2 text-sm font-bold text-slate-900">
                          {planner.itinerary[0].expected_weather} · {planner.itinerary[0].weather_forecast?.temperature_min_c ?? 24}°C – {planner.itinerary[0].weather_forecast?.temperature_max_c ?? 31}°C
                        </p>
                        <p className="mt-1 text-xs text-slate-700">Rainfall: {planner.itinerary[0].weather_forecast?.precipitation_sum_mm ?? 0} mm</p>
                      </div>
                      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                        <p className="text-[11px] font-bold uppercase text-blue-900">Historical Climate</p>
                        <p className="mt-2 text-sm font-bold text-slate-900">
                          {planner.itinerary[0].historical_weather?.dominant_condition || "Cloudy"} · Avg {planner.itinerary[0].historical_weather?.average_temperature_c ?? 27.5}°C
                        </p>
                        <p className="mt-1 text-xs text-slate-700">Average rainfall: {planner.itinerary[0].historical_weather?.average_rainfall_mm ?? 5} mm</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="w-full max-w-5xl mx-auto mt-8 p-8 md:p-12 rounded-3xl shadow-2xl relative bg-[url('/plannerbg.png')] bg-cover bg-center bg-no-repeat">
                  <div className="absolute inset-0 bg-white/40 rounded-3xl z-0 pointer-events-none"></div>
                  <div className="relative z-10">
                    <h2 className="text-3xl font-serif font-extrabold text-[#D93845] mb-10 text-center italic">
                      Itinerary Overview
                    </h2>

                    <div className="flex flex-col gap-10">
                      {itineraryDays.map((day) => {
                        const dailySpend = day.activities.reduce((total, activity) => total + Number(activity.price || 0), 0);

                        return (
                          <section key={day.dayNumber} className="border-b border-white/70 pb-8 last:border-b-0">
                            <header className="mb-5 text-center">
                              <p className="text-2xl font-serif font-bold text-[#1E3A8A]">{day.dayNumber}</p>
                              <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-gray-500">{day.date}</p>
                            </header>

                            <div className="flex flex-col gap-4">
                              {day.activities.map((activity, activityIndex) => (
                                <div key={activity.id || `${day.dayNumber}-${activity.name}-${activityIndex}`} className="mb-4">
                                  {activity.hasLongTravelWarning ? (
                                    <div className="mb-2 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800">
                                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M10.29 3.86 2.82 17.25A1.5 1.5 0 0 0 4.12 19.5h15.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.96 1.96 0 0 0-3.42 0Z" />
                                      </svg>
                                      <span>Long travel distance from the previous location.</span>
                                    </div>
                                  ) : null}

                                  <div className="relative flex items-center w-full">
                                    <div className="w-[85%] bg-[#FDFBF7] p-6 pr-24 shadow-md border border-gray-200 rounded-xl z-0">
                                      <h3 className="text-xl font-extrabold text-[#1E3A8A] uppercase tracking-wide">
                                        {activity.name}
                                      </h3>

                                      <div className="mt-2 text-sm font-medium text-gray-700">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">LOCATION:</span>{" "}
                                        {activity.location || "Destination"}
                                      </div>

                                      <div className="mt-5 flex flex-col gap-2 border-t border-gray-200 pt-4">
                                        <div className="text-sm text-gray-600">
                                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">FORECAST:</span>{" "}
                                          {activity.weather || "Clear / Mild"}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">APPAREL:</span>{" "}
                                          {activity.apparel || "Comfortable travel attire"}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">ESTIMATE:</span>{" "}
                                          PHP {Number(activity.price || 0).toLocaleString()}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="absolute right-0 w-40 h-40 bg-gray-200 border-[6px] border-white shadow-xl rotate-3 rounded-sm z-10 overflow-hidden transition-transform duration-300 hover:rotate-0 hover:scale-105">
                                      <img
                                        src={activity.image || "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80"}
                                        alt={activity.name || "Destination"}
                                        className="h-full w-full object-cover"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="mt-5 flex items-center justify-between border-t border-white/80 pt-3 text-sm font-bold text-[#1E3A8A]">
                              <span>Average Daily Spend</span>
                              <span>PHP {dailySpend.toLocaleString()}</span>
                            </div>
                          </section>
                        );
                      })}
                    </div>

                    <div className="mt-8 rounded-2xl bg-[#1E3A8A] px-6 py-5 text-center text-white shadow-lg">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Total Estimated Trip Cost</p>
                      <p className="mt-2 text-3xl font-black">
                        PHP {itineraryDays.reduce((total, day) => total + day.activities.reduce((dailyTotal, activity) => dailyTotal + Number(activity.price || 0), 0), 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            ) : null}
          </section>
        </div>
        {savedPlanners.length > 0 ? (
          <section className="planner-controls mt-10 border-t border-slate-200 pt-6">
            <h2 className="text-lg font-black">Saved planners</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {savedPlanners.map((savedPlanner, index) => (
                <button key={savedPlanner.createdAt} type="button" onClick={() => setPlanner(savedPlanner)} className={`rounded-xl border px-3 py-2 text-left text-sm ${savedPlanner === planner ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}>
                  Planner {savedPlanners.length - index}<span className="ml-2 text-xs opacity-70">{savedPlanner.itinerary[0]?.day}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
