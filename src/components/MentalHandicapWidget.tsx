import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { useMentalHandicap } from "@/hooks/useMentalHandicap";
import { cn } from "@/lib/utils";

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
          {/* Score display */}
          <div className="relative flex flex-col items-center justify-center">
            {/* Subtle ring */}
            <div className="absolute inset-0 -m-1 rounded-2xl border border-[rgba(203,184,146,0.12)]" />
            <div className="flex h-[60px] w-[60px] flex-col items-center justify-center rounded-2xl bg-[rgba(18,64,47,0.55)]">
              <span
                className={cn(
                  "font-serif text-[28px] leading-none tracking-tight text-[var(--text-0)]",
                  "tabular-nums"
                )}
              >
                <AnimatedNumber target={score} loading={loading} />
              </span>
            </div>
          </div>

          {/* Labels */}
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--sand-0)]">
                Mental Handicap
              </p>
              <TrendArrow trend={trend} />
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
