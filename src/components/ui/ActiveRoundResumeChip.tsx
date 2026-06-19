import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleDot, Flag } from "lucide-react";
import { loadActiveRoundSession, ACTIVE_ROUND_CHANGED_EVENT } from "@/lib/roundSession";
import { useRounds } from "@/hooks/useRounds";
import { triggerHaptic } from "@/lib/haptics";

type ResumeSummary = {
  roundId: string;
  roundType: string;
  environment: string;
} | null;

export function ActiveRoundResumeChip() {
  const navigate = useNavigate();
  const { getActiveRound } = useRounds();
  const [summary, setSummary] = useState<ResumeSummary>(() => {
    const persisted = loadActiveRoundSession();
    return persisted?.status === "active"
      ? {
          roundId: persisted.roundId,
          roundType: persisted.roundType,
          environment: persisted.environment,
        }
      : null;
  });

  useEffect(() => {
    let cancelled = false;

    const syncActiveRound = () => {
      const persisted = loadActiveRoundSession();
      if (persisted?.status === "active") {
        setSummary({
          roundId: persisted.roundId,
          roundType: persisted.roundType,
          environment: persisted.environment,
        });
      } else {
        setSummary(null);
      }

      void getActiveRound().then((round) => {
        if (cancelled) return;
        if (!round) {
          setSummary(null);
          return;
        }
        setSummary({
          roundId: round.id,
          roundType: round.round_type,
          environment: round.environment,
        });
      });
    };

    syncActiveRound();
    window.addEventListener("focus", syncActiveRound);
    document.addEventListener("visibilitychange", syncActiveRound);
    // Ending a round dispatches this in-document — clears the chip immediately.
    window.addEventListener(ACTIVE_ROUND_CHANGED_EVENT, syncActiveRound);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", syncActiveRound);
      document.removeEventListener("visibilitychange", syncActiveRound);
      window.removeEventListener(ACTIVE_ROUND_CHANGED_EVENT, syncActiveRound);
    };
  }, [getActiveRound]);

  if (!summary) return null;

  return (
    <button
      type="button"
      onClick={() => {
        triggerHaptic("soft");
        navigate(`/round?roundId=${summary.roundId}`);
      }}
      className="active-round-resume-chip"
      aria-label="Resume active round"
    >
      <span className="active-round-resume-ball" aria-hidden="true">
        <CircleDot className="h-4 w-4" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#e8a84c]">
          Active Round
        </span>
        <span className="block truncate text-xs font-medium capitalize text-white">
          {summary.roundType.replace("-", " ")} · {summary.environment}
        </span>
      </span>
      <Flag className="h-4 w-4 shrink-0 text-white/85" />
    </button>
  );
}
