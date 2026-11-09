"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Footer from "./footer/Footer";
import { useTravel } from "./TravelContext";
import { getGuestWarning, getMinSelectableDate } from "./tripUtils";

const activityFallbackImage = (activity, destination) => {
  const name = `${activity?.name || ""} ${activity?.type || ""}`.toLowerCase();
  if (/food|seafood|culinary|dining|tasting|manokan|oyster/.test(name)) return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80";
  if (/museum|gallery|art|heritage|cultural/.test(name)) return "https://images.unsplash.com/photo-1564399579883-451a5d44ec08?auto=format&fit=crop&w=1200&q=80";
  if (/boat|island|beach|falls|nature|park|hiking|walking/.test(name)) return "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";
  return destination?.image || "/destination-placeholder.svg";
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

function ExperienceCard({ experience }) {
  const [imageIndex, setImageIndex] = useState(0);
  const image = experience.images[imageIndex % experience.images.length];

  useEffect(() => {
    if (experience.images.length < 2) return undefined;
    const interval = window.setInterval(() => {
      setImageIndex((current) => (current + 1) % experience.images.length);
    }, 4500);
    return () => window.clearInterval(interval);
  }, [experience.images.length]);

  return (
    <Link
      href={`/destinations?activityType=${encodeURIComponent(experience.type)}`}
      className="group relative block h-64 overflow-hidden rounded-3xl shadow-md md:h-72"
    >
      <img
        src={image}
        alt={`${experience.type} experience`}
        onError={(event) => {
          if (event.currentTarget.src !== experience.fallbackImage) event.currentTarget.src = experience.fallbackImage;
          else event.currentTarget.style.visibility = "hidden";
        }}
        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e]/90 via-[#1a1a2e]/30 to-transparent" />
      <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e4f7ed] text-sm font-black text-teal-800 shadow-lg">
          {experience.type.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-white">{experience.type}</h3>
          <p className="text-sm text-slate-300">{experience.count} experiences</p>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const router = useRouter();
  const { dateRange, setDateRange, guests, setGuests } = useTravel();
  const startDate = dateRange.startDate || "";
  const endDate = dateRange.endDate || "";
  const [experiences, setExperiences] = useState([]);
  const minDate = getMinSelectableDate();

  useEffect(() => {
    let active = true;
    const loadExperienceCounts = async () => {
      try {
        const response = await fetch("/api/backend/destinations");
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.destinations)) throw new Error();
        const grouped = data.destinations.reduce((result, destination) => {
          (destination.activities || []).forEach((activity) => {
            const types = activity.record_types || (activity.record_type ? [activity.record_type] : []);
            types.filter(Boolean).forEach((type) => {
              if (!result[type]) result[type] = [];
              result[type].push({
                activity,
                destination,
                image: activityImage(activity, destination),
              });
            });
          });
          return result;
        }, {});
        const nextExperiences = Object.entries(grouped).map(([type, items]) => ({
          type,
          count: items.length,
          images: [...new Set(items.map((item) => item.image))],
          fallbackImage: activityFallbackImage(items[0]?.activity, items[0]?.destination),
        })).slice(0, 6);
        if (active) setExperiences(nextExperiences);
      } catch (error) {
        console.error("Could not load experience counts from the tourism dataset.", error);
        if (active) setExperiences([]);
      }
    };
    loadExperienceCounts();
    return () => { active = false; };
  }, []);

  const guestWarning = getGuestWarning(guests);

  const handleMinus = (e) => {
    e.preventDefault();
    setGuests((prev) => (prev > 1 ? prev - 1 : 1));
  };

  const handlePlus = (e) => {
    e.preventDefault();
    setGuests((prev) => prev + 1);
  };

  const searchUrl = `/destinations?startDate=${startDate}&endDate=${endDate}&date=${startDate}&guests=${guests}`;

  const saveTripSearch = (event) => {
    event.preventDefault();
    if (!startDate || !endDate || endDate < startDate) return;
    const existing = JSON.parse(window.localStorage.getItem("anoTaraTrip") || "{}");
    setDateRange({ startDate, endDate });
    window.localStorage.setItem("anoTaraTrip", JSON.stringify({
      ...existing,
      startDate,
      endDate,
      targetDates: [startDate, ...(endDate !== startDate ? [endDate] : [])],
      guests,
    }));
    router.push(searchUrl);
  };

  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      
      {/* --- HERO SECTION --- */}
      <section className="relative flex min-h-[500px] w-full flex-col bg-[url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=80')] bg-cover bg-center">
        
        <div className="absolute inset-0 bg-black/40"></div>

        {/* ORIGINAL TOP NAVIGATION (Transparent, shown at top of page) */}
        <nav className="relative z-20 mx-auto flex w-full items-center justify-between px-6 py-4 sm:px-12">
          <div className="flex-1 hidden md:block"></div>

          <div className="flex flex-1 justify-center">
            <img src="/LOGO-WHITE.svg" alt="Ano Tara Logo" className="h-20 w-20 drop-shadow-lg" />
          </div>

          <div className="flex flex-1 items-center justify-end gap-3">
            <Link href="/predict-outfit" className="rounded-md border border-white/60 bg-black/20 px-5 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10">
              Outfit Planner
            </Link>
            <Link href="/final-planner" className="rounded-md border border-white/60 bg-black/20 px-5 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10">
              Itinerary planner
            </Link>
          </div>
        </nav>

        {/* HERO MAIN TEXT */}
        <div className="relative z-10 mx-auto flex flex-1 w-full max-w-5xl flex-col items-center justify-center px-5 pb-20 text-center text-white uppercase">
          <h1 className="text-6xl tracking-wide font-bold drop-shadow-lg sm:text-8xl mt-4">
            Ano tara?
          </h1>
          <p className="mt-5 text-4xl font-medium drop-shadow-md sm:text-5xl">
            kung saan maganda, mahal!
          </p>
        </div>
      </section>

      {/* --- ORIGINAL BIG SEARCH BAR (Floating in original position) --- */}
      <div className="relative z-30 mx-auto -mt-12 w-[92%] max-w-4xl rounded-full border border-gray-200 bg-white p-2 sm:p-3 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
        <div className="flex flex-col sm:flex-row gap-2 items-center px-2">
          
          <div className="flex-[3] flex items-center w-full px-4 py-2 sm:border-r sm:border-slate-300 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer">
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Start date</p>
              <input
                type="date"
                min={minDate}
                value={startDate}
                onChange={(event) => {
                  const nextStartDate = event.target.value;
                  setDateRange({
                    startDate: nextStartDate,
                    endDate: endDate && endDate < nextStartDate ? nextStartDate : endDate,
                  });
                }}
                className="mt-1 w-full border-0 bg-transparent p-0 text-base font-medium text-slate-900 outline-none cursor-pointer"
              />
            </div>
            <div className="flex-1 border-t border-slate-200 pt-2 sm:border-t-0 sm:border-l sm:border-slate-300 sm:pl-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">End date</p>
              <input
                type="date"
                min={startDate || minDate}
                value={endDate}
                onChange={(event) => setDateRange({ startDate, endDate: event.target.value })}
                className="mt-1 w-full border-0 bg-transparent p-0 text-base font-medium text-slate-900 outline-none cursor-pointer"
              />
            </div>
          </div>

          <div className="flex-[1.5] flex flex-col justify-center w-full px-4 py-2 hover:bg-gray-50 rounded-2xl transition-colors">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Guests</p>
            <div className="flex items-center justify-between">
              <button onClick={handleMinus} type="button" className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:border-slate-800 hover:text-slate-900 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              
              <span className="text-lg font-medium text-slate-900 w-8 text-center">{guests}</span>
              
              <button onClick={handlePlus} type="button" className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:border-slate-800 hover:text-slate-900 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            </div>
          </div>

          <div className="flex-none w-full sm:w-auto mt-2 sm:mt-0 pl-2">
            <button type="button" onClick={saveTripSearch} disabled={!startDate || !endDate || endDate < startDate} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#b9f0c8] px-8 py-4 sm:py-5 shadow-sm transition hover:scale-105 active:scale-95 text-teal-950 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:scale-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <span className="font-bold text-lg hidden sm:block">Search</span>
            </button>
          </div>

        </div>
        {guestWarning ? (
          <p className="px-6 pb-2 pt-1 text-xs font-semibold text-amber-600">{guestWarning}</p>
        ) : null}
      </div>

      {/* --- SEARCH BY EXPERIENCE SECTION --- */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Search by experience type</h2>
          <p className="mt-4 text-slate-500 max-w-2xl mx-auto">
            Looking for a relaxing beach side, or maybe just a city tour? Use the categories below to search for the experience that is right for you.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {experiences.map((experience) => (
            <ExperienceCard key={experience.type} experience={experience} />
          ))}
        </div>
        
        <div className="mt-16 flex justify-center">
          <Link href="/destinations" className="rounded-lg border-2 border-red-400 px-8 py-3 font-semibold text-red-500 transition hover:bg-red-50">
            View All Experiences
          </Link>
        </div>
      </section>

      {/* --- FULL-WIDTH PROMO BANNER SECTION --- */}
      <section className="relative w-full overflow-hidden bg-slate-900 shadow-lg min-h-[500px] flex items-center">
        <img src="https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=2400&q=80" alt="Clothing rack" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 sm:px-12">
          <div className="flex w-full flex-col items-start md:w-3/4 lg:w-1/2">
            <h2 className="mb-3 font-serif text-4xl font-black tracking-wide text-white drop-shadow-md sm:text-5xl">
              Ano Tara? Outfit matcher
            </h2>

            <p className="pt-4 mb-10 text-base leading-relaxed text-gray-300 drop-shadow-sm sm:text-lg">
              Check whether each garment fits the weather and destination before you pack.
            </p>
            <Link href="/predict-outfit">
              <button className="rounded-full bg-[#b9f0c8] px-10 py-4 font-bold text-slate-900 shadow-[0_4px_14px_0_rgba(185,240,200,0.39)] transition hover:-translate-y-1 hover:shadow-[0_6px_20px_rgba(185,240,200,0.23)] active:translate-y-0">
                Try outfit matcher
              </button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
