/**
 * playerMemory.ts — Adaptive AI Memory
 *
 * Persists rich per-round mental snapshots and builds them into a
 * formatted context string that gets injected into the AI system prompt
 * so the coach genuinely knows the player's history.
 *
 * Usage:
 *   updateRoundMemory(roundId, snapshot) — call at end of every round
 *   buildMemoryContext()                 — call in mentalCoachApi before each request
 */

const PLAYER_MEMORY_KEY = "caddie-player-memory";
const MAX_ROUNDS_STORED = 20;
const MAX_ROUNDS_IN_CONTEXT = 5;

/* ─── Types ───────────────────────────────────────────── */

export interface ShotPatternData {
  holes: number;
  fairwaysHit: number;
  fairwaysMissedLeft: number;
  fairwaysMissedRight: number;
  greensInReg: number;
  threePutts: number;
  totalPutts: number;
  obShots: number;
  sandShots: number;
  recoveryHoles: number; // holes they bounced back after a bad start
  emotionalTags: Record<string, number>; // { "nervous": 2, "focused": 5, ... }
}

export interface RoundMemorySnapshot {
  roundId: string;
  date: string; // ISO date string YYYY-MM-DD
  location?: string;
  roundType: "on-course" | "simulator" | "practice";
  environment: "casual" | "competitive" | "scoring";

  // Mental performance
  mentalTakeaway: string; // 1-sentence player reflection
  emotionalStart: string; // how they felt at the start
  emotionalFinish: string; // how they finished
  biggestChallenge: string; // what got them mentally
  bestMoment: string; // standout mental moment

  // Shot patterns (if GPS system was used)
  shotPatterns?: ShotPatternData;

  // Conditions
  weather?: string;
  playingWithOthers?: boolean;

  // Performance indicators
  mentalHandicap?: number; // 0-100 score at round end
  cueWordUsed?: string; // LRM cue word for this round
  confidenceLevel?: number; // 1-5 self-reported
}

export interface PlayerMemoryStore {
  rounds: RoundMemorySnapshot[];
  recurringPatterns: string[]; // derived cross-round insights
  statedGoals: string[]; // from Master Quiz + post-round
  knownWeakSpots: string[];
  updatedAt: string;
}

/* ─── Storage ─────────────────────────────────────────── */

function loadStore(): PlayerMemoryStore {
  try {
    const raw = localStorage.getItem(PLAYER_MEMORY_KEY);
    if (!raw) return emptyStore();
    return JSON.parse(raw) as PlayerMemoryStore;
  } catch {
    return emptyStore();
  }
}

function emptyStore(): PlayerMemoryStore {
  return {
    rounds: [],
    recurringPatterns: [],
    statedGoals: [],
    knownWeakSpots: [],
    updatedAt: new Date().toISOString(),
  };
}

function saveStore(store: PlayerMemoryStore): void {
  try {
    store.updatedAt = new Date().toISOString();
    localStorage.setItem(PLAYER_MEMORY_KEY, JSON.stringify(store));
  } catch { /* silent */ }
}

/* ─── Public API ──────────────────────────────────────── */

/**
 * Persist a round memory snapshot. Call at the end of every round.
 * Trims to MAX_ROUNDS_STORED so storage doesn't grow unbounded.
 */
export function updateRoundMemory(snapshot: RoundMemorySnapshot): void {
  const store = loadStore();

  // Deduplicate by roundId
  const filtered = store.rounds.filter((r) => r.roundId !== snapshot.roundId);
  filtered.push(snapshot);

  // Keep only the most recent N rounds
  store.rounds = filtered
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_ROUNDS_STORED);

  // Derive cross-round patterns after each update
  store.recurringPatterns = derivePatterns(store.rounds);

  saveStore(store);
}

/**
 * Pull goals and weak spots from Master Quiz into memory so they persist
 * and get referenced in every AI prompt.
 */
export function updatePlayerGoalsFromQuiz(goals: string[], weakSpots: string[]): void {
  const store = loadStore();
  store.statedGoals = goals;
  store.knownWeakSpots = weakSpots;
  saveStore(store);
}

/**
 * Build the formatted context string for injection into the AI system prompt.
 * Returns null if there isn't enough history yet (fewer than 1 round).
 */
export function buildMemoryContext(): string | null {
  const store = loadStore();
  if (store.rounds.length === 0) return null;

  const parts: string[] = [];
  parts.push("--- THEIR ROUND HISTORY (most recent first) ---");

  const recent = [...store.rounds]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_ROUNDS_IN_CONTEXT);

  for (const round of recent) {
    const dateStr = formatRelativeDate(round.date);
    const location = round.location ? ` at ${round.location}` : "";
    const env = round.environment !== "casual" ? ` (${round.environment})` : "";

    const lines: string[] = [`${dateStr}${location}${env}:`];

    if (round.mentalTakeaway) {
      lines.push(`  Mental takeaway: "${round.mentalTakeaway}"`);
    }
    if (round.emotionalStart && round.emotionalFinish) {
      lines.push(`  Started ${round.emotionalStart.toLowerCase()}, finished ${round.emotionalFinish.toLowerCase()}.`);
    }
    if (round.biggestChallenge) {
      lines.push(`  Biggest challenge: ${round.biggestChallenge}`);
    }
    if (round.bestMoment) {
      lines.push(`  Best moment: ${round.bestMoment}`);
    }
    if (round.cueWordUsed) {
      lines.push(`  Cue word: "${round.cueWordUsed}"`);
    }
    if (round.shotPatterns) {
      const sp = round.shotPatterns;
      const fairwayPct = sp.holes > 0 ? Math.round((sp.fairwaysHit / sp.holes) * 100) : 0;
      const missDir =
        sp.fairwaysMissedLeft > sp.fairwaysMissedRight
          ? "missed left more often"
          : sp.fairwaysMissedRight > sp.fairwaysMissedLeft
          ? "missed right more often"
          : null;
      if (fairwayPct > 0) {
        lines.push(
          `  Tee shots: ${fairwayPct}% fairways${missDir ? `, ${missDir}` : ""}.`
        );
      }
      if (sp.threePutts > 0) {
        lines.push(`  Putting: ${sp.threePutts} three-putt(s), ${sp.totalPutts} total putts.`);
      }
      if (sp.obShots > 0) {
        lines.push(`  Had ${sp.obShots} OB shot(s).`);
      }
      if (sp.recoveryHoles > 0) {
        lines.push(`  Recovered well on ${sp.recoveryHoles} hole(s) after a rough start.`);
      }
      // Dominant emotional tag
      const topEmotion = topEntry(sp.emotionalTags);
      if (topEmotion) {
        lines.push(`  Dominant mental state: ${topEmotion}.`);
      }
    }
    if (round.weather) {
      lines.push(`  Conditions: ${round.weather}`);
    }

    parts.push(lines.join("\n"));
  }

  // Recurring cross-round patterns
  if (store.recurringPatterns.length > 0) {
    parts.push("\n--- PATTERNS ACROSS ROUNDS ---");
    store.recurringPatterns.forEach((p) => parts.push(`• ${p}`));
  }

  // Stated goals + weak spots
  if (store.statedGoals.length > 0) {
    parts.push(`\n--- STATED GOALS ---\n${store.statedGoals.join("; ")}`);
  }
  if (store.knownWeakSpots.length > 0) {
    parts.push(`--- KNOWN WEAK SPOTS ---\n${store.knownWeakSpots.join("; ")}`);
  }

  parts.push(
    "\nUse this history naturally — reference specific rounds, conditions, or patterns by name when it's genuinely relevant. Don't announce that you 'remember' — just coach like you've been paying attention."
  );

  return parts.join("\n\n");
}

/**
 * Returns the last N round snapshots (for UI display or post-round analysis).
 */
export function getRecentRounds(n = 5): RoundMemorySnapshot[] {
  const store = loadStore();
  return [...store.rounds]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);
}

/**
 * Returns all stored rounds.
 */
export function getAllRounds(): RoundMemorySnapshot[] {
  return loadStore().rounds;
}

/* ─── Helpers ─────────────────────────────────────────── */

function formatRelativeDate(isoDate: string): string {
  const now = new Date();
  const d = new Date(isoDate + "T12:00:00Z");
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "Last week";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function topEntry(record: Record<string, number>): string | null {
  let top = "";
  let max = 0;
  for (const [k, v] of Object.entries(record)) {
    if (v > max) { max = v; top = k; }
  }
  return top || null;
}

/**
 * Derive cross-round patterns from stored round data.
 * Called automatically whenever a new round is saved.
 */
function derivePatterns(rounds: RoundMemorySnapshot[]): string[] {
  if (rounds.length < 3) return [];

  const patterns: string[] = [];
  const recent = rounds.slice(-10);

  // 1. Tee shot direction pattern
  const withShots = recent.filter((r) => r.shotPatterns);
  if (withShots.length >= 3) {
    const totalLeft = withShots.reduce((s, r) => s + (r.shotPatterns?.fairwaysMissedLeft ?? 0), 0);
    const totalRight = withShots.reduce((s, r) => s + (r.shotPatterns?.fairwaysMissedRight ?? 0), 0);
    const total = totalLeft + totalRight;
    if (total >= 5) {
      const leftPct = Math.round((totalLeft / total) * 100);
      if (leftPct >= 65) {
        patterns.push(`Tee shots: missing left in ${leftPct}% of missed fairways over the last ${withShots.length} rounds — persistent pattern worth addressing.`);
      } else if (leftPct <= 35) {
        patterns.push(`Tee shots: missing right in ${100 - leftPct}% of missed fairways — consistent miss pattern.`);
      }
    }

    // 3-putt clusters
    const totalThreePutts = withShots.reduce((s, r) => s + (r.shotPatterns?.threePutts ?? 0), 0);
    const avgThreePutts = totalThreePutts / withShots.length;
    if (avgThreePutts >= 2) {
      patterns.push(`Putting: averaging ${avgThreePutts.toFixed(1)} three-putts per round over last ${withShots.length} rounds — approach distance or green-reading issue.`);
    }
  }

  // 2. Emotional start vs finish
  const starts = recent.map((r) => r.emotionalStart.toLowerCase()).filter(Boolean);
  const finishes = recent.map((r) => r.emotionalFinish.toLowerCase()).filter(Boolean);
  const nervousStart = starts.filter((s) => s.includes("nervous") || s.includes("tight")).length;
  if (nervousStart >= 3) {
    patterns.push(`First-tee nerves appear in ${nervousStart} of last ${starts.length} rounds — first hole mental routine is key.`);
  }
  const finishedWorse = finishes.filter((f) => f.includes("frustrated") || f.includes("tight")).length;
  if (finishedWorse >= 3) {
    patterns.push(`Late-round emotional fade: finished frustrated or tight in ${finishedWorse} of last ${finishes.length} rounds.`);
  }

  // 3. Competitive vs casual gap
  const competitive = recent.filter((r) => r.environment === "competitive");
  const casual = recent.filter((r) => r.environment === "casual");
  if (competitive.length >= 2 && casual.length >= 2) {
    const compChallenges = competitive.map((r) => r.biggestChallenge.toLowerCase());
    const hasCompPressure = compChallenges.some((c) => c.includes("score") || c.includes("pressure") || c.includes("nervous"));
    if (hasCompPressure) {
      patterns.push("Competitive rounds trigger more mental friction than casual play — score-pressure is a known trigger.");
    }
  }

  // 4. Recovery pattern
  const withRecovery = recent.filter((r) => r.shotPatterns && (r.shotPatterns.recoveryHoles > 0));
  if (withRecovery.length >= 3) {
    patterns.push(`Strong bounce-back ability: showed recovery on ${withRecovery.length} of last ${recent.length} rounds — lean into this identity.`);
  }

  return patterns.slice(0, 5); // cap at 5 patterns to keep prompts lean
}

/**
 * Build a snapshot from available local data at round end.
 * Call this from RoundComplete or PostRound to auto-populate the memory.
 */
export function buildSnapshotFromRoundData(params: {
  roundId: string;
  location?: string;
  roundType: "on-course" | "simulator" | "practice";
  environment: "casual" | "competitive" | "scoring";
  mentalTakeaway?: string;
  emotionalStart?: string;
  emotionalFinish?: string;
  biggestChallenge?: string;
  bestMoment?: string;
  cueWordUsed?: string;
  mentalHandicap?: number;
  shotPatterns?: ShotPatternData;
  weather?: string;
}): RoundMemorySnapshot {
  return {
    roundId: params.roundId,
    date: new Date().toISOString().split("T")[0],
    location: params.location,
    roundType: params.roundType,
    environment: params.environment,
    mentalTakeaway: params.mentalTakeaway ?? "",
    emotionalStart: params.emotionalStart ?? "neutral",
    emotionalFinish: params.emotionalFinish ?? "neutral",
    biggestChallenge: params.biggestChallenge ?? "",
    bestMoment: params.bestMoment ?? "",
    cueWordUsed: params.cueWordUsed,
    mentalHandicap: params.mentalHandicap,
    shotPatterns: params.shotPatterns,
    weather: params.weather,
  };
}
