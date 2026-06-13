import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, ArrowLeft, Check, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const checks = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /\d/.test(newPassword),
    symbol: /[^A-Za-z0-9]/.test(newPassword),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const strengthLabel = ["Very weak", "Weak", "Fair", "Good", "Strong", "Very strong"][score];
  const strengthColor = [
    "bg-destructive", "bg-destructive", "bg-orange-500",
    "bg-yellow-500", "bg-primary", "bg-green-500",
  ][score];
  const strengthText = [
    "text-destructive", "text-destructive", "text-orange-500",
    "text-yellow-500", "text-primary", "text-green-500",
  ][score];
  const matches = confirm.length > 0 && newPassword === confirm;

  const handleSubmit = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({ title: "Invalid email format", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    if (!currentPassword) {
      toast({ title: "Current password required", description: "Enter your current password to verify your identity.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Weak password", description: "New password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (score < 3) {
      toast({ title: "Password too weak", description: "Please meet at least 3 of the strength requirements.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword === currentPassword) {
      toast({ title: "Use a new password", description: "New password must be different from current password.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Verify identity by signing in with current credentials
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: currentPassword,
      });
      if (signInErr) {
        const msg = (signInErr.message || "").toLowerCase();
        if (msg.includes("invalid login credentials")) {
          throw new Error("Incorrect email or current password.");
        }
        if (msg.includes("email not confirmed")) {
          throw new Error("Please verify your email before changing password.");
        }
        throw signInErr;
      }

      // Update password
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;

      // Sign out so user logs in fresh with the new password
      await supabase.auth.signOut();

      toast({ title: "Password updated", description: "You can now sign in with your new password." });
      navigate("/login");
    } catch (err: any) {
      toast({ title: "Could not change password", description: err.message, variant: "destructive" });
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
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/login")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Zap className="w-6 h-6 text-primary" />
          <span className="font-display font-bold text-lg text-foreground">Change Password</span>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Verify with your current password and set a new one — no email link needed.
        </p>

        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="mt-1 bg-muted/50 border-border"
            />
          </div>

          <div>
            <Label className="text-muted-foreground">Current Password</Label>
            <div className="relative mt-1">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="bg-muted/50 border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground">New Password</Label>
            <div className="relative mt-1">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="bg-muted/50 border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${i < score ? strengthColor : "bg-muted"}`}
                  />
                ))}
              </div>
              {newPassword.length > 0 && (
                <p className={`text-xs font-medium ${strengthText}`}>Strength: {strengthLabel}</p>
              )}
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs mt-2">
                {[
                  { ok: checks.length, label: "At least 8 characters" },
                  { ok: checks.upper, label: "One uppercase letter" },
                  { ok: checks.lower, label: "One lowercase letter" },
                  { ok: checks.number, label: "One number" },
                  { ok: checks.symbol, label: "One symbol (!@#$…)" },
                ].map((r, i) => (
                  <li key={i} className={`flex items-center gap-1.5 ${r.ok ? "text-green-600" : "text-muted-foreground"}`}>
                    {r.ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    {r.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground">Confirm New Password</Label>
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
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirm.length > 0 && (
              <p className={`text-xs mt-1.5 flex items-center gap-1 ${matches ? "text-green-600" : "text-destructive"}`}>
                {matches ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                {matches ? "Passwords match" : "Passwords do not match"}
              </p>
            )}
          </div>

          <Button variant="electric" className="w-full" onClick={handleSubmit} disabled={loading}>
            {loading ? "Updating..." : "Change Password"}
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Remember your password?{" "}
          <button onClick={() => navigate("/login")} className="text-primary hover:underline">Sign in</button>
        </p>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
