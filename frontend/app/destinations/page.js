"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Footer from "../footer/Footer";
import { MOCK_DESTINATIONS } from "./mockDestinations";

const destinationImages = MOCK_DESTINATIONS.map((destination) => destination.image);

function DestinationCard({ destination }) {
  return (
    <Link href={`/specific-destinations?id=${destination.id}`} className="group overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="relative h-52 overflow-hidden">
        <img src={destination.image} alt={`${destination.name} in ${destination.location}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
        <div className="absolute bottom-4 left-4 flex items-center gap-2">
          <div className="h-5 w-5 rounded-sm bg-[#fdb52a] shadow-sm" />
          <span className="text-sm font-medium text-white drop-shadow-sm">{destination.location}</span>
        </div>
      </div>
      <div className="p-5">
        <h2 className="text-lg font-bold text-slate-900">{destination.name}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{destination.description}</p>
      </div>
    </Link>
  );
}

export default function DestinationsPage() {
  const [guests, setGuests] = useState(3);
  const [destinations, setDestinations] = useState(MOCK_DESTINATIONS);
  
  // Date Range State
  const [checkIn, setCheckIn] = useState(new Date().toISOString().split("T")[0]);
  const [checkOut, setCheckOut] = useState("");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const storedTrip = window.localStorage.getItem("anoTaraTrip");
    let stored = {};
    try {
      stored = storedTrip ? JSON.parse(storedTrip) : {};
    } catch {
      window.localStorage.removeItem("anoTaraTrip");
    }
    if (query.get("checkIn")) setCheckIn(query.get("checkIn"));
    else if (stored.targetDates?.[0]) setCheckIn(stored.targetDates[0]);
    if (query.get("checkOut")) setCheckOut(query.get("checkOut"));
    if (query.get("guests")) setGuests(Number(query.get("guests")) || 1);
    else if (stored.guests) setGuests(stored.guests);

    fetch("http://localhost:8000/destinations")
      .then((response) => response.json())
      .then((data) => {
        if (data.destinations?.length) {
          setDestinations(data.destinations);
        }
      })
      .catch(() => {
        // Keep the mock cards visible while the backend is unavailable.
        setDestinations(MOCK_DESTINATIONS);
      });
  }, []);

  const handleMinus = (e) => {
    e.preventDefault();
    setGuests((prev) => (prev > 1 ? prev - 1 : 1));
  };

  const handlePlus = (e) => {
    e.preventDefault();
    setGuests((prev) => prev + 1);
  };

  // Helper to format dates for the UI
  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const displayRange = checkIn && checkOut 
    ? `${formatDate(checkIn)} - ${formatDate(checkOut)}` 
    : formatDate(checkIn) || "Select Dates";

  return (
    <div className="min-h-screen flex flex-col bg-[#fefdfd] text-slate-900">
      
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
          <Link href="/" className="rounded-md border border-gray-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-gray-50">
            Log in
          </Link>
          <Link href="/" className="flex items-center gap-2 rounded-md border border-[#d96a6a] px-5 py-2 text-sm font-semibold text-[#d96a6a] transition hover:bg-red-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Sign up
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pt-12 pb-6 flex-grow">
        
        {/* Dynamic Date Controls */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-xl font-medium text-gray-900 mb-4">
              10 experiences between <span className="text-[#4a8b8b] font-bold">{displayRange}</span> for {guests} Guests
            </h1>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium w-16">Check In:</span>
                <input 
                  type="date" 
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 outline-none hover:border-[#4a8b8b] focus:border-[#4a8b8b] transition-colors cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium w-16 sm:w-auto">Check Out:</span>
                <input 
                  type="date" 
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 outline-none hover:border-[#4a8b8b] focus:border-[#4a8b8b] transition-colors cursor-pointer"
                />
              </div>
            </div>
          </div>
          
          <button className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:shadow">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>
            </svg>
            Show map
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {destinations.map((destination) => (
            <DestinationCard key={destination.id} destination={{ ...destination, image: destination.image || destinationImages[destinations.indexOf(destination)] }} />
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}