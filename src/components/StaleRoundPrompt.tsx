import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { Flag, NotebookPen, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  loadActiveRoundSession,
  clearActiveRoundSession,
  clearRoundMessages,
  type ActiveRoundSnapshot,
} from "@/lib/roundSession";
import { clearRoundContext } from "@/lib/roundContext";
import { clearActiveHole, clearRoundCourse } from "@/lib/holeIntel";
import { extractAndSaveQuickEndData } from "@/lib/quickEndRound";
import { recordCompletedRound } from "@/lib/streakStorage";
import { useRounds } from "@/hooks/useRounds";
import { triggerHaptic } from "@/lib/haptics";

/**
 * StaleRoundPrompt — when a round has been left open for 24h+ (the golfer never
 * tapped "End Round"), pop a prompt letting them finish it, reflect on it, or
 * end it. Mounted on Home so it surfaces the next time the app is opened.
 */

const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours
const SNOOZE_MS = 6 * 60 * 60 * 1000; // "Keep it open" hushes the prompt for 6h
const SNOOZE_KEY = "stale-round-snooze-v1";

function isSnoozed(roundId: string): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { id: string; at: number };
    return parsed.id === roundId && Date.now() - parsed.at < SNOOZE_MS;
  } catch {
    return false;
  }
}

function snooze(roundId: string): void {
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify({ id: roundId, at: Date.now() }));
  } catch {
    /* best-effort */
  }
}

export function StaleRoundPrompt() {
  const navigate = useNavigate();
  const { updateRound } = useRounds();
  const [round, setRound] = useState<ActiveRoundSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(() => {
    const session = loadActiveRoundSession();
    if (!session || session.status !== "active") {
      setRound(null);
      return;
    }
    const startMs = new Date(session.startedAt ?? session.createdAt).getTime();
    if (Number.isNaN(startMs)) return;
    if (Date.now() - startMs >= STALE_MS && !isSnoozed(session.roundId)) {
      setRound(session);
    }
  }, []);

  useEffect(() => {
    check();
    let handle: Awaited<ReturnType<typeof App.addListener>> | null = null;
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) check();
    }).then((h) => {
      handle = h;
    });
    window.addEventListener("focus", check);
    return () => {
      handle?.remove();
      window.removeEventListener("focus", check);
    };
  }, [check]);

  if (!round) return null;

  const startMs = new Date(round.startedAt ?? round.createdAt).getTime();
  const hoursOpen = Math.max(24, Math.floor((Date.now() - startMs) / 3_600_000));

  const handleResume = () => {
    triggerHaptic("soft");
    setRound(null);
    navigate(`/round?roundId=${round.roundId}`);
  };

  const handleReflect = () => {
    triggerHaptic("soft");
    setRound(null);
    navigate(`/post-round?roundId=${round.roundId}`);
  };

  const handleKeepOpen = () => {
    triggerHaptic("soft");
    snooze(round.roundId);
    setRound(null);
  };

  const handleEnd = async () => {
    triggerHaptic("medium");
    setBusy(true);
    const id = round.roundId;
    // Local-first: capture what we can, then close the round out. Never let a
    // slow DB write trap the user behind a spinner.
    try {
      extractAndSaveQuickEndData(id);
      recordCompletedRound();
    } catch {
      /* non-critical */
    }
    try {
      await Promise.race([
        updateRound(id, { ended_at: new Date().toISOString(), status: "completed" }),
        new Promise((resolve) => setTimeout(resolve, 6000)),
      ]);
    } catch {
      /* complete locally regardless */
    }
    clearActiveRoundSession();
    clearRoundMessages(id);
    clearRoundContext();
    clearActiveHole();
    clearRoundCourse();
    setBusy(false);
    setRound(null);
    toast.success("Round ended");
  };

  const roundLabel = `${round.roundType.replace("-", " ")} · ${round.environment}`;

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-[rgba(15,31,15,0.55)] p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-3xl border border-[#c8ddc8] bg-white p-6 shadow-[0_24px_60px_rgba(15,31,15,0.3)]">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#d4813a]" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d4813a]">
            Round still open
          </p>
        </div>
        <h3 className="mt-2 font-serif text-2xl font-semibold text-[#0f1f0f]">
          You left a round running
        </h3>
        <p className="mt-1.5 text-sm leading-6 text-[#2d4d2d]">
          Your <span className="font-medium capitalize">{roundLabel}</span> has been open for
          {" "}
          {hoursOpen}+ hours. Want to wrap it up?
        </p>

        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={handleResume}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-2xl bg-[#1a5c2e] px-4 py-3.5 text-left text-white shadow-[0_6px_20px_rgba(26,92,46,0.28)] transition-all disabled:opacity-60"
          >
            <Flag className="h-5 w-5 text-[#e8a84c]" />
            <span className="font-medium">Finish the round</span>
          </button>

          <button
            type="button"
            onClick={handleReflect}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-2xl border border-[#1a5c2e]/40 bg-[#f0f7f1] px-4 py-3.5 text-left text-[#1a5c2e] transition-all hover:bg-[#e3f0e6] disabled:opacity-60"
          >
            <NotebookPen className="h-5 w-5" />
            <span className="font-medium">Post-round reflection</span>
          </button>

          <button
            type="button"
            onClick={() => void handleEnd()}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-2xl border border-[#c8ddc8] bg-white px-4 py-3.5 text-left text-[#2d4d2d] transition-all hover:bg-[#f0f7f1] disabled:opacity-60"
          >
            <CheckCircle2 className="h-5 w-5 text-[#1a5c2e]" />
            <span className="font-medium">{busy ? "Ending…" : "End round now"}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleKeepOpen}
          disabled={busy}
          className="mt-3 w-full py-2 text-center text-[13px] font-medium text-[#5a7a5a] transition-colors hover:text-[#2d4d2d] disabled:opacity-60"
        >
          Keep it open for now
        </button>
      </div>
    </div>
  );
}
