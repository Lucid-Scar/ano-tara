"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Footer from "../footer/Footer";
import Header from "../header/Header";
import ImageUploader from "../../components/ImageUploader";
import GarmentImage from "../../components/GarmentImage";
import OutfitImageCapture from "../../components/OutfitImageCapture";
import { useTravel } from "../TravelContext";
import { clampToSelectableDate, getMinSelectableDate, toDateString } from "../tripUtils";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const adviceByWeather = {
  "Clear / Sunny": "Choose light, breathable layers, sunscreen, a hat, and comfortable walking shoes.",
  "Fair / Partly Cloudy": "Wear comfortable layers and walking shoes, and bring a light jacket.",
  "Light Rain / Drizzle": "Bring quick-dry layers, waterproof shoes, and an umbrella or rain jacket.",
  "Heavy Rain / Rainy": "Wear waterproof layers, sturdy boots, and carry a heavy-duty umbrella.",
  "Windy / Stormy": "Stay indoors if possible; wear warm, windproof layers if you must go out.",
  "Extreme Heat / Danger": "Wear ultra-light, breathable clothing, stay hydrated, and avoid prolonged sun exposure.",
};

const formatDate = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "Select a date";

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

function OutfitPlannerContent() {
  const searchParams = useSearchParams();
  const fromPlanner = searchParams.get("from") === "planner";
  const { outfits, setOutfits, savedItineraries, dateRange, currentActivities } = useTravel();

  const [destinations, setDestinations] = useState([]);
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [plannerDates, setPlannerDates] = useState([]);
  const [weather, setWeather] = useState(null);
  const [image, setImage] = useState("");
  const [result, setResult] = useState(null);
  const [source, setSource] = useState(fromPlanner ? "current" : "saved");
  const [message, setMessage] = useState("");
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [loadingOutfit, setLoadingOutfit] = useState(false);
  const [captureSource, setCaptureSource] = useState("");
  const [captureMode, setCaptureMode] = useState("");
  const [outfitSets, setOutfitSets] = useState([{ id: "outfit-set-1", name: "Outfit 1" }]);
  const [activeOutfitSetId, setActiveOutfitSetId] = useState("outfit-set-1");
  const [selectedPlannerId, setSelectedPlannerId] = useState("");

  const currentPlannerDates = useMemo(
    () => generateDateRange(dateRange.startDate, dateRange.endDate),
    [dateRange.endDate, dateRange.startDate],
  );
  const currentPlannerDestination = useMemo(
    () => currentActivities[0]?.destination || "",
    [currentActivities],
  );
  const hasCurrentPlanner = Boolean(
    currentPlannerDates.length || currentActivities.length || (dateRange.startDate && dateRange.endDate),
  );

  const selectedSavedPlanner = savedItineraries.find((planner) => planner.createdAt === selectedPlannerId) || savedItineraries[0];

  const readFromItinerary = (planner = selectedSavedPlanner) => {
    const dates = planner?.itinerary?.map((day) => day.date || day.day).filter(Boolean) || [];
    const firstDay = planner?.itinerary?.[0];
    const savedDestination =
      firstDay?.scheduled_activities?.[0]?.destination || firstDay?.destination || "";

    return { dates, destination: savedDestination };
  };

  const locationsForDate = (planner, selectedDate) => {
    const day = planner?.itinerary?.find((item) => (item.date || item.day) === selectedDate);
    const locations = (day?.scheduled_activities || [])
      .map((activity) => activity.destination || activity.location)
      .filter(Boolean);

    if (!locations.length && day?.destination) locations.push(day.destination);
    return [...new Set(locations)];
  };

  const locationsForCurrentDate = (selectedDate, dates = plannerDates) => {
    const dayIndex = dates.indexOf(selectedDate);
    if (dayIndex < 0) return [];

    const dayLabel = `Day ${dayIndex + 1}`;
    return [...new Set(
      currentActivities
        .filter((activity) => (activity.assignedDay || activity.assigned_day) === dayLabel)
        .map((activity) => activity.destination || activity.location)
        .filter(Boolean),
    )];
  };

  const dayNumberForDate = (selectedDate, dates = plannerDates) => {
    if (!selectedDate) return 1;
    const index = dates.indexOf(selectedDate);
    return index >= 0 ? index + 1 : 1;
  };

  useEffect(() => {
    let active = true;

    const loadDestinations = async () => {
      try {
        const response = await fetch("/api/backend/destinations");
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.destinations)) throw new Error();

        if (active) setDestinations(data.destinations);
      } catch (error) {
        console.error("Could not load destinations from the tourism dataset.", error);
        if (active) setDestinations([]);
      }
    };

    loadDestinations();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!destination && destinations.length && !savedItineraries.length && !hasCurrentPlanner) {
      setDestination(destinations[0].name);
    }
  }, [destination, destinations, hasCurrentPlanner, savedItineraries.length]);

  useEffect(() => {
    if (!(fromPlanner && hasCurrentPlanner)) return;

    setSource("current");
    setPlannerDates(currentPlannerDates);
    const firstDate = currentPlannerDates[0] || clampToSelectableDate(getMinSelectableDate());
    setDate(firstDate);

    const firstDayLocations = locationsForCurrentDate(firstDate, currentPlannerDates);
    if (firstDayLocations[0] || currentPlannerDestination) {
      setDestination(firstDayLocations[0] || currentPlannerDestination);
    }

    setWeather(null);
    setResult(null);
    setMessage("Current planner dates loaded from your itinerary workspace.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromPlanner, hasCurrentPlanner]);

  useEffect(() => {
    if (source === "current" || source === "new") return;
    if (savedItineraries.some((planner) => planner.createdAt === selectedPlannerId)) return;

    const planner = savedItineraries[0];
    setSelectedPlannerId(planner?.createdAt || "");

    if (source !== "saved") return;

    const saved = readFromItinerary(planner);
    setPlannerDates(saved.dates);
    setDate(saved.dates[0] || clampToSelectableDate(getMinSelectableDate()));
    if (saved.destination) setDestination(saved.destination);
    setWeather(null);
    setResult(null);
  }, [savedItineraries, selectedPlannerId, source]);

  const destinationNames = destinations.map((item) => item.name);
  const destinationByKey = new Map(destinationNames.map((name) => [name.trim().toLowerCase(), name]));
  const canonicalizeLocations = (locations) => [
    ...new Set(
      locations
        .map((location) => destinationByKey.get(String(location).trim().toLowerCase()))
        .filter(Boolean),
    ),
  ];

  const selectedPlannerLocations =
    source === "saved" ? canonicalizeLocations(locationsForDate(selectedSavedPlanner, date)) : [];
  const savedPlannerLocations =
    source === "saved"
      ? canonicalizeLocations(
          [
            ...new Set(
              (selectedSavedPlanner?.itinerary || []).flatMap((day) =>
                locationsForDate(selectedSavedPlanner, day.date || day.day),
              ),
            ),
          ],
        )
      : [];
  const currentDateLocations = source === "current" ? canonicalizeLocations(locationsForCurrentDate(date)) : [];
  const currentLocations =
    source === "current"
      ? canonicalizeLocations(currentActivities.map((activity) => activity.destination || activity.location).filter(Boolean))
      : [];

  const locationOptions =
    source === "current" && currentDateLocations.length
      ? currentDateLocations
      : source === "current" && currentLocations.length
        ? currentLocations
        : source === "saved" && selectedPlannerLocations.length
          ? selectedPlannerLocations
          : source === "saved" && savedPlannerLocations.length
            ? savedPlannerLocations
            : destinations.map((item) => item.name);

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
      group = {
        key,
        name: set?.name || outfit.outfitSetName || "Outfit 1",
        date: outfit.date,
        items: [],
      };
      groups.push(group);
    }

    group.items.push(outfit);
    return groups;
  }, []);

  const createOutfitSet = () => {
    const next = {
      id: `outfit-set-${Date.now()}`,
      name: `Outfit ${outfitSets.length + 1}`,
    };

    setOutfitSets((current) => [...current, next]);
    setActiveOutfitSetId(next.id);
  };

  const removeActiveOutfitSet = () => {
    if (availableOutfitSets.length <= 1) return;

    const remaining = availableOutfitSets.filter((set) => set.id !== activeOutfitSetId);
    const fallback = remaining[0];

    setOutfitSets(remaining);
    setOutfits((current) =>
      current.map((outfit) =>
        (outfit.outfitSetId || "outfit-set-1") === activeOutfitSetId
          ? { ...outfit, outfitSetId: fallback.id, outfitSetName: fallback.name }
          : outfit,
      ),
    );
    setActiveOutfitSetId(fallback.id);
  };

  const useSavedPlanner = () => {
    const saved = readFromItinerary(selectedSavedPlanner);
    setSource("saved");
    setPlannerDates(saved.dates);
    setDate(saved.dates[0] || clampToSelectableDate(getMinSelectableDate()));
    setDestination(saved.destination || destination);
    setWeather(null);
    setResult(null);
    setMessage(
      saved.dates.length
        ? "Saved planner dates and destination loaded."
        : "No saved planners were found. Generate a planner first.",
    );
  };

  const useCurrentPlanner = () => {
    setSource("current");
    setPlannerDates(currentPlannerDates);
    setDate(currentPlannerDates[0] || clampToSelectableDate(getMinSelectableDate()));
    setDestination(
      locationsForCurrentDate(currentPlannerDates[0], currentPlannerDates)[0] ||
        currentPlannerDestination ||
        destinations[0]?.name ||
        destination,
    );
    setWeather(null);
    setResult(null);
    setMessage(
      currentPlannerDates.length
        ? "Current planner dates loaded."
        : "No current trip dates found. Set dates in the itinerary planner first.",
    );
  };

  const useNewLocation = () => {
    const nextDate = clampToSelectableDate(getMinSelectableDate());
    setSource("new");
    setPlannerDates([nextDate]);
    setDate(nextDate);
    setDestination(destinations[0]?.name || "");
    setWeather(null);
    setResult(null);
    setResult(null);
    setImage("");
    setMessage("");
  };

  const getWeather = async () => {
    if (!destination || !date) {
      setMessage("Choose a place and date first.");
      return;
    }

    setLoadingWeather(true);
    setMessage("");

    try {
      const match = destinations.find((item) => item.name === destination);
      const id = match?.id || destination.toLowerCase().replace(/\s+/g, "-");
      const response = await fetch(`/api/backend/destinations/${id}/forecast?date_str=${date}`);
      const data = await response.json();

      if (!response.ok || !data.forecast) throw new Error();

      setWeather({
        condition: data.forecast.condition,
        temperature: data.forecast.average_temperature,
        rainfall: data.forecast.precipitation_sum_mm,
        source: data.forecast.source || "Weather service",
      });
    } catch (error) {
      setWeather(null);
    setResult(null);
      setMessage(error.message || "Weather forecast is unavailable. Please try again.");
    } finally {
      setLoadingWeather(false);
    }
  };

  const analyzeOutfit = async (dataUrl) => {
    if (dataUrl.length * 0.75 > MAX_IMAGE_BYTES) {
      setMessage("Please choose an image smaller than 20MB.");
      return;
    }

    setImage(dataUrl);
    setResult(null);
    setMessage("");

    if (!destination || !weather) {
      setMessage("Choose a place, date, and predicted weather before uploading an outfit.");
      return;
    }

    setLoadingOutfit(true);

    try {
      const response = await fetch("/api/backend/predict-outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: dataUrl }),
      });
      const data = await response.json();

      if (!response.ok || data.status === "error") {
        throw new Error(data.message || "Outfit prediction failed.");
      }

      const parsedItems = data.items.map((item) => ({
        ...item,
        matches: Array.isArray(item.conditions) && item.conditions.includes(weather.condition),
        outfitPhrase: item.weather_suitability,
        advice: `${adviceByWeather[weather.condition]} ${item.weather_suitability}.`,
        image: item.cropped_image,
      }));

      setResult(parsedItems);
    } catch (error) {
      setMessage(error.message || "Could not analyze outfit.");
    } finally {
      setLoadingOutfit(false);
    }
  };

  const acceptOutfit = (index) => {
    if (!result || !result[index]) return;

    const item = result[index];
    const outfitSet =
      availableOutfitSets.find((set) => set.id === activeOutfitSetId) || availableOutfitSets[0];
    const resolvedDates = plannerDates.length ? plannerDates : [date];

    setOutfits((current) => [
      ...current,
      {
        id: `outfit-${Date.now()}-${index}`,
        image: item.image,
        category: item.category,
        destination,
        weather: weather.condition,
        matches: item.matches,
        outfitPhrase: item.outfitPhrase,
        advice: item.advice,
        date,
        day: `Day ${dayNumberForDate(date, resolvedDates)}`,
        outfitSetId: outfitSet?.id || "outfit-set-1",
        outfitSetName: outfitSet?.name || "Outfit 1",
      },
    ]);

    const updatedResults = result.filter((_, itemIndex) => itemIndex !== index);
    setResult(updatedResults.length ? updatedResults : null);
    if (!updatedResults.length) setImage("");

    setMessage(`${item.category} added to the outfit.`);
  };

  const updateOutfit = (id, changes) =>
    setOutfits((current) => current.map((outfit) => (outfit.id === id ? { ...outfit, ...changes } : outfit)));

  const deleteOutfit = (id) =>
    setOutfits((current) => current.filter((outfit) => outfit.id !== id));

  const dayOptions = plannerDates.length
    ? plannerDates
    : date
      ? [date]
      : [clampToSelectableDate(getMinSelectableDate())];

  const sourceButtonClass = (value) =>
    `rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${
      source === value
        ? "bg-slate-900 text-white hover:bg-slate-800"
        : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
    }`;

  return (
    <main className="wardrobe-workspace flex min-h-screen flex-col bg-[#f7f8fa] text-slate-900">
      <Header />

      <div className="mx-auto w-full max-w-7xl flex-grow px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Your travel wardrobe</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Wardrobe workspace</h1>
            <p className="mt-2 text-sm text-slate-500">Match your clothes to the forecast. Build an outfit for each day.</p>
          </div>

          <Link
            href="/final-planner"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-transparent px-4 py-2.5 text-xs font-semibold text-slate-800 transition hover:border-slate-600 hover:bg-white"
          >
            Review Itinerary Planner <ChevronRight aria-hidden="true" className="ml-2 h-4 w-4 shrink-0" />
          </Link>
        </div>

        <div className="grid gap-0 overflow-hidden rounded-lg border border-slate-200 bg-white md:grid-cols-2 md:items-start">
          <section className="wardrobe-context min-w-0 p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">01 / Trip details</p>
            <h2 className="mt-2 text-xl font-bold">Plan your outfit</h2>

            <div className={`mt-5 grid gap-2 ${fromPlanner || hasCurrentPlanner ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
              <button type="button" onClick={useSavedPlanner} aria-pressed={source === "saved"} className={sourceButtonClass("saved")}>
                Saved trip
              </button>
              {(fromPlanner || hasCurrentPlanner) ? (
                <button type="button" onClick={useCurrentPlanner} aria-pressed={source === "current"} className={sourceButtonClass("current")}>
                  Current plan
                </button>
              ) : null}
              <button type="button" onClick={useNewLocation} aria-pressed={source === "new"} className={sourceButtonClass("new")}>
                New destination
              </button>
            </div>

            {source === "saved" && !savedItineraries.length && (
              <p className="mt-4 border-l-2 border-slate-400 pl-3 text-xs leading-relaxed text-slate-600">No archived trips yet. Choose a current plan or a new destination to get started.</p>
            )}
            {source === "saved" && savedItineraries.length ? (
              <label className="mt-4 flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Archived itinerary
                <select
                  value={selectedSavedPlanner?.createdAt || ""}
                  onChange={(event) => {
                    const planner = savedItineraries.find((item) => item.createdAt === event.target.value);
                    setSelectedPlannerId(event.target.value);
                    const saved = readFromItinerary(planner);
                    setPlannerDates(saved.dates);
                    setDate(saved.dates[0] || clampToSelectableDate(getMinSelectableDate()));
                    setDestination(saved.destination);
                    setWeather(null);
    setResult(null);
                  }}
                  className="w-full min-w-0 rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
                >
                  {savedItineraries.map((planner) => (
                    <option key={planner.createdAt} value={planner.createdAt}>
                      {planner.name || "Saved itinerary"} · {planner.itinerary?.length || 0} days
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Location
                <select
                  value={destination}
                  onChange={(event) => {
                    setDestination(event.target.value);
                    setWeather(null);
    setResult(null);
                  }}
                  className="w-full min-w-0 rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
                >
                  {locationOptions.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Travel date
                {(source === "saved" || source === "current") && plannerDates.length ? (
                  <select
                    value={date}
                    onChange={(event) => {
                      const nextDate = event.target.value;
                      setDate(nextDate);
                      if (source === "saved") {
                        setDestination(locationsForDate(selectedSavedPlanner, nextDate)[0] || destination);
                      }
                      if (source === "current") {
                        setDestination(locationsForCurrentDate(nextDate)[0] || currentPlannerDestination || destination);
                      }
                      setWeather(null);
    setResult(null);
                    }}
                    className="w-full min-w-0 rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
                  >
                    {plannerDates.map((plannerDate, index) => (
                      <option key={plannerDate} value={plannerDate}>
                        Day {index + 1} · {formatDate(plannerDate)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="date"
                    min={getMinSelectableDate()}
                    value={date}
                    onChange={(event) => {
                      const nextDate = event.target.value;
                      setDate(nextDate);
                      setPlannerDates([nextDate]);
                      setWeather(null);
    setResult(null);
                    }}
                    className="w-full min-w-0 rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
                  />
                )}
              </label>
            </div>

            <button
              type="button"
              onClick={getWeather}
              disabled={loadingWeather}
              className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-3 text-xs font-black tracking-wide text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 "
            >
              {loadingWeather ? "Checking forecast..." : "Check forecast"}
            </button>

            {weather ? (
              <div className="mt-4 rounded-lg border border-slate-300 bg-transparent p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-black text-slate-900">{destination} forecast</span>
                  <span className="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white">
                    {weather.condition}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-slate-800">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Average temp</span>
                    <span className="text-lg font-black">{weather.temperature}°C</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Rainfall</span>
                    <span className="text-lg font-black">{weather.rainfall} mm</span>
                  </div>
                </div>

                <p className="mt-4 border-t border-slate-300 pt-3 text-[10px] font-semibold leading-relaxed text-slate-600">
                  Garment recommendations will be matched against these {weather.condition.toLowerCase()} conditions for Day {dayNumberForDate(date, dayOptions)}.
                </p>
              </div>
            ) : null}
          </section>

          <section className="wardrobe-capture min-w-0 border-t border-slate-200 p-4 sm:p-5 md:border-l md:border-t-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">02 / Add a garment</p>
            <h2 className="mt-2 text-xl font-bold">Your garment studio</h2>
            <p className="mt-2 text-sm text-slate-600">Upload a clear photo or use your camera. Images up to 20 MB.</p>

            <div className="mt-5 flex flex-wrap gap-3">
              <ImageUploader
                maxBytes={MAX_IMAGE_BYTES}
                onError={setMessage}
                onSelect={(dataUrl) => {
                  setResult(null);
                  setCaptureSource(dataUrl);
                  setCaptureMode("image");
                  setImage(dataUrl);
                }}
                label="Upload photo"
                className="wardrobe-upload"
              />
              <button
                type="button"
                onClick={() => {
                  setCaptureSource("");
                  setCaptureMode("camera");
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100"
              >
                Use camera
              </button>
            </div>

            {!image && (
              <div className="mt-5 flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center">
                <svg aria-hidden="true" className="mb-3 h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.2"><path strokeLinejoin="round" d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c0 3-8 3-8 0Z" /></svg>
                <p className="text-sm font-semibold text-slate-800">A place for your next outfit</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">Photograph one garment against a plain background for a clearer result.</p>
              </div>
            )}
            {image ? (
              <div className="mt-4">
                <GarmentImage
                  src={image}
                  alt="Garment preview"
                  imageClassName="object-contain"
                  className="h-44 w-full rounded-lg border border-slate-200 bg-slate-100"
                />
                {!result && (
                <button
                  type="button"
                  onClick={() => analyzeOutfit(image)}
                  disabled={!destination || !weather || loadingOutfit || loadingWeather}
                  className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-3 text-xs font-black tracking-wide text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 "
                >
                  {loadingOutfit ? "Scanning garment..." : "Check weather compatibility"}
                </button>
                )}
                {!weather && <p className="mt-2 text-xs text-slate-500">Check the forecast in Trip details to analyze this garment.</p>}
              </div>
            ) : null}

            {message ? (
              <div role="status" aria-live="polite" className="mt-4 flex items-start gap-2 border-l-2 border-slate-700 py-2 pl-3">
                <svg className="h-5 w-5 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold text-slate-800">{message}</p>
              </div>
            ) : null}
          </section>
        </div>

            {result && weather && Array.isArray(result) ? (
              <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">03 / Analysis results</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">{result.length ? `${result.length} garments detected` : "No garments detected"}</h2>
                {!result.length && <p className="mt-2 text-sm text-slate-600">Try a clearer photo of one garment against a plain background.</p>}
                {result.length > 0 && (
            <div className="mt-5 border-t border-slate-200 pt-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Assign to outfit set
                  <select
                    value={activeOutfitSetId}
                    onChange={(event) => setActiveOutfitSetId(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  >
                    {availableOutfitSets.map((set) => (
                      <option key={set.id} value={set.id}>
                        {set.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={createOutfitSet}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 "
                  >
                    + New set
                  </button>
                  {availableOutfitSets.length > 1 && <button
                    type="button"
                    onClick={removeActiveOutfitSet}
                    disabled={availableOutfitSets.length <= 1}
                    title="Remove set"
                    className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 "
                  >
                    Remove set
                  </button>}
                </div>
              </div>
            </div>

                )}


                <div className="mt-4 grid items-start gap-3 md:grid-cols-2">
                {result.map((item, index) => (
                  <div key={index} className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-white ">
                    <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50 p-4">
                      <GarmentImage
                        src={item.image}
                        alt="Detected garment"
                        className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1"
                      />
                      <div>
                        <h4 className="text-lg font-black capitalize text-slate-900">{item.category}</h4>
                        <div className="mt-1">
                          {item.matches ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-800">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Weather match
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-transparent border border-slate-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-800">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Adjustments needed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="mb-4 text-xs font-semibold leading-relaxed text-slate-600">
                        Based on the {weather.condition.toLowerCase()} skies and {weather.temperature}°C {weather.temperature > 28 ? "heat" : weather.temperature < 24 ? "chill" : "breeze"} in {destination}, {item.matches ? "this is a solid choice." : "this might not be the most comfortable option."}
                      </p>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Styling advice</p>
                        <p className="text-xs font-medium leading-relaxed text-slate-700">{item.advice}</p>
                      </div>
                      <div className="mt-5 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => acceptOutfit(index)}
                          className="rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 "
                        >
                          Save to wardrobe
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setImage("");
                  }}
                  className="mt-3 text-xs font-semibold text-slate-600 underline underline-offset-4 hover:text-slate-900"
                >
                  Clear & try another
                </button>
              </section>
            ) : null}


        {outfits.length > 0 && (
          <section className="mt-6 border-t border-slate-300 pt-6">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">Wardrobe collections</h2>
                </div>
                <p className="text-sm text-slate-600">{outfits.length} garments across {groupedOutfits.length} collections. Assign an outfit and travel day below.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groupedOutfits.map((group) => (
                <article key={group.key} className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white ">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-transparent px-4 py-3">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">{group.name}</h3>
                    <span className="rounded bg-slate-200/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      Day {dayNumberForDate(group.date, dayOptions)}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-4 p-4">
                    {group.items.map((outfit) => {
                      const setId = outfit.outfitSetId || "outfit-set-1";
                      const outfitDate = dayOptions.includes(outfit.date) ? outfit.date : dayOptions[0];

                      return (
                        <div key={outfit.id} className="group relative flex min-w-0 gap-3 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                            <GarmentImage
                              src={outfit.image}
                              alt={`${outfit.category} garment`}
                              className="h-full w-full object-contain p-1"
                            />
                          </div>

                          <div className="flex min-w-0 flex-1 flex-col">
                            <div className="mb-1 flex items-start justify-between gap-2 pr-6">
                              <h4 className="truncate text-sm font-black capitalize text-slate-900">{outfit.category}</h4>
                              {outfit.matches ? (
                                <span title="Matches weather" className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-800">✓</span>
                              ) : (
                                <span title="Review weather match" className="flex h-5 w-5 items-center justify-center rounded-full bg-transparent border border-slate-400 text-[10px] font-bold text-slate-700">!</span>
                              )}
                            </div>

                            <p className="mb-2 truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              {outfit.destination}
                            </p>

                            <div className="mt-auto grid grid-cols-2 gap-2">
                              <select
                                aria-label={`Group ${outfit.category} into an outfit`}
                                value={setId}
                                onChange={(event) => {
                                  const nextSet = availableOutfitSets.find((item) => item.id === event.target.value);
                                  updateOutfit(outfit.id, {
                                    outfitSetId: nextSet.id,
                                    outfitSetName: nextSet.name,
                                  });
                                }}
                                className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-slate-400"
                              >
                                {availableOutfitSets.map((set) => (
                                  <option key={set.id} value={set.id}>
                                    {set.name}
                                  </option>
                                ))}
                              </select>

                              <select
                                aria-label={`Assign ${outfit.category} to a day`}
                                value={outfitDate}
                                onChange={(event) => {
                                  const nextDate = event.target.value;
                                  updateOutfit(outfit.id, {
                                    date: nextDate,
                                    day: `Day ${dayNumberForDate(nextDate, dayOptions)}`,
                                  });
                                }}
                                className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-slate-400"
                              >
                                {dayOptions.map((day, index) => (
                                  <option key={day} value={day}>
                                    Day {index + 1}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => deleteOutfit(outfit.id)}
                            className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700"
                            aria-label={`Remove ${outfit.category}`}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="mt-auto w-full">
        <Footer />
      </div>

      {captureMode ? (
        <OutfitImageCapture
          source={captureSource}
          mode={captureMode}
          onCancel={() => setCaptureMode("")}
          onSelect={(croppedImage) => {
            setCaptureMode("");
            setImage(croppedImage);
            setResult(null);
          }}
        />
      ) : null}
    </main>
  );
}

export default function OutfitPlannerClient() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#FFFDFB] text-sm font-bold text-slate-600">
          Loading Wardrobe Module...
        </main>
      }
    >
      <OutfitPlannerContent />
    </Suspense>
  );
}
