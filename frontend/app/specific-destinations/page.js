"use client";
import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Footer from "../footer/Footer";
import { useTravel } from "../TravelContext";
import { getGuestWarning, getMinSelectableDate, toDateString } from "../tripUtils";

const mainImage =
  "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1400&q=80";

const activityFallbackImage = (activity, destination) => {
  const name = `${activity?.name || ""} ${activity?.type || ""}`.toLowerCase();
  if (/food|seafood|culinary|dining|tasting|manokan|oyster/.test(name)) return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80";
  if (/museum|gallery|art|heritage|cultural/.test(name)) return "https://images.unsplash.com/photo-1564399579883-451a5d44ec08?auto=format&fit=crop&w=1200&q=80";
  if (/boat|island|beach|falls|nature|park|hiking|walking/.test(name)) return "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";
  return destination.image;
};
const activityImage = (activity, destination) => activity?.image || activityFallbackImage(activity, destination);

const FALLBACK_DESTINATION = {
  id: "alaminos",
  name: "Alaminos",
  location: "Alaminos, Philippines",
  country: "Philippines",
  main_weather: "Sunny",
  image: mainImage,
  description: "Discover scenic attractions, cultural landmarks, and local experiences in Alaminos.",
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
  const occupiedDays = new Set(activities.map((activity) => activity.assignedDay));
  const afterIndex = Number(afterDay.replace("Day ", "")) - 1;
  const startIndex = afterIndex >= 0 ? afterIndex + 1 : 0;
  const order = [...dates.keys()].slice(startIndex).concat([...dates.keys()].slice(0, startIndex));
  const nextIndex = order.find((index) => !occupiedDays.has(`Day ${index + 1}`));
  return nextIndex === undefined ? "" : `Day ${nextIndex + 1}`;
};

const formatTimeOption = (time) => {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
};

const ACTIVITY_TIMES = Array.from({ length: 69 }, (_, index) => {
  const minutes = 6 * 60 + index * 15;
  const hour = Math.floor(minutes / 60);
  return `${String(hour).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

function NearbyCard({ destination }) {
  const activity = destination.activities?.[0];
  const title = activity?.name || destination.name;
  const image = activityImage(activity, destination);
  const weatherTag = activity?.weather_tag || destination.main_weather || "Sunny";
  return (
    <Link href={`/specific-destinations?id=${destination.id}${activity ? `&activity=${encodeURIComponent(activity.name)}` : ""}`} className="group relative block h-32 overflow-hidden rounded-xl shadow-sm">
      <img src={image} alt={title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
      <span className="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold uppercase text-white">{weatherTag} chance</span>
      <div className="absolute bottom-2 left-2 right-2">
        <p className="line-clamp-2 text-xs font-bold leading-snug text-white">{title}</p>
        <p className="text-[10px] text-white/80">{destination.name}</p>
      </div>
    </Link>
  );
}

function SpecificDestinationsContent() {
  const { dateRange, setDateRange, guests, setGuests, addActivity, currentActivities, hasActivityConflict } = useTravel();
  const searchParams = useSearchParams();
  const [tripReady, setTripReady] = useState(false);
  const minDate = getMinSelectableDate();

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
  const [failedActivityImage, setFailedActivityImage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [predictedPrice, setPredictedPrice] = useState("...");
  const [priceError, setPriceError] = useState("");
  const [pricingDetails, setPricingDetails] = useState(null);
  const [weatherForecast, setWeatherForecast] = useState(null);
  const [recommendedType, setRecommendedType] = useState("outdoor");
  const [recommendationReason, setRecommendationReason] = useState("");
  const [weatherComparison, setWeatherComparison] = useState(null);
  
  const [destinationDetails, setDestinationDetails] = useState(FALLBACK_DESTINATION);
  const [activityList, setActivityList] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState("Scenic landmarks and nature park tour");
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
    || destinationDetails.activities?.find((activity) => activity.name === selectedActivity);
  const requestedActivityImage = activityImage(selectedActivityData, destinationDetails);
  const selectedActivityImage = failedActivityImage === requestedActivityImage ? activityFallbackImage(selectedActivityData, destinationDetails) : requestedActivityImage;

  const guestWarning = getGuestWarning(guests);
  const assignedDayTaken = hasActivityConflict({ assignedDay });

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
    const assignedIndex = Number(assignedDay.replace("Day ", "")) - 1;
    if (dates.length && (assignedIndex < 0 || assignedIndex >= dates.length)) setAssignedDay(`Day ${dates.length}`);
    if (dates.length && !dates.includes(pricingDate)) setPricingDate(dates[0]);
  }, [assignedDay, endDate, pricingDate, startDate]);

  useEffect(() => {
    setTripReady(true);
  }, []);

  useEffect(() => {
    if (!tripReady) return;
    const currentQuery = new URLSearchParams(searchParams.toString());
    const destinationId = currentQuery.get("id") || FALLBACK_DESTINATION.id;
    const activityParam = currentQuery.get("activity");
    let isMounted = true;
    setIsLoading(true);

    const loadDestinationAndWeather = async () => {
      setWeatherForecast(null);
      setWeatherComparison(null);
      setRecommendationReason("");
      const { MOCK_DESTINATIONS } = await import("../destinations/mockDestinations");
      const mockDestination = MOCK_DESTINATIONS.find((destination) => destination.id === destinationId) || MOCK_DESTINATIONS[0] || FALLBACK_DESTINATION;
      if (!isMounted) return;
      setDestinationDetails(mockDestination);
      const nearby = MOCK_DESTINATIONS.filter((destination) => destination.id !== mockDestination.id);
      for (let index = nearby.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [nearby[index], nearby[swapIndex]] = [nearby[swapIndex], nearby[index]];
      }
      setNearbyDestinations(nearby.slice(0, 4));

      try {
        // Fetch priority Open-Meteo forecast and activity recommendations
        let destinationResponse;
        let destination = mockDestination;
        try {
          destinationResponse = await fetch(`http://localhost:8000/destinations/${destinationId}`);
          if (destinationResponse.ok) destination = await destinationResponse.json();
        } catch (error) {
          console.warn("Destination details are unavailable; continuing with local data", error);
        }

        let forecastResponse;
        let forecastData = {};
        try {
          forecastResponse = await fetch(`http://localhost:8000/destinations/${destinationId}/forecast?date_str=${pricingDate || startDate}`);
          forecastData = forecastResponse.ok ? await forecastResponse.json() : {};
        } catch (error) {
          console.warn("Weather forecast is unavailable; continuing with destination pricing", error);
        }
        
        let acts = destination.activities || mockDestination.activities || [];
        if (forecastResponse?.ok && forecastData.activities && forecastData.activities.length > 0) {
          acts = forecastData.activities;
          setActivityList(forecastData.activities);
          setWeatherForecast(forecastData.forecast);
          setRecommendedType(forecastData.recommended_activity_type || "outdoor");
          setRecommendationReason(forecastData.activity_recommendation_reason || "");
          setWeatherComparison(forecastData.comparison || null);
        } else {
          const isRainy = (destination.main_weather || "").toLowerCase().includes("rain");
          acts = acts.map((a) => {
            const isOutdoor = a.type === "outdoor";
            const rec = isRainy ? !isOutdoor : isOutdoor;
            return {
              ...a,
              hotel_type: isOutdoor ? "Resort Hotel" : "City Hotel",
              recommended: rec,
              locked: !rec,
              lock_reason: `Locked: Recommended for ${isRainy ? "Rainy" : "Sunny/Cloudy"} weather only.`,
            };
          });
          setActivityList(acts);
        }

        // Determine target selected activity
        let targetActName = activityParam || selectedActivity;
        const matchingAct = acts.find((a) => a.name === targetActName) || acts.find((a) => a.recommended) || acts[0];
        if (matchingAct) {
          targetActName = matchingAct.name;
          setSelectedActivity(targetActName);
        }

        const chosenHotelType = matchingAct?.hotel_type || (matchingAct?.type === "outdoor" ? "Resort Hotel" : "City Hotel");

        const priceResponse = await fetch("http://localhost:8000/predict-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            check_in: pricingDate || startDate || toDateString(new Date()),
            check_out: (() => {
              const nextDate = new Date(`${pricingDate || startDate}T00:00:00`);
              nextDate.setDate(nextDate.getDate() + 1);
              return toDateString(nextDate);
            })(),
            guests,
            hotel_type: chosenHotelType,
            room_type: roomType,
          }),
        });
        const price = await priceResponse.json();

        if (isMounted && destination.id) {
          setDestinationDetails((current) => ({ ...current, ...destination }));
        }

        if (isMounted && priceResponse.ok && price.status === "success") {
          setPredictedPrice(price.total_price.toLocaleString());
          setPricingDetails(price);
          setPriceError("");
          setIsLoading(false);
        } else {
          throw new Error(price.detail || "Price prediction is unavailable.");
        }
      } catch (error) {
        console.warn("Using fallback destination data because the backend is unavailable", error);
        if (isMounted) {
          setPriceError("Price unavailable. Start the backend service to calculate the estimate.");
        }
        const acts = (mockDestination.activities || []).map((a) => ({
          ...a,
          hotel_type: a.type === "outdoor" ? "Resort Hotel" : "City Hotel",
          recommended: a.type === "outdoor",
          locked: a.type !== "outdoor",
          lock_reason: a.type !== "outdoor" ? "Locked: Recommended for rainy weather only." : null,
        }));
        setActivityList(acts);
        if (acts[0]) setSelectedActivity(acts[0].name);
        setIsLoading(false);
      }
    };

    loadDestinationAndWeather();
    return () => {
      isMounted = false;
    };
  }, [endDate, guests, pricingDate, roomType, searchParams, startDate, tripReady]);

  const addToPlanner = () => {
    if (!generateDateRange(startDate, endDate).includes(pricingDate)) {
      setToastMessage("Choose a valid trip day before adding this activity.");
      return;
    }
    if (selectedTime < "06:00" || selectedTime > "23:00") {
      setToastMessage("Choose an activity time between 6:00 AM and 11:00 PM.");
      return;
    }
    const currentActivitiesList = activityList.length > 0 ? activityList : (destinationDetails.activities || []);
    const activity = currentActivitiesList.find((item) => item.name === selectedActivity) || currentActivitiesList[0];
    if (hasActivityConflict({ ...activity, assignedDay })) {
      setToastMessage("This day already has an activity. Choose another day before adding this one.");
      window.setTimeout(() => setToastMessage(""), 3000);
      return;
    }
    const selected = {
      ...activity,
      destination: destinationDetails.name,
      assignedDay,
      assigned_day: assignedDay,
      guests,
      time: selectedTime,
      roomType,
      image: selectedActivityImage,
      weather: weatherForecast?.condition || destinationDetails.main_weather || "Sunny",
      weather_forecast: weatherForecast,
    };
    addActivity(selected);
    const nextDay = getNextAvailableDay(generateDateRange(startDate, endDate), [...currentActivities, selected], assignedDay);
    if (nextDay) {
      setAssignedDay(nextDay);
      const nextDate = generateDateRange(startDate, endDate)[Number(nextDay.replace("Day ", "")) - 1];
      if (nextDate) setPricingDate(nextDate);
    }
    setDateRange({ startDate, endDate });
    setToastMessage("Activity added to your itinerary.");
    window.setTimeout(() => setToastMessage(""), 3000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfcfd] text-slate-900">
      
      {/* HEADER WITH DYNAMIC DATE RANGE */}
      <header className="legacy-destination-header sticky top-0 z-50 flex h-20 items-center justify-between bg-white px-6 lg:px-12 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border-b border-gray-100">
        <div className="flex flex-1 items-center">
          <Link href="/">
            <img src="/LOGO-BLACK.svg" alt="Ano Tara Logo" className="h-10 w-auto object-contain cursor-pointer" />
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
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </Link>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
          <Link href="/predict-outfit" className="planner-nav-link hidden sm:inline-flex">
            Outfit Planner
          </Link>
          <Link href="/final-planner" className="planner-nav-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Itinerary Planner
          </Link>
        </div>
      </header>

      <div className="activity-date-strip border-b border-slate-200 bg-white px-6 py-4 lg:px-12">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Trip dates</p>
            <p className="text-sm font-semibold text-slate-700">Dates are shared with your itinerary.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-bold text-slate-500">Start<input type="date" min={minDate} value={startDate} onChange={(event) => { const nextStartDate = event.target.value; const nextEndDate = endDate < nextStartDate ? nextStartDate : endDate; setStartDate(nextStartDate); setEndDate(nextEndDate); setDateRange({ startDate: nextStartDate, endDate: nextEndDate }); }} className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800" /></label>
            <label className="text-xs font-bold text-slate-500">End<input type="date" min={startDate || minDate} value={endDate} onChange={(event) => { const nextEndDate = event.target.value; setEndDate(nextEndDate); setDateRange({ startDate, endDate: nextEndDate }); }} className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800" /></label>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1400px] px-6 lg:px-12 py-10 flex-grow">
        <Link href="/destinations" className="mb-6 inline-flex rounded-lg border-2 border-slate-900 px-4 py-2 text-sm font-black text-slate-900 transition hover:bg-slate-900 hover:text-white">Back to destinations</Link>
        
        <div className="flex flex-col lg:flex-row gap-12 items-start mb-16">
          
          <div className="flex-1 flex flex-col w-full max-w-4xl">
            <div className="w-full h-[400px] lg:h-[500px] overflow-hidden rounded-[2rem] shadow-sm mb-8 bg-gray-100">
              <img src={selectedActivityImage} alt={selectedActivity || destinationDetails.name} onError={(event) => { if (event.currentTarget.src !== activityFallbackImage(selectedActivityData, destinationDetails)) setFailedActivityImage(requestedActivityImage); else event.currentTarget.style.visibility = "hidden"; }} className="h-full w-full object-cover" />
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
              <p className="mb-8 text-lg leading-relaxed text-gray-700">
                {destinationDetails.description}
              </p>
              <div className="h-px w-full bg-gray-200 mb-8"></div>
              
              <div className="mt-2">
                <p className="text-sm font-bold uppercase tracking-wider text-gray-400">Total estimated cost</p>
                <h3 className="text-4xl font-black text-[#860001]">{isLoading ? "Predicting..." : priceError ? "Unavailable" : `PHP ${predictedPrice}`}</h3>
                {isLoading ? <p role="status" className="mt-2 text-sm font-semibold text-slate-500">Loading price prediction...</p> : null}
                {pricingDetails ? (
                  <p className="mt-2 text-sm text-gray-500">
                    PHP {pricingDetails.daily_price.toLocaleString()} / night for {pricingDetails.length_of_stay} {pricingDetails.length_of_stay === 1 ? "night" : "nights"}
                  </p>
                ) : null}
                <a href="#" className="mt-2 inline-block text-sm font-medium italic text-gray-500 underline transition-colors hover:text-[#76B3DD]">
                  look more here! Bookingsite.com
                </a>
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Next destinations</h2>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {nearbyDestinations.slice(0, 3).map((dest) => <NearbyCard key={dest.id} destination={dest} />)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[400px] xl:w-[440px] shrink-0 sticky top-28 pt-2">
            <div className="rounded-[2rem] border border-gray-100 bg-white p-6 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)] relative z-10">
              
              <div className="mb-6 pb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Estimated cost</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-[2rem] font-black text-[#0f172a]">{isLoading ? "Predicting..." : priceError ? "Unavailable" : `PHP ${predictedPrice}`}</h3>
                  <span className="text-sm text-gray-500 font-medium">total for {guests} {guests === 1 ? 'guest' : 'guests'}</span>
                </div>
                {pricingDetails ? (
                  <div className="mt-3 space-y-1 text-xs text-gray-500">
                    <p>PHP {pricingDetails.daily_price.toLocaleString()} / night · {pricingDetails.length_of_stay} {pricingDetails.length_of_stay === 1 ? "night" : "nights"}</p>
                    <p>Base daily rate: PHP {pricingDetails.base_price.toLocaleString()}</p>
                    <p>{pricingDetails.month} · {pricingDetails.season}</p>
                  </div>
                ) : null}

                {/* Weather Forecast & Recommendation Badge */}
                {weatherForecast ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Destination Weather</span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        weatherForecast.condition === 'Sunny'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : weatherForecast.condition === 'Rainy'
                          ? 'bg-sky-100 text-sky-800 border border-sky-200'
                          : 'bg-slate-200 text-slate-800 border border-slate-300'
                      }`}>
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
                ) : isLoading ? <p role="status" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">Loading weather prediction for {formatDate(pricingDate)}...</p> : null}
              </div>

              <div className="mb-6 grid w-full grid-cols-1 gap-6">
                
                <div>
                  <div className="mt-3">
                    <label htmlFor="room-type" className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-400">Room type</label>
                    <select
                      id="room-type"
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value)}
                      className="h-[48px] w-full appearance-none rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-gray-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    >
                      <option>Standard Room</option>
                      <option>Premium Suite</option>
                    </select>
                  </div>

                  <label className={`mt-3 mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${assignedDayTaken ? "border-amber-300 bg-amber-50/60 text-slate-700" : "border-gray-300 text-slate-700"}`}>
                    <span>
                      Assign to{assignedDayTaken ? " · taken" : ""}
                    </span>
                    <select
                      value={assignedDay}
                      onChange={(e) => handleAssignedDayChange(e.target.value)}
                      className={`max-w-[65%] rounded-lg border bg-white px-2 py-1 text-xs font-semibold outline-none focus:border-gray-400 ${assignedDayTaken ? "border-amber-200 text-slate-700" : "border-gray-200"}`}
                    >
                      {generateDateRange(startDate, endDate).map((date, index) => {
                        const dayLabel = `Day ${index + 1}`;
                        const taken = currentActivities.some((item) => item.assignedDay === dayLabel);
                        return (
                          <option key={date} value={dayLabel} className={taken ? "text-slate-400" : "text-slate-800"}>
                            {dayLabel} · {formatDate(date)}{taken ? " (selected)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  {assignedDayTaken ? (
                    <p className="mb-3 text-[11px] font-semibold text-amber-700 opacity-70">
                      An activity is already assigned to {assignedDay}. Choose another day or replace it in the itinerary planner.
                    </p>
                  ) : null}

                  <div className="mt-1 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-3 hover:border-gray-400 transition-colors cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 shrink-0">
                          <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <select
                          aria-label="Activity time"
                          value={selectedTime}
                          onChange={(e) => setSelectedTime(e.target.value)}
                          className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
                        >
                          {ACTIVITY_TIMES.map((time) => <option key={time} value={time}>{formatTimeOption(time)}</option>)}
                        </select>
                      </div>
                      <div className="flex h-[48px] items-center justify-between rounded-xl border border-gray-300 px-4">
                        <span className="text-sm font-medium text-slate-700">Guests</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={handleMinus} className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100">-</button>
                          <span className="w-4 text-center font-bold text-slate-800">{guests}</span>
                          <button type="button" onClick={handlePlus} className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100">+</button>
                        </div>
                      </div>
                    </div>
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

              <div className="rounded-xl bg-[#f8fafc] p-4 flex items-start gap-3 border border-gray-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#58a573] mt-0.5 flex-shrink-0">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <div>
                  <p className="text-xs font-semibold text-slate-800 mb-1">Synced with Itinerary Planner</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed max-w-lg">
                    This location, date, and guest count will automatically be populated into your group's shared itinerary board. No payments are processed on this page.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}

export default function SpecificDestinationsPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm font-bold text-slate-600">Loading destination details...</div>}><SpecificDestinationsContent /></Suspense>;
}
