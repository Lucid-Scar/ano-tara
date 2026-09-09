"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ImageUploader from "../../components/ImageUploader";

const adviceByWeather = {
  Sunny: "Choose light, breathable layers, sunscreen, a hat, and comfortable walking shoes.",
  Rainy: "Bring a rain jacket or umbrella, quick-dry clothes, and waterproof shoes.",
  Cloudy: "Comfortable layers and a light jacket are the safest choice.",
};

const FALLBACK_DESTINATIONS = [
  { id: "el-nido", name: "El Nido Panaginip", hotel_type: "Resort Hotel" },
  { id: "boracay", name: "Boracay", hotel_type: "Resort Hotel" },
  { id: "cebu", name: "Cebu City", hotel_type: "City Hotel" },
  { id: "baguio", name: "Baguio City", hotel_type: "City Hotel" },
  { id: "davao", name: "Davao City", hotel_type: "City Hotel" },
  { id: "manila", name: "Manila", hotel_type: "City Hotel" },
];

/** Map CNN labels to forecast conditions they fit. Cold/cloudy also covers sunny days with wind or a cool breeze. */
function outfitExpectation(categoryOrSuitability) {
  const raw = String(categoryOrSuitability || "").toLowerCase().replace(/-/g, " ");
  if (raw.includes("rain")) {
    return { conditions: ["Rainy"], phrase: "rainy weather" };
  }
  if (raw.includes("warm") || raw.includes("hot")) {
    return { conditions: ["Sunny"], phrase: "sunny, warm weather" };
  }
  if (raw.includes("cold") || raw.includes("cool") || raw.includes("cloud")) {
    return {
      conditions: ["Cloudy", "Sunny"],
      phrase: "cool or cloudy weather, including sunny days with strong wind or a cool breeze",
    };
  }
  return { conditions: [], phrase: "this trip's weather" };
}

export default function OutfitPlannerPage() {
  const [destinations, setDestinations] = useState(FALLBACK_DESTINATIONS);
  const [destination, setDestination] = useState("");
  const [hotelType, setHotelType] = useState("Resort Hotel");
  const [date, setDate] = useState("");
  const [weather, setWeather] = useState(null);
  const [image, setImage] = useState("");
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [loadingOutfit, setLoadingOutfit] = useState(false);

  useEffect(() => {
    const trip = JSON.parse(window.localStorage.getItem("anoTaraTrip") || "{}");
    const selectedDate = trip.targetDates?.[0] || new Date().toISOString().split("T")[0];
    setDate(selectedDate);

    const savedPlace = trip.activities?.[0]?.destination || trip.destination || "";
    fetch("http://localhost:8000/destinations")
      .then((response) => response.json())
      .then((data) => {
        const list = Array.isArray(data.destinations) && data.destinations.length ? data.destinations : FALLBACK_DESTINATIONS;
        setDestinations(list);
        const match = list.find((item) => item.name === savedPlace) || list[0];
        if (match) {
          setDestination(match.name);
          setHotelType(match.hotel_type || "Resort Hotel");
        }
      })
      .catch(() => {
        setDestinations(FALLBACK_DESTINATIONS);
        const match = FALLBACK_DESTINATIONS.find((item) => item.name === savedPlace) || FALLBACK_DESTINATIONS[0];
        setDestination(match.name);
        setHotelType(match.hotel_type || "Resort Hotel");
      });
  }, []);

  const onPlaceChange = (name) => {
    setDestination(name);
    setWeather(null);
    setResult(null);
    const match = destinations.find((item) => item.name === name);
    if (match?.hotel_type) setHotelType(match.hotel_type);
  };

  const getWeather = async () => {
    if (!destination || !date) {
      setMessage("Choose a place and date first.");
      return;
    }
    setLoadingWeather(true);
    setMessage("");
    try {
      const response = await fetch("http://localhost:8000/predict-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ check_in: date, guests: 1, hotel_type: hotelType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not get the weather baseline.");
      setWeather({
        condition: data.weather.condition,
        temperature: data.weather.average_temperature,
        rainfall: data.weather.average_rainfall,
        source: data.source,
      });
    } catch (error) {
      setMessage(error.message || "Could not get weather.");
    } finally {
      setLoadingWeather(false);
    }
  };

  const analyzeOutfit = async (dataUrl) => {
    setImage(dataUrl);
    setResult(null);
    setMessage("");
    if (!destination) {
      setMessage("Choose a place before uploading an outfit.");
      return;
    }
    if (!weather) {
      setMessage("Choose a date and check its predicted weather before uploading an outfit.");
      return;
    }
    setLoadingOutfit(true);
    try {
      const response = await fetch("http://localhost:8000/predict-outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: dataUrl }),
      });
      const data = await response.json();
      if (!response.ok || data.status === "error") throw new Error(data.message || "Outfit prediction failed.");
      const expectation = outfitExpectation(data.detected_category || data.weather_suitability);
      const matches = expectation.conditions.includes(weather.condition);
      setResult({
        ...data,
        matches,
        outfitPhrase: expectation.phrase,
        advice: adviceByWeather[weather.condition],
      });
    } catch (error) {
      setMessage(error.message || "Could not analyze outfit.");
    } finally {
      setLoadingOutfit(false);
    }
  };

  const addToPlanner = () => {
    if (!result || !weather) return;
    const trip = JSON.parse(window.localStorage.getItem("anoTaraTrip") || "{}");
    window.localStorage.setItem(
      "anoTaraTrip",
      JSON.stringify({
        ...trip,
        destination,
        targetDates: [date],
        outfit: {
          destination,
          date,
          weather: weather.condition,
          category: result.detected_category,
          confidence: result.confidence_score,
          matches: result.matches,
          advice: result.advice,
        },
      }),
    );
    window.location.href = "/final-planner";
  };

  return (
    <main className="min-h-screen bg-[#f5f7fa] px-4 py-5 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <Link href="/" className="text-sm font-semibold text-slate-500 hover:text-slate-900">
              Back to home
            </Link>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Outfit Planner</h1>
            <p className="mt-2 text-slate-600">Pick a place and date, then see if your outfit matches the weather.</p>
          </div>
          <Link href="/final-planner" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50">
            Final planner
          </Link>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="space-y-8">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">1. Where do you plan to go?</h2>
              <select
                value={destination}
                onChange={(event) => onPlaceChange(event.target.value)}
                className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-medium"
              >
                {!destination ? <option value="">Select a destination</option> : null}
                {destinations.map((item) => (
                  <option key={item.id || item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">2. Which date do you plan to go?</h2>
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setWeather(null);
                  setResult(null);
                }}
                className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-3 font-medium"
              />
              <button
                onClick={getWeather}
                disabled={!destination || !date || loadingWeather}
                className="mt-4 w-full rounded-xl bg-[#b9f0c8] px-4 py-3 font-bold disabled:opacity-60"
              >
                {loadingWeather ? "Checking weather..." : "Check predicted weather"}
              </button>
              {weather ? (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-bold">
                    {destination}: {weather.condition}
                  </p>
                  <p className="mt-1 text-sm">
                    {weather.temperature}°C average · {weather.rainfall} mm rain
                  </p>
                  <p className="mt-2 text-sm">{adviceByWeather[weather.condition]}</p>
                </div>
              ) : null}
            </section>
          </div>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">3. Upload your outfit to know if it is the perfect match</h2>
            <div className="mt-5">
              <ImageUploader onSelect={analyzeOutfit} label="Upload outfit" />
            </div>
            {image ? <img src={image} alt="Outfit preview" className="mt-5 h-56 w-full rounded-xl object-contain bg-slate-50" /> : null}
            {loadingOutfit ? <p className="mt-4 text-sm text-slate-500">CNN is analyzing your outfit...</p> : null}
            {result ? (
              <div className={`mt-5 rounded-xl p-4 ${result.matches ? "bg-emerald-50 text-emerald-950" : "bg-amber-50 text-amber-950"}`}>
                <p className="font-bold">
                  {result.matches ? `Your outfit is a match for ${destination}.` : `Your outfit would not be a match for ${destination}.`}
                </p>
                <p className="mt-2 text-sm">
                  The destination is expected to be {weather.condition.toLowerCase()}, while your outfit is suited for {result.outfitPhrase}.
                </p>
                <p className="mt-2 text-sm">{result.advice}</p>
                <button onClick={addToPlanner} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
                  Add this to final planner
                </button>
              </div>
            ) : null}
            {message ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{message}</p> : null}
          </section>
        </div>
      </div>
    </main>
  );
}
