/**
 * gpsPatternStorage.ts — Mental GPS shot pattern storage
 *
 * Stores per-hole, per-round shot data and derives cross-round insights.
 * This is the data layer for the Mental GPS system.
 */

const ROUND_PATTERNS_KEY = "caddie-round-patterns";

/* ─── Types ───────────────────────────────────────────── */

export type MissDirection = "left" | "right" | "center" | "long" | "short";
export type LieType = "fairway" | "rough" | "heavy-rough" | "sand" | "water" | "ob";
export type PuttResult = "made" | "rolled-past" | "short" | "3-putt" | "4-putt";
export type TeeResult = "fairway" | "left-rough" | "right-rough" | "ob" | "great";
export type EmotionalTag = "nervous" | "focused" | "frustrated" | "confident" | "distracted" | null;

export interface HoleShot {
  holeNumber: number;
  par?: number;
  // Tee shot
  teeResult?: TeeResult;
  // Miss info (if applicable)
  missDirection?: MissDirection;
  lie?: LieType;
  // Putting
  puttResult?: PuttResult;
  // Mental tag
  emotionalTag?: EmotionalTag;
  // Manual yardage to pin (entered by user)
  yardageToPin?: number;
  // GPS position when shot logged (if available)
  gpsLat?: number;
  gpsLng?: number;
  // When logged
  loggedAt: string;
}

export interface RoundPatternData {
  roundId: string;
  date: string;
  location?: string;
  holes: HoleShot[];
  startedAt: string;
  completedAt?: string;
}

/* ─── Storage helpers ─────────────────────────────────── */

function loadAllRoundPatterns(): RoundPatternData[] {
  try {
    const raw = localStorage.getItem(ROUND_PATTERNS_KEY);
    return raw ? (JSON.parse(raw) as RoundPatternData[]) : [];
  } catch {
    return [];
  }
}

function saveAllRoundPatterns(rounds: RoundPatternData[]): void {
  try {
    // Keep last 30 rounds
    const trimmed = rounds.slice(-30);
    localStorage.setItem(ROUND_PATTERNS_KEY, JSON.stringify(trimmed));
  } catch { /* silent */ }
}

/* ─── Active round management ─────────────────────────── */

const ACTIVE_PATTERN_KEY = "caddie-active-pattern-round";

export function startPatternRound(roundId: string, location?: string): RoundPatternData {
  const round: RoundPatternData = {
    roundId,
    date: new Date().toISOString().split("T")[0],
    location,
    holes: [],
    startedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(ACTIVE_PATTERN_KEY, JSON.stringify(round));
  } catch { /* silent */ }
  return round;
}

export function loadActivePatternRound(): RoundPatternData | null {
  try {
    const raw = localStorage.getItem(ACTIVE_PATTERN_KEY);
    return raw ? (JSON.parse(raw) as RoundPatternData) : null;
  } catch {
    return null;
  }
}

function saveActivePatternRound(round: RoundPatternData): void {
  try {
    localStorage.setItem(ACTIVE_PATTERN_KEY, JSON.stringify(round));
  } catch { /* silent */ }
}

export function logHoleShot(shot: HoleShot): void {
  const round = loadActivePatternRound();
  if (!round) return;

  // Replace existing entry for this hole or append
  const existingIdx = round.holes.findIndex((h) => h.holeNumber === shot.holeNumber);
  if (existingIdx >= 0) {
    round.holes[existingIdx] = shot;
  } else {
    round.holes.push(shot);
  }

  saveActivePatternRound(round);
}

export function updateHoleShot(holeNumber: number, update: Partial<HoleShot>): void {
  const round = loadActivePatternRound();
  if (!round) return;

  const idx = round.holes.findIndex((h) => h.holeNumber === holeNumber);
  if (idx >= 0) {
    round.holes[idx] = { ...round.holes[idx], ...update };
  } else {
    round.holes.push({
      holeNumber,
      loggedAt: new Date().toISOString(),
      ...update,
    });
  }
  saveActivePatternRound(round);
}

export function getHoleShot(holeNumber: number): HoleShot | null {
  const round = loadActivePatternRound();
  return round?.holes.find((h) => h.holeNumber === holeNumber) ?? null;
}

export function completePatternRound(): RoundPatternData | null {
  const round = loadActivePatternRound();
  if (!round) return null;

  round.completedAt = new Date().toISOString();

  // Persist to full history
  const all = loadAllRoundPatterns();
  const filtered = all.filter((r) => r.roundId !== round.roundId);
  filtered.push(round);
  saveAllRoundPatterns(filtered);

  // Clear active round
  try { localStorage.removeItem(ACTIVE_PATTERN_KEY); } catch { /* silent */ }

  return round;
}

/* ─── Analytics ───────────────────────────────────────── */

export interface CrossRoundPatternInsight {
  type: "tee" | "putt" | "mental" | "recovery" | "start";
  severity: "info" | "warning" | "positive";
  headline: string;
  detail: string;
}

/**
 * Derive 3–5 insights across recent rounds.
 * Call this after round completion for the PatternAnalysis component.
 */
export function derivePatternInsights(maxRounds = 5): CrossRoundPatternInsight[] {
  const rounds = loadAllRoundPatterns()
    .filter((r) => r.holes.length >= 3)
    .slice(-maxRounds);

  if (rounds.length < 2) return [];

  const insights: CrossRoundPatternInsight[] = [];
  const allHoles = rounds.flatMap((r) => r.holes);

  // ── Tee shot miss direction ────────────────────────
  const teeShots = allHoles.filter((h) => h.teeResult);
  const missedLeft = teeShots.filter((h) => h.teeResult === "left-rough" || h.missDirection === "left").length;
  const missedRight = teeShots.filter((h) => h.teeResult === "right-rough" || h.missDirection === "right").length;
  const totalMissed = missedLeft + missedRight;

  if (totalMissed >= 5) {
    const leftPct = Math.round((missedLeft / totalMissed) * 100);
    if (leftPct >= 65) {
      insights.push({
        type: "tee",
        severity: "warning",
        headline: `Missing left on ${leftPct}% of missed fairways`,
        detail: `Over the last ${rounds.length} rounds you've missed ${missedLeft} tee shots left vs ${missedRight} right. This is a consistent pattern worth addressing in your pre-shot routine.`,
      });
    } else if (leftPct <= 35) {
      insights.push({
        type: "tee",
        severity: "warning",
        headline: `Missing right on ${100 - leftPct}% of missed fairways`,
        detail: `Over the last ${rounds.length} rounds you've missed ${missedRight} tee shots right vs ${missedLeft} left. A consistent miss direction is actually useful — play for it.`,
      });
    }
  }

  // ── Great drives ───────────────────────────────────
  const greatDrives = teeShots.filter((h) => h.teeResult === "great" || h.teeResult === "fairway").length;
  const totalTeeShots = teeShots.length;
  if (totalTeeShots >= 8) {
    const fairwayPct = Math.round((greatDrives / totalTeeShots) * 100);
    if (fairwayPct >= 60) {
      insights.push({
        type: "tee",
        severity: "positive",
        headline: `Hitting ${fairwayPct}% fairways — tee game is a strength`,
        detail: `Across ${rounds.length} rounds you're finding the fairway or hitting great drives ${greatDrives} out of ${totalTeeShots} tee shots. Your pre-shot routine on the tee box is working.`,
      });
    }
  }

  // ── Putting ────────────────────────────────────────
  const putts = allHoles.filter((h) => h.puttResult);
  const threePutts = putts.filter((h) => h.puttResult === "3-putt" || h.puttResult === "4-putt").length;
  const avgThreePuttsPerRound = threePutts / rounds.length;

  if (avgThreePuttsPerRound >= 2) {
    insights.push({
      type: "putt",
      severity: "warning",
      headline: `Averaging ${avgThreePuttsPerRound.toFixed(1)} three-putts per round`,
      detail: `You've 3-putted ${threePutts} times across ${rounds.length} rounds. This often signals approach distance issues or first-putt pace — either you're leaving yourself too far, or there's mental pressure on the long ones.`,
    });
  }

  const shortPutts = putts.filter((h) => h.puttResult === "short").length;
  if (shortPutts >= 4 && shortPutts > threePutts) {
    insights.push({
      type: "putt",
      severity: "warning",
      headline: `Leaving putts short — ${shortPutts} times across ${rounds.length} rounds`,
      detail: `Coming up short is typically fear-based — the subconscious protects against the "embarrassment" of rolling past. Try committing to a spot 6 inches past the hole.`,
    });
  }

  // ── Emotional patterns ─────────────────────────────
  const emotionalHoles = allHoles.filter((h) => h.emotionalTag);
  const tagCounts: Partial<Record<string, number>> = {};
  emotionalHoles.forEach((h) => {
    if (h.emotionalTag) tagCounts[h.emotionalTag] = (tagCounts[h.emotionalTag] ?? 0) + 1;
  });

  const dominantTag = Object.entries(tagCounts).sort(([, a], [, b]) => b - a)[0];
  if (dominantTag && emotionalHoles.length >= 6) {
    const [tag, count] = dominantTag;
    const pct = Math.round((count / emotionalHoles.length) * 100);
    if (tag === "frustrated" && pct >= 35) {
      insights.push({
        type: "mental",
        severity: "warning",
        headline: `Frustrated on ${pct}% of logged holes`,
        detail: `Frustration tagged ${count} times across ${rounds.length} rounds. When it shows up back-to-back, that's the spiral. Building a 30-second reset routine between holes is the highest-leverage intervention.`,
      });
    } else if (tag === "focused" && pct >= 50) {
      insights.push({
        type: "mental",
        severity: "positive",
        headline: `Focused on ${pct}% of logged holes`,
        detail: `Your mental consistency is strong — focused ${count} times across ${rounds.length} rounds. This is what top-of-form feels like. Lock in what's driving it.`,
      });
    }
  }

  // ── Recovery ───────────────────────────────────────
  const obHoles = allHoles.filter((h) => h.teeResult === "ob" || h.lie === "ob");
  const postObHoles = obHoles.map((h) => {
    const round = rounds.find((r) => r.holes.some((rh) => rh.loggedAt === h.loggedAt));
    if (!round) return null;
    return round.holes.find((rh) => rh.holeNumber === h.holeNumber + 1);
  }).filter(Boolean);

  const recoveredAfterOb = postObHoles.filter(
    (h) => h?.emotionalTag === "focused" || h?.emotionalTag === "confident" || h?.teeResult === "fairway" || h?.teeResult === "great"
  ).length;

  if (obHoles.length >= 2 && recoveredAfterOb >= Math.floor(obHoles.length * 0.6)) {
    insights.push({
      type: "recovery",
      severity: "positive",
      headline: `Strong recovery after OB — bounced back ${recoveredAfterOb} of ${obHoles.length} times`,
      detail: `When you hit it OB you tend to reset and come back strong. This resilience is a real mental asset. Build on it — it shows you can separate shots.`,
    });
  }

  // ── Best-round start pattern ───────────────────────
  const roundsWithEarlyFairways = rounds.filter((r) => {
    const firstFour = r.holes.filter((h) => h.holeNumber <= 4);
    const fairwaysInFirst4 = firstFour.filter(
      (h) => h.teeResult === "fairway" || h.teeResult === "great"
    ).length;
    return fairwaysInFirst4 >= 3;
  });

  if (roundsWithEarlyFairways.length >= 2 && rounds.length >= 3) {
    insights.push({
      type: "start",
      severity: "info",
      headline: `Strong starts (3+ fairways in holes 1-4) lead to better rounds`,
      detail: `In ${roundsWithEarlyFairways.length} of your last ${rounds.length} rounds, hitting fairways early set up a good round. Your tee-box routine in the first 4 holes is the highest-leverage focus.`,
    });
  }

  return insights.slice(0, 5);
}

/**
 * Summarize a completed round's pattern data into a compact string
 * for injection into the AI prompt as post-round context.
 */
export function buildRoundPatternContextForAI(round: RoundPatternData): string {
  if (round.holes.length === 0) return "";

  const parts: string[] = [`Shot pattern data from today's round (${round.holes.length} holes logged):`];

  const teeShots = round.holes.filter((h) => h.teeResult);
  const fairways = teeShots.filter((h) => h.teeResult === "fairway" || h.teeResult === "great").length;
  if (teeShots.length > 0) {
    parts.push(`Tee shots: ${fairways}/${teeShots.length} fairways/great drives.`);
    const leftMisses = round.holes.filter((h) => h.teeResult === "left-rough").length;
    const rightMisses = round.holes.filter((h) => h.teeResult === "right-rough").length;
    if (leftMisses + rightMisses > 0) {
      parts.push(`Missed: ${leftMisses} left, ${rightMisses} right.`);
    }
    const ob = round.holes.filter((h) => h.teeResult === "ob").length;
    if (ob > 0) parts.push(`OB: ${ob} tee shots.`);
  }

  const putts = round.holes.filter((h) => h.puttResult);
  if (putts.length > 0) {
    const threePutts = putts.filter((h) => h.puttResult === "3-putt" || h.puttResult === "4-putt").length;
    const made = putts.filter((h) => h.puttResult === "made").length;
    parts.push(`Putting: ${made} made, ${threePutts} three-putts.`);
  }

  const emotional = round.holes.filter((h) => h.emotionalTag);
  if (emotional.length > 0) {
    const counts: Record<string, number> = {};
    emotional.forEach((h) => { if (h.emotionalTag) counts[h.emotionalTag] = (counts[h.emotionalTag] ?? 0) + 1; });
    const top3 = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 3);
    parts.push(`Mental tags: ${top3.map(([t, n]) => `${t} (${n}x)`).join(", ")}.`);
  }

  return parts.join(" ");
}
