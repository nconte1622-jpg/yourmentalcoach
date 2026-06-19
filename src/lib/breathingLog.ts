/**
 * Breathing session log.
 *
 * Every completed Breathe / Pre-Shot Reset is recorded locally. After a round
 * ends, the sessions taken during that round are scored 1-10 for how helpful
 * they appeared to be — calibrated by how the round actually left the golfer
 * feeling. The Memory Bank surfaces this history so the golfer can see whether
 * breathing is working for them.
 */

import { loadActiveRoundSession } from "./roundSession";
import { getCoachResponse } from "./mentalCoachApi";

export interface BreathingSession {
  id: string;
  startedAt: string; // ISO
  endedAt: string; // ISO
  cyclesCompleted: number;
  durationSeconds: number;
  roundId: string | null;
  /** 1-10 helpfulness, set after the round ends. null until scored. */
  aiScore: number | null;
  aiNotes: string | null;
}

const KEY = "breathing-sessions-v1";
const MAX_SESSIONS = 100;

function safeParse(raw: string | null): BreathingSession[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadBreathingSessions(): BreathingSession[] {
  try {
    return safeParse(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

function saveBreathingSessions(sessions: BreathingSession[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sessions.slice(-MAX_SESSIONS)));
  } catch {
    // Ignore storage failures — breathing log is non-critical.
  }
}

function makeId(): string {
  return `breath_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Record a completed breathing session. The active round (if any) is resolved
 * automatically so callers don't need to thread the round ID through.
 */
export function logBreathingSession(input: {
  startedAt: string;
  cyclesCompleted: number;
  durationSeconds: number;
}): BreathingSession | null {
  // A session with no completed cycles isn't worth logging (instant close).
  if (input.cyclesCompleted <= 0 && input.durationSeconds < 3) return null;

  const roundId = (() => {
    try {
      return loadActiveRoundSession()?.roundId ?? null;
    } catch {
      return null;
    }
  })();

  const session: BreathingSession = {
    id: makeId(),
    startedAt: input.startedAt,
    endedAt: new Date().toISOString(),
    cyclesCompleted: Math.max(0, Math.round(input.cyclesCompleted)),
    durationSeconds: Math.max(0, Math.round(input.durationSeconds)),
    roundId,
    aiScore: null,
    aiNotes: null,
  };

  const sessions = loadBreathingSessions();
  sessions.push(session);
  saveBreathingSessions(sessions);
  return session;
}

/** Deterministic fallback when the AI scorer is unavailable/offline. */
function heuristicScore(
  count: number,
  totalCycles: number,
  postRoundFeeling: number | null
): { score: number; notes: string } {
  // Anchor on how the round left them feeling; nudge up for consistent use.
  const base = postRoundFeeling != null ? postRoundFeeling : 6;
  let score = base;
  if (count >= 3) score += 1;
  if (count >= 6) score += 1;
  if (totalCycles >= 12) score += 1;
  score = Math.max(1, Math.min(10, Math.round(score)));

  const usage =
    count >= 3
      ? `You leaned on breathing ${count} times this round`
      : count === 2
        ? "You reset twice this round"
        : "You used one breathing reset this round";
  const tail =
    postRoundFeeling != null
      ? postRoundFeeling >= 7
        ? "and finished feeling steady — keep it in the routine."
        : postRoundFeeling >= 4
          ? "— worth using a little earlier on tough holes."
          : "— the rounds where you breathe more tend to settle faster."
      : "— consistency is what makes it work.";

  return { score, notes: `${usage} ${tail}` };
}

async function aiScore(
  count: number,
  totalCycles: number,
  totalMinutes: number,
  postRoundFeeling: number | null
): Promise<{ score: number; notes: string } | null> {
  try {
    const prompt =
      `The golfer did ${count} breathing reset${count !== 1 ? "s" : ""} during this round, ` +
      `totaling ${totalCycles} breath cycles (~${totalMinutes} minute${totalMinutes !== 1 ? "s" : ""}). ` +
      (postRoundFeeling != null
        ? `The round left them feeling ${postRoundFeeling}/10. `
        : "") +
      `Rate how helpful the breathing appeared to be on a scale of 1-10, with one short sentence of explanation. ` +
      `Respond ONLY with JSON in this exact form: {"score": <1-10 integer>, "notes": "<one sentence>"}`;

    const raw = await getCoachResponse({
      messages: [{ role: "user", content: prompt }],
      context: "reset",
    });

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { score?: unknown; notes?: unknown };
    const score = Number(parsed.score);
    if (!Number.isFinite(score)) return null;
    return {
      score: Math.max(1, Math.min(10, Math.round(score))),
      notes: typeof parsed.notes === "string" && parsed.notes.trim() ? parsed.notes.trim() : "",
    };
  } catch {
    return null;
  }
}

/**
 * Score (1-10) the breathing sessions taken during a round, once it ends.
 * Tries the AI coach first, falls back to a deterministic heuristic. Writes the
 * same round-level score/notes onto each previously-unscored session.
 */
export async function scoreBreathingSessionsForRound(
  roundId: string,
  postRoundFeeling: number | null
): Promise<void> {
  if (!roundId) return;

  const sessions = loadBreathingSessions();
  const forRound = sessions.filter((s) => s.roundId === roundId && s.aiScore == null);
  if (forRound.length === 0) return;

  const count = forRound.length;
  const totalCycles = forRound.reduce((sum, s) => sum + s.cyclesCompleted, 0);
  const totalSeconds = forRound.reduce((sum, s) => sum + s.durationSeconds, 0);
  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));

  const result =
    (await aiScore(count, totalCycles, totalMinutes, postRoundFeeling)) ??
    heuristicScore(count, totalCycles, postRoundFeeling);

  const notes = result.notes || heuristicScore(count, totalCycles, postRoundFeeling).notes;

  // Re-read in case other sessions were logged while the AI call was in flight.
  const latest = loadBreathingSessions().map((s) =>
    s.roundId === roundId && s.aiScore == null
      ? { ...s, aiScore: result.score, aiNotes: notes }
      : s
  );
  saveBreathingSessions(latest);
}
