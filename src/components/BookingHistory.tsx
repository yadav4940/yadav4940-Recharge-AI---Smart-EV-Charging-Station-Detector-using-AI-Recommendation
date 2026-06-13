import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, Clock, CheckCircle2, XCircle, QrCode, CalendarClock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import BookingDialog from "./BookingDialog";

type Station = {
  id: string;
  name: string;
  address: string;
  total_slots: number;
  charging_power_kw: number;
  charger_types: string[];
};

type Booking = {
  id: string;
  station_id: string;
  booking_date: string;
  booking_time: string;
  slot_number: number;
  status: string;
  created_at: string;
  charging_stations: Station | null;
};

const BookingHistory = () => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [qrFor, setQrFor] = useState<Booking | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<Booking | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("bookings")
      .select("*, charging_stations(id, name, address, total_slots, charging_power_kw, charger_types)")
      .order("created_at", { ascending: false });
    if (data) setBookings(data as unknown as Booking[]);
  };

  useEffect(() => { load(); }, []);

  const cancelBooking = async () => {
    if (!cancelId) return;
    try {
      const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", cancelId);
      if (error) throw error;
      toast({ title: "Booking cancelled" });
      setCancelId(null);
      load();
    } catch (err: any) {
      toast({ title: "Couldn't cancel", description: err.message, variant: "destructive" });
    }
  };

  if (bookings.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">No bookings yet. Find a station and book your first slot!</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {bookings.map((b, i) => {
          const isCancelled = b.status === "cancelled";
          const isPast = new Date(`${b.booking_date}T${b.booking_time}`).getTime() < Date.now();
          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`glass-card p-4 ${isCancelled ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">
                    {b.charging_stations?.name || "Station"}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" /> {b.charging_stations?.address}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {b.booking_date}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {b.booking_time}</span>
                    <span>Slot #{b.slot_number}</span>
                  </div>
                </div>
                <span className={`flex items-center gap-1 text-xs font-medium shrink-0 ${isCancelled ? "text-destructive" : "text-accent"}`}>
                  {isCancelled ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {b.status}
                </span>
              </div>

              {!isCancelled && !isPast && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                  <Button size="sm" variant="outline" onClick={() => setQrFor(b)}>
                    <QrCode className="w-3.5 h-3.5 mr-1" /> Show QR
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRescheduleFor(b)} disabled={!b.charging_stations}>
                    <CalendarClock className="w-3.5 h-3.5 mr-1" /> Reschedule
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setCancelId(b.id)}>
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                  </Button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* QR Modal */}
      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="glass-card border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground">Show this at the station</DialogTitle>
          </DialogHeader>
          {qrFor && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG
                  value={JSON.stringify({
                    booking_id: qrFor.id,
                    station_id: qrFor.station_id,
                    date: qrFor.booking_date,
                    time: qrFor.booking_time,
                    slot: qrFor.slot_number,
                  })}
                  size={200}
                  level="M"
                />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground text-sm">{qrFor.charging_stations?.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {qrFor.booking_date} • {qrFor.booking_time} • Slot #{qrFor.slot_number}
                </p>
                <p className="text-[10px] text-muted-foreground mt-2 font-mono break-all">ID: {qrFor.id}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirm */}
      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>This slot will be freed up for other users. You can book again any time.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction onClick={cancelBooking} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, cancel</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule dialog (reuses BookingDialog in update mode) */}
      {rescheduleFor?.charging_stations && (
        <BookingDialog
          station={rescheduleFor.charging_stations}
          open={!!rescheduleFor}
          onClose={() => { setRescheduleFor(null); load(); }}
          rescheduleBookingId={rescheduleFor.id}
        />
      )}
    </>
  );
};

export default BookingHistory;
