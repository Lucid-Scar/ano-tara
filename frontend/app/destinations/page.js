"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Footer from "../footer/Footer";

const CARDS_PER_PAGE = 24;

function ActivityDestinationCard({ item }) {
  return (
    <Link
      href={`/specific-destinations?id=${item.destinationId}&activity=${encodeURIComponent(item.activityName)}`}
      className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm border border-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
    >
      <div className="relative h-56 w-full overflow-hidden bg-slate-100">
        <img
          src={item.image}
          alt={`${item.activityName} in ${item.cityName}`}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        
        {/* Top Badge: Weather Tag */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-end gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold shadow-sm backdrop-blur-md ${
              item.weatherTag === "Sunny"
                ? "bg-amber-400/95 text-slate-900"
                : item.weatherTag === "Rainy"
                ? "bg-sky-500/95 text-white"
                : "bg-teal-600/95 text-white"
            }`}
          >
            <span>
              {item.weatherTag === "Sunny" ? "☀️" : item.weatherTag === "Rainy" ? "🌧️" : "❄️"}
            </span>
            <span>{item.weatherTag}</span>
          </span>
        </div>

        {/* Bottom City Name Badge (Swapped in place of Philippines) */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-xl bg-black/40 backdrop-blur-md px-3 py-1.5 text-white border border-white/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fdb52a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span className="text-sm font-bold tracking-tight text-white drop-shadow">
              {item.cityName}
            </span>
          </div>

          <span className="text-xs font-semibold text-white/90 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-lg">
            {item.durationHours} hrs
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <h2 className="text-lg font-black text-slate-900 leading-snug group-hover:text-[#4a8b8b] transition-colors">
            {item.activityName}
          </h2>
          
          <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        </div>

        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-[#4a8b8b] flex items-center gap-1 group-hover:underline">
            View details & price
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </span>
          <span className="text-xs font-bold text-slate-600">
            {item.hotelType === "Resort Hotel" ? "₱9,000 base" : "₱3,800 base"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function DestinationsPage() {
  const [guests, setGuests] = useState(3);
  const [destinations, setDestinations] = useState([]);
  const [tripReady, setTripReady] = useState(false);
  const [checkIn, setCheckIn] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [weatherFilter, setWeatherFilter] = useState(null); // null | 'Sunny' | 'Rainy' | 'Cold'
  const [visibleCardCount, setVisibleCardCount] = useState(CARDS_PER_PAGE);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const storedTrip = window.localStorage.getItem("anoTaraTrip");
    let stored = {};
    try {
      stored = storedTrip ? JSON.parse(storedTrip) : {};
    } catch {
      window.localStorage.removeItem("anoTaraTrip");
    }
    if (query.get("startDate")) setCheckIn(query.get("startDate"));
    else if (query.get("date")) setCheckIn(query.get("date"));
    else if (query.get("checkIn")) setCheckIn(query.get("checkIn"));
    else if (stored.targetDates?.[0]) setCheckIn(stored.targetDates[0]);
    if (query.get("endDate")) setEndDate(query.get("endDate"));
    else if (stored.endDate) setEndDate(stored.endDate);
    if (query.get("guests")) setGuests(Number(query.get("guests")) || 1);
    else if (stored.guests) setGuests(stored.guests);

    let isMounted = true;

    const loadDestinations = async () => {
      try {
        const response = await fetch("http://localhost:8000/destinations");
        const data = await response.json();
        if (!response.ok || !data.destinations?.length) throw new Error("Destination data is unavailable.");
        if (isMounted) setDestinations(data.destinations);
      } catch {
        const { MOCK_DESTINATIONS: fallbackDestinations } = await import("./mockDestinations");
        if (isMounted) setDestinations(fallbackDestinations);
      }
    };

    loadDestinations();
    setTripReady(true);

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!tripReady) return;
    const stored = JSON.parse(window.localStorage.getItem("anoTaraTrip") || "{}");
    window.localStorage.setItem("anoTaraTrip", JSON.stringify({ ...stored, startDate: checkIn, endDate: endDate || checkIn, targetDates: checkIn ? [checkIn, ...(endDate && endDate !== checkIn ? [endDate] : [])] : [], guests }));
  }, [checkIn, endDate, guests, tripReady]);

  const handleMinus = (e) => {
    e.preventDefault();
    setGuests((prev) => (prev > 1 ? prev - 1 : 1));
  };

  const handlePlus = (e) => {
    e.preventDefault();
    setGuests((prev) => prev + 1);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const displayRange = formatDate(checkIn) || "Select date";

  // Flatten destinations into 2 distinct activities (1 outdoor, 1 indoor)
  const allActivities = useMemo(() => {
    const list = [];
    destinations.forEach((dest) => {
      const acts = dest.activities || [];
      const outdoor = acts.find((a) => a.type === "outdoor") || {
        name: `${dest.name} scenic landmarks and nature park tour`,
        type: "outdoor",
        hotel_type: "Resort Hotel",
        duration_hours: 4,
      };
      const indoor = acts.find((a) => a.type === "indoor") || {
        name: `${dest.name} cultural heritage museum visit`,
        type: "indoor",
        hotel_type: "City Hotel",
        duration_hours: 3,
      };

      const isCold = /baguio|tagaytay|malaybalay|canlaon|sagada|bontoc/i.test(dest.name);

      // 1. Outdoor Activity (mapped to Resort Hotel)
      list.push({
        id: `${dest.id}-outdoor`,
        destinationId: dest.id,
        cityName: dest.name,
        country: dest.country || "Philippines",
        activityName: outdoor.name,
        activityType: "outdoor",
        hotelType: "Resort Hotel",
        weatherTag: outdoor.weather_tag || (isCold ? "Cold" : "Sunny"),
        image: dest.image,
        description: dest.description,
        durationHours: outdoor.duration_hours || 4,
      });

      // 2. Indoor Activity (mapped to City Hotel)
      list.push({
        id: `${dest.id}-indoor`,
        destinationId: dest.id,
        cityName: dest.name,
        country: dest.country || "Philippines",
        activityName: indoor.name,
        activityType: "indoor",
        hotelType: "City Hotel",
        weatherTag: indoor.weather_tag || (isCold ? "Cold" : "Rainy"),
        image: dest.image,
        description: dest.description,
        durationHours: indoor.duration_hours || 3,
      });
    });
    return list;
  }, [destinations]);

  // Filter activities based on search bar, activity type filter, and weather tag filter
  const filteredActivities = useMemo(() => {
    return allActivities.filter((item) => {
      // 1. Search filter: matches activity name OR city name
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.activityName.toLowerCase().includes(q);
        const matchesCity = item.cityName.toLowerCase().includes(q);
        if (!matchesName && !matchesCity) return false;
      }

      // 2. Weather tag filter (Sunny, Rainy, Cold)
      if (weatherFilter !== null) {
        if (item.weatherTag !== weatherFilter) return false;
      }

      return true;
    });
  }, [allActivities, searchQuery, weatherFilter]);

  const visibleActivities = filteredActivities.slice(0, visibleCardCount);

  useEffect(() => {
    setVisibleCardCount(CARDS_PER_PAGE);
  }, [searchQuery, weatherFilter]);

  const toggleWeather = (weather) => {
    setWeatherFilter((prev) => (prev === weather ? null : weather));
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setWeatherFilter(null);
  };

  const isAnyFilterActive = searchQuery.trim() !== "" || weatherFilter !== null;

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfcfd] text-slate-900">
      
      {/* HEADER WITH DYNAMIC DATE RANGE */}
      <header className="sticky top-0 z-50 flex h-20 items-center justify-between bg-white px-6 lg:px-12 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border-b border-gray-100">
        <div className="flex flex-1 items-center">
          <Link href="/">
            <img src="/ano_tara_logo.svg" alt="Ano Tara Logo" className="h-10 w-auto object-contain cursor-pointer" />
          </Link>
        </div>

        <div className="hidden lg:flex items-center justify-center">
          <div className="flex items-center rounded-full border border-gray-200 py-1.5 pl-6 pr-2 shadow-sm bg-white transition-shadow hover:shadow-md">
            
            <div className="flex cursor-pointer items-center gap-3 pr-4 text-sm font-medium text-slate-700 max-w-[200px] overflow-hidden whitespace-nowrap">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span className="text-ellipsis overflow-hidden">{displayRange}</span>
            </div>

            <div className="h-6 w-px bg-gray-200 mx-2"></div>

            <div className="flex items-center gap-3 pl-4 pr-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span className="w-[64px]">{guests} Guests</span>
              </div>
              
              <div className="flex items-center gap-1">
                 <button onClick={handleMinus} className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors">-</button>
                 <button onClick={handlePlus} className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors">+</button>
              </div>
            </div>

            <Link href="/destinations" className="ml-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#fcedec] text-[#d96a6a] transition-colors hover:bg-[#fadbd8]">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </Link>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
          <Link href="/predict-outfit" className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors mr-2 hidden sm:block">
            Outfit Planner
          </Link>
          <Link href="/final-planner" className="rounded-md border border-[#4a8b8b] px-4 py-2 text-sm font-semibold text-[#4a8b8b] transition hover:bg-teal-50">
            Final Planner
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-12 pt-8 pb-16 flex-grow">
        
        {/* Title & Travel Date Controls */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Activities & Experiences
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Showing <span className="font-bold text-slate-800">{filteredActivities.length}</span> activities across {destinations.length} Philippine cities for <span className="font-bold text-[#4a8b8b]">{displayRange}</span> ({guests} {guests === 1 ? 'guest' : 'guests'})
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Dates:</span>
            <input 
              type="date" 
              value={checkIn}
              onChange={(e) => { const nextStartDate = e.target.value; setCheckIn(nextStartDate); if (endDate < nextStartDate) setEndDate(nextStartDate); }}
              className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 outline-none hover:border-[#4a8b8b] focus:border-[#4a8b8b] shadow-sm transition cursor-pointer"
            />
            <input
              type="date"
              min={checkIn}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 outline-none hover:border-[#4a8b8b] focus:border-[#4a8b8b] shadow-sm transition cursor-pointer"
            />
          </div>
        </div>

        {/* SEARCH BAR & DUAL FILTERS SECTION */}
        <div className="mb-8 rounded-3xl bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-100 space-y-5">
          
          {/* 1. Search Bar */}
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by city (e.g. Alaminos, Baguio, Cebu) or activity (e.g. island hopping, museum)..."
              className="w-full rounded-2xl border border-gray-200 bg-slate-50/50 py-3.5 pl-12 pr-10 text-sm font-medium text-slate-900 placeholder:text-gray-400 outline-none transition focus:border-[#4a8b8b] focus:bg-white focus:ring-4 focus:ring-[#4a8b8b]/10"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            ) : null}
          </div>

          {/* 2. Main Filters Grid */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2 border-t border-slate-100">
            
            <div className="flex flex-wrap items-center gap-6">

              {/* Weather Forecast Filter (Sunny, Rainy, Cold) */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">City Weather:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleWeather("Sunny")}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all ${
                      weatherFilter === "Sunny"
                        ? "bg-amber-500 text-white shadow-sm scale-105"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span>☀️</span>
                    Sunny
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleWeather("Rainy")}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all ${
                      weatherFilter === "Rainy"
                        ? "bg-sky-600 text-white shadow-sm scale-105"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span>🌧️</span>
                    Rainy
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleWeather("Cold")}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all ${
                      weatherFilter === "Cold"
                        ? "bg-teal-700 text-white shadow-sm scale-105"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span>❄️</span>
                    Cold
                  </button>
                </div>
              </div>

            </div>

            {/* Clear Filters Button */}
            {isAnyFilterActive ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-800 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                Reset all filters
              </button>
            ) : null}

          </div>

        </div>

        {/* ACTIVITIES GRID */}
        {filteredActivities.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleActivities.map((item) => (
              <ActivityDestinationCard key={item.id} item={item} />
            ))}
          </div>
        ) : destinations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-500">Loading destinations…</p>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">
              🔍
            </div>
            <h3 className="text-lg font-bold text-slate-900">No matching activities found</h3>
            <p className="mt-1 text-sm text-slate-500">
              Try adjusting your search query or toggling off active weather/activity filters.
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
            >
              Show all activities
            </button>
          </div>
        )}

        {visibleActivities.length < filteredActivities.length ? (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCardCount((count) => count + CARDS_PER_PAGE)}
              className="rounded-xl border border-[#4a8b8b] px-5 py-2.5 text-sm font-bold text-[#4a8b8b] transition hover:bg-teal-50"
            >
              Load more activities
            </button>
          </div>
        ) : null}

      </main>

      <Footer />
    </div>
  );
}
