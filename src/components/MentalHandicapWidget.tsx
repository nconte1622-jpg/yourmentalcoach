import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { useMentalHandicap } from "@/hooks/useMentalHandicap";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import { MentalHandicapBadge } from "@/components/MentalHandicapBadge";

/** Tap-to-reveal tooltip explaining the Mental Handicap score */
function MentalHandicapTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--text-1)] opacity-50 hover:opacity-90 transition-opacity"
        aria-label="What is the Mental Handicap?"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-1/2 z-[70] mb-2 w-[230px] -translate-x-1/2 rounded-2xl border border-[rgba(203,184,146,0.18)] bg-[rgba(9,19,15,0.97)] p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-fade-in">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sand-0)] mb-2">Mental Handicap</p>
            <p className="text-xs leading-5 text-[var(--text-1)]">
              A score from 0–100 measuring your mental consistency across rounds. Higher is better. It grows as you complete more rounds, use emotion check-ins, and practice resets. Strong = 75+, Building = 50–74.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 w-full rounded-xl bg-white/6 py-1.5 text-xs text-[var(--text-1)] hover:bg-white/10 transition-colors"
            >
              Got it
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function TrendArrow({ trend }: { trend: "up" | "down" | "neutral" }) {
  if (trend === "up") {
    return (
      <span className="text-[rgba(31,180,100,0.9)] text-base leading-none" aria-label="trending up">
        ↑
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span className="text-[rgba(220,80,60,0.85)] text-base leading-none" aria-label="trending down">
        ↓
      </span>
    );
  }
  return (
    <span className="text-[var(--text-1)] text-base leading-none opacity-60" aria-label="stable">
      →
    </span>
  );
}

function AnimatedNumber({ target, loading }: { target: number; loading: boolean }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const startValRef = useRef(0);
  const DURATION = 900; // ms

  useEffect(() => {
    if (loading) return;

    startValRef.current = display;
    startRef.current = null;

    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValRef.current + (target - startValRef.current) * eased);
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, loading]);

  return <>{display}</>;
}

export function MentalHandicapWidget({ refreshKey }: { refreshKey?: number } = {}) {
  const { score, trend, roundsThisMonth, loading } = useMentalHandicap(refreshKey);
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowSkeleton(false);
      return;
    }
    const timer = setTimeout(() => setShowSkeleton(true), 200);
    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <GlassCard className="calm-pro-mount p-5">
      {showSkeleton && loading ? (
        /* Skeleton — only shown after 200ms delay to avoid flash */
        <div className="flex items-center gap-5 animate-pulse">
          <div className="h-14 w-14 rounded-2xl bg-[rgba(203,184,146,0.08)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 rounded-full bg-[rgba(203,184,146,0.08)]" />
            <div className="h-2 w-20 rounded-full bg-[rgba(203,184,146,0.06)]" />
          </div>
        </div>
      ) : !loading ? (
        <div className="flex items-center gap-5">
          {/* Score badge — Whoop-style ring with progress arc */}
          <div className="relative shrink-0">
            <MentalHandicapBadge score={loading ? 0 : score} size={64} variant="score" />
          </div>

          {/* Labels */}
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--sand-0)]">
                Mental Handicap
              </p>
              <TrendArrow trend={trend} />
              <MentalHandicapTooltip />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-[15px] text-[var(--text-0)]">{score}</span>
              <span className="text-[11px] text-[var(--text-1)]">/ 100</span>
            </div>
            <p className="text-[11px] text-[var(--text-1)] opacity-70">
              {roundsThisMonth === 0
                ? "Complete a round to build your score"
                : `${roundsThisMonth} round${roundsThisMonth !== 1 ? "s" : ""} this month`}
            </p>
          </div>

          {/* Score band label */}
          <div className="flex flex-col items-end gap-1">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em]",
                score >= 75
                  ? "bg-[rgba(31,180,100,0.18)] text-[rgba(31,180,100,0.9)]"
                  : score >= 50
                  ? "bg-[rgba(203,184,146,0.15)] text-[var(--sand-0)]"
                  : "bg-[rgba(255,255,255,0.06)] text-[var(--text-1)]"
              )}
            >
              {score >= 75 ? "Strong" : score >= 50 ? "Building" : "Early"}
            </span>
          </div>
        </div>
      ) : null}
    </GlassCard>
  );
}
