import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Volume2, VolumeX, Battery, BatteryCharging } from "lucide-react";

const useChargingSound = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<{ stop: () => void } | null>(null);
  const volumeRef = useRef(0.18);

  const setVolume = (v: number) => {
    volumeRef.current = v;
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(v, audioCtxRef.current.currentTime, 0.05);
    }
  };

  const start = () => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.value = volumeRef.current;
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 320;
      lp.Q.value = 6;
      lp.connect(masterGain);

      const osc1 = ctx.createOscillator();
      osc1.type = "sawtooth";
      osc1.frequency.value = 55;
      const osc2 = ctx.createOscillator();
      osc2.type = "sawtooth";
      osc2.frequency.value = 58;
      osc1.connect(lp);
      osc2.connect(lp);

      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 180;
      noiseFilter.Q.value = 0.7;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.35;
      noise.connect(noiseFilter).connect(noiseGain).connect(masterGain);

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 8;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.12;
      lfo.connect(lfoGain).connect(masterGain.gain);

      osc1.start();
      osc2.start();
      noise.start();
      lfo.start();

      const now = ctx.currentTime;
      osc1.frequency.linearRampToValueAtTime(95, now + 5);
      osc2.frequency.linearRampToValueAtTime(99, now + 5);
      lfo.frequency.linearRampToValueAtTime(16, now + 5);
      lp.frequency.linearRampToValueAtTime(550, now + 5);

      nodesRef.current = {
        stop: () => {
          try {
            osc1.stop();
            osc2.stop();
            noise.stop();
            lfo.stop();
          } catch {}
        },
      };
    } catch {}
  };

  const stop = () => {
    try {
      nodesRef.current?.stop();
      audioCtxRef.current?.close();
      masterGainRef.current = null;
    } catch {}
  };

  return { start, stop, setVolume };
};

const EnergyParticle = ({ delay, x }: { delay: number; x: number }) => (
  <motion.div
    className="absolute w-1.5 h-1.5 rounded-full bg-primary/60"
    initial={{ opacity: 0, y: 20, x }}
    animate={{
      opacity: [0, 1, 0],
      y: [20, -30],
      x: [x, x + (Math.random() - 0.5) * 40],
    }}
    transition={{
      duration: 1.5,
      delay,
      repeat: Infinity,
      ease: "easeOut",
    }}
  />
);

const LoadingScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolumeState] = useState(0.18);
  const chargingSound = useChargingSound();
  const soundStarted = useRef(false);

  useEffect(() => {
    const startSound = () => {
      if (!soundStarted.current) {
        soundStarted.current = true;
        chargingSound.start();
      }
    };
    startSound();
    document.addEventListener("click", startSound, { once: true });

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          chargingSound.stop();
          return 100;
        }
        return prev + 2;
      });
    }, 50);
    return () => {
      clearInterval(timer);
      document.removeEventListener("click", startSound);
    };
  }, [onComplete]);

  // Trigger drive-away after charging completes
  const [driveAway, setDriveAway] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (progress >= 100 && !driveAway) {
      const t = setTimeout(() => setDriveAway(true), 400);
      return () => clearTimeout(t);
    }
  }, [progress, driveAway]);

  // Start fade-out after car drives away, then call onComplete
  useEffect(() => {
    if (driveAway) {
      const fadeTimer = setTimeout(() => setFadeOut(true), 600);
      const completeTimer = setTimeout(onComplete, 1400);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [driveAway, onComplete]);

  const isCharging = progress < 100;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
        style={{ background: "hsl(var(--background))" }}
        animate={
          fadeOut
            ? { opacity: 0, scale: 1.08, filter: "blur(8px)" }
            : { opacity: 1, scale: 1, filter: "blur(0px)" }
        }
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Animated background grid */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div
            className="w-full h-full"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {/* Radial glow behind car */}
        <motion.div
          className="absolute rounded-full blur-[100px]"
          style={{
            width: 300,
            height: 300,
            background: "hsl(var(--primary) / 0.15)",
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Sound controls */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute top-5 right-5 flex items-center gap-2 px-3 py-2 rounded-full border border-border/50 bg-card/50 backdrop-blur-sm"
        >
          <button
            onClick={() => {
              setMuted(prev => {
                if (!prev) {
                  chargingSound.stop();
                } else {
                  chargingSound.start();
                  chargingSound.setVolume(volume);
                }
                return !prev;
              });
            }}
            className="hover:scale-110 transition-transform"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Volume2 className="w-4 h-4 text-primary" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolumeState(v);
              if (muted && v > 0) {
                setMuted(false);
                chargingSound.start();
              }
              chargingSound.setVolume(v);
            }}
            className="w-20 h-1 accent-primary cursor-pointer"
            aria-label="Engine volume"
          />
        </motion.div>

        {/* Main content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative flex flex-col items-center"
        >
          {/* EV Car Scene */}
          <div className="relative w-80 h-36 mb-8">
            {/* Energy particles around car */}
            {isCharging && (
              <div className="absolute inset-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <EnergyParticle
                    key={i}
                    delay={i * 0.2}
                    x={140 + (i - 4) * 15}
                  />
                ))}
              </div>
            )}

            {/* Car */}
            <motion.div
              className="absolute top-1/2 -translate-y-1/2"
              initial={{ x: "-5%" }}
              animate={
                driveAway
                  ? { x: "400%", scale: 0.8 }
                  : { x: `${Math.min(progress, 85)}%` }
              }
              transition={
                driveAway
                  ? { duration: 0.8, ease: [0.4, 0, 0.2, 1] }
                  : { ease: "easeOut", duration: 0.3 }
              }
            >
              <div className="relative">
                <motion.div
                  animate={isCharging ? { y: [0, -2, 0] } : {}}
                  transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                >
                  <svg width="64" height="28" viewBox="0 0 64 28" fill="none" className="drop-shadow-[0_0_8px_hsl(var(--primary)/0.4)]">
                    {/* Body */}
                    <path d="M8 18 L14 8 L28 4 L44 4 L52 10 L60 12 L60 20 L4 20 L4 16 Z" fill="hsl(var(--primary))" opacity="0.9" />
                    {/* Roof */}
                    <path d="M16 8 L28 4 L44 4 L48 10 L14 10 Z" fill="hsl(var(--primary))" opacity="0.7" />
                    {/* Windows */}
                    <path d="M18 9 L28 5.5 L32 5.5 L32 9 Z" fill="hsl(var(--background))" opacity="0.5" />
                    <path d="M34 5.5 L43 5.5 L46 9 L34 9 Z" fill="hsl(var(--background))" opacity="0.5" />
                    {/* Headlight */}
                    <motion.circle cx="58" cy="14" r="2" fill="hsl(var(--primary-foreground))"
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                    {/* Tail light */}
                    <circle cx="5" cy="16" r="1.5" fill="hsl(var(--destructive))" opacity="0.8" />
                    {/* Wheels */}
                    <motion.g animate={{ rotate: (isCharging || driveAway) ? 360 : 0 }} transition={{ duration: driveAway ? 0.15 : 0.5, repeat: Infinity, ease: "linear" }}>
                      <circle cx="16" cy="21" r="4" fill="hsl(var(--muted-foreground))" opacity="0.8" />
                      <circle cx="16" cy="21" r="2" fill="hsl(var(--background))" opacity="0.4" />
                      <line x1="16" y1="17.5" x2="16" y2="19" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" opacity="0.6" />
                    </motion.g>
                    <motion.g animate={{ rotate: (isCharging || driveAway) ? 360 : 0 }} transition={{ duration: driveAway ? 0.15 : 0.5, repeat: Infinity, ease: "linear" }}>
                      <circle cx="48" cy="21" r="4" fill="hsl(var(--muted-foreground))" opacity="0.8" />
                      <circle cx="48" cy="21" r="2" fill="hsl(var(--background))" opacity="0.4" />
                      <line x1="48" y1="17.5" x2="48" y2="19" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" opacity="0.6" />
                    </motion.g>
                    {/* Bottom line */}
                    <line x1="12" y1="21" x2="52" y2="21" stroke="hsl(var(--border))" strokeWidth="0.5" />
                  </svg>
                </motion.div>

                {/* Electric arc from car */}
                {isCharging && (
                  <motion.div
                    className="absolute -right-2 top-1/2 -translate-y-1/2"
                    animate={{
                      opacity: [0.4, 1, 0.4],
                      scale: [0.8, 1.2, 0.8],
                    }}
                    transition={{ duration: 0.4, repeat: Infinity }}
                  >
                    <Zap className="w-4 h-4 text-primary fill-primary drop-shadow-[0_0_6px_hsl(var(--primary))]" />
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* Road with glowing line */}
            <div className="absolute bottom-4 left-0 right-0">
              <div className="h-px bg-border" />
              <motion.div
                className="h-px mt-px"
                style={{
                  background: `linear-gradient(90deg, hsl(var(--primary) / 0.6) ${progress}%, transparent ${progress}%)`,
                }}
              />
              {/* Dashed center line */}
              <div className="absolute -top-px left-0 right-0 flex gap-3">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-6 h-px bg-muted-foreground/20 flex-shrink-0"
                  />
                ))}
              </div>
            </div>

            {/* Charging Station */}
            <motion.div
              className="absolute right-2 bottom-2 flex flex-col items-center"
              animate={
                progress > 80
                  ? { scale: [1, 1.1, 1] }
                  : {}
              }
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              <motion.div
                animate={{
                  opacity: [0.5, 1, 0.5],
                  filter: [
                    "drop-shadow(0 0 4px hsl(var(--primary) / 0.3))",
                    "drop-shadow(0 0 12px hsl(var(--primary) / 0.6))",
                    "drop-shadow(0 0 4px hsl(var(--primary) / 0.3))",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <BatteryCharging className="w-7 h-7 text-primary" />
              </motion.div>
              <div className="w-4 h-5 bg-muted-foreground/30 rounded-sm mt-0.5" />
              <div className="w-6 h-1 bg-muted-foreground/20 rounded-full mt-0.5" />
            </motion.div>
          </div>

          {/* Battery indicator + progress */}
          <div className="flex items-center gap-3 mb-5">
            <Battery className="w-5 h-5 text-muted-foreground" />
            <div className="w-56 h-3 bg-muted/50 rounded-full overflow-hidden border border-border/50 backdrop-blur-sm">
              <motion.div
                className="h-full rounded-full relative overflow-hidden"
                style={{
                  background: progress < 30
                    ? "hsl(var(--destructive))"
                    : progress < 70
                    ? "hsl(var(--primary))"
                    : "var(--gradient-electric, hsl(var(--primary)))",
                }}
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: "easeOut" }}
              >
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                  }}
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
              </motion.div>
            </div>
            <motion.span
              className="text-sm font-mono font-semibold text-foreground min-w-[3ch] text-right"
              key={progress}
              initial={{ opacity: 0.5, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {progress}%
            </motion.span>
          </div>

          {/* Brand text */}
          <motion.div className="text-center">
            <motion.h1
              className="text-xl font-display font-bold tracking-tight text-foreground mb-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Recharge
              <span className="text-primary">AI</span>
            </motion.h1>
            <motion.p
              className="text-xs text-muted-foreground font-medium tracking-wider uppercase"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              {progress >= 100 ? "Ready to go ⚡" : "Charging up..."}
            </motion.p>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LoadingScreen;
