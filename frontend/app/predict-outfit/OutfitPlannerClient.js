"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Footer from "../footer/Footer";
import Header from "../header/Header";
import ImageUploader from "../../components/ImageUploader";
import GarmentImage from "../../components/GarmentImage";
import OutfitImageCapture from "../../components/OutfitImageCapture";
import { useTravel } from "../TravelContext";
import { clampToSelectableDate, getMinSelectableDate, toDateString } from "../tripUtils";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const categories = ["Top", "Bottom", "Dress", "Shoes", "Outerwear", "Accessory"];
const adviceByWeather = {
  Sunny: "Choose light, breathable layers, sunscreen, a hat, and comfortable walking shoes.",
  Rainy: "Bring a rain jacket or umbrella, quick-dry clothes, and waterproof shoes.",
  Cloudy: "Comfortable layers and a light jacket are the safest choice.",
};
const getExpectation = (value) => {
  const raw = String(value || "").toLowerCase().replace(/_/g, " ");
  if (["shirt", "dress", "sandal"].some((item) => raw.includes(item))) return { conditions: ["Sunny"], phrase: "sunny, warm weather" };
  if (["trouser", "pullover", "coat", "boot"].some((item) => raw.includes(item))) return { conditions: ["Cloudy", "Rainy"], phrase: "cool, cloudy, or rainy weather" };
  return { conditions: ["Cloudy"], phrase: "this trip's weather" };
};
const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Select a date";
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

export default function OutfitPlannerClient() {
  const { outfits, setOutfits, savedItineraries } = useTravel();
  const [destinations, setDestinations] = useState([]);
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [plannerDates, setPlannerDates] = useState([]);
  const [weather, setWeather] = useState(null);
  const [image, setImage] = useState("");
  const [result, setResult] = useState(null);
  const [source, setSource] = useState("saved");
  const [message, setMessage] = useState("");
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [loadingOutfit, setLoadingOutfit] = useState(false);
  const [captureSource, setCaptureSource] = useState("");
  const [captureMode, setCaptureMode] = useState("");
  const [outfitSets, setOutfitSets] = useState([{ id: "outfit-set-1", name: "Outfit 1" }]);
  const [activeOutfitSetId, setActiveOutfitSetId] = useState("outfit-set-1");
  const [selectedPlannerId, setSelectedPlannerId] = useState("");

  const selectedSavedPlanner = savedItineraries.find((planner) => planner.createdAt === selectedPlannerId) || savedItineraries[0];
  const readFromItinerary = (planner = selectedSavedPlanner) => {
    const dates = planner?.itinerary?.map((day) => day.date || day.day).filter(Boolean) || [];
    const firstDay = planner?.itinerary?.[0];
    const savedDestination = firstDay?.scheduled_activities?.[0]?.destination || firstDay?.destination || "";
    return { dates, destination: savedDestination };
  };

  const locationsForDate = (planner, selectedDate) => {
    const day = planner?.itinerary?.find((item) => (item.date || item.day) === selectedDate);
    const locations = (day?.scheduled_activities || []).map((activity) => activity.destination || activity.location).filter(Boolean);
    if (!locations.length && day?.destination) locations.push(day.destination);
    return [...new Set(locations)];
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      let list;
      try {
        const response = await fetch("http://localhost:8000/destinations");
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.destinations)) throw new Error();
        list = data.destinations;
      } catch {
        const { MOCK_DESTINATIONS } = await import("../destinations/mockDestinations");
        list = MOCK_DESTINATIONS;
      }
      if (!active) return;
      setDestinations(list);
    };
    load();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!destination && destinations.length && !savedItineraries.length) setDestination(destinations[0].name);
  }, [destination, destinations, savedItineraries.length]);

  useEffect(() => {
    if (savedItineraries.some((planner) => planner.createdAt === selectedPlannerId)) return;
    const planner = savedItineraries[0];
    setSelectedPlannerId(planner?.createdAt || "");
    const saved = readFromItinerary(planner);
    setPlannerDates(saved.dates);
    setDate(saved.dates[0] || clampToSelectableDate(getMinSelectableDate()));
    if (saved.destination) setDestination(saved.destination);
    setWeather(null);
  }, [savedItineraries, selectedPlannerId]);

  const selectedPlannerLocations = source === "saved" ? locationsForDate(selectedSavedPlanner, date) : [];
  const savedPlannerLocations = source === "saved" ? [...new Set((selectedSavedPlanner?.itinerary || []).flatMap((day) => locationsForDate(selectedSavedPlanner, day.date || day.day)))] : [];
  const locationOptions = source === "saved" && selectedPlannerLocations.length
    ? selectedPlannerLocations
    : source === "saved" && savedPlannerLocations.length ? savedPlannerLocations : destinations.map((item) => item.name);

  const availableOutfitSets = [...outfitSets];
  outfits.forEach((outfit) => {
    const id = outfit.outfitSetId || "outfit-set-1";
    if (!availableOutfitSets.some((set) => set.id === id)) {
      availableOutfitSets.push({ id, name: outfit.outfitSetName || "Outfit 1" });
    }
  });
  const groupedOutfits = outfits.reduce((groups, outfit) => {
    const setId = outfit.outfitSetId || "outfit-set-1";
    const set = availableOutfitSets.find((item) => item.id === setId);
    const key = `${outfit.date || "unassigned"}-${setId}`;
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, name: set?.name || outfit.outfitSetName || "Outfit 1", date: outfit.date, items: [] };
      groups.push(group);
    }
    group.items.push(outfit);
    return groups;
  }, []);

  const createOutfitSet = () => {
    const next = { id: `outfit-set-${Date.now()}`, name: `Outfit ${outfitSets.length + 1}` };
    setOutfitSets((current) => [...current, next]);
    setActiveOutfitSetId(next.id);
  };
  const removeActiveOutfitSet = () => {
    if (availableOutfitSets.length <= 1) return;
    const remaining = availableOutfitSets.filter((set) => set.id !== activeOutfitSetId);
    const fallback = remaining[0];
    setOutfitSets(remaining);
    setOutfits((current) => current.map((outfit) => (outfit.outfitSetId || "outfit-set-1") === activeOutfitSetId
      ? { ...outfit, outfitSetId: fallback.id, outfitSetName: fallback.name }
      : outfit));
    setActiveOutfitSetId(fallback.id);
  };
  const useSavedPlanner = () => {
    const saved = readFromItinerary(selectedSavedPlanner);
    setSource("saved");
    setPlannerDates(saved.dates);
    setDate(saved.dates[0] || clampToSelectableDate(getMinSelectableDate()));
    setDestination(saved.destination || destination);
    setWeather(null);
    setMessage(saved.dates.length ? "Saved planner dates and destination loaded." : "No saved planners were found. Generate a planner first.");
  };
  const getWeather = async () => {
    if (!destination || !date) { setMessage("Choose a place and date first."); return; }
    setLoadingWeather(true);
    setMessage("");
    try {
      const match = destinations.find((item) => item.name === destination);
      const id = match?.id || destination.toLowerCase().replace(/\s+/g, "-");
      const response = await fetch(`http://localhost:8000/destinations/${id}/forecast?date_str=${date}`);
      const data = await response.json();
      if (!response.ok || !data.forecast) throw new Error();
      setWeather({ condition: data.forecast.condition, temperature: data.forecast.average_temperature, rainfall: data.forecast.precipitation_sum_mm });
    } catch {
      setWeather({ condition: "Cloudy", temperature: 27, rainfall: 0 });
      setMessage("Live weather was unavailable, so a neutral forecast was used.");
    } finally { setLoadingWeather(false); }
  };
  const analyzeOutfit = async (dataUrl) => {
    if (dataUrl.length * 0.75 > MAX_IMAGE_BYTES) { setMessage("Please choose an image smaller than 20MB."); return; }
    setImage(dataUrl);
    setResult(null);
    setMessage("");
    if (!destination || !weather) { setMessage("Choose a place, date, and predicted weather before uploading an outfit."); return; }
    setLoadingOutfit(true);
    try {
      const response = await fetch("http://localhost:8000/predict-outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: dataUrl }),
      });
      const data = await response.json();
      if (!response.ok || data.status === "error") throw new Error(data.message || "Outfit prediction failed.");
      
      // FIX: Rely entirely on the backend's weather logic instead of getExpectation()
      setResult({ 
        ...data, 
        category: "Top", 
        matches: data.conditions.includes(weather.condition), 
        outfitPhrase: data.weather_suitability, 
        advice: adviceByWeather[weather.condition] 
      }); 
    } catch (error) {
      setMessage(error.message || "Could not analyze outfit.");
    } finally { setLoadingOutfit(false); }
  };
  const acceptOutfit = () => {
    if (!result || !image) return;
    const outfitSet = availableOutfitSets.find((set) => set.id === activeOutfitSetId) || availableOutfitSets[0];
    setOutfits((current) => [...current, {
      id: `outfit-${Date.now()}`,
      image,
      category: result.category,
      destination,
      weather: weather.condition,
      matches: result.matches,
      outfitPhrase: result.outfitPhrase,
      advice: result.advice,
      date,
      day: `Day ${Math.max(0, plannerDates.indexOf(date)) + 1}`,
      outfitSetId: outfitSet?.id || "outfit-set-1",
      outfitSetName: outfitSet?.name || "Outfit 1",
    }]);
    setResult(null);
    setImage("");
    setMessage("Garment added to the outfit.");
  };
  const updateOutfit = (id, changes) => setOutfits((current) => current.map((outfit) => outfit.id === id ? { ...outfit, ...changes } : outfit));
  const deleteOutfit = (id) => setOutfits((current) => current.filter((outfit) => outfit.id !== id));
  const dayOptions = plannerDates.length ? plannerDates : [date || clampToSelectableDate(getMinSelectableDate())];

  return (
    <main className="outfit-planner-shell min-h-screen bg-[#f5f7fa] text-slate-900">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Wardrobe workspace</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">Attach outfit</h1>
          </div>
          <Link href="/final-planner" className="planner-nav-link">Itinerary Planner</Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">01 / Outfit source</p>
            <h2 className="mt-2 text-2xl font-black">Where is this outfit for?</h2>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={useSavedPlanner} className={`rounded-lg px-3 py-2 text-sm font-bold ${source === "saved" ? "bg-slate-900 text-white" : "border border-slate-300"}`}>Use saved planner</button>
              <button type="button" onClick={() => { setSource("new"); setPlannerDates([]); setDate(clampToSelectableDate(getMinSelectableDate())); setDestination(destinations[0]?.name || ""); setWeather(null); setResult(null); setImage(""); setMessage(""); }} className={`rounded-lg px-3 py-2 text-sm font-bold ${source === "new" ? "bg-slate-900 text-white" : "border border-slate-300"}`}>New location</button>
            </div>
            {source === "saved" && savedItineraries.length ? <label className="mt-4 block text-sm font-bold">Saved planner
              <select value={selectedSavedPlanner?.createdAt || ""} onChange={(event) => { const planner = savedItineraries.find((item) => item.createdAt === event.target.value); setSelectedPlannerId(event.target.value); const saved = readFromItinerary(planner); setPlannerDates(saved.dates); setDate(saved.dates[0] || clampToSelectableDate(getMinSelectableDate())); setDestination(saved.destination); setWeather(null); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3">
                {savedItineraries.map((planner) => <option key={planner.createdAt} value={planner.createdAt}>{planner.name || "Saved itinerary"} · {planner.itinerary?.length || 0} days</option>)}
              </select>
            </label> : null}
            <label className="mt-5 block text-sm font-bold">Location
              <select value={destination} onChange={(event) => { setDestination(event.target.value); setWeather(null); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3">
                {locationOptions.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label className="mt-4 block text-sm font-bold">Plan date
              {source === "saved" && plannerDates.length ? <select value={date} onChange={(event) => { const nextDate = event.target.value; setDate(nextDate); setDestination(locationsForDate(selectedSavedPlanner, nextDate)[0] || destination); setWeather(null); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3">{plannerDates.map((plannerDate, index) => <option key={plannerDate} value={plannerDate}>Day {index + 1} · {formatDate(plannerDate)}</option>)}</select> : <input type="date" min={getMinSelectableDate()} value={date} onChange={(event) => { setDate(event.target.value); setWeather(null); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3" />}
            </label>
            <button type="button" onClick={getWeather} disabled={loadingWeather} className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-50">{loadingWeather ? "Checking weather..." : "Check predicted weather"}</button>
            {weather ? <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="font-bold">{destination}: {weather.condition}</p>
              <p className="mt-1 text-sm">{weather.temperature}°C average · {weather.rainfall} mm rain</p>
              <p className="mt-2 text-sm text-slate-600">Garment matching is based on {weather.condition.toLowerCase()} conditions for {formatDate(date)}.</p>
            </div> : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">02 / Capture</p>
            <h2 className="mt-2 text-2xl font-black">Add one garment</h2>
            <p className="mt-2 text-sm text-slate-600">JPG and image files up to 20MB are supported.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <ImageUploader maxBytes={MAX_IMAGE_BYTES} onError={setMessage} onSelect={(dataUrl) => { setCaptureSource(dataUrl); setCaptureMode("image"); }} label="Upload garment" />
              <button type="button" onClick={() => { setCaptureSource(""); setCaptureMode("camera"); }} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white">Use camera</button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block text-sm font-bold">Add this garment to
                <select value={activeOutfitSetId} onChange={(event) => setActiveOutfitSetId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  {availableOutfitSets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}
                </select>
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={createOutfitSet} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold">Create outfit</button>
                <button type="button" onClick={removeActiveOutfitSet} disabled={availableOutfitSets.length <= 1} title="Remove the selected outfit set and move its garments to another set" className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 disabled:cursor-not-allowed disabled:opacity-40">Remove set</button>
              </div>
            </div>
            {image ? <GarmentImage src={image} alt="Garment preview" imageClassName="object-contain" className="mt-5 h-48 w-full rounded-lg bg-slate-50" /> : null}
            {image ? <button type="button" onClick={() => analyzeOutfit(image)} disabled={!destination || !weather || loadingOutfit || loadingWeather} className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">Re-analyze garment</button> : null}
            {loadingOutfit ? <p className="mt-4 text-sm font-semibold text-slate-600">Analyzing garment...</p> : null}
            {result ? <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="font-bold">{result.matches ? "Weather match" : "Needs adjustment"}</p>
              <p className="mt-2 text-sm text-slate-600">{destination} on {formatDate(date)} is expected to be {weather.condition.toLowerCase()}. This garment is suited for {result.outfitPhrase}.</p>
              <p className="mt-2 text-sm text-slate-600">{result.advice}</p>
              <label className="mt-4 block text-sm font-bold">Garment category
                <select value={result.category} onChange={(event) => setResult({ ...result, category: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={acceptOutfit} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Accept garment</button>
                <button type="button" onClick={() => { setResult(null); setImage(""); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold">Reject</button>
              </div>
            </div> : null}
            {message ? <p className="mt-4 bg-rose-50 p-3 text-sm text-rose-700">{message}</p> : null}
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">03 / Accepted garments</p>
          <h2 className="mt-2 text-2xl font-black">Outfits by itinerary day</h2>
          <p className="mt-2 text-sm text-slate-600">Group multiple garments into one outfit, then create another outfit for the same day.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {groupedOutfits.map((group) => (
              <article key={group.key} className="border border-slate-200 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-black">{group.name}</h3>
                  <p className="text-xs text-slate-500">{formatDate(group.date)}</p>
                </div>
                <div className="mt-3 grid gap-3">
                  {group.items.map((outfit) => {
                    const setId = outfit.outfitSetId || "outfit-set-1";
                    return <div key={outfit.id} className="flex min-w-0 gap-3 border-t border-slate-100 pt-3">
                      <GarmentImage src={outfit.image} alt={`${outfit.category} garment`} className="h-20 w-20 shrink-0 rounded object-cover" />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold">{outfit.category}</h4>
                        <p className="mt-1 text-xs text-slate-500">{outfit.destination} · {outfit.weather}</p>
                        <p className="mt-1 text-xs text-slate-600">{outfit.matches ? "Matches the selected weather" : "Review for the selected weather"}</p>
                        <label className="mt-2 block text-xs font-bold">Outfit set
                          <select aria-label={`Group ${outfit.category} into an outfit`} value={setId} onChange={(event) => {
                            const nextSet = availableOutfitSets.find((item) => item.id === event.target.value);
                            updateOutfit(outfit.id, { outfitSetId: nextSet.id, outfitSetName: nextSet.name });
                          }} className="ml-2 rounded border border-slate-300 bg-white px-2 py-1">
                            {availableOutfitSets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <select aria-label={`Assign ${outfit.category} to a day`} value={outfit.date || dayOptions[0]} onChange={(event) => {
                          const nextDate = event.target.value;
                          updateOutfit(outfit.id, { date: nextDate, day: `Day ${Math.max(0, plannerDates.indexOf(nextDate)) + 1}` });
                        }} className="max-w-32 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-bold">
                          {dayOptions.map((day) => <option key={day} value={day}>Day {plannerDates.indexOf(day) + 1} · {formatDate(day)}</option>)}
                        </select>
                        <button type="button" onClick={() => deleteOutfit(outfit.id)} className="rounded border border-rose-200 px-2 py-1 text-xs font-bold text-rose-700">Delete</button>
                      </div>
                    </div>;
                  })}
                </div>
              </article>
            ))}
            {!outfits.length ? <p className="border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 md:col-span-2">Accepted garments will appear here.</p> : null}
          </div>
        </section>
        <div className="mt-8"><Footer /></div>
      </div>
      {captureMode ? <OutfitImageCapture source={captureSource} mode={captureMode} onCancel={() => setCaptureMode("")} onSelect={(croppedImage) => { setCaptureMode(""); analyzeOutfit(croppedImage); }} /> : null}
    </main>
  );
}