import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const step1Schema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  email: z.string().trim().email("Please enter a valid email address.").max(255),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72)
    .regex(/[A-Z]/, "Add at least one uppercase letter.")
    .regex(/[0-9]/, "Add at least one number."),
  mobile: z.string().trim().regex(/^\+?[0-9 \-]{7,16}$/, "Enter a valid mobile number.").optional().or(z.literal("")),
});

const plugTypes = ["CCS", "Type 2", "CHAdeMO", "GB/T", "Tesla Supercharger"];

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({
    fullName: "", email: "", password: "", mobile: "",
    evBrand: "", evModel: "", year: "", batteryCapacity: "",
    vehicleRange: "", seatingCapacity: "", plugType: "",
  });

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
      if (result.error) {
        toast({ title: "Google sign-up failed", description: (result.error as Error).message, variant: "destructive" });
        return;
      }
      if (result.redirected) return;
      navigate("/dashboard");
    } finally { setLoading(false); }
  };

  const goNext = () => {
    const parsed = step1Schema.safeParse({ fullName: form.fullName, email: form.email, password: form.password, mobile: form.mobile });
    if (!parsed.success) {
      toast({ title: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    const parsed = step1Schema.safeParse({ fullName: form.fullName, email: form.email, password: form.password, mobile: form.mobile });
    if (!parsed.success) {
      toast({ title: parsed.error.issues[0].message, variant: "destructive" });
      setStep(1);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;

      // Update profile with EV details after signup
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({
          full_name: form.fullName,
          mobile_number: form.mobile,
          ev_brand: form.evBrand,
          ev_model: form.evModel,
          manufacturing_year: form.year ? parseInt(form.year) : null,
          battery_capacity: form.batteryCapacity ? parseFloat(form.batteryCapacity) : null,
          vehicle_range: form.vehicleRange ? parseFloat(form.vehicleRange) : null,
          seating_capacity: form.seatingCapacity ? parseInt(form.seatingCapacity) : null,
          charging_plug_type: form.plugType,
        }).eq("user_id", user.id);
      }

      toast({ title: "Account created!", description: "Please check your email to verify your account." });
      navigate("/login");
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
        toast({ title: "Email already registered", description: "This email is already in use. Please log in or use a different email.", variant: "destructive" });
      } else if (msg.includes("invalid") && msg.includes("email")) {
        toast({ title: "Invalid email format", description: "Please enter a valid email address.", variant: "destructive" });
      } else if (msg.includes("password")) {
        toast({ title: "Password issue", description: err.message, variant: "destructive" });
      } else {
        toast({ title: "Registration failed", description: err.message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 w-full max-w-lg relative z-10"
      >
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Zap className="w-6 h-6 text-primary" />
          <span className="font-display font-bold text-lg text-foreground">Create Account</span>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {[1, 2].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
              <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.2 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.1 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.1 29 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5 0 9.5-1.9 12.9-5.1l-6-5.1c-2 1.4-4.4 2.2-6.9 2.2-5.2 0-9.6-3.1-11.3-7.6l-6.6 5.1C9.6 39.7 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6 5.1C40.7 35 44 30 44 24c0-1.3-.1-2.4-.4-3.5z"/>
              </svg>
              Sign up with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
            </div>

            <h2 className="font-display font-semibold text-foreground text-xl">Personal Details</h2>
            <div>
              <Label className="text-muted-foreground">Full Name *</Label>
              <Input value={form.fullName} onChange={e => update("fullName", e.target.value)} placeholder="Enter your full name" className="mt-1 bg-muted/50 border-border" />
            </div>
            <div>
              <Label className="text-muted-foreground">Email *</Label>
              <Input type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="name@example.com" className="mt-1 bg-muted/50 border-border" />
            </div>
            <div>
              <Label className="text-muted-foreground">Password *</Label>
              <div className="relative mt-1">
                <Input type={showPwd ? "text" : "password"} value={form.password} onChange={e => update("password", e.target.value)} placeholder="Min 8 chars, 1 uppercase, 1 number" className="bg-muted/50 border-border pr-10" />
                <button type="button" aria-label={showPwd ? "Hide password" : "Show password"} onClick={() => setShowPwd(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Mobile Number</Label>
              <Input value={form.mobile} onChange={e => update("mobile", e.target.value)} placeholder="+91 98123 45678" className="mt-1 bg-muted/50 border-border" />
            </div>
            <Button variant="electric" className="w-full mt-2" onClick={goNext}>
              Next: EV Details <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="font-display font-semibold text-foreground text-xl mb-4">EV Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">EV Brand</Label>
                <Input value={form.evBrand} onChange={e => update("evBrand", e.target.value)} placeholder="Enter EV brand" className="mt-1 bg-muted/50 border-border" />
              </div>
              <div>
                <Label className="text-muted-foreground">EV Model</Label>
                <Input value={form.evModel} onChange={e => update("evModel", e.target.value)} placeholder="Enter EV model" className="mt-1 bg-muted/50 border-border" />
              </div>
              <div>
                <Label className="text-muted-foreground">Year</Label>
                <Input value={form.year} onChange={e => update("year", e.target.value)} placeholder="Enter manufacturing year" className="mt-1 bg-muted/50 border-border" />
              </div>
              <div>
                <Label className="text-muted-foreground">Battery (kWh)</Label>
                <Input value={form.batteryCapacity} onChange={e => update("batteryCapacity", e.target.value)} placeholder="Enter battery capacity" className="mt-1 bg-muted/50 border-border" />
              </div>
              <div>
                <Label className="text-muted-foreground">Range (km)</Label>
                <Input value={form.vehicleRange} onChange={e => update("vehicleRange", e.target.value)} placeholder="Enter vehicle range" className="mt-1 bg-muted/50 border-border" />
              </div>
              <div>
                <Label className="text-muted-foreground">Seats</Label>
                <Input value={form.seatingCapacity} onChange={e => update("seatingCapacity", e.target.value)} placeholder="Enter seating capacity" className="mt-1 bg-muted/50 border-border" />
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Charging Plug Type</Label>
              <Select value={form.plugType} onValueChange={v => update("plugType", v)}>
                <SelectTrigger className="mt-1 bg-muted/50 border-border">
                  <SelectValue placeholder="Select plug type" />
                </SelectTrigger>
                <SelectContent>
                  {plugTypes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button variant="electric" className="flex-1" onClick={handleSubmit} disabled={loading}>
                {loading ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </motion.div>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <button onClick={() => navigate("/login")} className="text-primary hover:underline">Log in</button>
        </p>
      </motion.div>
    </div>
  );
};

export default Register;
