"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Footer from "../footer/Footer";
import Header from '../header/Header';
import { useTravel } from "../TravelContext";
import { clampToSelectableDate, getGuestWarning, getMinSelectableDate, WeatherIcon } from "../tripUtils";
import { getActivityImagePath, DESTINATION_PLACEHOLDER } from "../../lib/resolveActivityImage";

const CARDS_PER_PAGE = 24;
// Stable order across navigation and reloads; only the refresh button changes the seed.
const activityOrder = (id, seed) => {
  let hash = seed | 0;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x45d9f3b);
  return (hash ^ (hash >>> 16)) >>> 0;
};
const parseDisplayPriceAmount = (value) => {
  const match = String(value || "").match(/(₱|PHP\s*|USD|\$)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!match) return null;
  const amount = Number(match[2].replace(/,/g, ""));
  return Number.isFinite(amount) ? (/^(USD|\$)$/i.test(match[1].trim()) ? amount * 63.78 : amount) : null;
};
const isFreeActivity = (activity) => (
  (parseDisplayPriceAmount(activity?.price_display) || 0) <= 0
  && !/not published|not listed|unlisted|not cited|unknown|n\/a|tba/i.test(activity?.price_display?.trim() || "")
  && (
    (activity?.price_per_pax != null && Number(activity.price_per_pax) === 0)
    || /^free(?:\s*\(|$)/i.test(activity?.price_display?.trim() || "")
  )
);
const activityFallbackImage = () => DESTINATION_PLACEHOLDER;
const activityImage = (activity, destination) => getActivityImagePath(activity, destination);

const formatActivityPrice = (displayStr, rawPrice) => {
  const cleaned = typeof displayStr === "string" ? displayStr.trim() : "";
  const numericPrice = Number(rawPrice);
  let amount = rawPrice != null && rawPrice !== "" && Number.isFinite(numericPrice) && numericPrice > 0
    ? numericPrice
    : null;

  if (amount == null) {
    if (/not published|unlisted|tba|n\/a|not cited/i.test(cleaned)) return "";

    const dollarAmount = cleaned.match(/(?:USD|\$)\s*([\d,]+(?:\.\d{1,2})?)/);
    const pesoAmount = cleaned.match(/(?:₱|PHP\s*)\s*([\d,]+(?:\.\d{1,2})?)/i);
    const displayAmount = dollarAmount?.[1] || pesoAmount?.[1] || cleaned.match(/([\d,]+(?:\.\d{1,2})?)/)?.[1];
    if (!displayAmount) return "";

    amount = Number(displayAmount.replace(/,/g, ""));
    if (dollarAmount) amount *= 63.78;
  }

  return Number.isFinite(amount) && amount > 0
    ? `₱${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : "";
};

function ActivityDestinationCard({ item }) {
  const duration = item.activityDuration?.trim() || "";
  const durationLabel = duration && !/not published|not cited|not in cited source|planning estimate|as stated in listing title|not applicable|not available|unavailable|not listed|not specified|unknown|\bn\s*\/\s*a\b|\btba\b|\btbd\b/i.test(duration)
    ? duration
    : "";

  return (
    <Link
      href={`/specific-destinations?id=${item.destinationId}&activity=${encodeURIComponent(item.activityName)}`}
      className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm border border-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
    >
      <div className="relative h-56 w-full overflow-hidden bg-slate-100">
        <img
          src={item.image}
          alt={`${item.activityName} in ${item.cityName}`}
          onError={(event) => { if (event.currentTarget.src !== item.fallbackImage) event.currentTarget.src = item.fallbackImage; else event.currentTarget.style.visibility = "hidden"; }}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        
        {/* Top Badge: Weather Tag */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-end gap-2">
          <div className="flex max-w-[75%] flex-wrap justify-end gap-1">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/95 shadow-lg ring-1 ring-black/10" title={item.weatherCondition} role="img" aria-label={item.weatherCondition || "Weather condition unavailable"}>
              <WeatherIcon condition={item.weatherCondition} className="h-7 w-7" />
            </span>
          </div>
        </div>

        {/* Bottom City Name Badge */}
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

          {durationLabel && (
            <span className="text-xs font-semibold text-white/90 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-lg">
              {durationLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <h2 className="text-ms font-black text-slate-900 leading-snug group-hover:text-[#4a8b8b] transition-colors text-justify">
            {item.activityName}
          </h2>
        </div>

        <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-[#4a8b8b] flex items-center gap-1 group-hover:underline">
            View details & price
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </span>
          {(() => {
          const formatted = formatActivityPrice(item.activityPriceDisplay, item.activityPrice);
          
          if (item.isFreeActivity) {
            return (
              <div className="flex flex-col items-end text-right">
                <span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400">Activity price</span>
                <span className="text-sm font-black text-slate-800">Free</span>
              </div>
            );
          }
          
          if (formatted) {
            return (
              <div className="flex flex-col items-end text-right">
                <span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400">Activity price</span>
                <span className="max-w-[180px] text-xs font-black text-slate-800 leading-tight">
                  {formatted}
                </span>
              </div>
            );
          }
          
          // Return nothing if the price is intentionally left blank/unpublished
          return null;
        })()}
        </div>
      </div>
    </Link>
  );
}

function TripDetailsSelector({
  minDate,
  checkIn,
  setCheckIn,
  endDate,
  setEndDate,
  guests,
  setGuests,
  displayRange
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block text-left mt-3">
      <button type="button" onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-2xl border border-gray-300 bg-white px-4 py-2.5 shadow-sm transition hover:border-slate-500 hover:shadow-md active:scale-98"
      >
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          <span>Trip Details</span>
        </div>

        <span className="font-light text-slate-300">|</span>

        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span>{displayRange || "Select dates"}</span>
          <span className="text-slate-400">•</span>
          <span>{guests} {guests === 1 ? "Guest" : "Guests"}</span>
        </div>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180 text-[#860001]" : ""}`}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 z-30 mt-2 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150 w-[310px]">
          {/* DATE RANGE ROW (INLINE START & END) */}
          <div className="flex items-center justify-between gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-1.5">
            <div className="flex flex-1 items-center gap-1 min-w-0">
              <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">In</span>
              <input
                type="date"
                min={minDate}
                value={checkIn}
                onChange={(e) => {
                  const nextStartDate = e.target.value;
                  setCheckIn(nextStartDate);
                  if (endDate < nextStartDate) setEndDate(nextStartDate);
                }}
                className="w-full cursor-pointer bg-transparent text-xs font-semibold text-slate-800 outline-none p-0"
              />
            </div>

            <span className="text-slate-300 font-light text-xs shrink-0">/</span>

            <div className="flex flex-1 items-center gap-1 min-w-0">
              <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">Out</span>
              <input
                type="date"
                min={checkIn || minDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full cursor-pointer bg-transparent text-xs font-semibold text-slate-800 outline-none p-0"
              />
            </div>
          </div>

          {/* GUESTS & APPLY ROW */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-1 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-slate-400"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span className="text-xs font-bold text-slate-800">
                  {guests} {guests === 1 ? "Guest" : "Guests"}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Decrease guests"
                  onClick={() => setGuests((prev) => Math.max(1, prev - 1))}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-xs font-bold text-slate-600 transition hover:bg-slate-200 active:scale-95"
                >
                  -
                </button>
                <button
                  type="button"
                  aria-label="Increase guests"
                  onClick={() => setGuests((prev) => prev + 1)}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-xs font-bold text-slate-600 transition hover:bg-slate-200 active:scale-95"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-[#FFFDF7] transition hover:bg-[#860001] shadow-sm shrink-0"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DestinationsPage() {

  const { dateRange, setDateRange, guests, setGuests, tripLoaded } = useTravel();
  const [destinations, setDestinations] = useState([]);
  const [destinationError, setDestinationError] = useState("");
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(true);
  const [tripReady, setTripReady] = useState(false);
  const minDate = getMinSelectableDate();
  const [checkIn, setCheckIn] = useState(dateRange.startDate || minDate);
  const [endDate, setEndDate] = useState(dateRange.endDate || "");
  const guestWarning = getGuestWarning(guests);

  useEffect(() => {
    if (dateRange.startDate) setCheckIn(dateRange.startDate);
    if (dateRange.endDate) setEndDate(dateRange.endDate);
  }, [dateRange.endDate, dateRange.startDate]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [weatherFilter, setWeatherFilter] = useState(null);
  const [activityTypeFilter, setActivityTypeFilter] = useState(null);
  const [visibleCardCount, setVisibleCardCount] = useState(CARDS_PER_PAGE);
  const [activitySeed, setActivitySeed] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    if (!tripLoaded) return;
    try {
      const saved = JSON.parse(localStorage.getItem("anoTaraDestinationView") || "null");
      if (saved) {
        setSearchQuery(saved.searchQuery || "");
        setWeatherFilter(saved.weatherFilter ?? null);
        setActivityTypeFilter(saved.activityTypeFilter ?? null);
        setVisibleCardCount(saved.visibleCardCount || CARDS_PER_PAGE);
        setActivitySeed(saved.activitySeed || 1);
        if (saved.checkIn && !dateRange.startDate) setCheckIn(clampToSelectableDate(saved.checkIn));
        if (saved.endDate && !dateRange.endDate) setEndDate(clampToSelectableDate(saved.endDate));
      }
    } catch { /* Keep the default view when storage is unavailable. */ }
    const query = new URLSearchParams(window.location.search);
    const requestedActivityType = query.get("activityType");
    if (requestedActivityType) setActivityTypeFilter(requestedActivityType);
    const nextCheckIn = query.get("startDate") || query.get("date") || query.get("checkIn");
    if (nextCheckIn) setCheckIn(clampToSelectableDate(nextCheckIn));
    const nextEndDate = query.get("endDate");
    if (nextEndDate) setEndDate(clampToSelectableDate(nextEndDate));
    if (query.get("guests")) setGuests(Number(query.get("guests")) || 1);
    setTripReady(true);
  }, [setGuests, tripLoaded]);

  useEffect(() => {
    if (!tripReady) return;
    let isMounted = true;

    const loadDestinations = async () => {
      try {
        const params = new URLSearchParams({
          check_in: checkIn,
          check_out: endDate || checkIn,
          guests: String(guests),
          room_type: "Standard Room",
        });
        const response = await fetch(`/api/backend/destinations?${params}`);
        const responseText = await response.text();
        let data;
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch {
          throw new Error(`Destination service returned an invalid response (${response.status}).`);
        }
        if (!response.ok || !Array.isArray(data.destinations) || !data.destinations.length) {
          throw new Error(data.detail || "The tourism dataset returned no destinations.");
        }
        if (isMounted) {
          setDestinations(data.destinations);
          setDestinationError("");
        }
      } catch (error) {
        console.error("Could not load destinations from the tourism dataset.", error);
        if (isMounted) setDestinationError("Could not load destinations from the tourism dataset. Check that the backend is running and try again.");
      } finally {
        if (isMounted) setIsLoadingDestinations(false);
      }
    };

    loadDestinations();
    return () => {
      isMounted = false;
    };
  }, [checkIn, endDate, guests, tripReady, refreshVersion]);

  useEffect(() => {
    if (!tripReady) return;
    setDateRange({ startDate: checkIn, endDate: endDate || checkIn });
  }, [checkIn, endDate, tripReady]);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const displayRange = formatDate(checkIn) || "Select date";

  // Cards represent the actual activity records returned from the tourism dataset.
  const allActivities = useMemo(() => {
    const list = [];
    destinations.forEach((dest) => {
      (dest.activities || []).forEach((activity, index) => {
        const hotelType = activity.hotel_type || dest.hotel_type || "City Hotel";
        list.push({
          id: `${dest.id}-${index}`,
          destinationId: dest.id,
          cityName: dest.name,
          country: dest.country || "Philippines",
          activityName: activity.name,
          activityType: activity.type,
          activityDuration: activity.activity_duration || "",
          recordType: activity.record_type || "",
          recordTypes: activity.record_types || (activity.record_type ? [activity.record_type] : []),
          hotelType,
          base_price: dest.base_price ?? null,
          isLocalRate: Boolean(dest.has_local_rate),
          estimatedDailyPrice: dest.estimated_prices?.[hotelType]?.daily_price ?? null,
          priceMultiplier: dest.estimated_prices?.[hotelType]?.multiplier ?? null,
          activityPrice: activity.price_per_pax ?? null,
          activityPriceDisplay: activity.price_display || "",
          isFreeActivity: isFreeActivity(activity),
          weatherCondition: activity.weather_condition || dest.weather_condition || dest.main_weather,
          image: activityImage(activity, dest),
          fallbackImage: activityFallbackImage(activity, dest),
        });
      });
    });
    return list.sort((a, b) => activityOrder(a.id, activitySeed) - activityOrder(b.id, activitySeed) || a.id.localeCompare(b.id));
  }, [destinations, activitySeed]);

  const recordTypeOptions = useMemo(
    () => [...new Set(allActivities.flatMap((item) => item.recordTypes).filter(Boolean))].sort(),
    [allActivities],
  );
  const weatherTagOptions = useMemo(
    () => [...new Set(allActivities.map((item) => item.weatherCondition).filter(Boolean))].sort(),
    [allActivities],
  );

  // Filter activities based on search bar, activity type filter, and weather tag filter
  const filteredActivities = useMemo(() => {
    return allActivities.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.activityName.toLowerCase().includes(q);
        const matchesCity = item.cityName.toLowerCase().includes(q);
        if (!matchesName && !matchesCity) return false;
      }

      if (weatherFilter !== null) {
        if (item.weatherCondition !== weatherFilter) return false;
      }

      if (activityTypeFilter !== null && !item.recordTypes.includes(activityTypeFilter)) return false;

      return true;
    });
  }, [activityTypeFilter, allActivities, searchQuery, weatherFilter]);

  const visibleActivities = filteredActivities.slice(0, visibleCardCount);

  useEffect(() => {
    if (!tripReady) return;
    try {
      const url = new URL(window.location.href);
      if (activityTypeFilter) url.searchParams.set("activityType", activityTypeFilter);
      else url.searchParams.delete("activityType");
      window.history.replaceState(window.history.state, "", url);
      localStorage.setItem("anoTaraDestinationView", JSON.stringify({
        searchQuery, weatherFilter, activityTypeFilter, visibleCardCount, activitySeed, checkIn, endDate,
      }));
    } catch { /* Browsing still works without storage. */ }
  }, [tripReady, searchQuery, weatherFilter, activityTypeFilter, visibleCardCount, activitySeed, checkIn, endDate]);

  const toggleWeather = (weather) => {
    setWeatherFilter((prev) => (prev === weather ? null : weather));
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setWeatherFilter(null);
    setActivityTypeFilter(null);
    setVisibleCardCount(CARDS_PER_PAGE);
    window.history.replaceState(window.history.state, "", window.location.pathname);
  };

  const isAnyFilterActive = searchQuery.trim() !== "" || weatherFilter !== null || activityTypeFilter !== null;

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFDFB] text-slate-900">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-16 flex-grow">
        <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          {/* Title & Subtitle Context */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-extrabold uppercase tracking-tight text-slate-900 sm:text-4xl">
                Activities &amp; Experiences
              </h1>
              <span className="group relative inline-flex">
                <button
                  type="button"
                  aria-label="About activity information"
                  aria-describedby="activity-information-note"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:text-[#4a8b8b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4a8b8b]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="11" x2="12" y2="16"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </button>
                <span
                  id="activity-information-note"
                  role="tooltip"
                  className="invisible absolute left-0 top-full z-30 mt-2 w-72 rounded-xl bg-slate-900 px-3 py-2 text-left text-xs font-medium normal-case leading-relaxed text-white opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                >
                  Some details, including prices, may be left blank when they are not listed or cited in the source. Open an activity to see any additional available information.
                </span>
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500">
              Showing <span className="font-bold text-slate-900">{filteredActivities.length}</span> activities across {destinations.length} cities for{" "}
              <span className="font-bold text-[#860001]">{displayRange}</span> ({guests} {guests === 1 ? "guest" : "guests"})
            </p>
          </div>
          <div className="sm:ml-auto">
            <TripDetailsSelector
              minDate={minDate}
              checkIn={checkIn}
              setCheckIn={setCheckIn}
              endDate={endDate}
              setEndDate={setEndDate}
              guests={guests}
              setGuests={setGuests}
              displayRange={displayRange}
            />
          </div>
        </div>
        {guestWarning ? (
          <p className="-mt-2 mb-4 text-xs font-semibold text-amber-600">{guestWarning}</p>
        ) : null}

        {/* INLINE COMPACT SEARCH & FILTERS TOOLBAR */}
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Weather Filter Pill */}
            <div className="relative">
              <select
                value={weatherFilter || ""}
                onChange={(e) => setWeatherFilter(e.target.value || null)}
                className={`appearance-none rounded-xl border py-3 pl-3 pr-8 text-xs font-bold outline-none transition-all cursor-pointer shadow-sm ${
                  weatherFilter
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                <option value="" className="bg-white text-slate-900 font-semibold">Weather Condition (All)</option>
                {weatherTagOptions.map((tag) => (
                  <option key={tag} value={tag} className="bg-white text-slate-900 font-semibold">
                    {tag}
                  </option>
                ))}
              </select>
              <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 ${weatherFilter ? "text-white" : "text-slate-400"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>

            {/* Activity Type Filter Pill */}
            <div className="relative">
              <select
                value={activityTypeFilter || ""}
                onChange={(e) => setActivityTypeFilter(e.target.value || null)}
                className={`appearance-none rounded-xl border py-3 pl-3 pr-8 text-xs font-bold outline-none transition-all cursor-pointer shadow-sm ${
                  activityTypeFilter
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                <option value="" className="bg-white text-slate-900 font-semibold">Activity Type (All)</option>
                {recordTypeOptions.map((type) => (
                  <option key={type} value={type} className="bg-white text-slate-900 font-semibold">
                    {type}
                  </option>
                ))}
              </select>
              <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 ${activityTypeFilter ? "text-white" : "text-slate-400"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>

            {/* Slate Reset Filters Button */}
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900 shadow-sm"
                title="Reset all filters"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <span>Reset</span>
              </button>
            )}

          </div>
          
          {/* 1. Compact Search Input */}
          <div className="flex flex-1 min-w-[260px] items-center gap-2">
            <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search city or activity..."
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-9 text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition-all hover:border-slate-300 focus:border-slate-900 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
            </div>
            <button
              type="button"
              onClick={() => {
                setActivitySeed(Date.now());
                setRefreshVersion((version) => version + 1);
                setDestinationError("");
                setIsLoadingDestinations(true);
              }}
              disabled={isLoadingDestinations}
              aria-label={isLoadingDestinations ? "Refreshing activities" : "Refresh activities"}
              title="Refresh activities"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-wait disabled:opacity-50"
            >
              <svg className={isLoadingDestinations ? "animate-spin motion-reduce:animate-none" : ""} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 7v5h-5M4 17v-5h5" />
                <path d="M6.1 7a7 7 0 0 1 11.5-2L20 8M4 16l2.4 3A7 7 0 0 0 17.9 17" />
              </svg>
            </button>
          </div>

          
        </div>

        {/* ACTIVITIES GRID */}
        {filteredActivities.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleActivities.map((item) => (
              <ActivityDestinationCard key={item.id} item={item} />
            ))}
          </div>
        ) : isLoadingDestinations ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-500">Loading destinations…</p>
          </div>
        ) : destinationError ? (
          <div role="alert" className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
            <p className="text-sm font-semibold text-amber-900">{destinationError}</p>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">
              Search
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
          <div className="mt-12 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCardCount((count) => count + CARDS_PER_PAGE)}
              className="rounded-xl bg-slate-950 px-8 py-3.5 text-sm font-bold text-[#FFFDF7] transition-all duration-200 hover:bg-slate-800 hover:-translate-y-0.5 shadow-md hover:shadow-lg active:translate-y-0"
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
