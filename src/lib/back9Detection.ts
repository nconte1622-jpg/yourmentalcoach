// Back-9 Timing Pattern Detection library
// Analyzes emotion tap logs to detect patterns in the second half of rounds
// Helps identify when golfers typically start to struggle

import { loadRoundContext } from "@/lib/roundContext";
import { loadEmotionLog } from "@/lib/roundMetrics";

const BACK9_PATTERNS_KEY = "golfer-back9-patterns";
const BACK9_THRESHOLD_MINUTES = 90; // 1.5 hours marks transition to back 9
const MAX_PATTERNS_STORED = 10;

// Emotions that indicate struggle/negative state
const NEGATIVE_EMOTIONS = [
  "Frustrated",
  "Tight",
  "Angry",
  "Rushed",
  "Anxious",
];

export interface Back9Pattern {
  roundId: string;
  date: string;
  back9NegativeRatio: number;
  front9NegativeRatio: number;
  dropoffDetected: boolean;
}

export interface CurrentRoundAnalysis {
  isBack9: boolean;
  negativeRatio: number;
  dominantEmotion: string | null;
  suggestion: string | null;
}

interface EmotionTap {
  tag: string;
  timestamp: string;
}

/**
 * Analyzes the current round for back-9 patterns
 * Returns null if insufficient data or not accessible
 */
export function analyzeCurrentRoundTiming(): CurrentRoundAnalysis | null {
  try {
    const context = loadRoundContext();
    if (!context) return null;

    const taps = loadEmotionLog();
    if (taps.length === 0) {
      return {
        isBack9: false,
        negativeRatio: 0,
        dominantEmotion: null,
        suggestion: null,
      };
    }

    // Calculate elapsed time since round start
    const startedAt = new Date(context.startedAt);
    const elapsedMinutes = Math.round((Date.now() - startedAt.getTime()) / 60000);
    const isBack9 = elapsedMinutes > BACK9_THRESHOLD_MINUTES;

    // Determine split point: emotions from first 90 minutes vs after
    const splitTimestamp = new Date(startedAt.getTime() + BACK9_THRESHOLD_MINUTES * 60000);

    const front9Taps = taps.filter(
      (tap) => new Date(tap.timestamp) < splitTimestamp
    );
    const back9Taps = taps.filter(
      (tap) => new Date(tap.timestamp) >= splitTimestamp
    );

    // Calculate negative emotion ratios
    const front9NegativeRatio = front9Taps.length > 0
      ? front9Taps.filter((tap) => NEGATIVE_EMOTIONS.includes(tap.tag)).length /
        front9Taps.length
      : 0;

    const back9NegativeRatio = back9Taps.length > 0
      ? back9Taps.filter((tap) => NEGATIVE_EMOTIONS.includes(tap.tag)).length /
        back9Taps.length
      : 0;

    // Find dominant emotion in back 9 (or current state if not yet in back 9)
    const relevantTaps = isBack9 ? back9Taps : taps;
    const dominantEmotion = getDominantEmotion(relevantTaps);

    // Build suggestion if in back 9 and showing negative pattern
    let suggestion: string | null = null;
    if (isBack9 && back9NegativeRatio > 0.5) {
      if (dominantEmotion && NEGATIVE_EMOTIONS.includes(dominantEmotion)) {
        suggestion = buildBack9Suggestion(dominantEmotion);
      }
    }

    return {
      isBack9,
      negativeRatio: back9NegativeRatio,
      dominantEmotion,
      suggestion,
    };
  } catch {
    return null;
  }
}

/**
 * Saves back-9 pattern for a completed round
 * Called at the end of a round
 */
export function saveBack9Pattern(roundId: string): void {
  try {
    const taps = loadEmotionLog();
    if (taps.length === 0) return;

    const context = loadRoundContext();
    if (!context) return;

    // Determine split point: first 90 minutes vs after
    const startedAt = new Date(context.startedAt);
    const splitTimestamp = new Date(startedAt.getTime() + BACK9_THRESHOLD_MINUTES * 60000);

    const front9Taps = taps.filter(
      (tap) => new Date(tap.timestamp) < splitTimestamp
    );
    const back9Taps = taps.filter(
      (tap) => new Date(tap.timestamp) >= splitTimestamp
    );

    // Calculate negative emotion ratios
    const front9NegativeRatio = front9Taps.length > 0
      ? front9Taps.filter((tap) => NEGATIVE_EMOTIONS.includes(tap.tag)).length /
        front9Taps.length
      : 0;

    const back9NegativeRatio = back9Taps.length > 0
      ? back9Taps.filter((tap) => NEGATIVE_EMOTIONS.includes(tap.tag)).length /
        back9Taps.length
      : 0;

    // Detect dropoff (back 9 negative ratio > front 9 by 20%)
    const dropoffDetected = back9NegativeRatio > front9NegativeRatio + 0.2;

    const pattern: Back9Pattern = {
      roundId,
      date: new Date().toISOString(),
      back9NegativeRatio,
      front9NegativeRatio,
      dropoffDetected,
    };

    const patterns = loadBack9Patterns();
    patterns.push(pattern);

    // Keep only last 10 rounds
    if (patterns.length > MAX_PATTERNS_STORED) {
      patterns.shift();
    }

    localStorage.setItem(BACK9_PATTERNS_KEY, JSON.stringify(patterns));
  } catch {
    // Silent fail
  }
}

/**
 * Loads stored back-9 patterns
 */
export function loadBack9Patterns(): Back9Pattern[] {
  try {
    const stored = localStorage.getItem(BACK9_PATTERNS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Gets a warning about back-9 tendencies based on historical patterns
 * Returns null if no clear pattern
 */
export function getBack9Warning(): string | null {
  try {
    const patterns = loadBack9Patterns();
    if (patterns.length < 3) return null;

    // Look at last 5 rounds
    const recentPatterns = patterns.slice(-5);

    // Count rounds with detected dropoff
    const dropoffCount = recentPatterns.filter((p) => p.dropoffDetected).length;

    // If 3+ of last 5 rounds show dropoff, return warning
    if (dropoffCount >= 3) {
      return "You tend to get tight on the back 9. Today, commit to a reset after every 3 holes.";
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Builds context string for AI about back-9 tendencies
 * Returns null if insufficient data
 */
export function buildBack9ContextForAI(): string | null {
  try {
    const patterns = loadBack9Patterns();
    if (patterns.length < 3) return null;

    const recentPatterns = patterns.slice(-5);
    const dropoffCount = recentPatterns.filter((p) => p.dropoffDetected).length;

    if (dropoffCount === 0) return null;

    // Calculate average negative ratios
    const avgBack9Negative =
      recentPatterns.reduce((sum, p) => sum + p.back9NegativeRatio, 0) /
      recentPatterns.length;
    const avgFront9Negative =
      recentPatterns.reduce((sum, p) => sum + p.front9NegativeRatio, 0) /
      recentPatterns.length;

    const dropoffPercent = Math.round(
      (avgBack9Negative - avgFront9Negative) * 100
    );

    const percentStr = `${Math.round(avgBack9Negative * 100)}%`;
    const emotionalTendency =
      avgBack9Negative > 0.6
        ? "tends to get tight"
        : avgBack9Negative > 0.4
          ? "sometimes gets tight"
          : "occasionally gets tight";

    return (
      `The golfer ${emotionalTendency} on the back nine. ` +
      `In recent rounds, back-nine negative emotions average ${percentStr}, ` +
      `up from ${Math.round(avgFront9Negative * 100)}% on the front nine ` +
      `(a ${dropoffPercent}% increase). Consider suggesting mental resets or resilience strategies.`
    );
  } catch {
    return null;
  }
}

/**
 * Helper: Find dominant emotion in a set of taps
 */
function getDominantEmotion(taps: EmotionTap[]): string | null {
  if (taps.length === 0) return null;

  const counts: Record<string, number> = {};
  taps.forEach((tap) => {
    counts[tap.tag] = (counts[tap.tag] || 0) + 1;
  });

  let dominant: string | null = null;
  let maxCount = 0;

  for (const [emotion, count] of Object.entries(counts)) {
    if (count > maxCount) {
      dominant = emotion;
      maxCount = count;
    }
  }

  return dominant;
}

/**
 * Helper: Build context-specific suggestion for back-9 struggle
 */
function buildBack9Suggestion(emotion: string): string {
  const suggestions: Record<string, string> = {
    Frustrated:
      "Take a breath and refocus on one shot at a time. Frustration clouds your next decision.",
    Tight:
      "Loosen your grip—physically and mentally. One deep breath before each shot.",
    Angry:
      "Channel that energy into commitment. Step away if you need a moment to reset.",
    Rushed:
      "Slow down your routine. You've got time. Trust your process.",
    Anxious:
      "Acknowledge the nerves, then let them go. Focus on what you can control.",
  };

  return suggestions[emotion] || "Take a moment to reset your mental state.";
}
