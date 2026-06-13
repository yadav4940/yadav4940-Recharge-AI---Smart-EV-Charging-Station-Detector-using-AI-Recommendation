import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Zap, Users, Plug, Star, ChevronRight, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import BookingDialog from "@/components/BookingDialog";
import LeafletMap, { type MapMarker } from "@/components/LeafletMap";

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

type Props = {
  userProfile: {
    vehicle_range: number | null;
    charging_plug_type: string | null;
  } | null;
};

const StationFinder = ({ userProfile }: Props) => {
  const [stations, setStations] = useState<Station[]>([]);
  const [range, setRange] = useState(userProfile?.vehicle_range?.toString() || "");
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    supabase.from("charging_stations").select("*").then(({ data }) => {
      if (data) setStations(data as Station[]);
    });
  }, []);

  // Simple AI ranking: prefer available, compatible plug, lower load
  const rankedStations = [...stations].sort((a, b) => {
    let scoreA = 0, scoreB = 0;
    if (a.availability_status === "available") scoreA += 10;
    if (b.availability_status === "available") scoreB += 10;
    if (userProfile?.charging_plug_type && a.charger_types.includes(userProfile.charging_plug_type)) scoreA += 5;
    if (userProfile?.charging_plug_type && b.charger_types.includes(userProfile.charging_plug_type)) scoreB += 5;
    scoreA -= a.current_load;
    scoreB -= b.current_load;
    scoreA += a.charging_power_kw / 50;
    scoreB += b.charging_power_kw / 50;
    return scoreB - scoreA;
  }).slice(0, 5);

  const mapMarkers: MapMarker[] = rankedStations.map((s, i) => ({
    lat: s.latitude,
    lng: s.longitude,
    label: s.name,
    type: "station" as const,
    popup: `<strong>#${i + 1} ${s.name}</strong><br/>${s.address}<br/><em>${s.charging_power_kw} kW · ${s.availability_status}</em>`,
  }));

  return (
    <div className="space-y-6">
      {/* Range Input */}
      <div className="glass-card p-4 flex flex-col sm:flex-row items-end gap-4">
        <div className="flex-1 w-full">
          <Label className="text-muted-foreground text-sm">Your remaining range (km)</Label>
          <Input
            type="number"
            value={range}
            onChange={e => setRange(e.target.value)}
            placeholder="Enter remaining range"
            className="mt-1 bg-muted/50 border-border"
          />
        </div>
        <Button variant="electric" size="default">
          <MapPin className="w-4 h-4 mr-1" /> Find Stations
        </Button>
      </div>

      {/* Map Toggle + AI Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 w-fit">
          <Star className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-medium text-accent">AI Ranked — Top 5 Best Matches</span>
        </div>
        <Button
          variant="ghost-glow"
          size="sm"
          onClick={() => setShowMap(!showMap)}
        >
          <Map className="w-4 h-4 mr-1" />
          {showMap ? "Hide Map" : "Show Map"}
        </Button>
      </div>

      {/* Live Map */}
      {showMap && rankedStations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="glass-card p-3 overflow-hidden"
        >
          <LeafletMap
            markers={mapMarkers}
            className="rounded-lg"
            onMarkerClick={(m) => {
              const station = rankedStations.find(s => s.latitude === m.lat && s.longitude === m.lng);
              if (station) setSelectedStation(station);
            }}
          />
        </motion.div>
      )}

      {/* Station Cards */}
      <div className="space-y-4">
        {rankedStations.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass-card p-5 hover:border-primary/30 transition-all cursor-pointer group"
            onClick={() => setSelectedStation(s)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-primary">#{i + 1}</span>
                  <h3 className="font-display font-semibold text-foreground">{s.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    s.availability_status === "available"
                      ? "bg-accent/10 text-accent"
                      : "bg-destructive/10 text-destructive"
                  }`}>
                    {s.availability_status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {s.address}
                </p>

                <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-primary" /> {s.charging_power_kw} kW
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {s.current_load}/{s.total_slots} slots
                  </span>
                  <span className="flex items-center gap-1">
                    <Plug className="w-3 h-3" /> {s.charger_types.join(", ")}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>

      {selectedStation && (
        <BookingDialog
          station={selectedStation}
          open={!!selectedStation}
          onClose={() => setSelectedStation(null)}
        />
      )}
    </div>
  );
};

export default StationFinder;
