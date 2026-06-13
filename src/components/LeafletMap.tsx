import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export type MapMarker = {
  lat: number;
  lng: number;
  label: string;
  type?:
    | "station"
    | "station-available"
    | "station-busy"
    | "station-offline"
    | "station-along"
    | "station-recommended"
    | "start"
    | "end"
    | "stop";
  popup?: string;
};

type Props = {
  markers: MapMarker[];
  /** Drawn as solid main route */
  routePoints?: [number, number][];
  /** Optional dashed planning line */
  planLine?: [number, number][];
  center?: [number, number];
  zoom?: number;
  className?: string;
  height?: string;
  userLocation?: [number, number] | null;
  onMarkerClick?: (marker: MapMarker) => void;
};

const stationIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 6 7 12 13 12 9 18"/></svg>`;
const starIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 9 22 9 17 14 19 22 12 17 5 22 7 14 2 9 9 9 12 2"/></svg>`;

const markerConfig: Record<string, { color: string; icon: string; size?: number; ring?: string }> = {
  station: { color: "#22c55e", icon: stationIcon },
  "station-available": { color: "#22c55e", icon: stationIcon },
  "station-busy": { color: "#f59e0b", icon: stationIcon },
  "station-offline": { color: "#ef4444", icon: stationIcon },
  "station-along": { color: "#64748b", icon: stationIcon, size: 28 },
  "station-recommended": { color: "#06b6d4", icon: starIcon, size: 42, ring: "0 0 0 4px rgba(6,182,212,0.25)" },
  start: { color: "#3b82f6", icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>` },
  end: { color: "#ef4444", icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>` },
  stop: { color: "#06b6d4", icon: starIcon, size: 40, ring: "0 0 0 4px rgba(6,182,212,0.25)" },
};

const createIcon = (type: string) => {
  const config = markerConfig[type] || markerConfig.station;
  const size = config.size || 36;
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: ${size}px; height: ${size}px; border-radius: 50%;
      background: ${config.color}; border: 3px solid white;
      box-shadow: 0 3px 12px rgba(0,0,0,0.35)${config.ring ? ", " + config.ring : ""};
      display: flex; align-items: center; justify-content: center;
    ">${config.icon}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
  });
};

const userIcon = L.divIcon({
  className: "user-marker",
  html: `<div style="position:relative;width:22px;height:22px;">
    <div style="position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,0.35);animation:pulseUser 1.6s infinite;"></div>
    <div style="position:absolute;top:5px;left:5px;width:12px;height:12px;border-radius:50%;background:#3b82f6;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>
  </div>
  <style>@keyframes pulseUser {0%{transform:scale(0.6);opacity:1}100%{transform:scale(1.6);opacity:0}}</style>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const LeafletMap = ({
  markers,
  routePoints,
  planLine,
  center,
  zoom = 6,
  className = "",
  height = "350px",
  userLocation,
  onMarkerClick,
}: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Init map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      center: center || [20.5937, 78.9629],
      zoom,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    mapInstanceRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers + routes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing layers (except tiles + user marker)
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer !== userMarkerRef.current) map.removeLayer(layer);
      if (layer instanceof L.Polyline) map.removeLayer(layer);
    });

    const bounds = L.latLngBounds([]);

    markers.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], { icon: createIcon(m.type || "station") }).addTo(map);
      marker.bindPopup(m.popup || `<strong>${m.label}</strong>`, { maxWidth: 240 });
      if (onMarkerClick) marker.on("click", () => onMarkerClick(m));
      bounds.extend([m.lat, m.lng]);
    });

    if (routePoints && routePoints.length > 1) {
      L.polyline(routePoints, { color: "#06b6d4", weight: 5, opacity: 0.85 }).addTo(map);
      L.polyline(routePoints, { color: "#0891b2", weight: 9, opacity: 0.25 }).addTo(map);
      routePoints.forEach((p) => bounds.extend(p));
    }
    if (planLine && planLine.length > 1) {
      L.polyline(planLine, { color: "#6366f1", weight: 3, opacity: 0.55, dashArray: "8,8" }).addTo(map);
    }

    if (markers.length > 0 || (routePoints && routePoints.length > 1)) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      } catch {}
    } else if (center) {
      map.setView(center, zoom);
    }
  }, [markers, routePoints, planLine]);

  // User location
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }
    if (userLocation) {
      userMarkerRef.current = L.marker(userLocation, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
    }
  }, [userLocation]);

  return (
    <div
      ref={mapRef}
      className={`w-full rounded-lg border border-border overflow-hidden ${className}`}
      style={{ height, minHeight: "250px" }}
    />
  );
};

export default LeafletMap;
