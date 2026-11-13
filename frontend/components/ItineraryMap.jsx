"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { validCoordinate, routeLines } from "../lib/mapGeometry";
import "leaflet/dist/leaflet.css";

function MapViewport({ points }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize({ animate: false });
      if (points.length) map.fitBounds(points, { padding: [32, 32], maxZoom: 13, animate: false });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    const prepare = (event) => {
      event.detail.waitUntil(new Promise((resolve, reject) => {
        fit();
        let elapsed = 0;
        const timer = setInterval(() => {
          elapsed += 100;
          const tiles = [...map.getContainer().querySelectorAll('.leaflet-tile')];
          let loading = false;
          map.eachLayer((layer) => { if (layer instanceof L.TileLayer && layer.isLoading()) loading = true; });
          if (!loading && tiles.length && tiles.every((tile) => tile.complete)) {
            clearInterval(timer);
            if (tiles.some((tile) => !tile.naturalWidth)) reject(new Error('Some map tiles could not load. Check your connection and try printing again.'));
            else resolve();
          } else if (elapsed >= 15000) {
            clearInterval(timer);
            reject(new Error('The map is still loading. Please try printing again.'));
          }
        }, 100);
      }));
    };
    map.getContainer().dataset.mapReady = 'true';
    window.addEventListener('ano-prepare-print', prepare);
    window.addEventListener('beforeprint', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('ano-prepare-print', prepare);
      window.removeEventListener('beforeprint', fit);
    };
  }, [map, points]);
  return null;
}

export default function ItineraryMap({ activities = [], routeSegments = [] }) {
  const stops = useMemo(() => activities.map((activity, index) => ({ ...activity, markerNumber: activity.markerNumber ?? index + 1 }))
    .filter((a) => validCoordinate(a.exact_latitude, a.exact_longitude)), [activities]);
  const lines = useMemo(() => routeLines(routeSegments), [routeSegments]);
  const points = useMemo(() => [...stops.map((a) => [Number(a.exact_latitude), Number(a.exact_longitude)]), ...lines.flat()], [stops, lines]);
  return <div className="itinerary-map h-[450px] w-full overflow-hidden rounded-xl border border-slate-200 relative z-0">
    <MapContainer center={points[0] || [14.6042, 120.9822]} zoom={13} scrollWheelZoom={false} className="h-full w-full z-0">
      <MapViewport points={points} />
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {lines.map((line, index) => <Polyline key={JSON.stringify(line)} positions={line} pathOptions={{ color: '#0f766e', weight: 4, opacity: .85 }} />)}
      {stops.map((activity, index) => <Marker key={index} position={[Number(activity.exact_latitude), Number(activity.exact_longitude)]}
        icon={L.divIcon({ className: 'numbered-map-marker', html: `<span>${Number(activity.markerNumber)}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] })}>
        <Popup><strong>{activity.markerNumber}. {activity.name}</strong><br />{activity.location || activity.destination}</Popup>
      </Marker>)}
    </MapContainer>
  </div>;
}
