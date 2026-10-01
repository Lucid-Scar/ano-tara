"use client";

import { useEffect, useState } from "react";

export default function GarmentImage({ src, alt, className = "", imageClassName = "object-cover" }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return <>
    <button type="button" onClick={() => setIsOpen(true)} aria-label={`View larger image: ${alt}`} className={`block overflow-hidden ${className}`}>
      <img src={src} alt={alt} className={`h-full w-full ${imageClassName}`} />
    </button>
    {isOpen ? <div role="dialog" aria-modal="true" aria-label={`Larger view: ${alt}`} onClick={() => setIsOpen(false)} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
      <div className="relative flex max-h-full max-w-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => setIsOpen(false)} aria-label="Close image preview" className="absolute -right-2 -top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-2xl font-bold text-slate-900 shadow">×</button>
        <img src={src} alt={alt} className="max-h-[88vh] max-w-[92vw] object-contain" />
      </div>
    </div> : null}
  </>;
}