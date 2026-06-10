import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MentalHandicapResult {
  score: number;
  trend: "up" | "down" | "neutral";
  totalRounds: number;
  roundsThisMonth: number;
  loading: boolean;
}

interface RoundRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  post_round_best: string | null;
  post_round_cost: string | null;
  post_round_adjustment: string | null;
}

function weeksAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function isCompleted(r: RoundRow) {
  return r.status === "completed" || (r.ended_at != null && r.status !== "abandoned");
}

function calcScore(rounds: RoundRow[]): number {
  const completed = rounds.filter(isCompleted);
  const now = new Date();

  const total = completed.length;
  const last7 = completed.filter((r) => new Date(r.started_at) >= daysAgo(7)).length;
  const last30 = completed.filter((r) => new Date(r.started_at) >= daysAgo(30)).length;
  const last60 = completed.filter((r) => new Date(r.started_at) >= daysAgo(60)).length;

  // Post-round engagement: how many completed rounds have all 3 reflection fields filled
  const engagedRounds = completed.filter(
    (r) => r.post_round_best && r.post_round_cost && r.post_round_adjustment
  ).length;

  // Weekly streak: consecutive weeks (going backwards) that had at least 1 completed round
  let streak = 0;
  for (let w = 0; w < 12; w++) {
    const weekStart = weeksAgo(w + 1);
    const weekEnd = weeksAgo(w);
    const inWeek = completed.filter((r) => {
      const d = new Date(r.started_at);
      return d >= weekStart && d < weekEnd;
    });
    if (inWeek.length > 0) {
      streak++;
    } else if (w > 0) {
      // Allow gap only in current week (w=0), break on any older gap
      break;
    }
  }

  // Scoring components (sum to 100)
  const volumeScore = Math.min(total / 40, 1) * 35;           // up to 35 pts (40 rounds = full)
  const monthlyScore = Math.min(last30 / 6, 1) * 20;          // up to 20 pts (6/month = full)
  const consistencyScore =                                      // up to 15 pts
    last60 > 0 ? Math.min(last30 / last60, 1) * 15 : 0;
  const streakScore = Math.min(streak / 8, 1) * 20;            // up to 20 pts (8-week streak = full)
  const engagementScore =                                       // up to 5 pts
    total > 0 ? Math.min(engagedRounds / total, 1) * 5 : 0;
  const recencyBonus = last7 > 0 ? 5 : 0;                      // 5 pts for rounding last 7 days

  const raw = volumeScore + monthlyScore + consistencyScore + streakScore + engagementScore + recencyBonus;

  // Clamp to 1–100 (never show 0 — even a new user starts at 1)
  return Math.max(1, Math.min(100, Math.round(raw)));
}

export function useMentalHandicap(refreshKey?: number): MentalHandicapResult {
  const { user } = useAuth();
  const [result, setResult] = useState<MentalHandicapResult>({
    score: 1,
    trend: "neutral",
    totalRounds: 0,
    roundsThisMonth: 0,
    loading: true,
  });
  // Stale-while-revalidate: only show the loading/skeleton state on the very
  // first fetch. Background refreshes (app resume, refreshKey bumps) keep the
  // last good numbers on screen so the widget never flickers.
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    if (!user?.id) {
      setResult((r) => ({ ...r, loading: false }));
      return;
    }

    if (!hasLoadedOnce.current) {
      setResult((r) => ({ ...r, loading: true }));
    }
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("rounds")
        .select("id, started_at, ended_at, status, post_round_best, post_round_cost, post_round_adjustment")
        .eq("user_id", user!.id)
        .order("started_at", { ascending: false });

      if (cancelled) return;
      hasLoadedOnce.current = true;
      if (error) {
        console.error("[useMentalHandicap] fetch error", error);
        setResult((r) => ({ ...r, loading: false }));
        return;
      }

      const rounds = (data ?? []) as RoundRow[];
      const completed = rounds.filter(isCompleted);

      const currentScore = calcScore(rounds);

      // Trend: compare score excluding last 7 days vs including last 7 days
      const roundsExcludingLastWeek = rounds.filter(
        (r) => new Date(r.started_at) < daysAgo(7)
      );
      const lastWeekScore = calcScore(roundsExcludingLastWeek);
      const trend: "up" | "down" | "neutral" =
        currentScore > lastWeekScore + 1
          ? "up"
          : currentScore < lastWeekScore - 1
          ? "down"
          : "neutral";

      const roundsThisMonth = completed.filter(
        (r) => new Date(r.started_at) >= daysAgo(30)
      ).length;

      setResult({
        score: currentScore,
        trend,
        totalRounds: completed.length,
        roundsThisMonth,
        loading: false,
      });
    }

    void load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, refreshKey]);

  return result;
}
