import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Zap, Plug, Navigation, Clock, ExternalLink, Car } from "lucide-react";

type Station = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  availability_status: string;
  charging_power_kw: number;
  charger_types: string[];
  total_slots: number;
  current_load: number;
  distance_km: number | null;
  source: string;
};

interface StationDetailModalProps {
  station: Station | null;
  open: boolean;
  onClose: () => void;
  onBook: (station: Station) => void;
  userLocation?: { lat: number; lng: number } | null;
}

const statusStyles: Record<string, { label: string; dot: string; badge: string }> = {
  available: { label: "Available", dot: "bg-accent animate-pulse", badge: "bg-accent/15 text-accent border-accent/30" },
  busy: { label: "Busy", dot: "bg-amber-400", badge: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
  unavailable: { label: "Offline", dot: "bg-destructive", badge: "bg-destructive/15 text-destructive border-destructive/30" },
};

const StationDetailModal = ({ station, open, onClose, onBook, userLocation }: StationDetailModalProps) => {
  if (!station) return null;

  const status = statusStyles[station.availability_status] || statusStyles.unavailable;

  const directionsUrl = userLocation
    ? `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${station.latitude},${station.longitude}`
    : `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`;

  const estimateTime = station.charging_power_kw > 0
    ? `~${Math.round(60 / station.charging_power_kw * 30)} min for 30 kWh`
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <DialogTitle className="font-display text-lg leading-tight pr-6">
              {station.name}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${status.badge}`}>
            <span className={`w-2 h-2 rounded-full ${status.dot}`} />
            {status.label}
          </span>
          <Badge variant="outline" className="text-[10px]">{station.source}</Badge>
        </div>

        {/* Info grid */}
        <div className="space-y-3 mt-1">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span className="text-muted-foreground">{station.address}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {station.charging_power_kw > 0 && (
              <div className="glass-card p-3 text-center">
                <Zap className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-sm font-semibold text-foreground">{station.charging_power_kw} kW</p>
                <p className="text-[10px] text-muted-foreground">Charging Power</p>
              </div>
            )}
            <div className="glass-card p-3 text-center">
              <Car className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-sm font-semibold text-foreground">{station.total_slots}</p>
              <p className="text-[10px] text-muted-foreground">Total Slots</p>
            </div>
            {station.distance_km && (
              <div className="glass-card p-3 text-center">
                <Navigation className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-sm font-semibold text-foreground">{station.distance_km} km</p>
                <p className="text-[10px] text-muted-foreground">Distance</p>
              </div>
            )}
            {estimateTime && (
              <div className="glass-card p-3 text-center">
                <Clock className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-sm font-semibold text-foreground">{estimateTime}</p>
                <p className="text-[10px] text-muted-foreground">Est. Charge Time</p>
              </div>
            )}
          </div>

          {/* Charger types */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
              <Plug className="w-3 h-3" /> Charger Types
            </p>
            <div className="flex flex-wrap gap-1.5">
              {station.charger_types.map((t) => (
                <Badge key={t} variant="secondary" className="text-[11px]">{t}</Badge>
              ))}
            </div>
          </div>

          {/* Load indicator */}
          {station.current_load > 0 && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Current Load</span>
                <span className="text-foreground font-medium">{station.current_load}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    station.current_load < 50 ? "bg-accent" : station.current_load < 80 ? "bg-amber-400" : "bg-destructive"
                  }`}
                  style={{ width: `${station.current_load}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-2">
          <Button
            variant="electric"
            className="flex-1"
            onClick={() => { onClose(); onBook(station); }}
            disabled={station.availability_status === "unavailable"}
          >
            <Zap className="w-4 h-4" /> Book Slot
          </Button>
          <Button variant="outline" className="flex-1" asChild>
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" /> Directions
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StationDetailModal;
