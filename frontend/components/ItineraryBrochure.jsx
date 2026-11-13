"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DynamicMap from "./DynamicMap";
import { HazardBanner, WeatherCategoryBadge } from "./WeatherSafety";
import { getActivityImagePath, DESTINATION_PLACEHOLDER } from "../lib/resolveActivityImage";
import { validCoordinate, routeLines } from "../lib/mapGeometry";

const money = (n) => `₱${Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
const chunks = (text) => String(text || '').match(/[\s\S]{1,650}(?:\s|$)|[\s\S]{1,650}/g) || [];
const imageFallback = (event) => { if (!event.currentTarget.src.endsWith(DESTINATION_PLACEHOLDER)) event.currentTarget.src = DESTINATION_PLACEHOLDER; };

function buildBlocks({ planner, days, mode, start, end, guests, outfitsForDay, formatPrice }) {
  const blocks = [];
  const add = (node, day = '', heading = false, map = null) => blocks.push({ node, day, heading, map });
  let number = 0;
  const numberedDays = days.map((day) => ({ ...day, activities: day.activities.map((a) => ({ ...a, markerNumber: ++number })) }));
  const all = numberedDays.flatMap((day) => day.activities);
  const heading = (title, day = '') => add(<h2>{title}</h2>, day, true);
  const map = (activities, segments, day = '') => {
    heading('Destination map', day);
    if (activities.some((a) => validCoordinate(a.exact_latitude, a.exact_longitude))) {
      add(null, day, false, { activities, routeSegments: segments });
      add(<p className="brochure-muted">Numbered stops follow the itinerary order. Green lines show supplied road routes. {routeLines(segments).length ? 'Unconnected stops have no confirmed route shown.' : 'Road routing is unavailable; no driving connections are assumed.'}</p>, day);
    } else add(<p>Map coordinates are unavailable for these stops.</p>, day);
    for (let i = 0; i < activities.length; i += 3) add(<div className="brochure-legend-grid">{activities.slice(i, i + 3).map((a) => <p key={a.markerNumber} className="brochure-legend"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(validCoordinate(a.exact_latitude, a.exact_longitude) ? `${a.exact_latitude},${a.exact_longitude}` : `${a.name} ${a.location || ''}`)}`}>{a.markerNumber}. {a.name}</a>{!validCoordinate(a.exact_latitude, a.exact_longitude) && ' · Location not mapped'}</p>)}</div>, day);
  };
  const weather = (day) => {
    heading(`${day.dayNumber} · Weather & clothes`, day.dayNumber);
    add(<div className="brochure-weather"><WeatherCategoryBadge item={day} /><HazardBanner item={day} /><p>{day.weatherDescription}</p></div>, day.dayNumber);
    chunks(day.outfit_advice).forEach((text) => add(<p>{text}</p>, day.dayNumber));
  };
  const clothes = (day) => {
    const outfits = outfitsForDay(day.date || day.day, Number(day.dayNumber.replace('Day ', '')) - 1);
    if (!outfits.length) add(<p className="brochure-muted">No outfit assigned to this day.</p>, day.dayNumber);
    for (let i = 0; i < outfits.length; i += 4) add(<div className="brochure-garments">{outfits.slice(i, i + 4).map((outfit, j) => <figure key={j}>
      {outfit.image && <img src={outfit.image} alt={outfit.category} onError={imageFallback} />}
      <figcaption><strong>{outfit.category}</strong><p>{outfit.outfitSetName || 'Your outfit'}</p>{outfit.suitability && <p>{String(outfit.suitability)}</p>}</figcaption>
    </figure>)}</div>, day.dayNumber);
  };
  const activities = (day) => day.activities.forEach((a) => {
    add(<article className="brochure-stop"><img src={getActivityImagePath(a, a.destination || a.location)} alt="" onError={imageFallback} /><div><h3>{a.markerNumber}. {a.name}</h3><p>{a.location || a.destination || 'Location not listed'}</p><p className="brochure-muted">{a.time || a.schedule || a.start_time || 'Time to be confirmed'} · {a.guests || guests} travelers</p></div><strong>{formatPrice(a)}</strong></article>, day.dayNumber);
    if (mode === 'details') {
      chunks(a.description).forEach((text, i) => add(<div><h3>Stop {a.markerNumber}{i ? ' — Continued' : ' · About this stop'}</h3><p>{text}</p></div>, day.dayNumber));
      const condition = a.weather_forecast?.condition || a.weather || a.weather_condition;
      if (condition) add(<p className="brochure-muted">Stop {a.markerNumber} weather: {condition}</p>, day.dayNumber);
      if (a.hotel_type || a.room_type || a.roomType) add(<p>Accommodation: {[a.hotel_type, a.room_type || a.roomType].filter(Boolean).join(' · ')}</p>, day.dayNumber);
    }
  });
  const budget = () => {
    heading('Price & budget summary');
    const priced = all.filter((a) => a.brochurePrice !== null && a.brochurePrice !== undefined && Number.isFinite(Number(a.brochurePrice)));
    const admission = priced.reduce((sum, a) => sum + Number(a.brochurePrice), 0);
    const stay = planner.priceEstimate?.amount ?? planner.final_mlr_price;
    add(<div className="brochure-budget"><p>{guests} travelers · Activity prices shown are totals for each stop’s assigned travelers.</p><p><strong>Known activity costs: {money(admission)}</strong>{priced.length < all.length && ` · ${all.length - priced.length} stops have unlisted prices`}</p>{stay != null && <p><strong>Accommodation estimate (MLR): {money(stay)}</strong>{planner.priceEstimate?.destination && ` · ${planner.priceEstimate.destination}`}</p>}<p className="brochure-muted">Activity costs and accommodation estimates are listed separately; they are not added into a total that could count accommodation twice. Unlisted prices are excluded, not assumed free.</p></div>);
    if (planner.total_estimated_price) add(<p>Backend itinerary estimate: {money(planner.total_estimated_price.min)}–{money(planner.total_estimated_price.max)}. This is a separate estimate, not an additional expense.</p>);
    Object.entries(planner.destination_totals || {}).forEach(([destination, range]) => add(<p>{destination}: {money(range.min)}–{money(range.max)}</p>));
  };
  const duration = Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1);
  add(<header className="brochure-title"><div>TRAVEL ITINERARY <span>{mode === 'overview' ? 'OVERVIEW' : 'DETAILED'}</span></div><h1>ANO TARA?</h1><h2>{planner.name || [...new Set(days.map((d) => d.destination))].join(' · ')}</h2><p>{start} — {end} · {duration} days · {guests} travelers</p></header>);
  if (mode === 'overview') {
    map(all, days.flatMap((d) => d.route_segments));
    numberedDays.forEach((day) => { heading(`${day.dayNumber} · ${day.dateLabel}`, day.dayNumber); activities(day); });
    budget();
    numberedDays.forEach((day) => { weather(day); clothes(day); });
  } else {
    numberedDays.forEach((day) => {
      heading(`${day.dayNumber} · ${day.dateLabel}`, day.dayNumber);
      add(<div className="brochure-weather"><WeatherCategoryBadge item={day} /><HazardBanner item={day} /><p>{day.weatherDescription}</p></div>, day.dayNumber);
      activities(day);
      heading('Day costs & accommodation', day.dayNumber);
      const known = day.activities.filter((a) => a.brochurePrice != null);
      add(<div className="brochure-budget"><p>Known activity costs: <strong>{money(known.reduce((sum, a) => sum + a.brochurePrice, 0))}</strong>{known.length < day.activities.length && ' · Some prices are unlisted'}</p><p className="brochure-muted">See the trip budget summary for the accommodation estimate. It is quoted once for the trip.</p></div>, day.dayNumber);
      heading('What to wear', day.dayNumber);
      chunks(day.outfit_advice).forEach((text) => add(<p>{text}</p>, day.dayNumber));
      clothes(day);
      map(day.activities, day.route_segments, day.dayNumber);
    });
    budget();
  }
  heading('Travel notes');
  chunks(planner.notes || planner.advisory).forEach((text) => add(<p>{text}</p>));
  add(<p className="brochure-muted">Prices, opening hours and weather may change. Confirm arrangements before departure. Weather source: {planner.weather_source || 'See forecast details'}. Map data © OpenStreetMap contributors.</p>);
  return blocks;
}

export default function ItineraryBrochure(props) {
  const { planner, mode, onClose, onMode, onSave, saved } = props;
  const blocks = useMemo(() => buildBlocks(props), [planner, mode, props.start, props.end, props.guests]);
  const measure = useRef(null);
  const viewer = useRef(null);
  const [pagination, setPagination] = useState({ blocks: null, pages: [] });
  // Page indices belong to the exact blocks that were measured. A mode or
  // planner change must wait for its own measurements before rendering pages.
  const pages = pagination.blocks === blocks ? pagination.pages : [];
  const [scale, setScale] = useState(.7);
  const [spread, setSpread] = useState(0);
  const [columns, setColumns] = useState(2);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');
  const render = (block, measuring = false) => block.map ? <div className="brochure-map">{measuring ? <div /> : <DynamicMap {...block.map} />}</div> : block.node;
  useEffect(() => {
    let cancelled = false;
    const paginate = () => {
      if (cancelled || !measure.current || !measure.current.getBoundingClientRect().width) return;
      const nodes = [...measure.current.children];
      const capacity = 265 * 96 / 25.4;
      const result = []; let page = []; let used = 0;
      nodes.forEach((node, index) => {
        const height = node.getBoundingClientRect().height;
        const nextHeight = blocks[index].heading ? nodes[index + 1]?.getBoundingClientRect().height || 0 : 0;
        if (page.length && used + height + nextHeight > capacity) { result.push(page); page = []; used = 0; }
        page.push(index); used += height;
      });
      if (page.length) result.push(page);
      setPagination({ blocks, pages: result }); setSpread(0);
    };
    document.fonts.ready.then(paginate);
    const observer = new ResizeObserver(paginate);
    if (measure.current) observer.observe(measure.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [blocks]);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const count = width >= 1800 ? 3 : width >= 1000 ? 2 : 1;
      setColumns(count); setScale(Math.min(1, (width - 24 * (count + 1)) / (count * 210 * 96 / 25.4))); setSpread(0);
    });
    if (viewer.current) observer.observe(viewer.current);
    return () => observer.disconnect();
  }, []);
  const preparePrint = async () => {
    setPrinting(true); setError('');
    try {
      await document.fonts.ready;
      const root = document.getElementById('itinerary-print-root');
      const deadline = Date.now() + 15000;
      while (root.querySelectorAll('.brochure-map [data-map-ready]').length < blocks.filter((b) => b.map).length) {
        if (Date.now() > deadline) throw new Error('Maps are still loading. Please try again.');
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const pending = [];
      window.dispatchEvent(new CustomEvent('ano-prepare-print', { detail: { waitUntil: (promise) => pending.push(promise) } }));
      await Promise.all(pending);
      await Promise.all([...root.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
      const previousTitle = document.title;
      document.title = `${planner.name || 'Ano Tara itinerary'} - ${mode}`;
      try { window.print(); } finally { document.title = previousTitle; }
    } catch (err) { setError(err.message); }
    finally { setPrinting(false); }
  };
  return createPortal(<div id="itinerary-print-root" className="brochure-viewer" role="dialog" aria-modal="true" aria-label="Itinerary preview">
    <div className="brochure-controls"><button onClick={onClose}>← Back to planner</button><div>{['overview', 'details'].map((view) => <button key={view} aria-pressed={mode === view} onClick={() => onMode(view)}>{view === 'overview' ? 'Overview' : 'Detailed'}</button>)}</div><button onClick={onSave} disabled={saved}>{saved ? 'Saved to archive' : 'Save to archive'}</button><button disabled={printing || !pages.length} onClick={preparePrint}>{printing ? 'Preparing maps & images…' : 'Print / Save PDF'}</button></div>
    <div className="brochure-controls brochure-pagination"><button disabled={!spread} onClick={() => setSpread(Math.max(0, spread - columns))}>Previous pages</button><span>{pages.length ? `${spread + 1}–${Math.min(spread + columns, pages.length)} of ${pages.length} pages` : 'Preparing pages…'}</span><button disabled={spread + columns >= pages.length} onClick={() => setSpread(spread + columns)}>Next pages</button><p>In the print dialog, disable “Headers and footers” and use 100% scale.</p>{error && <p role="alert">{error}</p>}{props.archiveError && <p role="alert">{props.archiveError}</p>}</div>
    <div className="brochure-measure brochure-paper" ref={measure} aria-hidden="true">{blocks.map((block, i) => <div className="brochure-block" key={i}>{render(block, true)}</div>)}</div>
    <div className="brochure-pages" ref={viewer} style={{ '--preview-scale': scale }}>
      {pages.map((indices, pageIndex) => <section className={`brochure-page-frame ${pageIndex >= spread && pageIndex < spread + columns ? 'is-visible' : ''}`} key={pageIndex} aria-label={`Page ${pageIndex + 1}`}>
        <div className="brochure-paper"><div className="brochure-running">{pageIndex > 0 ? `${blocks[indices[0]].day || 'Travel itinerary'} — Continued` : 'Your travel companion'}</div>
          {indices.map((index) => <div className="brochure-block" key={index}>{render(blocks[index])}</div>)}
          <footer>ANO TARA? <span>{pageIndex + 1} / {pages.length}</span></footer>
        </div>
      </section>)}
    </div>
  </div>, document.body);
}
