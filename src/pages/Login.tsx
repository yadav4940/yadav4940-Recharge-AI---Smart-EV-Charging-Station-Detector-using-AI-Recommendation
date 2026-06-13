import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, ArrowLeft, Eye, EyeOff, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address.").max(255),
  password: z.string().min(6, "Password must be at least 6 characters.").max(72),
});

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const parsed = emailSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast({ title: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
      if (error) throw error;
      if (!remember) sessionStorage.setItem("rai_no_remember", "1");
      navigate("/dashboard");
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("invalid login credentials")) {
        toast({ title: "Incorrect email or password", variant: "destructive" });
      } else if (msg.includes("email not confirmed")) {
        toast({ title: "Email not verified", description: "Verify your email first.", variant: "destructive" });
      } else {
        toast({ title: "Login failed", description: err.message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
      if (result.error) {
        toast({ title: "Google sign-in failed", description: (result.error as Error).message, variant: "destructive" });
        return;
      }
      if (result.redirected) return;
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/3 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 w-full max-w-md relative z-10"
      >
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Zap className="w-6 h-6 text-primary" />
          <span className="font-display font-bold text-lg text-foreground">Welcome Back</span>
        </div>

        <Button variant="outline" className="w-full mb-4" onClick={handleGoogle} disabled={loading}>
          <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.2 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.1 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.1 29 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5 0 9.5-1.9 12.9-5.1l-6-5.1c-2 1.4-4.4 2.2-6.9 2.2-5.2 0-9.6-3.1-11.3-7.6l-6.6 5.1C9.6 39.7 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6 5.1C40.7 35 44 30 44 24c0-1.3-.1-2.4-.4-3.5z"/>
          </svg>
          Continue with Google
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" className="mt-1 bg-muted/50 border-border" />
          </div>
          <div>
            <Label className="text-muted-foreground">Password</Label>
            <div className="relative mt-1">
              <Input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" className="bg-muted/50 border-border pr-10" onKeyDown={e => e.key === "Enter" && handleLogin()} />
              <button type="button" aria-label={showPwd ? "Hide password" : "Show password"} onClick={() => setShowPwd(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Checkbox checked={remember} onCheckedChange={v => setRemember(!!v)} />
              Remember me
            </label>
            <button onClick={() => navigate("/forgot-password")} className="text-sm text-primary hover:underline">Forgot password?</button>
          </div>
          <Button variant="electric" className="w-full" onClick={handleLogin} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <button onClick={() => navigate("/register")} className="text-primary hover:underline">Register</button>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
