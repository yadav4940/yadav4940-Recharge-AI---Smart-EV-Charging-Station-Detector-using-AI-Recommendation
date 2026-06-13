import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web Speech API based voice guidance.
 * No API key required — uses the browser's built-in SpeechSynthesis.
 */
export function useVoiceGuidance(initialEnabled = true) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [supported, setSupported] = useState(false);
  const lastSpokenRef = useRef<string>("");

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const speak = useCallback(
    (text: string, opts?: { priority?: boolean; rate?: number; pitch?: number }) => {
      if (!enabled || !supported || !text) return;
      // Skip duplicates back-to-back unless priority
      if (!opts?.priority && lastSpokenRef.current === text) return;
      lastSpokenRef.current = text;
      try {
        if (opts?.priority) window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = opts?.rate ?? 1;
        u.pitch = opts?.pitch ?? 1;
        u.volume = 1;
        u.lang = "en-IN";
        window.speechSynthesis.speak(u);
      } catch (e) {
        console.warn("speech failed", e);
      }
    },
    [enabled, supported],
  );

  const cancel = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  // Cancel on unmount or when disabled
  useEffect(() => {
    if (!enabled) cancel();
    return () => cancel();
  }, [enabled, cancel]);

  return { enabled, setEnabled, supported, speak, cancel };
}
