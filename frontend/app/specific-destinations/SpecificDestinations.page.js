"use client";
import React, { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Footer from "../footer/Footer";
import Header from "../header/Header";
import ActivityTimePicker from "../../components/ActivityTimePicker";
import DynamicMap from "../../components/DynamicMap";
import PageSkeleton from "../../components/PageSkeleton";
import { useTravel } from "../TravelContext";
import { getGuestWarning, getMinSelectableDate, isValidActivityTime, toDateString, getPAGASABadgeColor, WeatherIcon } from "../tripUtils";
import { ChevronLeft } from 'lucide-react';

const mainImage =
  "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1400&q=80";
const localImageFallback = "/destination-placeholder.svg";

const applyImageFallback = (event, fallbackImage) => {
  const image = event.currentTarget;
  if (!image.dataset.fallbackAttempted) {
    image.dataset.fallbackAttempted = "true";
    image.src = fallbackImage;
    return;
  }
  if (!image.dataset.localFallbackAttempted) {
    image.dataset.localFallbackAttempted = "true";
    image.src = localImageFallback;
    return;
  }
  image.onerror = null;
  image.hidden = true;
};

const activityFallbackImage = (activity, destination) => {
  const name = `${activity?.name || ""} ${activity?.type || ""}`.toLowerCase();
  if (/food|seafood|culinary|dining|tasting|manokan|oyster/.test(name)) return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80";
  if (/museum|gallery|art|heritage|cultural/.test(name)) return "https://images.unsplash.com/photo-1564399579883-451a5d44ec08?auto=format&fit=crop&w=1200&q=80";
  if (/boat|island|beach|falls|nature|park|hiking|walking/.test(name)) return "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";
  return destination?.image || mainImage;
};
const activityImageSlug = (activity, destination) => {
  const value = `${activity?.name || destination?.name || ""} ${destination?.name || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return value ? `/activity%20pics/${value}.jpg` : "";
};
const activityImage = (activity, destination) => (
  activityImageSlug(activity, destination) || activity?.image || activityFallbackImage(activity, destination)
);
const richText = (value) => Array.isArray(value) ? value.filter(Boolean).join(" ") : (value || "").trim();
const formatDescriptionParagraphs = (rawNotes, fallbackDescription) => {
  const text = Array.isArray(rawNotes) ? rawNotes.filter(Boolean).join("\n") : (rawNotes || fallbackDescription || "").trim();
  if (!text) return null;
  const paragraphs = text.split(/(?:;|\n)+/).map(p => p.trim()).filter(Boolean);
  return (
    <div className="mb-8 space-y-2.5">
      {paragraphs.map((paragraph, idx) => (
        <p key={idx} className="text-base leading-relaxed text-gray-700">
          {paragraph}
        </p>
      ))}
    </div>
  );
};
const normalizeNearbyText = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const timeToMinutes = (value) => {
  const match = String(value || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3]?.toLowerCase();
  if (minute > 59 || hour > 23) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  }
  return hour * 60 + minute;
};
const normalizedTime = (value) => {
  const minutes = timeToMinutes(value);
  return minutes == null ? "" : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};
const splitRichValues = (value) => String(value || "").split(/[;,|\n]+/).map((item) => item.trim()).filter(Boolean);
const isOpenOnDate = (openDays, dateValue) => {
  if (!openDays || /not published|unknown|n\/a/i.test(openDays)) return null;
  const day = new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
  const normalized = openDays.toLowerCase().replace(/\s+/g, " ").trim();
  if (/daily|every day|all days/.test(normalized)) {
    const except = normalized.match(/except\s+(.+)$/);
    return !except || !except[1].includes(day.toLowerCase().slice(0, 3));
  }
  if (normalized.includes("-")) {
    const [start, end] = normalized.split("-").map((part) => part.trim());
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const startIndex = days.findIndex((item) => start.startsWith(item.slice(0, 3)));
    const endIndex = days.findIndex((item) => end.startsWith(item.slice(0, 3)));
    const dayIndex = days.indexOf(day.toLowerCase());
    if (startIndex >= 0 && endIndex >= 0) return startIndex <= endIndex
      ? dayIndex >= startIndex && dayIndex <= endIndex
      : dayIndex >= startIndex || dayIndex <= endIndex;
  }
  return normalized.includes(day.toLowerCase()) || normalized.includes(day.slice(0, 3).toLowerCase());
};
const parseDisplayPriceAmount = (value) => {
  const match = String(value || "").match(/(₱|PHP\s*|\$)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!match) return null;
  const amount = Number(match[2].replace(/,/g, ""));
  return Number.isFinite(amount) ? (match[1].trim() === "$" ? amount * 56 : amount) : null;
};
const isFreeActivity = (activity) => {
  const display = activity?.price_display?.trim() || "";
  const displayAmount = parseDisplayPriceAmount(activity?.price_display);
  if (displayAmount > 0) return false;
  if (/not published|not listed|unlisted|not cited|unknown|n\/a|tba/i.test(display)) return false;
  return (activity?.price_per_pax != null && Number(activity.price_per_pax) === 0)
    || /^free(?:\s*\(|$)/i.test(display);
};

const FALLBACK_DESTINATION = {
  id: "manila",
  name: "Manila",
  location: "Manila, Philippines",
  country: "Philippines",
  main_weather: "Clear / Sunny",
  image: mainImage,
  description: "Discover scenic attractions, cultural landmarks, and local experiences in Manila.",
  activities: [],
};

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

const getNextAvailableDay = (dates, activities, afterDay = "") => {
  const occupiedDays = new Set(activities.map((activity) => activity.assignedDay || activity.assigned_day));
  const afterIndex = Number(afterDay.replace("Day ", "")) - 1;
  const startIndex = afterIndex >= 0 ? afterIndex + 1 : 0;
  const order = [...dates.keys()].slice(startIndex).concat([...dates.keys()].slice(0, startIndex));
  const nextIndex = order.find((index) => !occupiedDays.has(`Day ${index + 1}`));
  return nextIndex === undefined ? "" : `Day ${nextIndex + 1}`;
};

const shuffleList = (items) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

function NearbyCard({ destination }) {
  const activity = destination.highlightActivity || destination.activities?.[0];
  const title = activity?.name || destination.name;
  const image = activityImage(activity, destination);
  const weatherCondition = destination.weather_condition || destination.main_weather || "Clear / Sunny";
  return (
    <Link key={`${destination.id}-${activity?.name || ""}`} href={`/specific-destinations?id=${destination.id}${activity ? `&activity=${encodeURIComponent(activity.name)}` : ""}`} className="group relative block h-36 overflow-hidden rounded-xl shadow-sm">
      <img src={image} alt={title} onError={(event) => applyImageFallback(event, activityFallbackImage(activity, destination))} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
      <span className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white" title={weatherCondition}>
        <WeatherIcon condition={weatherCondition} className="h-4 w-4" />
      </span>
      <div className="absolute bottom-2 left-2 right-2">
        <p className="line-clamp-2 text-xs font-bold leading-snug text-white">{title}</p>
        <p className="text-[10px] text-white/80">{destination.name}</p>
        {destination.proximityBasis ? (
          <p className="mt-0.5 truncate text-[9px] font-semibold text-amber-200" title={destination.proximityBasis}>
            Basis: {destination.proximityBasis}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function AssignDaySelect({ dates, assignedDay, currentActivities, assignedDayTaken, onChange, formatDate }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const options = dates.map((date, index) => {
    const dayLabel = `Day ${index + 1}`;
    const taken = currentActivities.some((item) => (item.assignedDay || item.assigned_day) === dayLabel);
    return { date, dayLabel, taken, text: `${dayLabel} · ${formatDate(date)}${taken ? " (selected)" : ""}` };
  });
  const selected = options.find((option) => option.dayLabel === assignedDay) || options[0];

  useEffect(() => {
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={menuRef} className={`relative mt-3 mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${assignedDayTaken ? "border-blue-300 bg-blue-50/60 text-slate-700" : "border-gray-300 text-slate-700"}`}>
      <span>Assign to{assignedDayTaken ? " · already has activity" : ""}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`max-w-[65%] truncate rounded-lg border bg-white px-2 py-1 text-left text-xs font-semibold outline-none focus:border-gray-400 ${assignedDayTaken ? "border-blue-200 text-slate-700" : "border-gray-200"}`}
      >
        {selected?.text || "Choose a day"}
      </button>
      {open ? (
        <ul role="listbox" className="absolute right-4 top-[calc(100%-0.35rem)] z-30 max-h-56 w-[min(100%-2rem,18rem)] overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {options.map((option) => (
            <li key={option.date}>
              <button
                type="button"
                role="option"
                aria-selected={option.dayLabel === assignedDay}
                onClick={() => { onChange(option.dayLabel); setOpen(false); }}
                className={`flex w-full px-3 py-2 text-left text-xs font-semibold ${option.dayLabel === assignedDay ? "bg-slate-900 text-white" : "text-slate-800 hover:bg-slate-50"} ${option.taken ? "bg-blue-50/50" : ""}`}
              >
                {option.text}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const formatActivityPrice = (displayStr, rawPrice) => {
  if (!displayStr) return "";
  let cleaned = displayStr.trim();

  if (
    /not published|unlisted|tba|n\/a/i.test(cleaned) ||
    cleaned === "Not published in cited source"
  ) {
    return "";
  }

  if (cleaned.includes("$")) {
    cleaned = cleaned.replace(/\$(\d+(?:\.\d+)?)/g, (match, usdVal) => {
      const phpVal = (parseFloat(usdVal) * 56.0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `₱${phpVal} ($${usdVal})`;
    });
  }

  return cleaned;
};

function SpecificDestinationsContent() {
  const { dateRange, setDateRange, guests, setGuests, addActivity, currentActivities, hasActivityConflict } = useTravel();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [tripReady, setTripReady] = useState(false);
  const minDate = getMinSelectableDate();

  const [hotelEstimate, setHotelEstimate] = useState(null);
  const [isEstimatingHotel, setIsEstimatingHotel] = useState(false);

  const [startDate, setStartDate] = useState(dateRange.startDate || minDate);
  const [endDate, setEndDate] = useState(() => {
    if (dateRange.endDate) return dateRange.endDate;
    const nextDay = new Date(`${minDate}T00:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    return toDateString(nextDay);
  });
  const [roomType, setRoomType] = useState("Standard Room");
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [assignedDay, setAssignedDay] = useState("Day 1");
  const [pricingDate, setPricingDate] = useState(dateRange.startDate || minDate);
  const [toastMessage, setToastMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);
  const [weatherForecast, setWeatherForecast] = useState(null);
  const [recommendedType, setRecommendedType] = useState("outdoor");
  const [recommendationReason, setRecommendationReason] = useState("");
  const [weatherComparison, setWeatherComparison] = useState(null);
  const [destinationError, setDestinationError] = useState("");
  
  const [destinationDetails, setDestinationDetails] = useState(null);
  const [activityList, setActivityList] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [nearbyDestinations, setNearbyDestinations] = useState([]);

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
    return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const displayRange = startDate
    ? `${formatDate(startDate)} - ${formatDate(endDate)}`
    : "Select dates";

  const selectedActivityData = activityList.find((activity) => activity.name === selectedActivity)
    || destinationDetails?.activities?.find((activity) => activity.name === selectedActivity);
  const roomOptions = selectedActivityData?.pricing_tiers?.length
    ? selectedActivityData.pricing_tiers
    : [{ room_type: "Standard Room" }, { room_type: "Premium Suite" }];
  const selectedPricingTier = selectedActivityData?.pricing_tiers?.find(
    (option) => option.room_type === roomType,
  ) || selectedActivityData?.pricing_tiers?.[0];
  
  const selectedActivityImage = activityImage(selectedActivityData, destinationDetails);
  const parsedGuests = Number(guests) || 1;
  const selectedRecordTypes = selectedActivityData?.record_types || [];
  const isAccommodation = selectedRecordTypes.some((type) => /hotel|room|accommodation|resort/i.test(type));
  const hotelRatePerNight = Number(selectedPricingTier?.hotel_rate_per_night ?? selectedActivityData?.hotel_rate_per_night);
  const hotelOccupancyPax = Number(selectedPricingTier?.hotel_occupancy_pax ?? selectedActivityData?.hotel_occupancy_pax);
  const hotelRatePerPaxPerNight = Number(selectedPricingTier?.hotel_rate_per_pax_per_night ?? selectedActivityData?.hotel_rate_per_pax_per_night);
  const hasExactAccommodationRate = isAccommodation
    && Number.isFinite(hotelRatePerNight)
    && hotelRatePerNight > 0
    && Number.isFinite(hotelOccupancyPax)
    && hotelOccupancyPax > 0;
  const hotelRoomsRequired = hasExactAccommodationRate
    ? Math.ceil(parsedGuests / hotelOccupancyPax)
    : 0;
  const accommodationNightlyTotal = hasExactAccommodationRate
    ? hotelRoomsRequired * hotelRatePerNight
    : null;
  const stayNights = Math.max(1, Math.round((new Date(`${endDate}T00:00:00`) - new Date(`${startDate}T00:00:00`)) / 86400000));

  const totalAccommodationCost = hasExactAccommodationRate
    ? accommodationNightlyTotal * stayNights
    : (hotelEstimate?.total_price ?? null);

  const perPaxAccommodationCost = totalAccommodationCost != null
    ? totalAccommodationCost / parsedGuests
    : null;

  const perPaxNightlyAccommodationCost = hasExactAccommodationRate
    ? accommodationNightlyTotal / parsedGuests
    : Number.isFinite(hotelRatePerPaxPerNight) ? hotelRatePerPaxPerNight : null;

  // 1. Extract static per-guest base price from dataset
  const listedPricePerGuest = !isAccommodation ? (
    selectedPricingTier?.price_per_pax ??
    (selectedPricingTier?.price != null && selectedActivityData?.pricing_tiers?.length
      ? selectedPricingTier.price
      : null) ??
    selectedActivityData?.price_per_pax ??
    selectedActivityData?.Price_Per_Pax_PHP ?? 
    null
  ) : null;
  const selectedPriceDisplay = selectedPricingTier?.price_display
    || selectedActivityData?.price_display
    || selectedActivityData?.Price_Display
    || "";
  const displayedPricePerGuest = parseDisplayPriceAmount(selectedPriceDisplay);
  const rawPricePerGuest = Number(listedPricePerGuest) === 0 && displayedPricePerGuest > 0
    ? displayedPricePerGuest
    : listedPricePerGuest ?? displayedPricePerGuest;

  const parsedPricePerGuest = rawPricePerGuest !== null && rawPricePerGuest !== undefined
    ? parseFloat(rawPricePerGuest)
    : NaN;

  // 2. Determine if activity is free
  const selectedActivityIsFree = !isAccommodation
    && isFreeActivity({ ...selectedActivityData, price_display: selectedPriceDisplay, price_per_pax: rawPricePerGuest });
  const selectedDataQualityNotes = richText(selectedActivityData?.data_quality_notes);
  const selectedNearbyActivities = richText(selectedActivityData?.nearby_activities);
  const selectedNearbyProximityBasis = selectedActivityData?.nearby_proximity_basis || "";
  const selectedTimeMinutes = timeToMinutes(selectedTime);
  const checkInMinutes = timeToMinutes(selectedActivityData?.hotel_check_in);
  const checkOutMinutes = timeToMinutes(selectedActivityData?.hotel_check_out);
  const hotelTimeWarning = isAccommodation && selectedTimeMinutes != null
    ? (checkInMinutes != null && selectedTimeMinutes < checkInMinutes
      ? `Selected time is before hotel check-in (${selectedActivityData.hotel_check_in}).`
      : checkOutMinutes != null && selectedTimeMinutes > checkOutMinutes
      ? `Selected time is after hotel check-out (${selectedActivityData.hotel_check_out}).`
      : "")
    : "";
  const operatingDayStatus = isOpenOnDate(selectedActivityData?.open_days, pricingDate);
  const operatingDayWarning = operatingDayStatus === false
    ? `This location may be closed on ${new Date(`${pricingDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" })} (${selectedActivityData.open_days}).`
    : "";
  const openingTime = String(selectedActivityData?.opening_time || "").trim();
  const closingTime = String(selectedActivityData?.closing_time || "").trim();
  const operatingHoursPublished = timeToMinutes(openingTime) != null && timeToMinutes(closingTime) != null;
  const operatingHoursNote = [openingTime, closingTime].find(
    (value) => value && timeToMinutes(value) == null,
  );
  const activityDurationLabel = selectedActivityData?.activity_duration || (
    selectedActivityData?.duration_hours ? `${selectedActivityData.duration_hours} hrs` : ""
  );
  const amenities = splitRichValues(selectedPricingTier?.amenities_or_inclusions || selectedActivityData?.amenities_or_inclusions);
  const promos = splitRichValues(selectedPricingTier?.promos_or_discounts || selectedActivityData?.promos_or_discounts);

  useEffect(() => {
    if (!operatingHoursPublished) return;
    const selectedMinutes = timeToMinutes(selectedTime);
    const openingMinutes = timeToMinutes(selectedActivityData.opening_time);
    const closingMinutes = timeToMinutes(selectedActivityData.closing_time);
    if (selectedMinutes == null || (openingMinutes != null && selectedMinutes < openingMinutes) || (closingMinutes != null && selectedMinutes > closingMinutes)) {
      const nextTime = normalizedTime(selectedActivityData.opening_time);
      if (nextTime) setSelectedTime(nextTime);
    }
  }, [operatingHoursPublished, selectedActivityData, selectedTime]);

  // 3. Dynamic total price (Math takes priority)
  const activityTotalPrice = (!isNaN(parsedPricePerGuest) && parsedPricePerGuest > 0) ? parsedPricePerGuest * parsedGuests : null;
  const activityAdmissionTotal = isAccommodation
    ? null
    : selectedActivityIsFree ? 0 : activityTotalPrice;
  const totalActivityAdmissionFees = isAccommodation ? 0 : activityAdmissionTotal;
  const totalTripCost = totalAccommodationCost != null && totalActivityAdmissionFees != null
    ? totalAccommodationCost + totalActivityAdmissionFees
    : null;

  const perPersonTripCost = totalTripCost != null ? totalTripCost / parsedGuests : null;

  // 4. Formatted Display Texts
  const activityTotalPriceText = selectedActivityIsFree
    ? "Free"
    : activityTotalPrice != null
    ? `PHP ${activityTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : selectedPriceDisplay.trim() || "Not listed";
    
  const staticBasePriceText = !isNaN(parsedPricePerGuest) && parsedPricePerGuest > 0
    ? `PHP ${parsedPricePerGuest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;
  const exactAccommodationPerPersonText = perPaxAccommodationCost != null
    ? `PHP ${perPaxAccommodationCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;
  const selectedPriceText = activityTotalPriceText !== "Not listed"
    ? activityTotalPriceText
    : formatActivityPrice(selectedPriceDisplay, rawPricePerGuest) || activityTotalPriceText;
  const tripTotalText = totalTripCost != null
    ? `PHP ${totalTripCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;
  const perPersonTripText = perPersonTripCost != null
    ? `PHP ${perPersonTripCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

  const guestWarning = getGuestWarning(guests);
  
  // Non-blocking check for multiple activities per day
  const assignedDayTaken = currentActivities.some((activity) => (activity.assignedDay || activity.assigned_day) === assignedDay);

  const destinationQuery = searchParams.get("id") || "";
  const activityQuery = searchParams.get("activity") || "";

  const handleAssignedDayChange = (nextDay) => {
    setAssignedDay(nextDay);
    const dayIndex = Number(nextDay.replace("Day ", "")) - 1;
    const selectedDate = generateDateRange(startDate, endDate)[dayIndex];
    if (selectedDate) setPricingDate(selectedDate);
  };

  useEffect(() => {
    if (dateRange.startDate) setStartDate(dateRange.startDate);
    if (dateRange.endDate) setEndDate(dateRange.endDate);
  }, [dateRange.endDate, dateRange.startDate]);

  useEffect(() => {
    const dates = generateDateRange(startDate, endDate);
    if (!dates.length) return;
    const assignedIndex = Number(assignedDay.replace("Day ", "")) - 1;
    if (assignedIndex < 0 || assignedIndex >= dates.length) setAssignedDay(`Day ${dates.length}`);
    if (!dates.includes(pricingDate)) setPricingDate(dates[0]);
  }, [activityQuery, currentActivities, destinationQuery, endDate, startDate]);

  useEffect(() => {
    const pricingTiers = selectedActivityData?.pricing_tiers || [];
    if (!pricingTiers.length) {
      if (roomType !== "Standard Room") setRoomType("Standard Room");
      return;
    }

    if (!pricingTiers.some((tier) => tier.room_type === roomType)) {
      setRoomType(pricingTiers[0].room_type);
    }
  }, [roomType, selectedActivityData]);

  useEffect(() => {
    setTripReady(true);
  }, []);

  

  useEffect(() => {
    let cancelled = false;
    const loadNearbyDestinations = async () => {
      try {
        const response = await fetch(`/api/backend/destinations?check_in=${encodeURIComponent(pricingDate || startDate)}`);
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.destinations)) {
          throw new Error(data.detail || "Destination data is unavailable.");
        }
        const destinations = data.destinations;
        const currentId = destinationQuery || FALLBACK_DESTINATION.id;
        const pool = [];
        destinations.forEach((destination) => {
          if (destination.id === currentId) return;
          (destination.activities || []).forEach((activity) => {
            pool.push({ ...destination, highlightActivity: activity });
          });
        });
        const nearbyTargets = selectedNearbyActivities
          .split(/[;,|\n]+/)
          .map(normalizeNearbyText)
          .filter((target) => target.length > 2);
        const prioritizedPool = nearbyTargets.length
          ? pool.filter((item) => {
            const destinationText = normalizeNearbyText(item.name);
            const activityText = normalizeNearbyText(item.highlightActivity?.name);
            return nearbyTargets.some((target) => destinationText.includes(target) || activityText.includes(target) || target.includes(destinationText));
          })
          : [];
        const picked = [];
        const usedDestinations = new Set();
        shuffleList([...prioritizedPool, ...pool.filter((item) => !prioritizedPool.includes(item))]).forEach((item) => {
          if (usedDestinations.has(item.id) || picked.length >= 3) return;
          usedDestinations.add(item.id);
          picked.push({
            ...item,
            proximityBasis: selectedNearbyProximityBasis,
          });
        });
        if (!cancelled) setNearbyDestinations(picked);
      } catch (error) {
        console.warn("Nearby tourism destinations are unavailable.", error);
        if (!cancelled) setNearbyDestinations([]);
      }
    };
    loadNearbyDestinations();
    return () => { cancelled = true; };
  }, [activityQuery, destinationQuery, pricingDate, selectedNearbyActivities, selectedNearbyProximityBasis, startDate]);

  useEffect(() => {
    if (!tripReady) return;
    const currentQuery = new URLSearchParams(searchParams.toString());
    const destinationId = currentQuery.get("id") || FALLBACK_DESTINATION.id;
    const activityParam = currentQuery.get("activity");
    let isMounted = true;
    setIsLoading(true);
    setDestinationDetails(null);
    setActivityList([]);
    setSelectedActivity("");
    setHotelEstimate(null);
    setIsEstimatingHotel(false);
    setIsLoadingWeather(true);

    const loadDestinationAndWeather = async () => {
      setWeatherForecast(null);
      setWeatherComparison(null);
      setRecommendationReason("");
      try {
        // Fetch priority Open-Meteo forecast and activity recommendations
        const destinationResponse = await fetch(`/api/backend/destinations/${destinationId}`);
        const destination = await destinationResponse.json();
        if (!destinationResponse.ok) {
          throw new Error(destination.detail || "Destination details are unavailable.");
        }
        if (!isMounted) return;
        setDestinationDetails(destination);
        setDestinationError("");

        const fallbackActs = (destination.activities || []).map((activity) => {
          const isRainy = /rain|storm/i.test(destination.main_weather || "");
          const isOutdoor = activity.type === "outdoor";
          const recommended = isRainy ? !isOutdoor : isOutdoor;
          return {
            ...activity,
            hotel_type: isOutdoor ? "Resort Hotel" : "City Hotel",
            recommended,
            locked: !recommended,
            lock_reason: "Locked: Recommended for weather compatibility only.",
          };
        });
        const initialActs = fallbackActs.length ? fallbackActs : destination.activities || [];
        const initialTarget = activityParam || selectedActivity;
        const initialMatch = initialActs.find((activity) => activity.name === initialTarget)
          || initialActs.find((activity) => activity.recommended)
          || initialActs[0];
        setActivityList(initialActs);
        if (initialMatch) setSelectedActivity(initialMatch.name);
        setIsLoading(false);

        let forecastResponse;
        let forecastData = {};
        try {
          forecastResponse = await fetch(`/api/backend/destinations/${destinationId}/forecast?date_str=${pricingDate || startDate}`);
          forecastData = forecastResponse.ok ? await forecastResponse.json() : {};
        } catch (error) {
          console.warn("Weather forecast is unavailable; continuing with destination pricing", error);
        }
        
        let acts = destination.activities || [];
        if (forecastResponse?.ok && forecastData.activities && forecastData.activities.length > 0) {
          acts = forecastData.activities;
          setActivityList(forecastData.activities);
          setWeatherForecast(forecastData.forecast);
          setRecommendedType(forecastData.recommended_activity_type || "outdoor");
          setRecommendationReason(forecastData.activity_recommendation_reason || "");
          setWeatherComparison(forecastData.comparison || null);
        } else {
          const isRainy = /rain|storm/i.test(destination.main_weather || "");
          acts = acts.map((a) => {
            const isOutdoor = a.type === "outdoor";
            const rec = isRainy ? !isOutdoor : isOutdoor;
            return {
              ...a,
              hotel_type: isOutdoor ? "Resort Hotel" : "City Hotel",
              recommended: rec,
              locked: !rec,
              lock_reason: `Locked: Recommended for weather compatibility only.`,
            };
          });
          setActivityList(acts);
        }
        if (isMounted) setIsLoadingWeather(false);

        let targetActName = activityParam || initialMatch?.name || selectedActivity;
        const matchingAct = acts.find((a) => a.name === targetActName) || acts.find((a) => a.recommended) || acts[0];
        if (matchingAct) {
          targetActName = matchingAct.name;
          setSelectedActivity(targetActName);
        }

      } catch (error) {
        console.warn("Destination data is unavailable from the backend.", error);
        if (isMounted) {
          setDestinationError(error.message || "Destination details are unavailable.");
          setIsLoading(false);
          setIsLoadingWeather(false);
        }
      }
    };

    loadDestinationAndWeather();
    return () => {
      isMounted = false;
    };
  }, [pricingDate, searchParams, startDate, endDate, guests, tripReady]);

  useEffect(() => {
    if (!tripReady || !destinationDetails || !selectedActivityData) return undefined;

    let isCurrentRequest = true;
    const predictHotelPrice = async () => {
      setIsEstimatingHotel(true);
      setHotelEstimate(null);
      try {
        const activityHotelType = selectedActivityData.hotel_type
          || (selectedActivityData.type === "outdoor" ? "Resort Hotel" : "City Hotel");
        const priceResponse = await fetch("/api/backend/predict-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            check_in: startDate,
            check_out: endDate,
            guests,
            destination: destinationDetails.name,
            hotel_type: activityHotelType,
            room_type: roomType,
          }),
        });
        const priceText = await priceResponse.text();
        let priceData;
        try {
          priceData = priceText ? JSON.parse(priceText) : {};
        } catch {
          throw new Error(`Price service returned an invalid response (${priceResponse.status}).`);
        }

        if (!priceResponse.ok) {
          throw new Error(priceData.detail || "Hotel price service is unavailable.");
        }
        if (priceData.status === "success" && priceData.total_price != null) {
          if (isCurrentRequest) setHotelEstimate(priceData);
        } else if (isCurrentRequest) {
          setHotelEstimate(null);
        }
      } catch (error) {
        console.warn("Hotel MLR prediction failed", error);
        if (isCurrentRequest) setHotelEstimate(null);
      } finally {
        if (isCurrentRequest) setIsEstimatingHotel(false);
      }
    };

    predictHotelPrice();
    return () => {
      isCurrentRequest = false;
    };
  }, [
    destinationDetails,
    endDate,
    guests,
    roomType,
    selectedActivityData,
    startDate,
    tripReady,
  ]);

  const addToPlanner = () => {
    if (!generateDateRange(startDate, endDate).includes(pricingDate)) {
      setToastMessage("Choose a valid trip day before adding this activity.");
      return;
    }
    if (!isValidActivityTime(selectedTime)) {
      setToastMessage("Choose an activity time between 6:00 AM and 11:00 PM.");
      return;
    }
    const currentActivitiesList = activityList.length > 0 ? activityList : (destinationDetails.activities || []);
    const activity = currentActivitiesList.find((item) => item.name === selectedActivity) || currentActivitiesList[0];
    
    // Multiple activities are now fully allowed on any day
    const latitude = Number(activity?.exact_latitude ?? destinationDetails.latitude);
    const longitude = Number(activity?.exact_longitude ?? destinationDetails.longitude);
    const selected = {
      ...activity,
      destination: destinationDetails.name,
      exact_latitude: Number.isFinite(latitude) ? latitude : null,
      exact_longitude: Number.isFinite(longitude) ? longitude : null,
      assignedDay,
      assigned_day: assignedDay,
      guests,
      time: selectedTime,
      roomType,
      price_per_pax: rawPricePerGuest,
      price_display: selectedPriceDisplay,
      real_price_php: selectedPricingTier?.price ?? activity.real_price_php,
      selected_pricing_tier: selectedPricingTier || null,
      image: selectedActivityImage,
      weather: weatherForecast?.condition || destinationDetails.main_weather || "Clear / Sunny",
      weather_forecast: weatherForecast,
    };
    
    addActivity(selected);
    setDateRange({ startDate, endDate });
    setToastMessage("Activity added to your itinerary.");
    window.setTimeout(() => setToastMessage(""), 3000);
  };

  if (!destinationDetails) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFDF7] text-sm font-bold text-slate-600">
        Loading destination details…
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-[#fcfcfd] text-slate-900">
      
      <Header />

      <main className="mx-auto w-full max-w-[1400px] px-6 lg:px-12 py-10 flex-grow">
        {destinationError ? (
          <div role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            <p>Could not load this destination: {destinationError}</p>
            <Link href="/destinations" className="mt-2 inline-block underline">Browse available destinations</Link>
          </div>
        ) : null}
        
        <div className="flex flex-col lg:flex-row gap-12 items-start mb-16">
          
          
          <div className="flex-1 flex flex-col w-full max-w-4xl relative">

            <div className="relative w-full h-[300px] lg:h-[400px] overflow-hidden rounded-[2rem] shadow-sm mb-8 bg-gray-100">
  
              {/* Floating Glass Back Button */}
              <Link 
                href="/destinations"
                className="absolute top-4 left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md transition-all hover:bg-black/40 hover:scale-105 shadow-sm"
                title="Back to destinations"
              >
                <ChevronLeft className="w-6 h-6 ml-[-2px]" />
              </Link>

              <img 
                key={`${destinationQuery}-${selectedActivity}-${selectedActivityImage}`} 
                src={selectedActivityImage} 
                alt={selectedActivity || destinationDetails.name} 
                onError={(event) => applyImageFallback(event, activityFallbackImage(selectedActivityData, destinationDetails))} 
                className="h-full w-full object-cover" 
              />
            </div>
            
            <div className="flex flex-col px-2 sm:px-4">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-[#fdb52a] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">Top Match</span>
                <span className="text-sm text-gray-500 flex items-center gap-1 font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  {destinationDetails.location}
                </span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black text-[#0f172a] mb-2 tracking-tight">
                {selectedActivity || destinationDetails.name}
              </h1>
              <p className="mb-8 text-base leading-relaxed text-gray-700">
                {selectedDataQualityNotes || destinationDetails.description}
              </p>
              
              

              {/* UNIFIED ACTIVITY SUMMARY CARD */}
              <div className="mb-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-6 text-sm">
                  {/* Duration */}
                  {activityDurationLabel ? (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Duration</span>
                      <span className="font-semibold text-slate-800">{activityDurationLabel}</span>
                    </div>
                  ) : null}

                  {/* Base Price */}
                  {!selectedActivityIsFree && staticBasePriceText ? (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Base Price</span>
                      <span className="font-semibold text-slate-800">{staticBasePriceText} / person</span>
                    </div>
                  ) : null}

                  {/* Source Data */}
                  {selectedActivityData?.source_url ? (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Source Data</span>
                      <a href={selectedActivityData.source_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#4a8b8b] hover:underline line-clamp-1">
                        {selectedActivityData.source_type || "External Link"}
                      </a>
                    </div>
                  ) : null}
                </div>

                {/* Unified Amenities & Promos List */}
                {(amenities.length > 0 || promos.length > 0) && (
                  <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {amenities.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                          Amenities & Inclusions
                        </p>
                        <ul className="space-y-1.5">
                          {amenities.map(item => (
                            <li key={item} className="flex items-start gap-2 text-xs text-slate-700">
                              <span className="text-slate-300 mt-0.5">•</span>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {promos.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-2">
                          Promos & Discounts
                        </p>
                        <ul className="space-y-1.5">
                          {promos.map(item => (
                            <li key={item} className="flex items-start gap-2 text-xs text-slate-700">
                              <span className="text-amber-300 mt-0.5">•</span>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              

              {/* NEXT DESTINATIONS ROW */}
              {nearbyDestinations.length > 0 && (
                <div>
                  <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Nearby Destinations</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {nearbyDestinations.slice(0, 3).map((dest) => (
                      <NearbyCard key={dest.id} destination={dest} />
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

          

          <div className="w-full lg:w-[400px] xl:w-[440px] shrink-0 sticky top-28 pt-2">

            {/* MOVED: Compact Pop-Over Trip Details Pill */}
            <div className="mb-4 relative z-40 w-full">
              <div className="relative w-full text-left">
                <button
                  type="button"
                  onClick={() => setIsOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-[#860001] hover:shadow-md active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Trip Details
                    </span>
                    <span className="text-slate-300 font-light">|</span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <span>{displayRange || "Select dates"}</span>
                      <span className="text-slate-400">•</span>
                      <span>{guests} {guests === 1 ? 'Guest' : 'Guests'}</span>
                    </div>
                  </div>

                  {/* Chevron Icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#860001]' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {/* Expandable Compact Pop-Over Dropdown */}
                {isOpen && (
                  <div className="absolute right-0 z-50 mt-2 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150 w-[310px]">
                    
                    {/* DATE RANGE ROW */}
                    <div className="flex items-center justify-between gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-1.5">
                      <div className="flex flex-1 items-center gap-1 min-w-0">
                        <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">In</span>
                        <input
                          type="date"
                          min={minDate}
                          value={startDate}
                          onChange={(event) => {
                            const nextStartDate = event.target.value;
                            const nextEndDate = endDate < nextStartDate ? nextStartDate : endDate;
                            setStartDate(nextStartDate);
                            setEndDate(nextEndDate);
                            if (setDateRange) setDateRange({ startDate: nextStartDate, endDate: nextEndDate });
                          }}
                          className="w-full cursor-pointer bg-transparent text-xs font-semibold text-slate-800 outline-none p-0"
                        />
                      </div>

                      <span className="text-slate-300 font-light text-xs shrink-0">/</span>

                      <div className="flex flex-1 items-center gap-1 min-w-0">
                        <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">Out</span>
                        <input
                          type="date"
                          min={startDate || minDate}
                          value={endDate}
                          onChange={(event) => {
                            const nextEndDate = event.target.value;
                            setEndDate(nextEndDate);
                            if (setDateRange) setDateRange({ startDate, endDate: nextEndDate });
                          }}
                          className="w-full cursor-pointer bg-transparent text-xs font-semibold text-slate-800 outline-none p-0"
                        />
                      </div>
                    </div>

                    {/* GUESTS & APPLY ROW */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-1 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400">
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          <span className="text-xs font-bold text-slate-800">
                            {guests} {guests === 1 ? "Guest" : "Guests"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" aria-label="Decrease guests" onClick={() => setGuests((prev) => Math.max(1, prev - 1))} className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-xs font-bold text-slate-600 transition hover:bg-slate-200 active:scale-95">-</button>
                          <button type="button" aria-label="Increase guests" onClick={() => setGuests((prev) => prev + 1)} className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-xs font-bold text-slate-600 transition hover:bg-slate-200 active:scale-95">+</button>
                        </div>
                      </div>
                      <button type="button" onClick={() => setIsOpen(false)} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-[#FFFDF7] transition hover:bg-[#860001] shadow-sm shrink-0">
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-gray-100 bg-white p-6 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)] relative z-10">
              
              <div className="mb-6 pb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                  {tripTotalText
                    ? "Estimated Total Trip Cost"
                    : selectedActivityIsFree ? "Activity admission" : "Activity cost"}
                </p>
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-[2rem] font-black text-[#0f172a]">
                      {tripTotalText
                        ? tripTotalText
                        : selectedActivityIsFree
                        ? "Free"
                        : isLoading
                        ? "Loading..."
                        : selectedPriceText}
                    </h3>
                    {tripTotalText && perPersonTripText ? (
                      <span className="text-sm text-gray-500 font-medium">
                        {perPersonTripText} / person
                      </span>
                    ) : !selectedActivityIsFree && activityTotalPrice != null && selectedPriceText ? (
                      <span className="text-sm text-gray-500 font-medium">
                        total for {guests} {guests === 1 ? 'guest' : 'guests'}
                      </span>
                    ) : null}
                  </div>
                  
                  {!tripTotalText && !selectedActivityIsFree && staticBasePriceText && selectedPriceText ? (
                    <span className="mt-1 text-xs font-semibold text-slate-400">
                      Base price: {staticBasePriceText} / person
                    </span>
                  ) : null}
                </div>
              

                {/* Weather Forecast & Recommendation Badge */}
                {weatherForecast ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Destination Weather</span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border ${getPAGASABadgeColor(weatherForecast.condition)}`}>
                        <WeatherIcon condition={weatherForecast.condition} className="h-4 w-4" />
                        {weatherForecast.condition}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-baseline justify-between gap-1 text-xs font-medium text-slate-700">
                      <span>Temp: {weatherForecast.average_temperature}°C</span>
                      <span>Rain chance: {weatherForecast.precipitation_probability == null ? "Unavailable" : `${weatherForecast.precipitation_probability}%`}</span>
                      <span>{weatherForecast.precipitation_sum_mm ?? "-"} mm expected</span>
                    </div>

                    <div className="mt-2 rounded-xl bg-white p-2.5 border border-slate-100">
                      <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                        {recommendedType === "outdoor" ? "Outdoor Activities Recommended" : "Indoor Activities Recommended"}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                        {recommendationReason}
                      </p>
                      {weatherComparison?.summary ? (
                        <p className="mt-1.5 text-[10px] italic text-slate-400">
                          {weatherComparison.summary}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : isLoadingWeather ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" role="status" aria-live="polite">
                    <div className="h-3 w-40 animate-pulse rounded bg-slate-200" />
                    <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-200" />
                    <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                    <span className="sr-only">Loading weather prediction for {formatDate(pricingDate)}...</span>
                  </div>
                ) : null}

                {/* CONDITIONAL ESTIMATION CONTAINER */}
                {(isEstimatingHotel || accommodationNightlyTotal != null || hotelEstimate) ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      {accommodationNightlyTotal != null ? "Selected Accommodation Cost" : "MLR Accommodation Estimate"}
                    </p>
                    
                    {isEstimatingHotel ? (
                      <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500" role="status" aria-live="polite">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[#4a8b8b]" aria-hidden="true" />
                        Predicting…
                      </p>
                    ) : accommodationNightlyTotal != null ? (
                      <div>
                        <h4 className="text-xl font-black text-[#0f172a]">
                          PHP {totalAccommodationCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h4>
                        <p className="text-xs font-medium text-slate-500 mb-2">Exact dataset rate for {stayNights} {stayNights === 1 ? "night" : "nights"}</p>
                        <div className="flex flex-col gap-1 text-[11px] text-slate-600">
                          <p className="flex justify-between"><span>Selected room:</span> <span className="text-right font-semibold text-slate-800">{selectedPricingTier?.room_type || roomType}</span></p>
                          <p className="flex justify-between"><span>Room rate:</span> <span className="font-semibold text-slate-800">PHP {hotelRatePerNight.toLocaleString()} / night</span></p>
                          <p className="flex justify-between"><span>Occupancy:</span> <span className="font-semibold text-slate-800">{hotelOccupancyPax} pax / room</span></p>
                          <p className="flex justify-between"><span>Rooms required:</span> <span className="font-semibold text-slate-800">{hotelRoomsRequired}</span></p>
                          <p className="flex justify-between"><span>Accommodation / person for stay:</span> <span className="font-semibold text-slate-800">{exactAccommodationPerPersonText}</span></p>
                          <p className="flex justify-between"><span>Per-pax nightly rate:</span> <span className="font-semibold text-slate-800">PHP {perPaxNightlyAccommodationCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                        </div>
                      </div>
                    ) : hotelEstimate ? (
                      <div>
                        <h4 className="text-xl font-black text-[#0f172a]">PHP {hotelEstimate.total_price.toLocaleString()}</h4>
                        <p className="text-xs font-medium text-slate-500 mb-2">Total for {hotelEstimate.length_of_stay} nights</p>
                        <div className="flex flex-col gap-1 text-[11px] text-slate-600">
                          <p className="flex justify-between"><span>Selected room:</span> <span className="text-right font-semibold text-slate-800">{roomType}</span></p>
                          <p className="flex justify-between"><span>Base Rate:</span> <span className="font-semibold text-slate-800">PHP {hotelEstimate.base_price.toLocaleString()}</span></p>
                          <p className="flex justify-between"><span>MLR Surge Multiplier:</span> <span className="font-bold text-[#860001]">{hotelEstimate.surge_multiplier}x</span></p>
                          <p className="text-[9px] text-[#4a8b8b] italic mt-1 text-right">{hotelEstimate.source}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              
              </div>

              <div className="mb-2 grid w-full grid-cols-1 gap-6">
                
                <div>
                  <div className="mt-1">
                    <label htmlFor="room-type" className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-400">Room type</label>
                    <select
                      id="room-type"
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value)}
                      className="h-[48px] w-full appearance-none rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-gray-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    >
                      {roomOptions.map((option) => (
                        <option key={option.room_type} value={option.room_type}>{option.room_type}</option>
                      ))}
                    </select>
                  </div>

                  <AssignDaySelect
                    dates={generateDateRange(startDate, endDate)}
                    assignedDay={assignedDay}
                    currentActivities={currentActivities}
                    assignedDayTaken={assignedDayTaken}
                    onChange={handleAssignedDayChange}
                    formatDate={formatDate}
                  />
                  
                  {/* Advisory note allowing multi-activity scheduling */}
                  {assignedDayTaken ? (
                    <p className="mb-3 text-[11px] font-semibold text-blue-700">
                      Note: {assignedDay} already has an activity. You can add multiple activities per day, but please consider travel distance and transit time between locations!
                    </p>
                  ) : null}

                  <div className="mt-1 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <ActivityTimePicker
                        value={selectedTime}
                        onChange={setSelectedTime}
                        minTime={operatingHoursPublished ? selectedActivityData.opening_time : undefined}
                        maxTime={operatingHoursPublished ? selectedActivityData.closing_time : undefined}
                        className="min-w-0"
                      />
                      <div className="flex h-[48px] items-center justify-between rounded-xl border border-gray-300 px-4">
                        <span className="text-sm font-medium text-slate-700">Guests</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={handleMinus} className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100">-</button>
                          <span className="w-4 text-center font-bold text-slate-800">{guests}</span>
                          <button type="button" onClick={handlePlus} className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100">+</button>
                        </div>
                      </div>
                    </div>
                    {operatingHoursPublished ? (
                      <p className="text-xs font-semibold text-slate-500">
                        Operating hours: {openingTime}–{closingTime}
                      </p>
                    ) : (
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                        Operating hours: {operatingHoursNote || "Not published — please verify locally."}
                      </p>
                    )}
                    {operatingDayWarning ? (
                      <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
                        {operatingDayWarning}
                      </p>
                    ) : null}
                    {hotelTimeWarning ? (
                      <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                        {hotelTimeWarning}
                      </p>
                    ) : null}
                    {guestWarning ? <p className="text-xs font-semibold text-amber-600">{guestWarning}</p> : null}
                </div>
              </div>
              </div>

              <button onClick={addToPlanner} type="button" className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#58a573] hover:bg-[#4d9064] px-8 py-3.5 text-base font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                Add to Itinerary
              </button>
              <Link href="/final-planner" className="mb-6 block text-center text-sm font-black text-[#4a8b8b] underline">Open itinerary planner</Link>

              {toastMessage ? (
                <div role="status" className="fixed bottom-6 right-6 z-[60] rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">
                  {toastMessage}
                </div>
              ) : null}

              {/* Sync Notice with Hover Tooltip */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#58a573]">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  <span>Synced with Planner</span>
                </div>

                {/* Hoverable Information Icon */}
                <div className="group relative cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 hover:text-slate-600 transition-colors">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>

                  {/* Tooltip Content */}
                  <div className="pointer-events-none absolute bottom-full right-0 mb-2 w-64 opacity-0 transition-opacity duration-200 group-hover:opacity-100 z-30">
                    <div className="rounded-xl bg-slate-900 p-3 text-[11px] text-white shadow-xl leading-relaxed">
                      This location, date, and guest count will automatically populate into your group&apos;s shared itinerary board. No payments are processed on this page.
                      <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-8 w-full rounded-[2rem] border border-gray-100 bg-white p-4 shadow-[0_12px_40px_rgba(0,0,0,0.06)] sm:p-6">
          <h2 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-500">Destination map</h2>
          <DynamicMap
            activities={[{
              name: selectedActivity || destinationDetails.name,
              type: selectedActivityData?.type || "Activity",
              exact_latitude: Number(selectedActivityData?.exact_latitude ?? destinationDetails.latitude ?? 14.5995),
              exact_longitude: Number(selectedActivityData?.exact_longitude ?? destinationDetails.longitude ?? 120.9842),
            }]}
            routeSegments={[]}
          />
        </section>

      </main>

      <Footer />
    </div>
  );
}

export default function SpecificDestinationsPage() {
  return <Suspense fallback={<PageSkeleton />}><SpecificDestinationsContent /></Suspense>;
}