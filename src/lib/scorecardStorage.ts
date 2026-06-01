/**
 * Scorecard storage — hole-by-hole scoring for any active or completed round.
 * Stored in localStorage, keyed by roundId.
 * Feeds directly into the AI coaching context.
 */
import { toast } from "sonner";

export interface HoleScore {
  hole: number;
  par: number;
  score: number | null;
}

export interface Scorecard {
  roundId: string;
  holes: HoleScore[];
  createdAt: string;
  updatedAt: string;
  source: "manual" | "18birdies-paste";
}

const SCORECARD_PREFIX = "scorecard";

function getScorecardKey(roundId: string) {
  return `${SCORECARD_PREFIX}:${roundId}`;
}

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err.message.toLowerCase().includes("quota")
  );
}

export function createBlankScorecard(roundId: string): Scorecard {
  return {
    roundId,
    holes: Array.from({ length: 18 }, (_, i) => ({
      hole: i + 1,
      par: 4,
      score: null,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: "manual",
  };
}

export function loadScorecard(roundId: string): Scorecard | null {
  try {
    const raw = localStorage.getItem(getScorecardKey(roundId));
    if (!raw) return null;
    return JSON.parse(raw) as Scorecard;
  } catch {
    return null;
  }
}

export function saveScorecard(scorecard: Scorecard): void {
  try {
    const toSave = { ...scorecard, updatedAt: new Date().toISOString() };
    localStorage.setItem(getScorecardKey(scorecard.roundId), JSON.stringify(toSave));
  } catch (err) {
    if (isQuotaError(err)) {
      toast.error("Device storage is full — scorecard may not be saved.", {
        id: "storage-quota",
        duration: 6000,
      });
    }
  }
}

export function updateHolePar(roundId: string, holeNumber: number, par: number): Scorecard {
  const sc = loadScorecard(roundId) ?? createBlankScorecard(roundId);
  const updated = {
    ...sc,
    holes: sc.holes.map((h) => (h.hole === holeNumber ? { ...h, par } : h)),
  };
  saveScorecard(updated);
  return updated;
}

export function updateHoleScore(roundId: string, holeNumber: number, score: number | null): Scorecard {
  const sc = loadScorecard(roundId) ?? createBlankScorecard(roundId);
  const updated = {
    ...sc,
    holes: sc.holes.map((h) => (h.hole === holeNumber ? { ...h, score } : h)),
  };
  saveScorecard(updated);
  return updated;
}

export function clearScorecard(roundId: string): void {
  try {
    localStorage.removeItem(getScorecardKey(roundId));
  } catch {
    // ignore
  }
}

// ─── Summary helpers ──────────────────────────────────────────────────────────

export interface ScorecardSummary {
  totalStrokes: number;
  totalPar: number;
  scoreToPar: number;
  front9Strokes: number;
  back9Strokes: number;
  front9Par: number;
  back9Par: number;
  holesCompleted: number;
  birdieOrBetterHoles: number[];
  eagleOrBetterHoles: number[];
  bogeyHoles: number[];
  doubleOrWorse: number[];
  longestBadStreak: number;
  longestBadStreakStart: number;
}

export function getScorecardSummary(sc: Scorecard): ScorecardSummary {
  const completed = sc.holes.filter((h) => h.score !== null);
  const front9 = sc.holes.slice(0, 9).filter((h) => h.score !== null);
  const back9 = sc.holes.slice(9).filter((h) => h.score !== null);

  const totalStrokes = completed.reduce((s, h) => s + (h.score ?? 0), 0);
  const totalPar = completed.reduce((s, h) => s + h.par, 0);
  const front9Strokes = front9.reduce((s, h) => s + (h.score ?? 0), 0);
  const back9Strokes = back9.reduce((s, h) => s + (h.score ?? 0), 0);
  const front9Par = front9.reduce((s, h) => s + h.par, 0);
  const back9Par = back9.reduce((s, h) => s + h.par, 0);

  const eagleOrBetterHoles = completed.filter((h) => h.score! <= h.par - 2).map((h) => h.hole);
  const birdieOrBetterHoles = completed.filter((h) => h.score! === h.par - 1).map((h) => h.hole);
  const bogeyHoles = completed.filter((h) => h.score! === h.par + 1).map((h) => h.hole);
  const doubleOrWorse = completed.filter((h) => h.score! >= h.par + 2).map((h) => h.hole);

  // Find longest consecutive bad streak (+1 or worse)
  let longestBadStreak = 0;
  let longestBadStreakStart = 0;
  let currentStreak = 0;
  let currentStreakStart = 0;
  for (const h of sc.holes) {
    if (h.score !== null && h.score > h.par) {
      if (currentStreak === 0) currentStreakStart = h.hole;
      currentStreak++;
      if (currentStreak > longestBadStreak) {
        longestBadStreak = currentStreak;
        longestBadStreakStart = currentStreakStart;
      }
    } else {
      currentStreak = 0;
    }
  }

  return {
    totalStrokes,
    totalPar,
    scoreToPar: totalStrokes - totalPar,
    front9Strokes,
    back9Strokes,
    front9Par,
    back9Par,
    holesCompleted: completed.length,
    birdieOrBetterHoles,
    eagleOrBetterHoles,
    bogeyHoles,
    doubleOrWorse,
    longestBadStreak,
    longestBadStreakStart,
  };
}

// ─── AI context builder ───────────────────────────────────────────────────────

export function buildScorecardContextForAI(roundId: string): string | null {
  const sc = loadScorecard(roundId);
  if (!sc) return null;

  const completed = sc.holes.filter((h) => h.score !== null);
  if (completed.length === 0) return null;

  const s = getScorecardSummary(sc);
  const parts: string[] = [];

  const scoreToPar = s.scoreToPar;
  const scoreLabel =
    scoreToPar === 0
      ? "even par"
      : scoreToPar > 0
      ? `+${scoreToPar} (${scoreToPar} over par)`
      : `${scoreToPar} (${Math.abs(scoreToPar)} under par)`;

  if (s.holesCompleted === 18) {
    parts.push(`Scorecard: shot ${s.totalStrokes} — ${scoreLabel}.`);
    if (s.front9Strokes > 0 && s.back9Strokes > 0) {
      const f9 = s.front9Strokes - s.front9Par;
      const b9 = s.back9Strokes - s.back9Par;
      const fmt = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
      parts.push(`Front 9: ${s.front9Strokes} (${fmt(f9)}), Back 9: ${s.back9Strokes} (${fmt(b9)}).`);
    }
  } else {
    parts.push(
      `Scorecard (${s.holesCompleted} holes played): ${s.totalStrokes} strokes through hole ${completed[completed.length - 1].hole}, currently ${scoreLabel}.`
    );
  }

  if (s.eagleOrBetterHoles.length > 0) {
    parts.push(`Eagles or better on holes: ${s.eagleOrBetterHoles.join(", ")}.`);
  }
  if (s.birdieOrBetterHoles.length > 0) {
    parts.push(`Birdies on holes: ${s.birdieOrBetterHoles.join(", ")}.`);
  }
  if (s.doubleOrWorse.length > 0) {
    parts.push(`Double bogey or worse on holes: ${s.doubleOrWorse.join(", ")}.`);
  }
  if (s.longestBadStreak >= 3) {
    parts.push(
      `Toughest stretch: ${s.longestBadStreak} consecutive over-par holes starting at hole ${s.longestBadStreakStart}.`
    );
  }

  return parts.join(" ");
}
