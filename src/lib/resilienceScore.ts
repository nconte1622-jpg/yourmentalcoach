/**
 * Resilience Score Calculator
 *
 * Calculates a "Resilience Score" (0-100) for each round based on emotional recovery,
 * engagement with tools, and persistence. Measures how well a golfer maintained mental
 * composure and bounced back from adversity during a round.
 */

import {
  loadCheckInTimestamps,
  loadEmotionLog,
  loadUsedPreShotReset,
} from "./roundMetrics";

/**
 * Represents a single emotion tap in the emotion log
 */
export interface EmotionTap {
  tag: string;
  timestamp: string;
}

/**
 * Input data for calculating resilience score
 */
export interface RoundScoreInput {
  emotionLog: EmotionTap[];
  checkInTimestamps: number[];
  usedPreShotReset: boolean;
  roundDurationMinutes: number;
}

/**
 * Stored resilience score entry
 */
export interface ResilienceEntry {
  roundId: string;
  date: string;
  score: number;
}

// Positive emotions that indicate good mental state
const POSITIVE_EMOTIONS = new Set([
  "Confident",
  "Calm",
  "Relaxed",
  "Locked In",
  "Focused",
  "Composed",
]);

// Negative emotions that indicate mental struggle
const NEGATIVE_EMOTIONS = new Set([
  "Tight",
  "Rushed",
  "Frustrated",
  "Distracted",
  "Anxious",
  "Discouraged",
]);

const STORAGE_KEY = "golfer-resilience-scores";
const MAX_STORED_ENTRIES = 20;

/**
 * Calculates the resilience score based on round data
 *
 * Scoring formula:
 * - Base score: 50
 * - Positive emotion ratio bonus: up to +20 (ratio of positive taps)
 * - Recovery bonus: up to +15 (if negative emotions are followed by positive ones)
 * - Check-in engagement: up to +10 (responded to proactive check-ins)
 * - Pre-shot reset usage: +5 (used the breathing tool at least once)
 * - Persistence: up to +10 (didn't quit early - round lasted > 2 hours)
 * - Penalty: -10 for ending on negative emotions, -5 for no emotion taps at all
 */
export function calculateResilienceScore(roundData: RoundScoreInput): number {
  let score = 50;

  const { emotionLog, checkInTimestamps, usedPreShotReset, roundDurationMinutes } =
    roundData;

  // PENALTY: No emotion tracking
  if (emotionLog.length === 0) {
    score -= 5;
    return Math.max(0, Math.min(100, score));
  }

  // Calculate emotion ratios
  const positiveCount = emotionLog.filter((e) => POSITIVE_EMOTIONS.has(e.tag))
    .length;
  const negativeCount = emotionLog.filter((e) => NEGATIVE_EMOTIONS.has(e.tag))
    .length;
  const totalEmotions = emotionLog.length;

  // BONUS: Positive emotion ratio (up to +20)
  if (totalEmotions > 0) {
    const positiveRatio = positiveCount / totalEmotions;
    score += positiveRatio * 20;
  }

  // BONUS: Recovery - did they bounce back from negative emotions? (up to +15)
  if (negativeCount > 0) {
    const recoveryBonus = calculateRecoveryBonus(emotionLog);
    score += recoveryBonus;
  }

  // BONUS: Check-in engagement (up to +10)
  if (checkInTimestamps.length > 0) {
    const checkInBonus = Math.min(10, checkInTimestamps.length * 3);
    score += checkInBonus;
  }

  // BONUS: Pre-shot reset usage (+5)
  if (usedPreShotReset) {
    score += 5;
  }

  // BONUS: Persistence - round lasted > 2 hours (up to +10)
  if (roundDurationMinutes > 120) {
    const persistenceBonus = Math.min(10, (roundDurationMinutes - 120) / 36); // 36min ≈ 10 points
    score += persistenceBonus;
  }

  // PENALTY: Ended on negative emotion (-10)
  if (emotionLog.length > 0) {
    const lastEmotion = emotionLog[emotionLog.length - 1].tag;
    if (NEGATIVE_EMOTIONS.has(lastEmotion)) {
      score -= 10;
    }
  }

  // Clamp score to 0-100 range
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculates recovery bonus based on emotional arc
 * If negative emotions appear but are followed by positive ones, award bonus (up to +15)
 */
function calculateRecoveryBonus(emotionLog: EmotionTap[]): number {
  let recoveryBonus = 0;

  // Find instances where a negative emotion is followed by a positive one
  for (let i = 0; i < emotionLog.length - 1; i++) {
    const current = emotionLog[i].tag;
    const next = emotionLog[i + 1].tag;

    if (NEGATIVE_EMOTIONS.has(current) && POSITIVE_EMOTIONS.has(next)) {
      recoveryBonus += 5;
    }
  }

  // Cap recovery bonus at 15
  return Math.min(15, recoveryBonus);
}

/**
 * Saves a resilience score to localStorage
 */
export function saveResilienceScore(
  roundId: string,
  score: number,
  date: string
): void {
  try {
    const entries = loadResilienceScores();

    // Add new entry
    entries.unshift({ roundId, date, score });

    // Keep only the most recent MAX_STORED_ENTRIES entries
    const trimmed = entries.slice(0, MAX_STORED_ENTRIES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Failed to save resilience score:", error);
  }
}

/**
 * Loads all stored resilience scores from localStorage
 * Returns an array of up to 20 most recent entries
 */
export function loadResilienceScores(): ResilienceEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    // Validate array structure
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry): entry is ResilienceEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.roundId === "string" &&
        typeof entry.date === "string" &&
        typeof entry.score === "number"
    );
  } catch (error) {
    console.error("Failed to load resilience scores:", error);
    return [];
  }
}

/**
 * Gets the current resilience score for the active round
 * Returns null if no active round or no emotion data
 */
export function getCurrentRoundScore(): number | null {
  try {
    const emotions = loadEmotionLog();

    // No emotion data yet → no score to show
    if (emotions.length === 0) {
      return null;
    }

    const checkIns = loadCheckInTimestamps();
    const usedPreShotReset = loadUsedPreShotReset();

    // Calculate round duration from round context (localStorage)
    let roundDuration = 0;
    try {
      const ctxStr = localStorage.getItem("golfer-round-context");
      if (ctxStr) {
        const ctx = JSON.parse(ctxStr);
        if (ctx?.startedAt) {
          roundDuration = Math.floor(
            (Date.now() - new Date(ctx.startedAt).getTime()) / 60000,
          );
        }
      }
    } catch { /* silent */ }

    return calculateResilienceScore({
      emotionLog: emotions,
      checkInTimestamps: checkIns,
      usedPreShotReset,
      roundDurationMinutes: roundDuration,
    });
  } catch (error) {
    console.error("Failed to get current round score:", error);
    return null;
  }
}
