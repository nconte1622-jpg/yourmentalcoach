/**
 * Streak Tracking — rounds played within a rolling window
 *
 * A "streak" is maintained as long as the golfer completes at least
 * one round within STREAK_WINDOW_DAYS days of their last round.
 * This is deliberately forgiving — golf is weekly, not daily.
 */

export interface StreakData {
  currentStreak: number;   // consecutive "active windows" completed
  longestStreak: number;   // all-time best streak
  lastRoundDate: string | null; // ISO date YYYY-MM-DD of last completed round
  totalRounds: number;
}

const STREAK_KEY = "streak-data-v1";

// A new round within 14 days of the last keeps the streak alive
const STREAK_WINDOW_DAYS = 14;

const DEFAULT_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastRoundDate: null,
  totalRounds: 0,
};

export function getStreakData(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return { ...DEFAULT_STREAK };
    return JSON.parse(raw) as StreakData;
  } catch {
    return { ...DEFAULT_STREAK };
  }
}

/**
 * Call this when a round is successfully completed.
 * Idempotent for the same calendar day.
 */
export function recordCompletedRound(): StreakData {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const data = getStreakData();

  // Already recorded a round today — no double-count
  if (data.lastRoundDate === today) return data;

  let newStreak = 1;

  if (data.lastRoundDate) {
    const lastDate = new Date(data.lastRoundDate + "T12:00:00Z");
    const todayDate = new Date(today + "T12:00:00Z");
    const daysDiff = Math.floor(
      (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    // Keep streak alive if within the window
    if (daysDiff <= STREAK_WINDOW_DAYS) {
      newStreak = data.currentStreak + 1;
    }
  }

  const updated: StreakData = {
    currentStreak: newStreak,
    longestStreak: Math.max(newStreak, data.longestStreak),
    lastRoundDate: today,
    totalRounds: data.totalRounds + 1,
  };

  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage failures
  }

  return updated;
}

/**
 * Whole days since the golfer's last completed round, or null if they've never
 * played. Used to drive the "keep your streak going" re-engagement nudge.
 */
export function daysSinceLastRound(data: StreakData = getStreakData()): number | null {
  if (!data.lastRoundDate) return null;
  const last = new Date(data.lastRoundDate + "T12:00:00Z").getTime();
  if (Number.isNaN(last)) return null;
  const today = new Date(new Date().toISOString().split("T")[0] + "T12:00:00Z").getTime();
  return Math.max(0, Math.floor((today - last) / (1000 * 60 * 60 * 24)));
}

/** Human-readable label for streak display, e.g. "3 round streak 🔥" */
export function streakLabel(data: StreakData): string {
  if (data.currentStreak <= 0) return "";
  if (data.currentStreak === 1) return "1 round played";
  return `${data.currentStreak} round streak`;
}
