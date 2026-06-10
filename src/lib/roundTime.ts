// Round duration formatting.
//
// A golf round runs ~3–6 hours. If the app ever shows something like
// "1845h 38m active" it means the round's start timestamp is missing, malformed,
// or the round was never properly ended (a zombie/abandoned session lingering in
// the DB with `ended_at = null`). This helper parses defensively and flags those
// stale rounds so the UI can show a sane message instead of a runaway counter.

// Beyond this, a "live" round is almost certainly an abandoned session.
export const STALE_ROUND_THRESHOLD_MIN = 12 * 60; // 12 hours

export interface RoundDuration {
  /** Human label like "42m" or "2h 15m". Empty string when unknown. */
  label: string;
  /** Minutes elapsed since the round started (clamped to >= 0). */
  minutes: number;
  /** True when the timestamp is missing/invalid or the round looks abandoned. */
  stale: boolean;
}

export function formatRoundDuration(startedAt: string | null | undefined): RoundDuration {
  if (!startedAt) {
    return { label: "", minutes: 0, stale: true };
  }

  const startMs = new Date(startedAt).getTime();
  if (Number.isNaN(startMs)) {
    return { label: "", minutes: 0, stale: true };
  }

  // Clamp negatives (clock skew / future timestamps) to 0.
  const rawMinutes = Math.round((Date.now() - startMs) / 60000);
  const minutes = Math.max(0, rawMinutes);

  if (minutes >= STALE_ROUND_THRESHOLD_MIN) {
    return { label: "", minutes, stale: true };
  }

  const display = Math.max(1, minutes);
  const label =
    display >= 60
      ? `${Math.floor(display / 60)}h ${display % 60}m`
      : `${display}m`;

  return { label, minutes, stale: false };
}
