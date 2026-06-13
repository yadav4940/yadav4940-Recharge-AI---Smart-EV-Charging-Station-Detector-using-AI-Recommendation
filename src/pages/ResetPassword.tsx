import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, Check, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length; // 0..5
  const strengthLabel = ["Very weak", "Weak", "Fair", "Good", "Strong", "Very strong"][score];
  const strengthColor = [
    "bg-destructive",
    "bg-destructive",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-primary",
    "bg-green-500",
  ][score];
  const strengthText = [
    "text-destructive",
    "text-destructive",
    "text-orange-500",
    "text-yellow-500",
    "text-primary",
    "text-green-500",
  ][score];
  const matches = confirm.length > 0 && password === confirm;

  useEffect(() => {
    // Supabase auto-handles the recovery token from URL hash via detectSessionInUrl.
    // Subscribe to auth state to confirm a recovery session is active.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (password.length < 8) {
      toast({ title: "Weak password", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (score < 3) {
      toast({ title: "Password too weak", description: "Please meet at least 3 of the strength requirements shown.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Password updated", description: "You can now sign in with your new password." });
      await supabase.auth.signOut();
      navigate("/login");
    } catch (err: any) {
      toast({ title: "Could not update password", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 w-full max-w-md relative z-10"
      >
        <div className="flex items-center gap-2 mb-8">
          <Zap className="w-6 h-6 text-primary" />
          <span className="font-display font-bold text-lg text-foreground">Set New Password</span>
        </div>

        {!ready ? (
          <p className="text-sm text-muted-foreground">
            Validating reset link… If nothing happens, please request a new reset link from the{" "}
            <button onClick={() => navigate("/forgot-password")} className="text-primary hover:underline">
              Forgot Password
            </button>{" "}
            page.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">New Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="bg-muted/50 border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength meter */}
              <div className="mt-3 space-y-2">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i < score ? strengthColor : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                {password.length > 0 && (
                  <p className={`text-xs font-medium ${strengthText}`}>
                    Strength: {strengthLabel}
                  </p>
                )}

                {/* Requirements checklist */}
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs mt-2">
                  {[
                    { ok: checks.length, label: "At least 8 characters" },
                    { ok: checks.upper, label: "One uppercase letter" },
                    { ok: checks.lower, label: "One lowercase letter" },
                    { ok: checks.number, label: "One number" },
                    { ok: checks.symbol, label: "One symbol (!@#$…)" },
                  ].map((r, i) => (
                    <li
                      key={i}
                      className={`flex items-center gap-1.5 ${
                        r.ok ? "text-green-600" : "text-muted-foreground"
                      }`}
                    >
                      {r.ok ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Confirm Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter new password"
                  className="bg-muted/50 border-border pr-10"
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirm.length > 0 && (
                <p
                  className={`text-xs mt-1.5 flex items-center gap-1 ${
                    matches ? "text-green-600" : "text-destructive"
                  }`}
                >
                  {matches ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  {matches ? "Passwords match" : "Passwords do not match"}
                </p>
              )}
            </div>
            <Button variant="electric" className="w-full" onClick={handleSubmit} disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;
