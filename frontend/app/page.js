"use client";
import React, { useState } from "react";
import Link from "next/link";
import Footer from "./footer/Footer";

export default function Home() {
  const [guests, setGuests] = useState(3);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  const handleMinus = (e) => {
    e.preventDefault();
    setGuests((prev) => (prev > 1 ? prev - 1 : 1));
  };

  const handlePlus = (e) => {
    e.preventDefault();
    setGuests((prev) => prev + 1);
  };

  const searchUrl = `/destinations?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`;

  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      
      {/* --- HERO SECTION --- */}
      <section className="relative flex min-h-[500px] w-full flex-col bg-[url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=80')] bg-cover bg-center">
        
        <div className="absolute inset-0 bg-black/40"></div>

        {/* ORIGINAL TOP NAVIGATION (Transparent, shown at top of page) */}
        <nav className="relative z-20 mx-auto flex w-full items-center justify-between px-6 py-4 sm:px-12">
          <div className="flex-1 hidden md:block"></div>

          <div className="flex flex-1 justify-center">
            <img src="/ano_tara_logo.svg" alt="Ano Tara Logo" className="h-20 w-20 drop-shadow-lg" />
          </div>

          <div className="flex flex-1 items-center justify-end gap-3">
            <Link href="/final-planner" className="rounded-md border border-white/60 bg-black/20 px-5 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10">
              Planner
            </Link>
            <Link href="/" className="flex items-center gap-2 rounded-md bg-white px-5 py-2 text-sm font-bold text-red-500 shadow-sm transition hover:bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Sign up
            </Link>
          </div>
        </nav>

        {/* HERO MAIN TEXT */}
        <div className="relative z-10 mx-auto flex flex-1 w-full max-w-5xl flex-col items-center justify-center px-5 pb-20 text-center text-white uppercase">
          <h1 className="text-6xl tracking-wide font-bold drop-shadow-lg sm:text-8xl mt-4">
            Travel, Ano tara?
          </h1>
          <p className="mt-5 text-4xl font-medium drop-shadow-md sm:text-6xl">
            kung saan maganda, mahal!
          </p>
        </div>
      </section>

      {/* --- ORIGINAL BIG SEARCH BAR (Floating in original position) --- */}
      <div className="relative z-30 mx-auto -mt-12 w-[92%] max-w-4xl rounded-full border border-gray-200 bg-white p-2 sm:p-3 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
        <div className="flex flex-col sm:flex-row gap-2 items-center px-2">
          
          <div className="flex-[3] flex items-center w-full px-4 py-2 sm:border-r sm:border-slate-300 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer">
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Check in</p>
              <input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className="mt-1 w-full border-0 bg-transparent p-0 text-base font-medium text-slate-900 outline-none cursor-pointer" />
            </div>
            <div className="w-px h-8 bg-slate-300 mx-3"></div>
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Check out</p>
              <input type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} className="mt-1 w-full border-0 bg-transparent p-0 text-base font-medium text-slate-900 outline-none cursor-pointer" />
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
            <Link href={searchUrl} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#b9f0c8] px-8 py-4 sm:py-5 shadow-sm transition hover:scale-105 active:scale-95 text-teal-950">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <span className="font-bold text-lg hidden sm:block">Search</span>
            </Link>
          </div>

        </div>
      </div>

      {/* --- SEARCH BY EXPERIENCE SECTION --- */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Search by experience type</h2>
          <p className="mt-4 text-slate-500 max-w-2xl mx-auto">
            Looking for a relaxing beach side, or maybe just a city tour? Use the categories below to search for the experience that's right for you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/destinations" className="relative h-[26rem] rounded-3xl overflow-hidden group cursor-pointer shadow-md block">
            <img src="https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=800&q=80" alt="Beach" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e]/90 via-[#1a1a2e]/40 to-transparent" />
            
            <div className="absolute bottom-6 left-6 right-6 flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-[#e4f7ed] flex items-center justify-center text-teal-800 shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20"/><path d="M12 2v20"/><path d="M4.93 4.93l14.14 14.14"/><path d="M19.07 4.93L4.93 19.07"/></svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Beach</h3>
                <p className="text-sm text-slate-300">16 experiences</p>
              </div>
            </div>
          </Link>

          <Link href="/destinations" className="relative h-[26rem] rounded-3xl overflow-hidden group cursor-pointer shadow-md block">
            <img src="https://images.unsplash.com/photo-1518398046578-8cca57782e17?auto=format&fit=crop&w=800&q=80" alt="City Tour" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e]/90 via-[#1a1a2e]/40 to-transparent" />
            
            <div className="absolute bottom-6 left-6 right-6 flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-[#e4f7ed] flex items-center justify-center text-teal-800 shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">City Tour</h3>
                <p className="text-sm text-slate-300">14 experiences</p>
              </div>
            </div>
          </Link>
        </div>
        
        <div className="mt-16 flex justify-center">
          <Link href="/all-experiences" className="rounded-lg border-2 border-red-400 px-8 py-3 font-semibold text-red-500 transition hover:bg-red-50">
            View All Experiences
          </Link>
        </div>
      </section>

      {/* --- FULL-WIDTH PROMO BANNER SECTION --- */}
      <section className="relative w-full overflow-hidden bg-slate-900 shadow-lg min-h-[500px] flex items-center">
        <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2400&q=80" alt="Promo Background" className="absolute inset-0 h-full w-full object-cover grayscale opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 sm:px-12">
          <div className="flex w-full flex-col items-start md:w-3/4 lg:w-1/2">
            <h2 className="mb-3 font-serif text-4xl font-black tracking-wide text-white drop-shadow-md sm:text-5xl">
              Adventure Awaits. <br className="hidden sm:block" /> Tara Na!
            </h2>

            <p className="pt-4 mb-10 text-base leading-relaxed text-gray-300 drop-shadow-sm sm:text-lg">
              Stop dreaming and start packing. From sun-kissed local beaches to vibrant cityscapes across the map, explore top-rated destinations tailored for your budget and style. Your next unforgettable story begins right here.
            </p>
            <Link href="/destinations">
              <button className="rounded-full bg-[#b9f0c8] px-10 py-4 font-bold text-slate-900 shadow-[0_4px_14px_0_rgba(185,240,200,0.39)] transition hover:-translate-y-1 hover:shadow-[0_6px_20px_rgba(185,240,200,0.23)] active:translate-y-0">
                Start Exploring Now
              </button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}