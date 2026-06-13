import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, User, Calendar, LogOut, Battery, Plug, Car, Gauge, Pencil, Save, X, Navigation2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import BookingHistory from "@/components/BookingHistory";
import TripPlanner from "@/components/TripPlanner";
import AIChatbot from "@/components/AIChatbot";
import LiveStationMap from "@/components/LiveStationMap";

const plugTypes = ["CCS", "Type 2", "CHAdeMO", "GB/T", "Tesla Supercharger"];

type Profile = {
  full_name: string;
  email: string;
  mobile_number: string | null;
  ev_brand: string | null;
  ev_model: string | null;
  manufacturing_year: number | null;
  battery_capacity: number | null;
  vehicle_range: number | null;
  seating_capacity: number | null;
  charging_plug_type: string | null;
};

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<"trip" | "bookings" | "profile" | "livemap">("livemap");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "", mobile_number: "", ev_brand: "", ev_model: "",
    manufacturing_year: "", battery_capacity: "", vehicle_range: "",
    seating_capacity: "", charging_plug_type: "",
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("*").eq("user_id", user.id).single()
        .then(({ data }) => { if (data) setProfile(data as Profile); });
    }
  }, [user]);

  if (authLoading || !user) return null;

  const tabs = [
    { id: "livemap" as const, label: "Live Map", icon: Globe },
    { id: "trip" as const, label: "Trip Planner", icon: Navigation2 },
    { id: "bookings" as const, label: "Bookings", icon: Calendar },
    { id: "profile" as const, label: "Profile", icon: User },
  ];

  const evDetails = [
    { icon: Car, label: "Vehicle", value: profile?.ev_brand && profile?.ev_model ? `${profile.ev_brand} ${profile.ev_model}` : "Not set" },
    { icon: Battery, label: "Battery", value: profile?.battery_capacity ? `${profile.battery_capacity} kWh` : "Not set" },
    { icon: Gauge, label: "Range", value: profile?.vehicle_range ? `${profile.vehicle_range} km` : "Not set" },
    { icon: Plug, label: "Plug Type", value: profile?.charging_plug_type || "Not set" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <nav className="glass-card border-b border-border/50 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-lg text-foreground">RechargeAI</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              Hi, {profile?.full_name || "User"}
            </span>
            <Button variant="ghost" size="icon" onClick={() => { signOut(); navigate("/"); }}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* EV Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          {evDetails.map(d => (
            <div key={d.label} className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <d.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{d.label}</p>
                <p className="text-sm font-semibold text-foreground">{d.value}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(t => (
            <Button
              key={t.id}
              variant={activeTab === t.id ? "electric" : "ghost-glow"}
              size="sm"
              onClick={() => setActiveTab(t.id)}
            >
              <t.icon className="w-4 h-4 mr-1" /> {t.label}
            </Button>
          ))}
        </div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === "livemap" && <LiveStationMap />}
          {activeTab === "trip" && <TripPlanner userProfile={profile} />}
          {activeTab === "bookings" && <BookingHistory />}
          {activeTab === "profile" && (
            <div className="glass-card p-6 max-w-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-xl text-foreground">Your Profile</h2>
                {!editing ? (
                  <Button variant="ghost-glow" size="sm" onClick={() => {
                    setEditForm({
                      full_name: profile?.full_name || "",
                      mobile_number: profile?.mobile_number || "",
                      ev_brand: profile?.ev_brand || "",
                      ev_model: profile?.ev_model || "",
                      manufacturing_year: profile?.manufacturing_year?.toString() || "",
                      battery_capacity: profile?.battery_capacity?.toString() || "",
                      vehicle_range: profile?.vehicle_range?.toString() || "",
                      seating_capacity: profile?.seating_capacity?.toString() || "",
                      charging_plug_type: profile?.charging_plug_type || "",
                    });
                    setEditing(true);
                  }}>
                    <Pencil className="w-4 h-4 mr-1" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                      <X className="w-4 h-4 mr-1" /> Cancel
                    </Button>
                    <Button variant="electric" size="sm" disabled={saving} onClick={async () => {
                      if (!editForm.full_name.trim()) {
                        toast({ title: "Name is required", variant: "destructive" });
                        return;
                      }
                      setSaving(true);
                      const { error } = await supabase.from("profiles").update({
                        full_name: editForm.full_name.trim(),
                        mobile_number: editForm.mobile_number.trim() || null,
                        ev_brand: editForm.ev_brand.trim() || null,
                        ev_model: editForm.ev_model.trim() || null,
                        manufacturing_year: editForm.manufacturing_year ? parseInt(editForm.manufacturing_year) : null,
                        battery_capacity: editForm.battery_capacity ? parseFloat(editForm.battery_capacity) : null,
                        vehicle_range: editForm.vehicle_range ? parseFloat(editForm.vehicle_range) : null,
                        seating_capacity: editForm.seating_capacity ? parseInt(editForm.seating_capacity) : null,
                        charging_plug_type: editForm.charging_plug_type || null,
                      }).eq("user_id", user.id);
                      setSaving(false);
                      if (error) {
                        toast({ title: "Update failed", description: error.message, variant: "destructive" });
                      } else {
                        // Refresh profile
                        const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
                        if (data) setProfile(data as Profile);
                        setEditing(false);
                        toast({ title: "Profile updated!" });
                      }
                    }}>
                      <Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                )}
              </div>

              {!editing ? (
                <div className="space-y-3">
                  {[
                    { label: "Name", value: profile?.full_name },
                    { label: "Email", value: profile?.email },
                    { label: "Mobile", value: profile?.mobile_number },
                    { label: "EV Brand", value: profile?.ev_brand },
                    { label: "EV Model", value: profile?.ev_model },
                    { label: "Year", value: profile?.manufacturing_year },
                    { label: "Battery", value: profile?.battery_capacity ? `${profile.battery_capacity} kWh` : null },
                    { label: "Range", value: profile?.vehicle_range ? `${profile.vehicle_range} km` : null },
                    { label: "Seats", value: profile?.seating_capacity },
                    { label: "Plug Type", value: profile?.charging_plug_type },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className="text-sm font-medium text-foreground">{item.value || "—"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Full Name *</Label>
                    <Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className="mt-1 bg-muted/50 border-border" />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Mobile Number</Label>
                    <Input value={editForm.mobile_number} onChange={e => setEditForm(f => ({ ...f, mobile_number: e.target.value }))} className="mt-1 bg-muted/50 border-border" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">EV Brand</Label>
                      <Input value={editForm.ev_brand} onChange={e => setEditForm(f => ({ ...f, ev_brand: e.target.value }))} className="mt-1 bg-muted/50 border-border" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">EV Model</Label>
                      <Input value={editForm.ev_model} onChange={e => setEditForm(f => ({ ...f, ev_model: e.target.value }))} className="mt-1 bg-muted/50 border-border" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Year</Label>
                      <Input value={editForm.manufacturing_year} onChange={e => setEditForm(f => ({ ...f, manufacturing_year: e.target.value }))} className="mt-1 bg-muted/50 border-border" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Battery (kWh)</Label>
                      <Input value={editForm.battery_capacity} onChange={e => setEditForm(f => ({ ...f, battery_capacity: e.target.value }))} className="mt-1 bg-muted/50 border-border" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Range (km)</Label>
                      <Input value={editForm.vehicle_range} onChange={e => setEditForm(f => ({ ...f, vehicle_range: e.target.value }))} className="mt-1 bg-muted/50 border-border" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Seats</Label>
                      <Input value={editForm.seating_capacity} onChange={e => setEditForm(f => ({ ...f, seating_capacity: e.target.value }))} className="mt-1 bg-muted/50 border-border" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Charging Plug Type</Label>
                    <Select value={editForm.charging_plug_type} onValueChange={v => setEditForm(f => ({ ...f, charging_plug_type: v }))}>
                      <SelectTrigger className="mt-1 bg-muted/50 border-border">
                        <SelectValue placeholder="Select plug type" />
                      </SelectTrigger>
                      <SelectContent>
                        {plugTypes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* AI Chatbot */}
      <AIChatbot />
    </div>
  );
};

export default Dashboard;
