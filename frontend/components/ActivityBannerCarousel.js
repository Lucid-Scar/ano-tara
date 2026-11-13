"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

export default function ActivityBannerCarousel({ slides }) {
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [readySource, setReadySource] = useState("");
  const nextIndex = slides.length ? (index + 1) % slides.length : 0;
  const nextSlide = slides[nextIndex];

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || slides.length < 2 || readySource !== nextSlide?.src) return;
    const timer = window.setTimeout(() => {
      setPrevious(index);
      setIndex(nextIndex);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [index, nextIndex, nextSlide?.src, paused, readySource, reducedMotion, slides.length]);

  if (!slides.length) return null;

  const move = (direction) => {
    setPaused(true);
    setPrevious(index);
    setIndex((index + direction + slides.length) % slides.length);
  };

  const buttonClass = "flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white backdrop-blur-md transition hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";

  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {previous !== null && (
          <Image src={slides[previous].src} alt="" fill sizes="100vw" className="object-cover" />
        )}
        <div key={slides[index].src} className="banner-slide absolute inset-0">
          <Image src={slides[index].src} alt="" fill sizes="100vw" loading="eager" className="object-cover" />
        </div>
        {slides.length > 1 && (
          <Image
            key={`preload-${nextSlide.src}`}
            src={nextSlide.src}
            alt=""
            fill
            sizes="100vw"
            loading="eager"
            className="object-cover opacity-0"
            onLoad={() => setReadySource(nextSlide.src)}
            onError={() => setReadySource(nextSlide.src)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/65" />
      </div>

      <div className="absolute left-6 top-20 z-20 max-w-[calc(100%-3rem)] sm:left-16 sm:top-8 sm:max-w-[calc(100%-26rem)]">
        <p className="text-xs font-semibold capitalize leading-relaxed text-white/85 drop-shadow-md">
          <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">Explore the Philippines</span>
          {slides[index].title}
        </p>
      </div>
      <div className="absolute bottom-6 right-6 z-20 sm:right-10">
        {slides.length > 1 && (
          <div className="flex shrink-0 items-center gap-2" role="group" aria-label="Activity slideshow controls">
            <button type="button" onClick={() => move(-1)} className={buttonClass} aria-label="Previous activity photo"><ChevronLeft size={10} /></button>
            <button
              type="button"
              onClick={() => {
                setPaused(!(paused || reducedMotion));
                setReducedMotion(false);
              }}
              className={buttonClass}
              aria-label={paused || reducedMotion ? "Play activity slideshow" : "Pause activity slideshow"}
            >
              {paused || reducedMotion ? <Play size={10} /> : <Pause size={10} />}
            </button>
            <button type="button" onClick={() => move(1)} className={buttonClass} aria-label="Next activity photo"><ChevronRight size={10} /></button>
          </div>
        )}
      </div>

      <style jsx>{`
        .banner-slide { animation: banner-reveal 1.2s ease-out both; }
        @keyframes banner-reveal { from { opacity: 0; transform: scale(1.025); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .banner-slide { animation: none; } }
      `}</style>
    </>
  );
}
