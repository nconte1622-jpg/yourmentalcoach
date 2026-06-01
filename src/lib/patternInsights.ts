import type { Round } from "@/hooks/useRounds";
import { parseStructuredReflectionFromRound } from "@/lib/roundDna";

export type PatternSummary = {
  round_count: number;
  most_common_trigger_type: string;
  most_common_emotional_start: string;
  emotional_trend: string;
  most_effective_cue: string;
  recovery_trend: string;
  struggle_summary: string;
  best_summary: string;
  generated_at: string;
};

const PATTERN_STORAGE_PREFIX = "user_profile.pattern_summary";

function getMostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let topValue = "";
  let topCount = -1;
  for (const [value, count] of counts.entries()) {
    if (count > topCount) {
      topValue = value;
      topCount = count;
    }
  }

  return topValue;
}

function emotionRank(value: string): number {
  const ranks: Record<string, number> = {
    Calm: 1,
    "Slightly tight": 2,
    "Fired up": 2,
    Distracted: 3,
    Nervous: 4,
  };

  return ranks[value] ?? 2;
}

export function derivePatternSummary(rounds: Round[]): PatternSummary | null {
  const reflections = rounds
    .map((round) => parseStructuredReflectionFromRound(round))
    .filter((reflection): reflection is NonNullable<typeof reflection> => Boolean(reflection));

  if (reflections.length < 3) return null;

  const triggers = reflections.map((reflection) =>
    reflection.trigger_type === "Specific hole" && reflection.trigger_hole
      ? `${reflection.trigger_type} (${reflection.trigger_hole})`
      : reflection.trigger_type
  );
  const emotionalStarts = reflections.map((reflection) => reflection.emotional_start);
  const emotionalFinishes = reflections.map((reflection) => reflection.emotional_finish);
  const effectiveCues = reflections.map((reflection) => reflection.effective_cue);
  const recoveryQualities = reflections.map((reflection) => reflection.recovery_quality);

  const trendDelta =
    reflections.reduce((sum, reflection) => {
      return sum + (emotionRank(reflection.emotional_finish) - emotionRank(reflection.emotional_start));
    }, 0) / reflections.length;

  const emotionalTrend =
    trendDelta <= -0.5
      ? "You usually settle in and finish calmer than you start."
      : trendDelta >= 0.5
        ? "Your emotional state tends to tighten as the round goes on."
        : "Your emotional state is mostly stable from start to finish.";

  const mostCommonTrigger = getMostCommon(triggers);
  const commonStart = getMostCommon(emotionalStarts);
  const bestCue = getMostCommon(effectiveCues);
  const recoveryTrend =
    getMostCommon(recoveryQualities) || "Neutral";

  return {
    round_count: reflections.length,
    most_common_trigger_type: mostCommonTrigger,
    most_common_emotional_start: commonStart,
    emotional_trend: emotionalTrend,
    most_effective_cue: bestCue,
    recovery_trend: recoveryTrend,
    struggle_summary: `You tend to struggle when ${mostCommonTrigger.toLowerCase()} pulls you out of your usual ${commonStart.toLowerCase()} start.`,
    best_summary: `You perform best when you lean on ${bestCue.toLowerCase()} and your recovery stays ${recoveryTrend.toLowerCase()}.`,
    generated_at: new Date().toISOString(),
  };
}

export function loadPatternSummary(userId: string | null | undefined): PatternSummary | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`${PATTERN_STORAGE_PREFIX}:${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as PatternSummary;
  } catch {
    return null;
  }
}

export function savePatternSummary(userId: string | null | undefined, summary: PatternSummary): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${PATTERN_STORAGE_PREFIX}:${userId}`, JSON.stringify(summary));
  } catch {
    // ignore storage failures
  }
}
