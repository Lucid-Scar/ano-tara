"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import GarmentImage from "../../components/GarmentImage";
import Footer from "../footer/Footer";
import Header from "../header/Header";
import { useTravel } from "../TravelContext";
import { getGuestWarning, getMinSelectableDate, isPastOrTodayDate, toDateString } from "../tripUtils";

const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const generateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate || endDate < startDate) return [];
  const dates = []; const current = new Date(`${startDate}T00:00:00`); const last = new Date(`${endDate}T00:00:00`);
  while (current <= last) { dates.push(toDateString(current)); current.setDate(current.getDate() + 1); }
  return dates;
};
const valueFrom = (item, keys) => keys.map((key) => item?.[key]).find((value) => value !== undefined && value !== null && value !== "");
const getTime = (activity) => { const start = valueFrom(activity, ["time", "schedule", "start_time"]); const end = valueFrom(activity, ["end_time"]); return start && end ? `${start} - ${end}` : start || "Time to be confirmed"; };
const getStay = (activity) => { const checkIn = valueFrom(activity, ["check_in", "checkIn", "checkin"]); const checkOut = valueFrom(activity, ["check_out", "checkOut", "checkout"]); return checkIn || checkOut ? `Check-in ${checkIn || "-"} · Check-out ${checkOut || "-"}` : "No check-in details"; };
const dayImage = (activity) => {
  if (activity?.image) return activity.image;
  const name = `${activity?.name || ""} ${activity?.type || ""}`.toLowerCase();
  if (/food|seafood|culinary|dining|tasting|manokan|oyster/.test(name)) return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80";
  if (/museum|gallery|art|heritage|cultural/.test(name)) return "https://images.unsplash.com/photo-1564399579883-451a5d44ec08?auto=format&fit=crop&w=1200&q=80";
  return "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";
};
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

export default function FinalPlannerPage() {
  const { dateRange, setDateRange, guests, currentActivities, setCurrentActivities, updateActivity, hasActivityConflict, outfits, setOutfits, savedItineraries, saveItinerary, deleteItinerary, clearCurrentPlan } = useTravel();
  const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState(""); const [activities, setActivities] = useState([]); const [planner, setPlanner] = useState(null); const [isLoading, setIsLoading] = useState(false); const [errorMessage, setErrorMessage] = useState(""); const [warningActivityIndex, setWarningActivityIndex] = useState(-1); const [showSavedPlanners, setShowSavedPlanners] = useState(false);

  useEffect(() => { if (dateRange.startDate) setStartDate(dateRange.startDate); if (dateRange.endDate) setEndDate(dateRange.endDate); }, [dateRange.endDate, dateRange.startDate]);
  useEffect(() => { setActivities(currentActivities); }, [currentActivities]);

  const dates = generateDateRange(startDate, endDate);
  const commitActivities = (nextActivities) => { setActivities(nextActivities); setCurrentActivities(nextActivities); setPlanner(null); };
  const changeActivity = (index, changes) => {
    const next = activities.map((activity, activityIndex) => activityIndex === index ? { ...activity, ...changes } : activity);
    if (changes.assignedDay && hasActivityConflict(next[index], index)) { setWarningActivityIndex(index); setErrorMessage("Only one activity per day. Choosing this day will swap the activities."); return; }
    setWarningActivityIndex(-1); setErrorMessage(""); updateActivity(index, changes); commitActivities(next);
  };
  const changeActivityGuests = (index, amount) => changeActivity(index, { guests: Math.max(1, (Number(activities[index]?.guests) || 1) + amount) });
  const removeOutfit = (id) => setOutfits((current) => current.filter((outfit) => outfit.id !== id));
  const outfitSetOptions = [...new Map(outfits.map((item) => {
    const id = item.outfitSetId || "outfit-set-1";
    return [id, { id, name: item.outfitSetName || "Outfit 1" }];
  })).values()];
  const changeOutfitSet = (outfitId, nextSet) => setOutfits((current) => current.map((item) => item.id === outfitId ? { ...item, outfitSetId: nextSet.id, outfitSetName: nextSet.name } : item));
  const createOutfitSet = (outfitId) => changeOutfitSet(outfitId, {
    id: `outfit-set-${Date.now()}-${outfitId}`,
    name: `Outfit ${outfitSetOptions.length + 1}`,
  });
  const outfitsForDay = (date, dayIndex) => outfits.filter((outfit) => outfit.date === date || outfit.day === `Day ${dayIndex + 1}`);

  const generatePlanner = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    const targetDates = generateDateRange(startDate, endDate);
    if (!targetDates.length || isPastOrTodayDate(startDate)) { setErrorMessage("Choose a valid future date range."); return; }
    setIsLoading(true);
    try {
      const primaryActivity = activities[0];
      const hotelType = primaryActivity.hotel_type || (String(primaryActivity.type).toLowerCase() === "outdoor" ? "Resort Hotel" : "City Hotel");
      const priceResponse = await fetch("http://localhost:8000/predict-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ check_in: startDate, check_out: endDate, guests: Number(primaryActivity.guests) || guests, hotel_type: hotelType, room_type: "Standard Room", destination_name: primaryActivity.destination }),
      });
      const priceData = await priceResponse.json();
      if (!priceResponse.ok) throw new Error(priceData?.detail || "Could not fetch the MLR price.");
      const mlrPrice = Number(priceData.total_price ?? priceData.price);
      if (!Number.isFinite(mlrPrice)) throw new Error("The MLR price response was invalid.");

      const response = await fetch("http://localhost:8000/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_dates: targetDates, raw_activities: activities.map((activity) => ({ ...activity, assigned_day: activity.assignedDay })), mlr_price: mlrPrice, guests, outfit: outfits[0] || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail?.[0]?.msg || data?.detail || "Could not generate the planner.");
      const newPlanner = {
        ...data,
        outfits,
        priceEstimate: { amount: mlrPrice, source: priceData.source, destination: primaryActivity.destination },
        createdAt: new Date().toLocaleString(),
      };
      setPlanner(newPlanner);
      saveItinerary(newPlanner);
    } catch (error) {
      setErrorMessage(error.message || "Could not connect to the backend.");
    } finally { setIsLoading(false); }
  };
  const printPlanner = () => { if (!planner) return; window.print(); };
  const itineraryDays = (planner?.itinerary || []).map((day, index) => ({ ...day, dayNumber: `Day ${index + 1}`, dateLabel: formatDate(day.date || day.day), weatherDescription: describeWeather(day), activities: (day.scheduled_activities || []).map((activity) => ({ ...activity, location: activity.location || activity.destination, price: Number(activity.price ?? ((activity.price_range?.min || 0) + (activity.price_range?.max || 0)) / 2), guests: Number(activity.guests) || guests })) })).filter((day) => day.activities.length);

  return (
    <main className="planner-shell min-h-screen bg-[#f5f7fa] text-slate-900">
      <div className="planner-controls"><Header /></div>
      <div className="w-full px-4 py-8 sm:px-8">
        <div className="planner-controls mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Trip workspace</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">Itinerary planner</h1></div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setShowSavedPlanners((current) => !current)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Saved planners ({savedItineraries.length})</button>
            <button type="button" onClick={() => { clearCurrentPlan(); setActivities([]); setPlanner(null); }} className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700">Clear current plan</button>
          </div>
        </div>

        {showSavedPlanners ? (
          <div className="planner-controls mb-8 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-bold text-slate-700">Previously generated planners</p>
            {savedItineraries.length ? (
              <div className="mt-3 space-y-2">
                {savedItineraries.map((item) => (
                  <div key={item.createdAt} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                    <button type="button" onClick={() => { setPlanner(item); setShowSavedPlanners(false); }} className="text-left text-sm font-bold text-slate-800 hover:underline">
                      {item.itinerary?.length || 0} day itinerary · {item.createdAt}
                    </button>
                    <button type="button" onClick={() => deleteItinerary(item.createdAt)} className="text-xs font-bold text-rose-600">Delete</button>
                  </div>
                ))}
              </div>
            ) : <p className="mt-2 text-sm text-slate-600">No planners have been generated yet.</p>}
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <form onSubmit={generatePlanner} className="planner-controls max-h-[calc(100vh-9rem)] overflow-y-auto pr-2 lg:sticky lg:top-24">
            <section className="border-b border-slate-200 pb-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">01 / Travel details</p>
              <h2 className="mt-2 text-2xl font-black">Selected trip</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold">Start date<input type="date" min={getMinSelectableDate()} value={startDate} onChange={(event) => { const next = event.target.value; const nextEnd = endDate < next ? next : endDate; setStartDate(next); setEndDate(nextEnd); setDateRange({ startDate: next, endDate: nextEnd }); setPlanner(null); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
                <label className="text-sm font-bold">End date<input type="date" min={startDate || getMinSelectableDate()} value={endDate} onChange={(event) => { setEndDate(event.target.value); setDateRange({ startDate, endDate: event.target.value }); setPlanner(null); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
              </div>
            </section>

            <section className="py-6">
              <div className="flex items-center justify-between"><h3 className="text-sm font-black uppercase tracking-wider">Activities</h3><Link href="/destinations" className="text-sm font-bold underline">Choose more</Link></div>
              <p className="mt-2 text-sm text-slate-600">Choose a different day to swap with the activity currently assigned there.</p>
              <div className="mt-4 space-y-3">
                {activities.map((activity, index) => (
                  <article key={`${activity.name}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex justify-between gap-3">
                      <div><h4 className="font-black">{activity.name}</h4><p className="mt-1 text-xs text-slate-500">{activity.destination} · {activity.type || "Activity"}</p></div>
                      <button type="button" onClick={() => commitActivities(activities.filter((_, activityIndex) => activityIndex !== index))} className="text-xs font-bold text-rose-600">Remove</button>
                    </div>
                    <div className="mt-4 grid gap-3 text-xs font-bold sm:grid-cols-2">
                      <div className="flex items-center gap-2"><span>Guests</span><button type="button" onClick={() => changeActivityGuests(index, -1)} className="h-6 w-6 rounded-full border">-</button><span>{activity.guests || 1}</span><button type="button" onClick={() => changeActivityGuests(index, 1)} className="h-6 w-6 rounded-full border">+</button></div>
                      <label>Day<select value={activity.assignedDay || "Day 1"} onChange={(event) => changeActivity(index, { assignedDay: event.target.value })} className="ml-2 rounded border border-slate-300 bg-white px-2 py-1">{dates.map((date, dayIndex) => <option key={date} value={`Day ${dayIndex + 1}`}>Day {dayIndex + 1} · {formatDate(date)}</option>)}</select></label>
                    </div>
                    {warningActivityIndex === index ? <p className="mt-2 text-[11px] font-semibold text-amber-700">{errorMessage}</p> : null}
                    <p className="mt-3 text-xs text-slate-600">Time: {getTime(activity)} · {getStay(activity)}</p>
                    {getGuestWarning(activity.guests) ? <p className="mt-1 text-[11px] font-semibold text-amber-700">{getGuestWarning(activity.guests)}</p> : null}
                  </article>
                ))}
              </div>
              {!activities.length ? <p className="mt-4 border border-dashed border-slate-300 p-4 text-sm text-slate-600">Choose an activity to begin.</p> : null}
            </section>

            <section className="border-t border-slate-200 py-6">
              <div className="flex items-center justify-between"><h3 className="text-sm font-black uppercase tracking-wider">Clothing</h3><Link href="/predict-outfit" className="text-sm font-bold underline">Attach outfit</Link></div>
              {outfits.length ? (
                <div className="mt-3 space-y-2">
                  {groupOutfits(outfits).map((group) => (
                    <div key={group.key} className="bg-white p-3">
                      <p className="mb-2 text-xs font-black uppercase text-slate-600">{group.name}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((item) => <div key={item.id} className="flex items-center gap-2">
                          <GarmentImage src={item.image} alt={`${item.category} garment`} className="h-10 w-10" />
                          <span className="text-sm font-bold">{item.category}</span>
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

          <aside className="planner-controls lg:sticky lg:top-24">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">02 / Travel summary</p>
            <h2 className="mt-2 text-2xl font-black">Daily conditions</h2>
            <div className="mt-5 space-y-4">
              <div className="border-b border-slate-200 pb-4">
                <p className="text-xs font-bold uppercase text-slate-500">Clothing</p>
                {outfits.length ? <p className="mt-1 text-sm font-bold">{outfits.length} garment{outfits.length === 1 ? "" : "s"} attached</p> : <Link href="/predict-outfit" className="mt-1 inline-block text-sm font-bold underline">Add clothing from outfit planner</Link>}
              </div>
              {itineraryDays.map((day, index) => {
                const dayOutfits = outfitsForDay(day.date, index);
                return (
                  <section key={`${day.date}-${index}`} className="border-b border-slate-200 pb-4">
                    <div className="flex justify-between gap-3"><h3 className="font-black">{day.dayNumber} · {day.dateLabel}</h3></div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{day.weatherDescription}</p>
                    {dayOutfits.length ? <div className="mt-3 space-y-2">{groupOutfits(dayOutfits).map((group) => <div key={group.key}>
                      <p className="text-xs font-bold text-slate-700">{group.name}</p>
                      <div className="mt-1 flex flex-wrap gap-2">{group.items.map((item) => <GarmentImage key={item.id} src={item.image} alt={`${item.category} for ${day.dayNumber}`} className="h-14 w-14 rounded" />)}</div>
                    </div>)}</div> : null}
                    {day.activities.map((activity) => <p key={activity.name} className="mt-2 text-xs font-semibold">{activity.name} · {activity.location || activity.destination} · {activity.guests} guests · PHP {Number(activity.price || 0).toLocaleString()}</p>)}
                  </section>
                );
              })}
              {!planner ? <p className="text-sm text-slate-600">Generate the planner to see daily weather, clothing, and compiled activity details.</p> : null}
            </div>
          </aside>
        </div>

        <section aria-live="polite" className="planner-document mt-12 bg-[url('/plannerbg.png')] bg-cover bg-center p-4 sm:p-8">
          <div className="planner-print-controls mb-4 flex justify-end">{planner ? <button type="button" onClick={printPlanner} className="rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-900 shadow">Print planner</button> : null}</div>
          {planner ? (
            <div className="planner-landscape mx-auto max-w-7xl p-2 sm:p-4">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 rounded-lg bg-white/95 p-4 shadow">
                <div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">Ano Tara travel plan</p><h2 className="mt-1 text-3xl font-black text-slate-950">Itinerary overview</h2></div>
                <p className="text-sm font-bold text-slate-800">{itineraryDays.length} planned day{itineraryDays.length === 1 ? "" : "s"}</p>
              </div>
              <div className="grid gap-4">
                {itineraryDays.map((day, index) => {
                  const dayOutfits = outfitsForDay(day.date, index);
                  const heroImage = dayImage(day.activities[0]);
                  return (
                    <article key={day.dayNumber} className="overflow-hidden rounded-lg bg-white shadow-lg">
                      <img src={heroImage} alt={day.activities[0]?.name || day.dayNumber} className="h-32 w-full object-cover" />
                      <div className="p-4">
                        <p className="text-xs font-black uppercase text-slate-500">{day.dayNumber}</p>
                        <p className="mt-1 text-sm font-bold">{day.dateLabel}</p>
                        {dayOutfits.length ? <div className="mt-3 space-y-2">{groupOutfits(dayOutfits).map((group) => <div key={group.key}>
                          <p className="text-xs font-black text-slate-700">{group.name}</p>
                          <div className="mt-1 flex flex-wrap gap-2">{group.items.map((item) => <GarmentImage key={item.id} src={item.image} alt={`${item.category} outfit`} className="h-10 w-10 rounded" />)}</div>
                        </div>)}</div> : null}
                        <p className="mt-3 text-xs leading-5 text-slate-600">{day.weatherDescription}</p>
                        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2 lg:grid-cols-3">
                          {day.activities.map((activity, activityIndex) => (
                          <div key={`${activity.name}-${activityIndex}`} className="min-w-0 rounded border border-slate-200 p-3">
                            {activity.hazard_flag ? <div role="alert" className="mb-3 flex items-center gap-2 border-2 border-rose-700 bg-rose-50 p-2 text-sm font-black text-rose-900">
                              <TriangleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
                              <span>SAFETY ALERT · Outdoor activity during rainy weather</span>
                            </div> : null}
                            <h3 className="font-black">{activity.name}</h3>
                            <p className="mt-1 text-xs text-slate-600">{activity.location || activity.destination}</p>
                            <p className="mt-2 text-xs text-slate-600">{getTime(activity)} · {activity.guests} guests · PHP {Number(activity.price || 0).toLocaleString()}</p>
                            <p className="mt-1 text-xs text-slate-600">{getStay(activity)}</p>
                          </div>
                          ))}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="mt-6 rounded-lg bg-white/95 p-4 text-right text-sm font-black text-slate-950 shadow">
                <p>MLR-based estimated trip price: PHP {Number(planner.final_mlr_price || planner.priceEstimate?.amount || 0).toLocaleString()}</p>
                {planner.priceEstimate?.source ? <p className="mt-1 text-xs font-semibold text-slate-700">{planner.priceEstimate.source} · {planner.priceEstimate.destination}</p> : null}
              </div>
            </div>
          ) : <p className="bg-white p-6 text-center text-sm text-slate-600">Generate a plan to see the print-ready travel plan.</p>}
        </section>
        <div className="planner-controls"><Footer /></div>
      </div>
    </main>
  );
}
