/**
 * Round Metrics Storage
 *
 * Single source of truth for the three within-round emotional metrics that
 * feed the resilience score (resilienceScore.ts) and back-9 tendency
 * detection (back9Detection.ts):
 *
 *   - emotion log         — array of { tag, timestamp } (every emotion tap)
 *   - check-in timestamps — array of epoch-ms (proactive mid-round check-ins)
 *   - pre-shot reset used — boolean flag (breathing tool used at least once)
 *
 * Storage backend: localStorage (not sessionStorage). This lets the metrics
 * survive a mid-round iOS WebView teardown so a golfer's emotional data isn't
 * lost if the app is backgrounded and the WebView is reclaimed.
 *
 * Because localStorage persists across rounds (and even app restarts), these
 * keys MUST be cleared at the start of every new round — see
 * clearRoundMetrics(), called from createRound() in useRounds.ts. Without that,
 * a second round started in the same session would append onto the previous
 * round's emotion log and corrupt both the resilience score and the back-9
 * tendency detection for the new round.
 */

export interface EmotionTap {
  tag: string;
  timestamp: string;
}

const EMOTION_LOG_KEY = "round-emotion-log";
const CHECK_IN_TIMESTAMPS_KEY = "round-checkin-timestamps";
const USED_PRE_SHOT_RESET_KEY = "round-used-pre-shot-reset";

// ── Emotion log ───────────────────────────────────────────────

/** Returns the emotion taps logged so far this round (empty if none). */
export function loadEmotionLog(): EmotionTap[] {
  try {
    const raw = localStorage.getItem(EMOTION_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EmotionTap[]) : [];
  } catch {
    return [];
  }
}

/** Appends one emotion tap (timestamped now) to this round's emotion log. */
export function appendEmotionTap(tag: string): void {
  try {
    const log = loadEmotionLog();
    log.push({ tag, timestamp: new Date().toISOString() });
    localStorage.setItem(EMOTION_LOG_KEY, JSON.stringify(log));
  } catch {
    /* silent — emotion logging is best-effort */
  }
}

// ── Check-in timestamps ───────────────────────────────────────

/** Returns the proactive check-in timestamps recorded so far this round. */
export function loadCheckInTimestamps(): number[] {
  try {
    const raw = localStorage.getItem(CHECK_IN_TIMESTAMPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as number[]) : [];
  } catch {
    return [];
  }
}

/**
 * Records a check-in timestamp (defaults to now) and returns the full,
 * updated list so callers can derive the new count.
 */
export function recordCheckInTimestamp(timestamp: number = Date.now()): number[] {
  try {
    const timestamps = loadCheckInTimestamps();
    timestamps.push(timestamp);
    localStorage.setItem(CHECK_IN_TIMESTAMPS_KEY, JSON.stringify(timestamps));
    return timestamps;
  } catch {
    return loadCheckInTimestamps();
  }
}

// ── Pre-shot reset flag ───────────────────────────────────────

/** Whether the pre-shot reset breathing tool was used this round. */
export function loadUsedPreShotReset(): boolean {
  try {
    return localStorage.getItem(USED_PRE_SHOT_RESET_KEY) === "true";
  } catch {
    return false;
  }
}

/** Marks the pre-shot reset breathing tool as used this round. */
export function markUsedPreShotReset(): void {
  try {
    localStorage.setItem(USED_PRE_SHOT_RESET_KEY, "true");
  } catch {
    /* silent — best-effort */
  }
}

// ── Lifecycle ─────────────────────────────────────────────────

/**
 * Clears all three within-round metrics. MUST be called when a new round
 * starts so each round begins with a clean slate and one round's emotions
 * never bleed into the next.
 */
export function clearRoundMetrics(): void {
  try {
    localStorage.removeItem(EMOTION_LOG_KEY);
    localStorage.removeItem(CHECK_IN_TIMESTAMPS_KEY);
    localStorage.removeItem(USED_PRE_SHOT_RESET_KEY);
  } catch {
    /* silent — best-effort */
  }
}
