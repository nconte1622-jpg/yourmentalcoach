import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { useMentalHandicap } from "@/hooks/useMentalHandicap";
import { cn } from "@/lib/utils";
import { InfoHint } from "@/components/ui/InfoHint";
import { MentalHandicapBadge } from "@/components/MentalHandicapBadge";

/** Tap-to-reveal tooltip explaining the Mental Handicap score */
function MentalHandicapTooltip() {
  return (
    <InfoHint title="Mental Handicap" label="What is the Mental Handicap?">
      A score from 0–100 measuring your mental consistency across rounds. Higher is better. It grows
      as you complete more rounds, use emotion check-ins, and practice resets. Strong = 75+,
      Building = 50–74.
    </InfoHint>
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
    <span className="text-[rgba(26,26,26,0.6)] text-base leading-none opacity-60" aria-label="stable">
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
        <div className="flex items-center gap-5">
          <div className="caddie-shimmer h-14 w-14 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <div className="caddie-shimmer h-3 w-28 rounded-full" />
            <div className="caddie-shimmer h-2 w-20 rounded-full" />
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
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2d6a4f]">
                Mental Handicap
              </p>
              <TrendArrow trend={trend} />
              <MentalHandicapTooltip />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-[15px] text-[#1a1a1a]">
                <AnimatedNumber target={score} loading={loading} />
              </span>
              <span className="text-[11px] text-[rgba(26,26,26,0.6)]">/ 100</span>
            </div>
            <p className="text-[11px] text-[rgba(26,26,26,0.6)] opacity-70">
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
                  ? "bg-[rgba(45,106,79,0.06)] text-[#2d6a4f]"
                  : "bg-[rgba(0,0,0,0.03)] text-[rgba(26,26,26,0.6)]"
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
