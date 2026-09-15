"use client";

import React from "react";
import Image from "next/image";
import { MapPin, Sun, CloudRain, CloudSun, Shirt, DollarSign, TrendingUp, Sparkles, Clock } from "lucide-react";

export const SAMPLE_ACTIVITIES = [
  {
    id: "act-1",
    activityName: "Hundred Islands Boat Tour & Snorkeling",
    time: "08:30 AM — 12:00 PM",
    badge: "ACTIVITY 01",
    location: "Lucap Wharf, Alaminos City, Pangasinan",
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Hundred Islands boat excursion",
    rotationClass: "-rotate-2",
    insights: {
      weather: {
        label: "Decision Tree",
        status: "Sunny & Calm (31°C)",
        icon: "🌤️",
        accent: "bg-amber-50 text-amber-900 border-amber-200",
      },
      apparel: {
        label: "CNN Model",
        status: "Rashguard & Quick-dry Shorts",
        icon: "👕",
        accent: "bg-emerald-50 text-emerald-900 border-emerald-200",
      },
      pricing: {
        label: "MLR Model",
        status: "Standard Base (₱1,200)",
        icon: "💰",
        accent: "bg-sky-50 text-sky-900 border-sky-200",
      },
    },
  },
  {
    id: "act-2",
    activityName: "Genting SkyWorlds & Cable Car Ride",
    time: "01:30 PM — 05:00 PM",
    badge: "ACTIVITY 02",
    location: "Genting Highlands Summit, Pahang",
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Scenic mountain cable car view",
    rotationClass: "rotate-3",
    insights: {
      weather: {
        label: "Decision Tree",
        status: "Cool & Misting (21°C)",
        icon: "⛅",
        accent: "bg-blue-50 text-blue-900 border-blue-200",
      },
      apparel: {
        label: "CNN Model",
        status: "Light Windbreaker / Hoodie",
        icon: "🧥",
        accent: "bg-indigo-50 text-indigo-900 border-indigo-200",
      },
      pricing: {
        label: "MLR Model",
        status: "+15% Peak Surge (₱2,450)",
        icon: "📈",
        accent: "bg-amber-50 text-amber-900 border-amber-200",
      },
    },
  },
  {
    id: "act-3",
    activityName: "Cultural Heritage & Street Food Tasting",
    time: "06:00 PM — 08:30 PM",
    badge: "ACTIVITY 03",
    location: "Central Market & Jalan Alor Night Bazaar",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Night market street food vibrant stalls",
    rotationClass: "-rotate-1",
    insights: {
      weather: {
        label: "Decision Tree",
        status: "Scattered Showers (27°C)",
        icon: "🌧️",
        accent: "bg-cyan-50 text-cyan-900 border-cyan-200",
      },
      apparel: {
        label: "CNN Model",
        status: "Breathable Cotton & Umbrella",
        icon: "👕",
        accent: "bg-teal-50 text-teal-900 border-teal-200",
      },
      pricing: {
        label: "MLR Model",
        status: "Off-Peak Saver (₱650)",
        icon: "🏷️",
        accent: "bg-emerald-50 text-emerald-900 border-emerald-200",
      },
    },
  },
  {
    id: "act-4",
    activityName: "Sunset Skyline Deck & Souvenir Walk",
    time: "05:00 PM — 07:30 PM",
    badge: "ACTIVITY 04",
    location: "Petronas Twin Towers & KLCC Park",
    image: "https://images.unsplash.com/photo-1508964942454-1a56651d54ac?auto=format&fit=crop&w=800&q=80",
    imageAlt: "City skyline towers view",
    rotationClass: "rotate-2",
    insights: {
      weather: {
        label: "Decision Tree",
        status: "Clear Evening (28°C)",
        icon: "🌇",
        accent: "bg-orange-50 text-orange-900 border-orange-200",
      },
      apparel: {
        label: "CNN Model",
        status: "Smart Casual / Light Jacket",
        icon: "👔",
        accent: "bg-purple-50 text-purple-900 border-purple-200",
      },
      pricing: {
        label: "MLR Model",
        status: "Standard Base (₱1,800)",
        icon: "💰",
        accent: "bg-sky-50 text-sky-900 border-sky-200",
      },
    },
  },
];

export default function ItineraryOverview({
  activities = SAMPLE_ACTIVITIES,
  title = "Itinerary Overview",
  subtitle = "SEE WHAT'S AHEAD IN",
}) {
  return (
    <section className="relative w-full overflow-hidden py-8 sm:py-12 px-3 sm:px-6">
      {/* Travel Brochure Header */}
      <div className="mx-auto max-w-4xl text-center mb-8 sm:mb-12">
        <span className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.25em] text-slate-700 block mb-1">
          {subtitle}
        </span>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black italic tracking-tight text-[#d9383a] drop-shadow-sm font-serif">
          {title}
        </h1>
        <div className="mx-auto mt-2 h-1 w-20 rounded-full bg-[#d9383a]/30" />
      </div>

      {/* Vertical List of Activity Cards */}
      <div className="mx-auto max-w-4xl space-y-7 sm:space-y-9">
        {activities.map((activity, index) => {
          // Fallback rotation classes cycling if not provided
          const rotations = ["-rotate-2", "rotate-3", "-rotate-1", "rotate-2"];
          const rotationClass = activity.rotationClass || rotations[index % rotations.length];

          return (
            <div
              key={activity.id || `activity-${index}`}
              className="group relative flex items-center w-full min-h-[170px] sm:min-h-[190px]"
            >
              {/* Left Side: Text Box (softly colored, rounded rectangle taking ~70-75% width) */}
              <div className="w-[78%] sm:w-[74%] md:w-[72%] rounded-2xl bg-[#f8f5ee] border border-[#ebe4d6] shadow-sm hover:shadow-md transition-all duration-300 p-4 sm:p-5 md:p-6 pr-12 sm:pr-20 md:pr-28 relative z-0">
                {/* Header: Activity Name and Time */}
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 border-b border-[#e6dece] pb-2.5">
                  <div className="flex items-center gap-2">
                    {activity.badge && (
                      <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase text-[#1e3a5f] bg-[#e3ecf6] px-2 py-0.5 rounded-md">
                        {activity.badge}
                      </span>
                    )}
                    <h3 className="text-base sm:text-lg md:text-xl font-black text-[#1e3a5f] tracking-tight leading-snug">
                      {activity.activityName || activity.name}
                    </h3>
                  </div>

                  {activity.time && (
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 shrink-0">
                      <Clock className="w-3.5 h-3.5 text-[#1e3a5f]" />
                      <span>{activity.time}</span>
                    </div>
                  )}
                </div>

                {/* Location with Pin Icon */}
                <div className="mt-2.5 flex items-start gap-1.5 text-xs sm:text-sm text-slate-700">
                  <MapPin className="w-4 h-4 text-[#d9383a] shrink-0 mt-0.5" />
                  <span className="font-semibold leading-tight text-slate-800">
                    {activity.location || activity.destination}
                  </span>
                </div>

                {/* System Insights Grid: Weather, Apparel, Price */}
                {activity.insights && (
                  <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* 🌤️ Weather Prediction (Decision Tree) */}
                    {activity.insights.weather && (
                      <div className={`rounded-xl border p-2 flex flex-col justify-between ${activity.insights.weather.accent || "bg-amber-50/90 border-amber-200 text-amber-950"}`}>
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-900/70">
                          <span>Weather (DT)</span>
                          <span className="text-sm">{activity.insights.weather.icon || "🌤️"}</span>
                        </div>
                        <p className="mt-0.5 text-xs font-bold leading-tight">
                          {activity.insights.weather.status}
                        </p>
                      </div>
                    )}

                    {/* 👕 Apparel Recommendation (CNN) */}
                    {activity.insights.apparel && (
                      <div className={`rounded-xl border p-2 flex flex-col justify-between ${activity.insights.apparel.accent || "bg-emerald-50/90 border-emerald-200 text-emerald-950"}`}>
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-900/70">
                          <span>Apparel (CNN)</span>
                          <span className="text-sm">{activity.insights.apparel.icon || "👕"}</span>
                        </div>
                        <p className="mt-0.5 text-xs font-bold leading-tight">
                          {activity.insights.apparel.status}
                        </p>
                      </div>
                    )}

                    {/* 💰 Price Surge Status (MLR) */}
                    {activity.insights.pricing && (
                      <div className={`rounded-xl border p-2 flex flex-col justify-between ${activity.insights.pricing.accent || "bg-sky-50/90 border-sky-200 text-sky-950"}`}>
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-sky-900/70">
                          <span>Price (MLR)</span>
                          <span className="text-sm">{activity.insights.pricing.icon || "💰"}</span>
                        </div>
                        <p className="mt-0.5 text-xs font-bold leading-tight">
                          {activity.insights.pricing.status}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Side: Polaroid Photo Overlap */}
              <div
                className={`absolute right-1 sm:right-4 md:right-8 top-1/2 -translate-y-1/2 z-10 
                  w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40
                  bg-white p-1.5 sm:p-2 pb-4 sm:pb-6 md:pb-7
                  border-4 border-white shadow-lg md:shadow-xl rounded-sm
                  transition-all duration-300 ease-out group-hover:scale-105 group-hover:rotate-0 group-hover:z-20
                  ${rotationClass}`}
              >
                <div className="relative w-full h-full overflow-hidden bg-slate-200 rounded-[2px]">
                  <img
                    src={activity.image || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80"}
                    alt={activity.imageAlt || activity.activityName || "Activity photo"}
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
