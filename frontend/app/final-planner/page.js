"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const defaultDate = new Date().toISOString().split("T")[0];

const weatherStyles = {
  Sunny: "border-amber-200 bg-amber-50 text-amber-900",
  Rainy: "border-sky-200 bg-sky-50 text-sky-900",
  Cloudy: "border-slate-200 bg-slate-100 text-slate-800",
};

export default function FinalPlannerPage() {
  const [dates, setDates] = useState(defaultDate);
  const [mlrPrice, setMlrPrice] = useState("2999");
  const [guests, setGuests] = useState(1);
  const [activities, setActivities] = useState([]);
  const [outfit, setOutfit] = useState(null);
  const [planner, setPlanner] = useState(null);
  const [savedPlanners, setSavedPlanners] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
      setActivities(Array.isArray(trip.activities) ? trip.activities.map((activity) => ({ ...activity, guests: Number(activity.guests) || Number(trip.guests) || 1 })) : []);
      setDates(Array.isArray(trip.targetDates) && trip.targetDates.length ? trip.targetDates[0] : defaultDate);
      if (typeof trip.mlrPrice === "number") setMlrPrice(String(trip.mlrPrice));
      if (typeof trip.guests === "number") setGuests(trip.guests);
      setOutfit(trip.outfit || null);
    } catch {
      window.localStorage.removeItem("anoTaraTrip");
    }
  }, []);

  const saveTrip = (nextActivities, nextDate = dates) => {
    const current = JSON.parse(window.localStorage.getItem("anoTaraTrip") || "{}");
    window.localStorage.setItem("anoTaraTrip", JSON.stringify({ ...current, activities: nextActivities, targetDates: nextDate ? [nextDate] : [], guests: Number(guests) || 1, mlrPrice: Number(mlrPrice) || 0 }));
  };

  const removeActivity = (index) => {
    const nextActivities = activities.filter((_, activityIndex) => activityIndex !== index);
    setActivities(nextActivities); saveTrip(nextActivities); setPlanner(null);
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
  };

  const printAndSavePlanner = () => {
    if (!planner) return;
    const saved = [planner, ...savedPlanners];
    window.localStorage.setItem("anoTaraSavedPlanners", JSON.stringify(saved));
    setSavedPlanners(saved);
    setActivities([]);
    window.localStorage.setItem("anoTaraTrip", JSON.stringify({ targetDates: [dates], guests, activities: [], mlrPrice: Number(mlrPrice) || 0 }));
    window.print();
  };

  const generatePlanner = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    const targetDates = [dates.trim()].filter(Boolean);

    if (!targetDates.length) {
      setErrorMessage("Add at least one target date.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:8000/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_dates: targetDates,
          raw_activities: activities,
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
            <button type="button" disabled={!planner} onClick={printAndSavePlanner} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              Print planner
            </button>
            <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">Decision Tree</span>
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <form onSubmit={generatePlanner} className="planner-controls rounded-2xl bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-bold">Selected trip details</h2>
            <label className="mt-6 block text-sm font-semibold text-slate-700">
              Travel date
              <input
                type="date"
                value={dates}
                onChange={(event) => { setDates(event.target.value); saveTrip(activities, event.target.value); setPlanner(null); }}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-medium outline-none focus:border-slate-900"
              />
            </label>

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
              <div>
                <div className="planner-title flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Final travel plan</p>
                    <h2 className="mt-1 text-4xl font-black">{planner.itinerary[0]?.day} to {planner.itinerary[planner.itinerary.length - 1]?.day}</h2>
                  </div>
                  <p className="text-sm text-slate-500">Weather outlook • Created {planner.createdAt}</p>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-900 p-4 text-white"><p className="text-xs uppercase tracking-wider text-slate-300">MLR baseline</p><p className="mt-1 text-2xl font-black">PHP {Number(planner.final_mlr_price).toLocaleString()}</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Trip estimate</p><p className="mt-1 text-2xl font-black">PHP {Number(planner.total_estimated_price.min).toLocaleString()}–{Number(planner.total_estimated_price.max).toLocaleString()}</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Activities</p><p className="mt-1 text-2xl font-black">{activities.length}</p></div>
                </div>
                {/* Trip Outfit Recommendation in Planner Document */}
                {(planner.outfit || outfit) ? (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Trip Outfit Match</span>
                        <h3 className="mt-1 text-lg font-black text-slate-900">
                          {(planner.outfit || outfit).category || "Predicted Outfit"}
                        </h3>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                        (planner.outfit || outfit).matches ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}>
                        {(planner.outfit || outfit).matches ? "✓ Perfect Weather Match" : "⚠️ Needs Adjustment"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row gap-4 items-start">
                      {(planner.outfit || outfit).image ? (
                        <img
                          src={(planner.outfit || outfit).image}
                          alt="Trip Outfit"
                          className="h-28 w-28 shrink-0 rounded-xl object-contain border border-slate-200 bg-slate-50 p-1"
                        />
                      ) : null}
                      <div className="flex-1 text-sm text-slate-700 space-y-1.5">
                        <p>
                          <strong>Expected Weather:</strong> {(planner.outfit || outfit).weather} in {(planner.outfit || outfit).destination || "Destination"}
                        </p>
                        <p className="text-slate-600 leading-relaxed">
                          {(planner.outfit || outfit).advice}
                        </p>
                        <div className="pt-1 flex items-center gap-3 text-xs">
                          <Link href="/predict-outfit" className="font-bold text-emerald-700 hover:underline">
                            Change outfit
                          </Link>
                          <button type="button" onClick={removeOutfit} className="font-bold text-rose-600 hover:underline">
                            Remove from plan
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {planner.decision_tree ? (
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider">Decision Tree result</h3>
                      <span className="text-xs font-bold uppercase">{planner.decision_tree.status}</span>
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {planner.decision_tree.rules.map((rule) => <li key={rule}>{rule}</li>)}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Estimated price by destination</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {Object.entries(planner.destination_totals).map(([destination, range]) => (
                      <div key={destination} className="flex justify-between border-b border-slate-100 pb-2 text-sm"><span className="font-semibold">{destination}</span><span>PHP {Number(range.min).toLocaleString()}–{Number(range.max).toLocaleString()}</span></div>
                    ))}
                  </div>
                </div>
                <div className="mt-5 space-y-4">
                  {planner.itinerary.map((day) => (
                    <article key={day.day} className="rounded-2xl bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Day</p>
                          <h2 className="mt-1 text-xl font-black">{day.day}</h2>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-sm font-bold ${weatherStyles[day.expected_weather] || weatherStyles.Cloudy}`}>
                          {day.expected_weather === "Sunny" ? "☀️ " : day.expected_weather === "Rainy" ? "🌧️ " : "⛅ "}
                          {day.expected_weather}
                        </span>
                      </div>

                      {/* Forecast & 5-Year Historical Climate Comparison */}
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Forecast & Historical Climate Comparison · {day.destination}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            Open-Meteo Priority
                          </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          {/* Live Open-Meteo Forecast */}
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase text-emerald-900">New Forecast (Open-Meteo)</span>
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                {day.weather_forecast?.source || "Open-Meteo live"}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1 text-xs text-slate-700 font-medium">
                              <p className="text-sm font-bold text-slate-900">
                                {day.expected_weather} · {day.weather_forecast?.temperature_min_c ?? 24}°C – {day.weather_forecast?.temperature_max_c ?? 31}°C
                              </p>
                              <p>Precipitation probability: {day.weather_forecast?.precipitation_probability ?? 20}%</p>
                              <p>Expected rainfall: <strong>{day.weather_forecast?.precipitation_sum_mm ?? 0} mm</strong></p>
                            </div>
                          </div>

                          {/* 5-Year Historical Weather Reference */}
                          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase text-blue-900">5-Year Historical Climate</span>
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                                {day.historical_weather?.source || "5-Year Archive"}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1 text-xs text-slate-700 font-medium">
                              <p className="text-sm font-bold text-slate-900">
                                Dominant: {day.historical_weather?.dominant_condition || "Cloudy"} · Avg {day.historical_weather?.average_temperature_c ?? 27.5}°C
                              </p>
                              <p>Historical average rainfall: <strong>{day.historical_weather?.average_rainfall_mm ?? 5} mm</strong></p>
                              <p>Archive period: Past 5 years on this calendar date</p>
                            </div>
                          </div>
                        </div>

                        {/* Comparison Analysis */}
                        {day.comparison?.summary ? (
                          <div className="mt-3 rounded-lg bg-white p-2.5 border border-slate-200 text-xs text-slate-700">
                            <p><strong>Weather Comparison Insight:</strong> {day.comparison.summary}</p>
                          </div>
                        ) : null}

                        <p className="mt-2.5 text-xs text-slate-600 italic">{day.outfit_advice}</p>
                      </div>

                      {/* Scheduled Activities */}
                      <div className="mt-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Scheduled activities (Cross-referenced with Weather)</p>
                        {day.scheduled_activities.length ? (
                          <ul className="mt-2 space-y-2">
                            {day.scheduled_activities.map((activity, activityIndex) => (
                              <li key={`${day.day}-${activity.name}-${activityIndex}`} className={`rounded-lg border px-3 py-3 text-sm ${
                                activity.hazard_flag ? "border-red-500 bg-red-50" : "border-slate-100 bg-slate-50/40"
                              }`}>
                                {activity.hazard_flag ? (
                                  <div className="mb-2 rounded-md border border-red-500 bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                                    ⚠️ SAFETY HAZARD: Outdoor activity scheduled during Rainy forecast.
                                  </div>
                                ) : null}
                                <div className="flex items-start justify-between gap-3">
                                  <span className="font-semibold">{activity.name}</span>
                                  <span className={`rounded-full px-2 py-1 text-xs font-bold uppercase ${
                                    activity.type === "outdoor" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
                                  }`}>
                                    {activity.type}
                                  </span>
                                </div>
                                <div className="mt-2 flex justify-between text-xs text-slate-500">
                                  <span>{activity.destination} • Forecast: {activity.weather || "Unavailable"}</span>
                                  <span>PHP {Number(activity.price_range.min).toLocaleString()}–{Number(activity.price_range.max).toLocaleString()}</span>
                                </div>
                                {activity.decision ? (
                                  <p className="mt-2 text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-1 rounded">
                                    ✓ {activity.decision}
                                  </p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm italic text-slate-400">No activities scheduled.</p>
                        )}
                      </div>
                    </article>
                  ))}
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
