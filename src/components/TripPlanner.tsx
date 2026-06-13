import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation, MapPin, Zap, Battery, Clock, ChevronRight, Route, AlertTriangle,
  CheckCircle2, Fuel, Map, Star, LocateFixed, Crosshair, Gauge, ListChecks,
  Volume2, VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import LeafletMap, { type MapMarker } from "@/components/LeafletMap";
import { useVoiceGuidance } from "@/hooks/useVoiceGuidance";

type Station = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  availability_status: string;
  current_load: number;
  total_slots: number;
  charger_types: string[];
  charging_power_kw: number;
};

type ScoredStation = Station & {
  distFromRouteKm: number;
  distFromStartKm: number;
  detourKm: number;
  rating: number;
  score: number;
};

type TripStop = {
  station: ScoredStation;
  distanceFromStart: number;
  batteryOnArrival: number;
  chargeToPercent: number;
  chargingTimeMin: number;
};

type RouteData = {
  geometry: [number, number][];
  distance_km: number;
  duration_min: number;
  steps: { instruction: string; distance_m: number; duration_s: number; location: [number, number] | null }[];
};

type TripPlan = {
  totalDistance: number;
  drivingTime: number;
  totalChargingTime: number;
  totalTime: number;
  stops: TripStop[];
  alongRoute: ScoredStation[];
  feasible: boolean;
  route: RouteData;
  src: { lat: number; lng: number; name: string };
  dst: { lat: number; lng: number; name: string };
};

type Props = {
  userProfile: {
    vehicle_range: number | null;
    battery_capacity: number | null;
    charging_plug_type: string | null;
    ev_brand: string | null;
    ev_model: string | null;
  } | null;
};

// ---------- Geo helpers ----------
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Distance from point P to a polyline (km) + cumulative distance along the line at the closest point
function distancePointToPolyline(p: [number, number], line: [number, number][]) {
  let best = { dist: Infinity, alongKm: 0 };
  let acc = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const segLen = haversine(a[0], a[1], b[0], b[1]);
    // approximate point-to-segment using closest endpoint + projection ratio in lat/lng space
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy || 1e-9;
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const proj: [number, number] = [a[0] + t * dx, a[1] + t * dy];
    const d = haversine(p[0], p[1], proj[0], proj[1]);
    if (d < best.dist) best = { dist: d, alongKm: acc + segLen * t };
    acc += segLen;
  }
  return best;
}

// Deterministic pseudo-rating from station id (stable 3.5–4.9)
function ratingFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return Math.round((3.5 + (h % 140) / 100) * 10) / 10;
}

// ---------- Cities (used as fallback when geocoder fails) ----------
const CITIES: Record<string, { lat: number; lng: number }> = {
  delhi: { lat: 28.6139, lng: 77.209 }, "new delhi": { lat: 28.6139, lng: 77.209 },
  mumbai: { lat: 19.076, lng: 72.8777 }, bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 }, chennai: { lat: 13.0827, lng: 80.2707 },
  hyderabad: { lat: 17.385, lng: 78.4867 }, kolkata: { lat: 22.5726, lng: 88.3639 },
  pune: { lat: 18.5204, lng: 73.8567 }, ahmedabad: { lat: 23.0225, lng: 72.5714 },
  jaipur: { lat: 26.9124, lng: 75.7873 }, lucknow: { lat: 26.8467, lng: 80.9462 },
  chandigarh: { lat: 30.7333, lng: 76.7794 }, agra: { lat: 27.1767, lng: 78.0081 },
  nagpur: { lat: 21.1458, lng: 79.0882 }, surat: { lat: 21.1702, lng: 72.8311 },
  vadodara: { lat: 22.3072, lng: 73.1812 }, indore: { lat: 22.7196, lng: 75.8577 },
  bhopal: { lat: 23.2599, lng: 77.4126 }, goa: { lat: 15.2993, lng: 74.124 },
  dehradun: { lat: 30.3165, lng: 78.0322 }, udaipur: { lat: 24.5854, lng: 73.7125 },
};

async function geocode(name: string, projectId: string, anonKey: string): Promise<{ lat: number; lng: number } | null> {
  const key = name.trim().toLowerCase();
  if (CITIES[key]) return CITIES[key];
  try {
    const r = await fetch(
      `https://${projectId}.supabase.co/functions/v1/route-planner?action=geocode&q=${encodeURIComponent(name + ", India")}`,
      { headers: { Authorization: `Bearer ${anonKey}` } },
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d.lat ? { lat: d.lat, lng: d.lng } : null;
  } catch { return null; }
}

const TripPlanner = ({ userProfile }: Props) => {
  const { toast } = useToast();
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [currentBattery, setCurrentBattery] = useState("80");
  const [bufferKm, setBufferKm] = useState(5);
  const [planning, setPlanning] = useState(false);
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);

  // Live tracking
  const [tracking, setTracking] = useState(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [deviated, setDeviated] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Voice guidance
  const voice = useVoiceGuidance(true);
  const announcedStopsRef = useRef<Set<string>>(new Set());
  const lastDeviationSpeakRef = useRef<number>(0);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const vehicleRange = userProfile?.vehicle_range || 300;
  const batteryCapacity = userProfile?.battery_capacity || 50;
  const plugType = userProfile?.charging_plug_type;

  // ---------- Routing call ----------
  const fetchRoute = async (waypoints: { lat: number; lng: number }[]): Promise<RouteData | null> => {
    try {
      const r = await fetch(`https://${projectId}.supabase.co/functions/v1/route-planner`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({ coordinates: waypoints.map((w) => [w.lng, w.lat]) }),
      });
      if (!r.ok) throw new Error(`route ${r.status}`);
      return await r.json();
    } catch (e) {
      console.error("route fetch failed", e);
      return null;
    }
  };

  // ---------- Trip planning ----------
  const planTrip = async () => {
    setPlanning(true);
    setTripPlan(null);
    try {
      const [srcCoord, dstCoord] = await Promise.all([
        geocode(source, projectId, anonKey),
        geocode(destination, projectId, anonKey),
      ]);
      if (!srcCoord) { toast({ title: "Source not found", variant: "destructive" }); return; }
      if (!dstCoord) { toast({ title: "Destination not found", variant: "destructive" }); return; }

      const route = await fetchRoute([srcCoord, dstCoord]);
      if (!route) { toast({ title: "Couldn't get route", description: "Routing service unavailable", variant: "destructive" }); return; }

      const { data: stations } = await supabase.from("charging_stations").select("*");
      if (!stations) { toast({ title: "No stations available", variant: "destructive" }); return; }

      const totalDistance = route.distance_km;
      const batteryPercent = parseFloat(currentBattery) || 80;
      const currentRange = (batteryPercent / 100) * vehicleRange;

      // Filter stations within buffer corridor of route
      const corridor: ScoredStation[] = [];
      for (const s of stations as Station[]) {
        const { dist, alongKm } = distancePointToPolyline([s.latitude, s.longitude], route.geometry);
        if (dist <= bufferKm) {
          const detour = dist * 2; // there + back
          const rating = ratingFor(s.id);
          corridor.push({ ...s, distFromRouteKm: dist, distFromStartKm: alongKm, detourKm: detour, rating, score: 0 });
        }
      }
      corridor.sort((a, b) => a.distFromStartKm - b.distFromStartKm);

      // Plug-type compatibility filter (soft preference)
      const isCompatible = (s: ScoredStation) =>
        !plugType || s.charger_types.length === 0 || s.charger_types.some((c) => c.toLowerCase().includes(plugType.toLowerCase().slice(0, 4)));

      // ---------- Scoring ----------
      const maxPower = Math.max(...corridor.map((s) => s.charging_power_kw || 1), 1);
      const scoreStation = (s: ScoredStation, neededByKm: number) => {
        const distFactor = 1 - Math.min(s.distFromRouteKm / bufferKm, 1); // closer to route = better
        const ratingFactor = (s.rating - 3) / 2; // 0..1
        const availFactor = s.availability_status === "available"
          ? 1 - s.current_load / Math.max(s.total_slots, 1)
          : 0.1;
        const speedFactor = (s.charging_power_kw || 0) / maxPower;
        const reachFactor = s.distFromStartKm <= neededByKm ? 1 : 0.3; // must be reachable
        const compatBonus = isCompatible(s) ? 0.1 : 0;
        return (
          0.25 * distFactor +
          0.20 * ratingFactor +
          0.25 * availFactor +
          0.20 * speedFactor +
          0.10 * reachFactor +
          compatBonus
        );
      };

      // ---------- Greedy stop selection w/ smart scoring ----------
      const MIN_ARRIVAL_PERCENT = 10;
      const minSafeRange = (MIN_ARRIVAL_PERCENT / 100) * vehicleRange;

      const stops: TripStop[] = [];
      let remainingRange = currentRange;
      let currentPos = 0;
      let safety = 0;

      while (currentPos + remainingRange < totalDistance && safety++ < 12) {
        const reachableLimit = currentPos + remainingRange - minSafeRange;
        const candidates = corridor.filter(
          (s) => s.distFromStartKm > currentPos + 5 && s.distFromStartKm <= reachableLimit,
        );
        if (candidates.length === 0) break;

        // Score each candidate; prefer the one furthest along that scores well
        const scored = candidates.map((c) => {
          const baseScore = scoreStation(c, reachableLimit);
          const progressBonus = (c.distFromStartKm - currentPos) / (reachableLimit - currentPos || 1) * 0.3;
          return { ...c, score: baseScore + progressBonus };
        });
        scored.sort((a, b) => b.score - a.score);
        const pick = scored[0];

        const segmentDist = pick.distFromStartKm - currentPos;
        const rangeAfter = remainingRange - segmentDist;
        const batteryOnArrival = Math.max(0, (rangeAfter / vehicleRange) * 100);
        const chargeToPercent = 90;
        const energyNeeded = ((chargeToPercent - batteryOnArrival) / 100) * batteryCapacity;
        const chargingTimeMin = Math.max(10, Math.round((energyNeeded / Math.max(pick.charging_power_kw, 7)) * 60));

        stops.push({
          station: pick,
          distanceFromStart: pick.distFromStartKm,
          batteryOnArrival: Math.round(batteryOnArrival),
          chargeToPercent,
          chargingTimeMin,
        });

        remainingRange = (chargeToPercent / 100) * vehicleRange;
        currentPos = pick.distFromStartKm;
      }

      const lastDist = totalDistance - currentPos;
      const feasible = remainingRange >= lastDist;
      const totalChargingTime = stops.reduce((s, x) => s + x.chargingTimeMin, 0);

      // Score all corridor stations for display
      const alongRoute = corridor
        .map((s) => ({ ...s, score: scoreStation(s, totalDistance) }))
        .sort((a, b) => b.score - a.score);

      setTripPlan({
        totalDistance: Math.round(totalDistance),
        drivingTime: route.duration_min,
        totalChargingTime,
        totalTime: route.duration_min + totalChargingTime,
        stops,
        alongRoute,
        feasible,
        route,
        src: { ...srcCoord, name: source },
        dst: { ...dstCoord, name: destination },
      });
      toast({ title: "Trip planned", description: `${Math.round(totalDistance)} km · ${stops.length} charging stop${stops.length === 1 ? "" : "s"}` });
    } catch (e) {
      console.error(e);
      toast({ title: "Planning failed", variant: "destructive" });
    } finally {
      setPlanning(false);
    }
  };

  // ---------- Live GPS tracking ----------
  const startTracking = () => {
    if (!tripPlan) return;
    if (!("geolocation" in navigator)) {
      toast({ title: "Geolocation unavailable", variant: "destructive" });
      return;
    }
    setTracking(true);
    setActiveStepIdx(0);
    setDeviated(false);
    announcedStopsRef.current.clear();

    // Initial spoken summary
    voice.speak(
      `Navigation started. ${tripPlan.totalDistance} kilometers to ${tripPlan.dst.name}. ${
        tripPlan.stops.length === 0
          ? "No charging stops needed."
          : `${tripPlan.stops.length} charging stop${tripPlan.stops.length === 1 ? "" : "s"} planned.`
      } Drive safely.`,
      { priority: true },
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(p);
        if (!tripPlan) return;
        const { dist } = distancePointToPolyline(p, tripPlan.route.geometry);
        const isOff = dist > 0.5;
        if (isOff && !deviated) {
          const now = Date.now();
          if (now - lastDeviationSpeakRef.current > 15000) {
            voice.speak("You have deviated from the route. Re-routing now.", { priority: true });
            lastDeviationSpeakRef.current = now;
          }
        }
        setDeviated(isOff);

        // advance step when within 80m of next maneuver
        const next = tripPlan.route.steps[activeStepIdx + 1];
        if (next?.location) {
          const d = haversine(p[0], p[1], next.location[0], next.location[1]);
          // Pre-announce 200m before turn
          if (d < 0.2 && d >= 0.08) {
            voice.speak(`In ${Math.round(d * 1000)} meters, ${next.instruction}.`);
          }
          if (d < 0.08) {
            voice.speak(next.instruction, { priority: true });
            setActiveStepIdx((i) => i + 1);
          }
        }

        // Charging stop proximity alerts (2km warning)
        for (const stop of tripPlan.stops) {
          const dStop = haversine(p[0], p[1], stop.station.latitude, stop.station.longitude);
          if (dStop < 2 && !announcedStopsRef.current.has(stop.station.id)) {
            announcedStopsRef.current.add(stop.station.id);
            voice.speak(
              `Charging stop ahead in ${dStop.toFixed(1)} kilometers. ${stop.station.name}. Estimated arrival battery ${stop.batteryOnArrival} percent. Plan to charge for ${stop.chargingTimeMin} minutes.`,
              { priority: true },
            );
          }
        }

        // Destination reached
        const dDest = haversine(p[0], p[1], tripPlan.dst.lat, tripPlan.dst.lng);
        if (dDest < 0.15) {
          voice.speak(`You have arrived at ${tripPlan.dst.name}.`, { priority: true });
          stopTracking();
        }
      },
      (err) => {
        console.error(err);
        toast({ title: "GPS error", description: err.message, variant: "destructive" });
        voice.speak("GPS signal lost.", { priority: true });
        stopTracking();
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
  };
  const stopTracking = () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setTracking(false);
    voice.cancel();
  };
  useEffect(() => () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); }, []);

  // Low battery warning when tracking
  useEffect(() => {
    if (!tracking || !tripPlan) return;
    const pct = parseFloat(currentBattery) || 0;
    if (pct > 0 && pct < 15) {
      voice.speak("Warning. Battery is low. Please charge soon.", { priority: true });
    }
  }, [tracking, currentBattery, tripPlan, voice]);

  // Re-route on deviation
  useEffect(() => {
    if (!deviated || !tripPlan || !userPos) return;
    (async () => {
      toast({ title: "Re-routing…", description: "You deviated from the planned path" });
      const newRoute = await fetchRoute([
        { lat: userPos[0], lng: userPos[1] },
        ...tripPlan.stops.map((s) => ({ lat: s.station.latitude, lng: s.station.longitude })),
        { lat: tripPlan.dst.lat, lng: tripPlan.dst.lng },
      ]);
      if (newRoute) {
        setTripPlan({
          ...tripPlan,
          route: newRoute,
          totalDistance: Math.round(newRoute.distance_km),
          drivingTime: newRoute.duration_min,
          totalTime: newRoute.duration_min + tripPlan.totalChargingTime,
        });
        setActiveStepIdx(0);
        setDeviated(false);
        voice.speak("New route ready. Continue driving.", { priority: true });
      }
    })();
  }, [deviated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Map markers ----------
  const mapMarkers = useMemo<MapMarker[]>(() => {
    if (!tripPlan) return [];
    const stopIds = new Set(tripPlan.stops.map((s) => s.station.id));
    const along: MapMarker[] = tripPlan.alongRoute
      .filter((s) => !stopIds.has(s.id))
      .slice(0, 25)
      .map((s) => ({
        lat: s.latitude, lng: s.longitude, label: s.name, type: "station-along",
        popup: `<strong>${s.name}</strong><br/>${s.charging_power_kw} kW · ★ ${s.rating}<br/><em>${s.distFromRouteKm.toFixed(1)} km off route</em>`,
      }));
    const stopMarkers: MapMarker[] = tripPlan.stops.map((stop, i) => ({
      lat: stop.station.latitude, lng: stop.station.longitude, label: stop.station.name, type: "stop",
      popup: `<strong>⭐ Recommended Stop ${i + 1}</strong><br/>${stop.station.name}<br/>${stop.chargingTimeMin} min · ${stop.station.charging_power_kw} kW · ★ ${stop.station.rating}`,
    }));
    return [
      { lat: tripPlan.src.lat, lng: tripPlan.src.lng, label: tripPlan.src.name, type: "start", popup: `<strong>Start:</strong> ${tripPlan.src.name}` },
      ...along,
      ...stopMarkers,
      { lat: tripPlan.dst.lat, lng: tripPlan.dst.lng, label: tripPlan.dst.name, type: "end", popup: `<strong>Destination:</strong> ${tripPlan.dst.name}` },
    ];
  }, [tripPlan]);

  return (
    <div className="space-y-6">
      {/* Input Card */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Route className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-xl text-foreground">Smart Trip Planner</h2>
            <p className="text-xs text-muted-foreground">Real-route navigation · Intelligent charging stops · Live GPS</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <Label className="text-muted-foreground text-xs">From</Label>
            <div className="relative mt-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
              <Input placeholder="e.g. Delhi" value={source} onChange={(e) => setSource(e.target.value)} className="pl-9 bg-muted/50 border-border" />
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">To</Label>
            <div className="relative mt-1">
              <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
              <Input placeholder="e.g. Mumbai" value={destination} onChange={(e) => setDestination(e.target.value)} className="pl-9 bg-muted/50 border-border" />
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Current Battery (%)</Label>
            <div className="relative mt-1">
              <Battery className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
              <Input type="number" min={5} max={100} value={currentBattery} onChange={(e) => setCurrentBattery(e.target.value)} className="pl-9 bg-muted/50 border-border" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-primary" />Range: {vehicleRange} km</span>
            <span className="flex items-center gap-1"><Battery className="w-3 h-3 text-accent" />Battery: {batteryCapacity} kWh</span>
            {plugType && <span className="flex items-center gap-1"><Fuel className="w-3 h-3 text-primary" />{plugType}</span>}
            <span className="flex items-center gap-1">
              <Crosshair className="w-3 h-3 text-primary" />
              Corridor:
              <select value={bufferKm} onChange={(e) => setBufferKm(parseInt(e.target.value))} className="bg-transparent border border-border rounded px-1 ml-1">
                <option value={2}>2 km</option><option value={5}>5 km</option><option value={10}>10 km</option>
              </select>
            </span>
          </div>
          <Button variant="electric" onClick={planTrip} disabled={planning || !source || !destination}>
            {planning ? "Planning…" : "Plan Route"}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {tripPlan && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            {/* Map */}
            <div className="glass-card p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <Map className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Route Map</span>
                  {deviated && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">Off route</span>}
                </div>
                {!tracking ? (
                  <Button size="sm" variant="ghost-glow" onClick={startTracking}>
                    <LocateFixed className="w-3 h-3" /> Start Live Nav
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    {voice.supported && (
                      <Button
                        size="sm"
                        variant={voice.enabled ? "ghost-glow" : "outline"}
                        onClick={() => voice.setEnabled(!voice.enabled)}
                        title={voice.enabled ? "Mute voice" : "Unmute voice"}
                      >
                        {voice.enabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                        {voice.enabled ? "Voice On" : "Voice Off"}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={stopTracking}>Stop Nav</Button>
                  </div>
                )}
              </div>
              <LeafletMap
                markers={mapMarkers}
                routePoints={tripPlan.route.geometry}
                userLocation={userPos}
                height="420px"
                className="rounded-lg"
              />
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Route, label: "Distance", value: `${tripPlan.totalDistance} km`, color: "text-primary" },
                { icon: Clock, label: "Total Time", value: `${Math.floor(tripPlan.totalTime / 60)}h ${tripPlan.totalTime % 60}m`, color: "text-accent" },
                { icon: Zap, label: "Charging Stops", value: `${tripPlan.stops.length}`, color: "text-primary" },
                { icon: Battery, label: "Charging Time", value: `${tripPlan.totalChargingTime} min`, color: "text-accent" },
              ].map((stat) => (
                <div key={stat.label} className="glass-card p-4 text-center">
                  <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                  <p className="text-lg font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {!tripPlan.feasible && (
              <div className="glass-card p-4 border-destructive/50 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Range anxiety alert</p>
                  <p className="text-xs text-muted-foreground">No charging station within reach for the final leg. Consider a smaller buffer or starting with more battery.</p>
                </div>
              </div>
            )}

            {/* Turn-by-turn */}
            {tracking && tripPlan.route.steps.length > 0 && (
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Gauge className="w-4 h-4 text-primary" />
                  <h3 className="font-display font-semibold text-foreground">Turn-by-turn</h3>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {tripPlan.route.steps.map((s, i) => (
                    <div key={i} className={`flex items-start gap-3 p-2 rounded-lg ${i === activeStepIdx ? "bg-primary/10 border border-primary/30" : "bg-muted/30"}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === activeStepIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground capitalize">{s.instruction}</p>
                        <p className="text-xs text-muted-foreground">{(s.distance_m / 1000).toFixed(1)} km · {Math.round(s.duration_s / 60)} min</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended stops */}
            {tripPlan.stops.length > 0 && (
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-4 h-4 text-primary fill-primary" />
                  <h3 className="font-display font-semibold text-foreground">Recommended Charging Stops</h3>
                </div>
                <div className="space-y-3">
                  {tripPlan.stops.map((stop, i) => (
                    <motion.div key={stop.station.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                      className="glass-card p-4 border-primary/30 bg-primary/5">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">STOP {i + 1}</span>
                            <p className="font-semibold text-foreground">{stop.station.name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{stop.station.address}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-amber-400"><Star className="w-3 h-3 fill-current" /><span className="text-sm font-semibold">{stop.station.rating}</span></div>
                          <p className="text-xs text-muted-foreground">Score {Math.round(stop.station.score * 100)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs mt-2">
                        <div className="bg-muted/50 rounded p-2 text-center">
                          <p className="text-muted-foreground">Distance</p>
                          <p className="font-semibold text-foreground">{Math.round(stop.distanceFromStart)} km</p>
                        </div>
                        <div className="bg-muted/50 rounded p-2 text-center">
                          <p className="text-muted-foreground">Arrival</p>
                          <p className={`font-semibold ${stop.batteryOnArrival < 15 ? "text-destructive" : "text-accent"}`}>{stop.batteryOnArrival}%</p>
                        </div>
                        <div className="bg-muted/50 rounded p-2 text-center">
                          <p className="text-muted-foreground">Charge</p>
                          <p className="font-semibold text-primary">{stop.chargingTimeMin} min</p>
                        </div>
                        <div className="bg-muted/50 rounded p-2 text-center">
                          <p className="text-muted-foreground">Power</p>
                          <p className="font-semibold text-foreground">{stop.station.charging_power_kw} kW</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Other along-route stations */}
            {tripPlan.alongRoute.length > tripPlan.stops.length && (
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks className="w-4 h-4 text-accent" />
                  <h3 className="font-display font-semibold text-foreground">Other Stations Along Route</h3>
                  <span className="text-xs text-muted-foreground">(within {bufferKm} km buffer)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {tripPlan.alongRoute
                    .filter((s) => !tripPlan.stops.some((st) => st.station.id === s.id))
                    .slice(0, 8)
                    .map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{s.name}</p>
                          <p className="text-muted-foreground">{Math.round(s.distFromStartKm)} km · {s.distFromRouteKm.toFixed(1)} km off route</p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className="flex items-center gap-1 text-amber-400"><Star className="w-3 h-3 fill-current" />{s.rating}</div>
                          <p className="text-muted-foreground">{s.charging_power_kw} kW</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {tripPlan.stops.length === 0 && tripPlan.feasible && (
              <div className="glass-card p-4 flex items-center gap-3 border-accent/30">
                <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-accent">No charging stops needed</p>
                  <p className="text-xs text-muted-foreground">Your {currentBattery}% battery covers the full {tripPlan.totalDistance} km trip.</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TripPlanner;
