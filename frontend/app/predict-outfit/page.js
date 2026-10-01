"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Footer from "../footer/Footer";
import Header from "../header/Header";
import ImageUploader from "../../components/ImageUploader";
import OutfitImageCapture from "../../components/OutfitImageCapture";
import { clampToSelectableDate, getMinSelectableDate } from "../tripUtils";

const adviceByWeather = { Sunny: "Choose light, breathable layers, sunscreen, a hat, and comfortable walking shoes.", Rainy: "Bring a rain jacket or umbrella, quick-dry clothes, and waterproof shoes.", Cloudy: "Comfortable layers and a light jacket are the safest choice." };
const categories = ["Top", "Bottom", "Dress", "Shoes", "Outerwear", "Accessory"];
const getExpectation = (value) => {
  const raw = String(value || "").toLowerCase().replace(/_/g, " ");
  if (["t shirt", "shirt", "dress", "sandal"].some((item) => raw.includes(item))) return { conditions: ["Sunny"], phrase: "sunny, warm weather" };
  if (["trouser", "pullover", "coat", "boot"].some((item) => raw.includes(item))) return { conditions: ["Cloudy", "Rainy"], phrase: "cool, cloudy, or rainy weather" };
  return { conditions: ["Cloudy"], phrase: "this trip's weather" };
};

export default function OutfitPlannerPage() {
  const [destinations, setDestinations] = useState([]); const [destination, setDestination] = useState(""); const [date, setDate] = useState(""); const [weather, setWeather] = useState(null); const [image, setImage] = useState(""); const [result, setResult] = useState(null); const [outfits, setOutfits] = useState([]); const [source, setSource] = useState("saved"); const [message, setMessage] = useState(""); const [loadingWeather, setLoadingWeather] = useState(false); const [loadingOutfit, setLoadingOutfit] = useState(false); const [captureSource, setCaptureSource] = useState(""); const [captureMode, setCaptureMode] = useState("");

  useEffect(() => {
    let trip = {};
    try { trip = JSON.parse(window.localStorage.getItem("anoTaraTrip") || "{}"); } catch { window.localStorage.removeItem("anoTaraTrip"); }
    setOutfits(Array.isArray(trip.outfits) ? trip.outfits : trip.outfit ? [{ ...trip.outfit, id: `${Date.now()}`, category: trip.outfit.category || "Top", day: "Day 1" }] : []);
    setDate(clampToSelectableDate(trip.targetDates?.[0] || getMinSelectableDate()));
    const savedPlace = trip.activities?.[0]?.destination || trip.destination || "";
    let active = true;
    const loadDestinations = async () => {
      let list;
      try { const response = await fetch("http://localhost:8000/destinations"); const data = await response.json(); if (!response.ok || !Array.isArray(data.destinations)) throw new Error(); list = data.destinations; } catch { const { MOCK_DESTINATIONS } = await import("../destinations/mockDestinations"); list = MOCK_DESTINATIONS; }
      if (!active) return; setDestinations(list); setDestination(list.find((item) => item.name === savedPlace)?.name || list[0]?.name || "");
    };
    loadDestinations(); return () => { active = false; };
  }, []);

  const persistOutfits = (next) => { setOutfits(next); const trip = JSON.parse(window.localStorage.getItem("anoTaraTrip") || "{}"); window.localStorage.setItem("anoTaraTrip", JSON.stringify({ ...trip, outfits: next, outfit: next[0] || null })); };
  const onPlaceChange = (name) => { setDestination(name); setWeather(null); setResult(null); };
  const getWeather = async () => {
    if (!destination || !date) { setMessage("Choose a place and date first."); return; }
    setLoadingWeather(true); setMessage("");
    try { const match = destinations.find((item) => item.name === destination); const id = match?.id || destination.toLowerCase().replace(/\s+/g, "-"); const response = await fetch(`http://localhost:8000/destinations/${id}/forecast?date_str=${date}`); const data = await response.json(); if (!response.ok || !data.forecast) throw new Error(); setWeather({ condition: data.forecast.condition, temperature: data.forecast.average_temperature, rainfall: data.forecast.precipitation_sum_mm }); } catch { setWeather({ condition: "Cloudy", temperature: 27, rainfall: 0 }); setMessage("Live weather was unavailable, so a neutral forecast was used."); } finally { setLoadingWeather(false); }
  };
  const analyzeOutfit = async (dataUrl) => {
    setImage(dataUrl); setResult(null); setMessage(""); if (!destination || !weather) { setMessage("Choose a place, date, and predicted weather before uploading an outfit."); return; } setLoadingOutfit(true);
    try { const response = await fetch("http://localhost:8000/predict-outfit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_base64: dataUrl }) }); const data = await response.json(); if (!response.ok || data.status === "error") throw new Error(data.message || "Outfit prediction failed."); const expectation = getExpectation(data.detected_category || data.weather_suitability); setResult({ ...data, category: "Top", matches: expectation.conditions.includes(weather.condition), outfitPhrase: expectation.phrase, advice: adviceByWeather[weather.condition] }); } catch (error) { setMessage(error.message || "Could not analyze outfit."); } finally { setLoadingOutfit(false); }
  };
  const acceptOutfit = () => { if (!result || !weather) return; persistOutfits([...outfits, { id: `${Date.now()}`, destination, date, weather: weather.condition, temperature: weather.temperature, rainfall: weather.rainfall, category: result.category, detectedCategory: result.detected_category, confidence: result.confidence_score, matches: result.matches, advice: result.advice, image, day: "Day 1" }]); setResult(null); setImage(""); };
  const updateOutfit = (id, changes) => persistOutfits(outfits.map((outfit) => outfit.id === id ? { ...outfit, ...changes } : outfit));
  const visibleOutfits = outfits.filter((outfit) => !outfit.deleted);

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-slate-900">
      <Header showBackLink />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Wardrobe workspace</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">Attach outfit</h1><p className="mt-2 text-slate-600">Analyze each garment, categorize it, and assign it to a day.</p></div><Link href="/final-planner" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Open final planner</Link></div>
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-yellow-200 bg-[#fff9c7] p-6"><p className="text-xs font-black uppercase tracking-wider text-slate-600">01 / Trip source</p><h2 className="mt-2 text-2xl font-black">Where is this outfit for?</h2><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => { setSource("saved"); const trip = JSON.parse(window.localStorage.getItem("anoTaraTrip") || "{}"); setDate(clampToSelectableDate(trip.targetDates?.[0] || getMinSelectableDate())); setDestination(trip.activities?.[0]?.destination || trip.destination || destination); }} className={`rounded-lg px-3 py-2 text-sm font-bold ${source === "saved" ? "bg-slate-900 text-white" : "bg-white"}`}>Use saved planner</button><button type="button" onClick={() => setSource("new")} className={`rounded-lg px-3 py-2 text-sm font-bold ${source === "new" ? "bg-slate-900 text-white" : "bg-white"}`}>New location</button></div><label className="mt-5 block text-sm font-bold">Location<select value={destination} onChange={(event) => onPlaceChange(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3">{destinations.map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}</select></label><label className="mt-4 block text-sm font-bold">Plan date<input type="date" min={getMinSelectableDate()} value={date} onChange={(event) => { setDate(event.target.value); setWeather(null); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3" /></label><button type="button" onClick={getWeather} disabled={loadingWeather} className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-50">{loadingWeather ? "Checking weather..." : "Check predicted weather"}</button>{weather ? <div className="mt-4 rounded-lg bg-white p-4"><p className="font-bold">{destination}: {weather.condition}</p><p className="mt-1 text-sm">{weather.temperature}°C average · {weather.rainfall} mm rain</p></div> : null}</section>
            <section className="rounded-2xl border border-slate-200 bg-[#d8f1dc] p-6"><p className="text-xs font-black uppercase tracking-wider text-slate-600">02 / Capture</p><h2 className="mt-2 text-2xl font-black">Add one garment</h2><p className="mt-2 text-sm text-slate-700">Upload an image or use the camera. Review and accept it after analysis.</p><div className="mt-5 flex flex-wrap gap-3"><ImageUploader onSelect={(dataUrl) => { setCaptureSource(dataUrl); setCaptureMode("image"); }} label="Upload outfit" /><button type="button" onClick={() => { setCaptureSource(""); setCaptureMode("camera"); }} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white">Use camera</button></div>{image ? <img src={image} alt="Garment preview" className="mt-5 h-48 w-full rounded-lg bg-white object-contain" /> : null}{loadingOutfit ? <p className="mt-4 text-sm font-semibold text-slate-600">Analyzing garment...</p> : null}{result ? <div className="mt-5 rounded-lg bg-white p-4"><p className="font-bold">{result.matches ? "Weather match" : "Needs adjustment"}</p><p className="mt-2 text-sm text-slate-600">Detected: {result.detected_category || "Garment"}</p><label className="mt-4 block text-sm font-bold">Garment category<select value={result.category} onChange={(event) => setResult({ ...result, category: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">{categories.map((category) => <option key={category}>{category}</option>)}</select></label><div className="mt-4 flex gap-2"><button type="button" onClick={acceptOutfit} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Accept garment</button><button type="button" onClick={() => { setResult(null); setImage(""); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold">Reject</button></div></div> : null}{message ? <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{message}</p> : null}</section>
          </div>
          <section className="rounded-2xl border border-slate-200 bg-[#dcecf8] p-6"><p className="text-xs font-black uppercase tracking-wider text-slate-600">03 / Outfit list</p><h2 className="mt-2 text-2xl font-black">Accepted garments</h2><p className="mt-2 text-sm text-slate-700">Hover a garment to change its day or remove it.</p><div className="mt-6 space-y-3">{visibleOutfits.map((outfit) => <article key={outfit.id} className="group relative flex gap-4 rounded-xl bg-white p-4"><img src={outfit.image} alt={`${outfit.category} garment`} className="h-24 w-24 rounded-lg bg-slate-100 object-cover" /><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="font-black">{outfit.category}</h3><span className="text-xs text-slate-500">{outfit.destination}</span></div><p className="mt-1 text-sm text-slate-600">{outfit.matches ? "Matches" : "Review for weather"} · {outfit.date}</p><p className="mt-2 text-xs text-slate-500">{outfit.advice}</p></div><div className="absolute right-3 top-3 hidden gap-2 group-hover:flex"><select aria-label={`Assign ${outfit.category} to a day`} value={outfit.day || "Day 1"} onChange={(event) => updateOutfit(outfit.id, { day: event.target.value })} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-bold"><option>Day 1</option><option>Day 2</option><option>Day 3</option><option>Day 4</option><option>Day 5</option></select><button type="button" onClick={() => updateOutfit(outfit.id, { deleted: true })} className="rounded border border-rose-200 bg-white px-2 py-1 text-xs font-bold text-rose-700">Delete</button></div></article>)}{!visibleOutfits.length ? <p className="rounded-lg border border-dashed border-blue-300 bg-white p-8 text-center text-sm text-slate-600">Accepted garments will appear here.</p> : null}</div></section>
        </div>
        <div className="mt-8"><Footer /></div>
      </div>
      {captureMode ? <OutfitImageCapture source={captureSource} mode={captureMode} onCancel={() => setCaptureMode("")} onSelect={(croppedImage) => { setCaptureMode(""); analyzeOutfit(croppedImage); }} /> : null}
    </main>
  );
}