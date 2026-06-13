import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Zap, MapPin, IndianRupee, Clock, Battery } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Station = {
  id: string;
  name: string;
  address: string;
  total_slots: number;
  charging_power_kw: number;
  charger_types: string[];
  latitude?: number;
  longitude?: number;
};

const timeSlots = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00",
];

// Avg India fast-charging tariff (₹/kWh)
const PRICE_PER_KWH = 18;

type Props = { station: Station; open: boolean; onClose: () => void; rescheduleBookingId?: string | null };

const BookingDialog = ({ station, open, onClose, rescheduleBookingId }: Props) => {
  const { toast } = useToast();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slot, setSlot] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookedKeys, setBookedKeys] = useState<Set<string>>(new Set()); // `${time}-${slot}`
  const [battery, setBattery] = useState<number | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!open) return;
    setDate(""); setTime(""); setSlot(""); setBookedKeys(new Set());

    // Load user's battery capacity for cost/duration estimate
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("battery_capacity").eq("user_id", user.id).maybeSingle();
      if (data?.battery_capacity) setBattery(Number(data.battery_capacity));
    });
  }, [open]);

  // Fetch bookings for the selected date to mark occupied slots
  useEffect(() => {
    if (!date || !open) { setBookedKeys(new Set()); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select("booking_time, slot_number, status, id")
        .eq("station_id", station.id)
        .eq("booking_date", date)
        .neq("status", "cancelled");
      if (cancelled || !data) return;
      const keys = new Set<string>();
      for (const b of data) {
        if (rescheduleBookingId && b.id === rescheduleBookingId) continue; // skip the one being rescheduled
        keys.add(`${b.booking_time}-${b.slot_number}`);
      }
      setBookedKeys(keys);
    })();
    return () => { cancelled = true; };
  }, [date, station.id, open, rescheduleBookingId]);

  const estimate = useMemo(() => {
    // Assume user wants ~80% charge of their battery, capped by station power per hour
    const targetKwh = battery ? battery * 0.8 : 30;
    const power = station.charging_power_kw || 22;
    const hours = power > 0 ? targetKwh / power : 1;
    const cost = targetKwh * PRICE_PER_KWH;
    return {
      kwh: Math.round(targetKwh),
      hours,
      cost: Math.round(cost),
    };
  }, [battery, station.charging_power_kw]);

  const fmtHours = (h: number) => {
    const totalMin = Math.max(15, Math.round(h * 60));
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    if (hh === 0) return `${mm} min`;
    if (mm === 0) return `${hh} hr`;
    return `${hh} hr ${mm} min`;
  };

  const handleBook = async () => {
    if (!date || !time || !slot) {
      toast({ title: "Please pick date, time and slot", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // If station came from an external provider (non-UUID id like "ocm-123"),
      // upsert it into our catalog first to get a real UUID for the booking FK.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(station.id);
      let stationId = station.id;
      if (!isUuid) {
        const { data: upserted, error: upErr } = await supabase
          .from("charging_stations")
          .upsert({
            external_id: station.id,
            name: station.name,
            address: station.address || "Unknown",
            latitude: station.latitude ?? 0,
            longitude: station.longitude ?? 0,
            total_slots: station.total_slots || 1,
            charging_power_kw: station.charging_power_kw || 22,
            charger_types: station.charger_types?.length ? station.charger_types : ["Standard"],
          }, { onConflict: "external_id" })
          .select("id")
          .maybeSingle();
        if (upErr) throw upErr;
        if (!upserted?.id) throw new Error("Could not register station");
        stationId = upserted.id;
      }

      if (rescheduleBookingId) {
        const { error } = await supabase.from("bookings").update({
          booking_date: date,
          booking_time: time,
          slot_number: parseInt(slot),
          status: "confirmed",
        }).eq("id", rescheduleBookingId);
        if (error) throw error;
        toast({ title: "Booking rescheduled ⚡", description: `${date} at ${time}` });
      } else {
        const { error } = await supabase.from("bookings").insert({
          user_id: user.id,
          station_id: stationId,
          booking_date: date,
          booking_time: time,
          slot_number: parseInt(slot),
          status: "confirmed",
        });
        if (error) throw error;
        toast({ title: "Booking confirmed! ⚡", description: `${station.name} — ${date} at ${time}` });
      }
      onClose();
    } catch (err: any) {
      toast({ title: "Booking failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const slotsArr = Array.from({ length: station.total_slots }, (_, i) => i + 1);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            {rescheduleBookingId ? "Reschedule Slot" : "Book Charging Slot"}
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 rounded-lg bg-muted/50">
          <p className="font-semibold text-foreground text-sm">{station.name}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3" /> {station.address}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {station.charging_power_kw} kW • {station.charger_types.join(", ")} • {station.total_slots} slots
          </p>
        </div>

        {/* Cost & duration estimate */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-center">
            <Battery className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-[10px] text-muted-foreground uppercase">Energy</p>
            <p className="font-semibold text-foreground text-sm">{estimate.kwh} kWh</p>
          </div>
          <div className="p-2 rounded-lg bg-accent/5 border border-accent/20 text-center">
            <Clock className="w-4 h-4 mx-auto text-accent mb-1" />
            <p className="text-[10px] text-muted-foreground uppercase">Duration</p>
            <p className="font-semibold text-foreground text-sm">{fmtHours(estimate.hours)}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/40 border border-border text-center">
            <IndianRupee className="w-4 h-4 mx-auto text-foreground mb-1" />
            <p className="text-[10px] text-muted-foreground uppercase">Est. Cost</p>
            <p className="font-semibold text-foreground text-sm">₹{estimate.cost}</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground -mt-2 mb-3">
          Estimate at ₹{PRICE_PER_KWH}/kWh for ~80% charge{battery ? ` (${battery} kWh battery)` : ""}.
        </p>

        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground text-sm">Date</Label>
            <Input type="date" min={todayStr} value={date} onChange={e => { setDate(e.target.value); setTime(""); setSlot(""); }} className="mt-1 bg-muted/50 border-border" />
          </div>

          {date && (
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Pick a Time & Slot</Label>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {timeSlots.map(t => (
                  <div key={t}>
                    <p className="text-xs font-medium text-foreground mb-1">{t}</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {slotsArr.map(s => {
                        const key = `${t}-${s}`;
                        const booked = bookedKeys.has(key);
                        const selected = time === t && slot === String(s);
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={booked}
                            onClick={() => { setTime(t); setSlot(String(s)); }}
                            className={`text-xs py-1.5 rounded-md border transition-all ${
                              booked
                                ? "bg-destructive/10 border-destructive/30 text-destructive/60 cursor-not-allowed line-through"
                                : selected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted/40 border-border text-foreground hover:bg-primary/10 hover:border-primary/50"
                            }`}
                          >
                            #{s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary inline-block" /> Selected</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-muted/40 border border-border inline-block" /> Available</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-destructive/30 inline-block" /> Booked</span>
              </div>
            </div>
          )}

          {/* Fallback select for accessibility / no-date */}
          {!date && (
            <div className="opacity-50 pointer-events-none">
              <Label className="text-muted-foreground text-sm">Time Slot</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="mt-1 bg-muted/50 border-border"><SelectValue placeholder="Pick a date first" /></SelectTrigger>
                <SelectContent>{timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <Button variant="electric" className="w-full" onClick={handleBook} disabled={loading || !date || !time || !slot}>
            <Calendar className="w-4 h-4 mr-1" />
            {loading ? "Saving..." : rescheduleBookingId ? "Confirm Reschedule" : "Confirm Booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookingDialog;
