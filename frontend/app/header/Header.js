import React from 'react';
import Link from 'next/link';

export default function Header({ fixed = false }) {
  return (
    <header className="sticky top-0 z-50 flex h-20 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 backdrop-blur-md shadow-sm lg:px-12">
      <div className="flex flex-1 items-center">
        <Link href="/">
          <img src="/LOGO-BLACK.svg" alt="Ano Tara Logo" 
            className={fixed ? "h-12 w-auto object-contain" : "h-10 w-auto object-contain cursor-pointer transition-transform hover:scale-105"}  />
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        <Link href="/predict-outfit" 
          className="hidden sm:inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-50 shadow-sm">
          Outfit Planner
        </Link>
        <Link href="/final-planner" 
          className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-[#FFFDF7] transition hover:bg-slate-800 shadow-sm">
          Itinerary Planner
        </Link>
      </div>
    </header>
  );
}