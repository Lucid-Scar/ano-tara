"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Footer from "../footer/Footer";
import { MOCK_DESTINATIONS } from "../destinations/mockDestinations";

const mainImage =
  "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1400&q=80";

const nearbyImages = [
  "https://images.unsplash.com/photo-1470214304380-aadaedcfff0b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80",
];

function NearbyCard({ image, name }) {
  return (
    <Link href="/destinations" className="group relative block h-52 overflow-hidden rounded-2xl shadow-sm">
      <img src={image} alt={name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
      <p className="absolute bottom-4 left-4 text-sm font-medium text-white">{name}</p>
    </Link>
  );
}

export default function SpecificDestinationsPage() {
  const [guests, setGuests] = useState(1); 
  
  // Date Range and Time State
  const [checkIn, setCheckIn] = useState(new Date().toISOString().split("T")[0]);
  const [checkOut, setCheckOut] = useState("");
  const [selectedTime, setSelectedTime] = useState("10:00");
  
  // CSV / MLR State Management
  const [predictedPrice, setPredictedPrice] = useState("...");
  const [pricingDetails, setPricingDetails] = useState(null);
  const [destinationDetails, setDestinationDetails] = useState({
    ...MOCK_DESTINATIONS[0],
  });

  const handleMinus = (e) => {
    e.preventDefault();
    setGuests((prev) => (prev > 1 ? prev - 1 : 1));
  };

  const handlePlus = (e) => {
    e.preventDefault();
    setGuests((prev) => prev + 1);
  };

  // Helper to format dates for the Header Display
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

  useEffect(() => {
    const destinationId = new URLSearchParams(window.location.search).get("id") || "destination-1";
    const mockDestination = MOCK_DESTINATIONS.find((destination) => destination.id === destinationId) || MOCK_DESTINATIONS[0];
    setDestinationDetails(mockDestination);

    const loadDestination = async () => {
      try {
        const destinationResponse = await fetch(`http://localhost:8000/destinations/${destinationId}`);
        const destination = await destinationResponse.json();
        const priceResponse = await fetch("http://localhost:8000/predict-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            check_in: checkIn || new Date().toISOString().split("T")[0],
            guests,
            hotel_type: destination.hotel_type,
          }),
        });
        const price = await priceResponse.json();
        if (destinationResponse.ok && destination.id) {
          setDestinationDetails(destination);
        }
        if (priceResponse.ok && price.status === "success") {
          setPredictedPrice(price.price.toLocaleString());
          setPricingDetails(price);
        }
      } catch (error) {
        console.warn("Using mock destination data because the backend is unavailable", error);
      }
    };

    loadDestination();
  }, [guests, checkIn, checkOut]);

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
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </Link>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
          <Link href="/destinations" className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors mr-2 hidden sm:block">
            Back to destinations
          </Link>
          <Link href="/" className="flex items-center gap-2 rounded-md border border-[#d96a6a] px-5 py-2 text-sm font-semibold text-[#d96a6a] transition hover:bg-red-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Sign up
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-6 lg:px-12 py-10 flex-grow">
        
        <div className="flex flex-col lg:flex-row gap-12 items-start mb-16">
          
          <div className="flex-1 flex flex-col w-full max-w-4xl">
            <div className="w-full h-[400px] lg:h-[500px] overflow-hidden rounded-[2rem] shadow-sm mb-8 bg-gray-100">
              <img src={destinationDetails.image} alt={destinationDetails.name} className="h-full w-full object-cover" />
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
                {destinationDetails.name}
              </h1>
              <p className="mb-8 text-lg leading-relaxed text-gray-700">
                {destinationDetails.description}
              </p>
              <div className="h-px w-full bg-gray-200 mb-8"></div>
              
              <div className="mt-2">
                <h3 className="text-4xl font-black text-[#860001]">PHP {predictedPrice}</h3>
                {pricingDetails ? (
                  <p className="mt-2 text-sm text-gray-500">
                    Base price: PHP {pricingDetails.base_price.toLocaleString()} · {pricingDetails.season}
                  </p>
                ) : null}
                <a href="#" className="mt-2 inline-block text-sm font-medium italic text-gray-500 underline transition-colors hover:text-[#76B3DD]">
                  look more here! Bookingsite.com
                </a>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[400px] xl:w-[440px] shrink-0 sticky top-28 pt-2">
            <div className="rounded-[2rem] border border-gray-100 bg-white p-6 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)] relative z-10">
              
              <div className="mb-6 pb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Estimated MLR Cost</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-[2rem] font-black text-[#0f172a]">PHP {predictedPrice}</h3>
                  <span className="text-sm text-gray-500 font-medium">/ for {guests} {guests === 1 ? 'guest' : 'guests'}</span>
                </div>
                {pricingDetails ? (
                  <div className="mt-3 space-y-1 text-xs text-gray-500">
                    <p>Base price: PHP {pricingDetails.base_price.toLocaleString()}</p>
                    <p>{pricingDetails.month} · {pricingDetails.season}</p>
                    <p>Weather: {pricingDetails.weather.average_temperature}°C · {pricingDetails.weather.average_rainfall} mm rain</p>
                  </div>
                ) : null}
              </div>

              <div className="mb-6 grid w-full grid-cols-1 gap-6">
                
                {/* Date Range Inputs */}
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">When are you going?</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 hover:border-gray-400 transition-colors cursor-pointer">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">IN</span>
                        <input 
                          type="date" 
                          value={checkIn}
                          onChange={(e) => setCheckIn(e.target.value)}
                          className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-700 outline-none cursor-pointer"
                        />
                      </div>
                      <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 hover:border-gray-400 transition-colors cursor-pointer">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">OUT</span>
                        <input 
                          type="date" 
                          value={checkOut}
                          onChange={(e) => setCheckOut(e.target.value)}
                          className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-700 outline-none cursor-pointer"
                        />
                      </div>
                    </div>
                    
                    {/* Time Input */}
                    <div className="flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-3 hover:border-gray-400 transition-colors cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 shrink-0">
                        <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      <input 
                        type="time" 
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">How many guests?</label>
                  <div className="flex h-[48px] items-center justify-between rounded-xl border border-gray-300 px-4 transition-colors hover:border-gray-400">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
                      </svg>
                      <span>Add guests</span>
                    </div>
                    <div className="flex items-center gap-3">
                       <button onClick={handleMinus} className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">-</button>
                       <span className="w-4 text-center font-bold text-slate-800">{guests}</span>
                       <button onClick={handlePlus} className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">+</button>
                    </div>
                  </div>
                </div>
              </div>

              <button className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#58a573] hover:bg-[#4d9064] px-8 py-3.5 text-base font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                Add to Itinerary
              </button>

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

        <div className="relative border-t border-gray-200 pt-12">
          <h2 className="mb-8 text-2xl font-black text-slate-800 italic">Destinations around it!</h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            {nearbyImages.map((image, index) => (
              <NearbyCard key={image} image={image} name={`Nearby place ${index + 1}`} />
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}