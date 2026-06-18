// Round context storage for mental state setup
// Persists the current round's mental context

import { buildScorecardContextForAI, loadScorecard } from "./scorecardStorage";
import { loadActiveRoundSession } from "./roundSession";
import {
  loadCachedCourse,
  getCurrentHole,
  getHoleDetail,
  buildCourseContextForAI,
} from "./courseData";
import { loadGolferProfile } from "./golferProfile";
import { loadEmotionLog } from "./roundMetrics";
import {
  getActiveHole,
  getHoleNote,
  courseIdFromName,
  buildHoleNoteContextString,
} from "./holeIntel";

const ROUND_CONTEXT_KEY = "golfer-round-context";
const ROUND_HISTORY_KEY = "golfer-round-history";

export type RoundType = "on-course" | "simulator" | "practice";
export type RoundEnvironment = "casual" | "competitive" | "scoring";

export interface RoundContext {
  roundType: RoundType;
  environment: RoundEnvironment;
  location?: string;
  intent?: string;
  startedAt: string;
}

export interface RoundHistoryEntry {
  id: string;
  date: string;
  roundType: RoundType;
  environment: RoundEnvironment;
  location?: string;
  intent?: string;
  mentalTakeaway: string;
  highlightIds: string[];
}

export function saveRoundContext(context: RoundContext): void {
  try {
    localStorage.setItem(ROUND_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // Silent fail
  }
}

export function loadRoundContext(): RoundContext | null {
  try {
    const stored = localStorage.getItem(ROUND_CONTEXT_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function clearRoundContext(): void {
  try {
    localStorage.removeItem(ROUND_CONTEXT_KEY);
  } catch {
    // Silent fail
  }
}

// Build a rich context string for LLM — includes round setup + emotional state
export function buildRoundContextString(): string | null {
  const context = loadRoundContext();
  if (!context) return null;

  const typeLabels: Record<RoundType, string> = {
    "on-course": "on the course",
    "simulator": "on the simulator",
    "practice": "at practice",
  };

  const envLabels: Record<RoundEnvironment, string> = {
    "casual": "casual round",
    "competitive": "competitive round",
    "scoring": "scoring round",
  };

  const parts: string[] = [];
  
  // Round setup
  parts.push(`Currently: ${typeLabels[context.roundType]}, ${envLabels[context.environment]}.`);
  
  if (context.intent && context.intent.trim()) {
    parts.push(`Their stated intention for this round: "${context.intent.trim()}"`);
  }

  // Elapsed time (gives AI a sense of where they are in the round)
  const startedAt = new Date(context.startedAt);
  const elapsedMinutes = Math.round((Date.now() - startedAt.getTime()) / 60000);
  if (elapsedMinutes > 10) {
    const hours = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    const elapsed = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    parts.push(`Round has been going for ${elapsed}.`);
  }

  // Emotion tap history from this round
  const taps = loadEmotionLog();
  if (taps.length > 0) {
    // Count emotions
    const counts: Record<string, number> = {};
    taps.forEach(t => { counts[t.tag] = (counts[t.tag] || 0) + 1; });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const dominant = sorted[0];

    if (taps.length >= 3) {
      // Build emotional arc narrative
      const recentTaps = taps.slice(-3).map(t => t.tag);
      parts.push(`Emotional arc this round: dominant feeling is "${dominant[0]}" (${dominant[1]}x). Recent emotions: ${recentTaps.join(" → ")}.`);
    } else {
      parts.push(`They've reported feeling "${dominant[0]}" this round.`);
    }
  }

  // Round history context
  const history = loadRoundHistory();
  if (history.length > 0) {
    const lastRound = history[history.length - 1];
    if (lastRound.mentalTakeaway) {
      parts.push(`Their takeaway from their last round: "${lastRound.mentalTakeaway}"`);
    }
  }

  // Scorecard + course + current hole context
  try {
    const session = loadActiveRoundSession();
    if (session?.roundId) {
      // Scorecard summary
      const scorecardCtx = buildScorecardContextForAI(session.roundId);
      if (scorecardCtx) parts.push(scorecardCtx);

      // Course & hole context
      const courseName = context?.location?.trim() || null;
      if (courseName) {
        const scorecard = loadScorecard(session.roundId);
        const currentHole = getCurrentHole(scorecard);
        const courseInfo = loadCachedCourse(courseName);
        const holeDetail = getHoleDetail(courseInfo, scorecard, currentHole);
        const profile = loadGolferProfile();
        const courseCtx = buildCourseContextForAI({
          courseName,
          holeNumber: currentHole,
          holeDetail,
          handicap: profile?.handicap ?? null,
        });
        if (courseCtx) parts.push(courseCtx);
      }

      // Per-hole mental notes from the GPS Hole Intel card. Prefer the hole the
      // player is actively viewing in GPS; otherwise fall back to the round's
      // course + the current scorecard hole.
      const active = getActiveHole();
      let holeNote = active ? getHoleNote(active.courseId, active.holeNumber) : null;
      let noteCourseName = active?.courseName;
      if (!holeNote && courseName) {
        const scorecard = loadScorecard(session.roundId);
        const ch = getCurrentHole(scorecard);
        holeNote = getHoleNote(courseIdFromName(courseName), ch);
        noteCourseName = courseName;
      }
      if (holeNote) {
        const noteCtx = buildHoleNoteContextString(holeNote, noteCourseName);
        if (noteCtx) parts.push(noteCtx);
      }
    }
  } catch {
    // scorecard/course context is best-effort — never crash
  }

  return parts.join("\n");
}

// Round History Management
export function loadRoundHistory(): RoundHistoryEntry[] {
  try {
    const stored = localStorage.getItem(ROUND_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveRoundToHistory(entry: Omit<RoundHistoryEntry, "id">): void {
  try {
    const history = loadRoundHistory();
    const newEntry: RoundHistoryEntry = {
      ...entry,
      id: `round-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    history.push(newEntry);
    localStorage.setItem(ROUND_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Silent fail
  }
}

export function deleteRoundFromHistory(id: string): void {
  try {
    const history = loadRoundHistory();
    const filtered = history.filter((r) => r.id !== id);
    localStorage.setItem(ROUND_HISTORY_KEY, JSON.stringify(filtered));
  } catch {
    // Silent fail
  }
}
