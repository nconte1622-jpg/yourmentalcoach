/**
 * Pre-Shot Reset — Full-screen breathing overlay
 *
 * 1-tap access. Shows a 6-second breathing cycle (3s in, 3s out)
 * with the golfer's top cue word. No typing, no chat.
 * Designed to be used 60+ times per round.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { loadPreferredWords } from "@/lib/memoryStorage";
import { loadGolferProfile } from "@/lib/golferProfile";
import { triggerHaptic } from "@/lib/haptics";
import { logBreathingSession } from "@/lib/breathingLog";

const BREATH_IN_MS = 3000;
const BREATH_OUT_MS = 3000;

interface PreShotResetProps {
  open: boolean;
  onClose: () => void;
}

type ResetMode = "choose" | "quick" | "full";

export function PreShotReset({ open, onClose }: PreShotResetProps) {
  const [mode, setMode] = useState<ResetMode>("choose");
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [cycleCount, setCycleCount] = useState(0);
  const [cueWord, setCueWord] = useState("commit");
  const onCloseRef = useRef(onClose);
  // Session tracking for the breathing log. cycleCountRef mirrors cycleCount so
  // the (stable) finish handler always reads the latest count, never a stale one.
  const sessionStartRef = useRef<number | null>(null);
  const loggedRef = useRef(false);
  const cycleCountRef = useRef(0);

  const autoCloseCycles = mode === "quick" ? 1 : 2;

  // Keep onClose ref fresh to avoid stale closure
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    cycleCountRef.current = cycleCount;
  }, [cycleCount]);

  // Record the completed session exactly once (on close or natural completion).
  const finishSession = useCallback(() => {
    if (loggedRef.current) return;
    const start = sessionStartRef.current;
    if (start == null) return; // user closed before choosing a mode
    loggedRef.current = true;
    logBreathingSession({
      startedAt: new Date(start).toISOString(),
      cyclesCompleted: cycleCountRef.current,
      durationSeconds: Math.round((Date.now() - start) / 1000),
    });
  }, []);

  // Load golfer's top cue word when opened; reset mode
  useEffect(() => {
    if (!open) return;
    const words = loadPreferredWords();
    if (words.length > 0) {
      setCueWord(words[0]);
    } else {
      const profile = loadGolferProfile();
      if (profile?.biggestChallenge === "focus") setCueWord("focus");
      else if (profile?.biggestChallenge === "anger-management") setCueWord("release");
      else if (profile?.biggestChallenge === "staying-patient") setCueWord("patient");
      else setCueWord("commit");
    }
    // Reset state for a fresh breathing session
    setMode("choose");
    setPhase("in");
    setCycleCount(0);
    sessionStartRef.current = null;
    loggedRef.current = false;
    cycleCountRef.current = 0;
  }, [open]);

  const beginSession = useCallback((m: "quick" | "full") => {
    triggerHaptic("medium");
    setMode(m);
    setPhase("in");
    setCycleCount(0);
    cycleCountRef.current = 0;
    sessionStartRef.current = Date.now();
    loggedRef.current = false;
  }, []);

  // Breathing engine — a single self-rescheduling timeout keyed to the current
  // phase. The effect body is pure (no state mutated inside an updater), so it
  // behaves correctly under StrictMode double-invocation and always cleans up
  // its pending timeout. This replaces the old nested-updater version that
  // could double-schedule and freeze after a few cycles.
  useEffect(() => {
    if (!open || mode === "choose") return;
    if (cycleCount >= autoCloseCycles) return; // engine stops once complete

    const duration = phase === "in" ? BREATH_IN_MS : BREATH_OUT_MS;
    const id = setTimeout(() => {
      // A full cycle completes when we leave the "out" phase back to "in".
      if (phase === "out") setCycleCount((c) => c + 1);
      setPhase((p) => (p === "in" ? "out" : "in"));
    }, duration);

    return () => clearTimeout(id);
  }, [open, mode, phase, cycleCount, autoCloseCycles]);

  // Auto-close after cycles complete
  useEffect(() => {
    if (!open || mode === "choose") return;
    if (cycleCount >= autoCloseCycles) {
      triggerHaptic("light");
      const timer = setTimeout(() => {
        finishSession();
        onCloseRef.current();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [cycleCount, open, mode, autoCloseCycles, finishSession]);

  const handleClose = useCallback(() => {
    triggerHaptic("light");
    finishSession();
    onCloseRef.current();
  }, [finishSession]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[rgba(5,10,8,0.97)]">
      {/* Close button */}
      <button
        type="button"
        onClick={handleClose}
        className="absolute top-[calc(var(--sat)+16px)] right-4 z-10 rounded-full p-2 text-white/30 hover:text-white/60 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Mode selection screen */}
      {mode === "choose" && (
        <div className="flex flex-col items-center gap-6 px-8 w-full max-w-xs animate-fade-in">
          <p className="text-sm tracking-[0.2em] uppercase text-white/40">Reset mode</p>
          <div className="flex flex-col gap-3 w-full">
            <button
              type="button"
              onClick={() => beginSession("quick")}
              className="flex items-center justify-between rounded-2xl border border-white/12 bg-white/6 px-5 py-4 text-left hover:bg-white/10 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-white/80">Quick Reset</p>
                <p className="text-xs text-white/40 mt-0.5">1 breath cycle · 6 seconds</p>
              </div>
              <span className="text-white/30 text-sm">→</span>
            </button>
            <button
              type="button"
              onClick={() => beginSession("full")}
              className="flex items-center justify-between rounded-2xl border border-white/12 bg-white/6 px-5 py-4 text-left hover:bg-white/10 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-white/80">Full Reset</p>
                <p className="text-xs text-white/40 mt-0.5">2 breath cycles · 12 seconds</p>
              </div>
              <span className="text-white/30 text-sm">→</span>
            </button>
          </div>
        </div>
      )}

      {/* Breathing circle */}
      {mode !== "choose" && (<>
      <div className="relative flex items-center justify-center">
        {/* Outer glow ring */}
        <div
          className="absolute rounded-full transition-all ease-in-out"
          style={{
            width: phase === "in" ? 220 : 140,
            height: phase === "in" ? 220 : 140,
            background: `radial-gradient(circle, hsl(158 30% 20% / 0.3) 0%, transparent 70%)`,
            transitionDuration: `${phase === "in" ? BREATH_IN_MS : BREATH_OUT_MS}ms`,
          }}
        />

        {/* Main circle */}
        <div
          className="relative flex items-center justify-center rounded-full border transition-all ease-in-out"
          style={{
            width: phase === "in" ? 180 : 100,
            height: phase === "in" ? 180 : 100,
            borderColor: `hsl(158 30% 35% / ${phase === "in" ? 0.4 : 0.2})`,
            background: `radial-gradient(circle, hsl(158 25% 15% / 0.6) 0%, hsl(158 20% 8% / 0.3) 100%)`,
            transitionDuration: `${phase === "in" ? BREATH_IN_MS : BREATH_OUT_MS}ms`,
          }}
        >
          {/* Cue word */}
          <span
            className="text-2xl font-serif tracking-wider text-[#2d6a4f] transition-opacity duration-1000"
            style={{ opacity: phase === "in" ? 1 : 0.5 }}
          >
            {cueWord}
          </span>
        </div>
      </div>

      {/* Breathing instruction */}
      <p className="mt-10 text-sm tracking-[0.2em] uppercase text-white/50 transition-all duration-700">
        {phase === "in" ? "Breathe in" : "Breathe out"}
      </p>

      {/* Progress dots */}
      <div className="mt-6 flex gap-2">
        {Array.from({ length: autoCloseCycles }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-all duration-500"
            style={{
              background: i < cycleCount
                ? "hsl(158 30% 45%)"
                : i === cycleCount
                  ? "hsl(158 25% 30%)"
                  : "hsl(158 15% 15%)",
            }}
          />
        ))}
      </div>

      {/* Tap to skip hint */}
      <button
        type="button"
        onClick={handleClose}
        className="mt-8 text-xs text-white/20 tracking-wide hover:text-white/40 transition-colors"
      >
        Tap to close
      </button>
      </>)}
    </div>
  );
}
