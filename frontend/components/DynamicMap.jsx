"use client";

import dynamic from "next/dynamic";

// Force Next.js to only load this component in the client's browser
const DynamicMap = dynamic(() => import("./ItineraryMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[450px] w-full animate-pulse flex-col items-center justify-center rounded-xl bg-slate-100 border border-slate-200">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900 mb-4"></div>
      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading Map Data...</p>
    </div>
  )
});

export default DynamicMap;