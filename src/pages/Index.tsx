import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, MapPin, Bot, Calendar, ArrowRight, Battery, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "@/components/LoadingScreen";

const features = [
  { icon: MapPin, title: "Smart Station Finder", desc: "AI-powered detection of nearby EV charging stations based on your range and location." },
  { icon: Bot, title: "AI Recommendations", desc: "Intelligent ranking of stations based on your EV model, plug type, and availability." },
  { icon: Calendar, title: "Slot Booking", desc: "Book charging slots in advance with real-time availability updates." },
  { icon: Battery, title: "Trip Planner", desc: "Plan long trips with optimal charging stops along your route." },
  { icon: Shield, title: "Secure & Fast", desc: "Enterprise-grade security with lightning-fast performance." },
  { icon: Zap, title: "AI Chatbot", desc: "24/7 AI assistant for charging queries, booking help, and EV tips." },
];

const Index = () => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  if (loading) {
    return <LoadingScreen onComplete={() => setLoading(false)} />;
  }

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 30, filter: "blur(6px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: "easeOut" as const } },
  };

  const scaleIn = {
    hidden: { opacity: 0, scale: 0.9 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" as const } },
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <motion.nav
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
        className="fixed top-0 left-0 right-0 z-40 glass-card border-b border-border/50 px-6 py-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Zap className="w-7 h-7 text-primary" />
            <span className="font-display font-bold text-xl text-foreground">RechargeAI</span>
          </motion.div>
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <Button variant="ghost-glow" size="sm" onClick={() => navigate("/login")}>
              Log In
            </Button>
            <Button variant="electric" size="sm" onClick={() => navigate("/register")}>
              Get Started
            </Button>
          </motion.div>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute top-20 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.2 }}
          />
          <motion.div
            className="absolute bottom-20 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.5 }}
          />
        </div>

        <motion.div
          className="max-w-5xl mx-auto text-center relative z-10"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={fadeUp}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI-Powered EV Charging</span>
            </div>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-7xl font-display font-bold leading-tight mb-6"
          >
            <span className="text-foreground">Find & Book</span>
            <br />
            <span className="gradient-text">Smart Charging</span>
            <br />
            <span className="text-foreground">Stations</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            RechargeAI uses artificial intelligence to find the best charging stations
            for your EV — optimized for your vehicle, route, and preferences.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button variant="hero" size="xl" onClick={() => navigate("/register")}>
              Start Free <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
            <Button variant="ghost-glow" size="lg" onClick={() => navigate("/login")}>
              I have an account
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="mt-20 grid grid-cols-3 gap-8 max-w-lg mx-auto"
          >
            {[
              { num: "10K+", label: "Stations" },
              { num: "50K+", label: "Users" },
              { num: "99.9%", label: "Uptime" },
            ].map((s) => (
              <motion.div key={s.label} variants={scaleIn} className="text-center">
                <p className="text-2xl md:text-3xl font-display font-bold gradient-text">{s.num}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Everything You Need to <span className="gradient-text">Charge Smarter</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Powered by AI, designed for EV drivers who want the best charging experience.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                className="glass-card p-6 hover:border-primary/30 transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="border-t border-border py-8 px-6"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="font-display font-semibold text-foreground">RechargeAI</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 RechargeAI. All rights reserved.</p>
        </div>
      </motion.footer>
    </div>
  );
};

export default Index;
