"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const defaultDates = "2026-09-12\n2026-09-13\n2026-09-14";

const weatherStyles = {
  Sunny: "border-amber-200 bg-amber-50 text-amber-900",
  Rainy: "border-sky-200 bg-sky-50 text-sky-900",
  Cloudy: "border-slate-200 bg-slate-100 text-slate-800",
};

export default function FinalPlannerPage() {
  const [dates, setDates] = useState("2026-09-12\n2026-09-13\n2026-09-14");
  const [mlrPrice, setMlrPrice] = useState("2999");
  const [guests, setGuests] = useState(1);
  const [activities, setActivities] = useState([]);
  const [planner, setPlanner] = useState(null);
  const [savedPlanners, setSavedPlanners] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const savedTrip = window.localStorage.getItem("anoTaraTrip");
    if (!savedTrip) return;

    try {
      const trip = JSON.parse(savedTrip);
      setActivities(Array.isArray(trip.activities) ? trip.activities : []);
      setDates(Array.isArray(trip.targetDates) && trip.targetDates.length ? trip.targetDates.join("\n") : defaultDates);
      if (typeof trip.mlrPrice === "number") setMlrPrice(String(trip.mlrPrice));
      if (typeof trip.guests === "number") setGuests(trip.guests);
    } catch {
      window.localStorage.removeItem("anoTaraTrip");
    }
  }, []);

  const generatePlanner = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    const targetDates = dates
      .split(/[\n,]+/)
      .map((date) => date.trim())
      .filter(Boolean);

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
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail?.[0]?.msg || data?.detail || "Could not generate the planner.");
      }
      if (!data?.itinerary || !data?.total_estimated_price || !data?.destination_totals) {
        throw new Error("The backend returned an incomplete planner response. Restart the backend and try again.");
      }
      const newPlanner = { ...data, createdAt: new Date().toLocaleString() };
      setPlanner(newPlanner);
      setSavedPlanners((currentPlanners) => [newPlanner, ...currentPlanners]);
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
            <button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50">
              Print planner
            </button>
            <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">Decision Tree</span>
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <form onSubmit={generatePlanner} className="planner-controls rounded-2xl bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-bold">Selected trip details</h2>
            <label className="mt-6 block text-sm font-semibold text-slate-700">
              Target dates
              <textarea
                value={dates}
                onChange={(event) => setDates(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-medium outline-none focus:border-slate-900"
                placeholder="One date per line"
              />
            </label>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Clicked activities</h3>
                <Link href="/destinations" className="text-sm font-bold text-slate-700 hover:underline">Choose more</Link>
              </div>
              <p className="mt-4 text-sm text-slate-500">{guests} guest{guests === 1 ? "" : "s"} included in this trip input.</p>
              <div className="mt-3 space-y-2">
                {activities.map((activity, index) => (
                  <div key={`${activity.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                    <span className="min-w-0 truncate text-sm font-medium">{activity.name}</span>
                    <span className="shrink-0 text-xs font-bold uppercase text-slate-500">{activity.type} • {activity.destination}</span>
                  </div>
                ))}
              </div>
              {!activities.length ? <p className="mt-3 rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">Choose activities from a destination page first.</p> : null}
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
                          {day.expected_weather}
                        </span>
                      </div>
                      <div className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
                        <p><strong>Forecast for {day.day}:</strong> {day.expected_weather} in {day.destination}.</p>
                        {day.destination_forecasts?.length > 1 ? <div className="mt-2 space-y-1 text-xs text-slate-500">{day.destination_forecasts.map((destinationForecast) => <p key={destinationForecast.destination}><strong>{destinationForecast.destination}:</strong> {destinationForecast.forecast.condition}, {destinationForecast.forecast.temperature_min_c}–{destinationForecast.forecast.temperature_max_c}°C, {destinationForecast.forecast.precipitation_probability}% precipitation probability</p>)}</div> : null}
                        {day.destination_forecasts?.length <= 1 && day.weather_forecast ? <p className="mt-1 text-xs text-slate-500">{day.weather_forecast.temperature_min_c}–{day.weather_forecast.temperature_max_c}°C • {day.weather_forecast.precipitation_probability}% precipitation probability • {day.weather_forecast.precipitation_sum_mm} mm expected precipitation</p> : null}
                        {day.historical_weather ? <p className="mt-1 text-xs text-slate-500">Historical weather context: {day.historical_weather.dominant_condition} was the dominant condition over the past five years.</p> : null}
                        <p className="mt-2">{day.outfit_advice}</p>
                      </div>
                      <div className="mt-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Scheduled activities</p>
                        {day.scheduled_activities.length ? (
                          <ul className="mt-2 space-y-2">
                            {day.scheduled_activities.map((activity, activityIndex) => (
                              <li key={`${day.day}-${activity.name}-${activityIndex}`} className="rounded-lg border border-slate-100 px-3 py-3 text-sm">
                                <div className="flex items-start justify-between gap-3"><span className="font-semibold">{activity.name}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold uppercase text-slate-500">{activity.type}</span></div>
                                <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{activity.destination} • Forecast: {activity.weather || "Unavailable"}</span><span>PHP {Number(activity.price_range.min).toLocaleString()}–{Number(activity.price_range.max).toLocaleString()}</span></div>
                                {activity.decision ? <p className="mt-2 text-xs italic text-slate-500">{activity.decision}</p> : null}
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
