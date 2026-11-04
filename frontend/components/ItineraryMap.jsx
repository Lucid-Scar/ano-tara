"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from "react-leaflet";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Next.js hotfix for missing Leaflet marker icons
const customIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapViewport({ center }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);

  return null;
}

export default function ItineraryMap({ activities = [], routeSegments = [] }) {
  const firstActivity = activities.find((activity) => (
    Number.isFinite(Number(activity.exact_latitude))
    && Number.isFinite(Number(activity.exact_longitude))
  ));
  const center = firstActivity
    ? [Number(firstActivity.exact_latitude), Number(firstActivity.exact_longitude)]
    : [14.6042, 120.9822];

  return (
    <div className="h-[450px] w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm z-0 relative">
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="h-full w-full z-0">
        <MapViewport center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Render the actual OSRM road paths connecting the activities */}
        {routeSegments.map((segment, index) => {
          if (segment.routing?.status === "success" && segment.routing.geometry) {
            return (
              <GeoJSON 
                key={`route-${index}`} 
                data={segment.routing.geometry} 
                style={{ color: "#0f172a", weight: 5, opacity: 0.8 }} 
              />
            );
          }
          return null;
        })}

        {/* Drop pins for each scheduled activity */}
        {activities.map((activity, index) => {
           if (!Number.isFinite(Number(activity.exact_latitude)) || !Number.isFinite(Number(activity.exact_longitude))) return null;
           return (
             <Marker 
               key={`marker-${index}`} 
               position={[Number(activity.exact_latitude), Number(activity.exact_longitude)]} 
               icon={customIcon}
             >
               <Popup className="font-sans">
                 <strong className="text-sm text-slate-900">{index + 1}. {activity.name}</strong><br/>
                 <span className="text-xs text-slate-500 capitalize">{activity.type} Activity</span>
               </Popup>
             </Marker>
           );
        })}
      </MapContainer>
    </div>
  );
}