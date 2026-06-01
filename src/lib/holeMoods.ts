/**
 * Hole-by-hole mood tracking — stored in localStorage per round.
 * No DB migration needed.
 */

export type MoodType = 'locked' | 'steady' | 'frustrated';

export interface HoleMood {
  hole: number;       // 1–18
  mood: MoodType;
  timestamp: string;  // ISO string
}

const storageKey = (roundId: string) => `hole-moods-${roundId}`;

/** Save a mood for a specific hole in a round */
export function saveHoleMood(roundId: string, hole: number, mood: MoodType): void {
  try {
    const existing = getHoleMoods(roundId);
    const filtered = existing.filter((m) => m.hole !== hole);
    filtered.push({ hole, mood, timestamp: new Date().toISOString() });
    localStorage.setItem(storageKey(roundId), JSON.stringify(filtered));
  } catch { /* silent */ }
}

/** Get all moods for a round, sorted by hole */
export function getHoleMoods(roundId: string): HoleMood[] {
  try {
    const raw = localStorage.getItem(storageKey(roundId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HoleMood[];
    return parsed.sort((a, b) => a.hole - b.hole);
  } catch {
    return [];
  }
}

/** Get mood for a specific hole */
export function getHoleMood(roundId: string, hole: number): MoodType | null {
  const moods = getHoleMoods(roundId);
  return moods.find((m) => m.hole === hole)?.mood ?? null;
}

/** Clear all moods for a round (call after round ends) */
export function clearHoleMoods(roundId: string): void {
  try {
    localStorage.removeItem(storageKey(roundId));
  } catch { /* silent */ }
}

/** Get a text summary for the AI */
export function getMoodSummary(roundId: string): string {
  const moods = getHoleMoods(roundId);
  if (moods.length === 0) return '';

  const moodLabel: Record<MoodType, string> = {
    locked: 'locked in',
    steady: 'steady',
    frustrated: 'frustrated',
  };

  // Group consecutive holes with the same mood
  const segments: { start: number; end: number; mood: MoodType }[] = [];
  let current: { start: number; end: number; mood: MoodType } | null = null;

  for (const entry of moods) {
    if (!current || current.mood !== entry.mood || entry.hole !== current.end + 1) {
      if (current) segments.push(current);
      current = { start: entry.hole, end: entry.hole, mood: entry.mood };
    } else {
      current.end = entry.hole;
    }
  }
  if (current) segments.push(current);

  return segments
    .map((s) => {
      const holeStr = s.start === s.end ? `Hole ${s.start}` : `Holes ${s.start}–${s.end}`;
      return `${holeStr}: ${moodLabel[s.mood]}`;
    })
    .join(', ');
}

/**
 * Get an insight string — finds frustration spikes and notes what happened after.
 * Returns null if nothing notable found.
 */
export function getMoodInsight(roundId: string): string | null {
  const moods = getHoleMoods(roundId);
  if (moods.length < 3) return null;

  // Look for frustration run of 2+ holes followed by recovery
  const insights: string[] = [];

  let frustStreak = 0;
  let frustStart = 0;

  for (let i = 0; i < moods.length; i++) {
    const m = moods[i];
    if (m.mood === 'frustrated') {
      if (frustStreak === 0) frustStart = m.hole;
      frustStreak++;
    } else {
      if (frustStreak >= 2) {
        const recovery = m.mood === 'locked' ? 'bounced back locked in' : 'steadied out';
        insights.push(
          `Frustration spike on holes ${frustStart}–${moods[i - 1].hole}, then ${recovery} at hole ${m.hole}`
        );
      }
      frustStreak = 0;
    }
  }

  // Trailing frustration streak with no recovery
  if (frustStreak >= 2) {
    insights.push(`Frustration run from hole ${frustStart} to end of logged holes`);
  }

  // Count totals for a closing observation
  const counts = moods.reduce<Record<MoodType, number>>(
    (acc, m) => { acc[m.mood]++; return acc; },
    { locked: 0, steady: 0, frustrated: 0 }
  );
  const dominant = (Object.entries(counts) as [MoodType, number][])
    .sort((a, b) => b[1] - a[1])[0];
  if (dominant[1] >= 3) {
    const labels: Record<MoodType, string> = {
      locked: 'playing with a lot of focus',
      steady: 'managing the round steadily',
      frustrated: 'fighting something mentally',
    };
    insights.push(`Overall the player was ${labels[dominant[0]]}`);
  }

  return insights.length > 0 ? insights.join('. ') + '.' : null;
}
