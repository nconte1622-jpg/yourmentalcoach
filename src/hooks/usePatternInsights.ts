import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags, FREE_PATTERN_DETECTION_ROUNDS } from "@/hooks/useFeatureFlags";
import { useRounds } from "@/hooks/useRounds";
import {
  derivePatternSummary,
  loadPatternSummary,
  savePatternSummary,
  type PatternSummary,
} from "@/lib/patternInsights";
import { parseStructuredReflectionFromRound } from "@/lib/roundDna";

export function usePatternInsights() {
  const { user } = useAuth();
  const { features } = useFeatureFlags();
  const { getRecentRounds } = useRounds();
  const [summary, setSummary] = useState<PatternSummary | null>(null);
  const [eligibleRoundCount, setEligibleRoundCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user?.id) {
        setSummary(null);
        setEligibleRoundCount(0);
        setIsLoading(false);
        return;
      }

      const stored = loadPatternSummary(user.id);
      if (stored) {
        setSummary(stored);
      }

      setIsLoading(true);

      try {
        const rounds = await getRecentRounds(24);
        if (cancelled) return;

        const structuredCount = rounds.filter((round) => Boolean(parseStructuredReflectionFromRound(round))).length;
        setEligibleRoundCount(structuredCount);

        // Compute patterns for Pro users OR free users who have earned it (3+ structured rounds)
        const hasEarned = features.pattern_detection || structuredCount >= FREE_PATTERN_DETECTION_ROUNDS;

        if (hasEarned) {
          const nextSummary = derivePatternSummary(rounds);
          if (nextSummary) {
            setSummary(nextSummary);
            savePatternSummary(user.id, nextSummary);
          } else {
            setSummary(stored);
          }
        }
      } catch (error) {
        console.error("Failed to compute pattern insights:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [features.pattern_detection, getRecentRounds, user?.id]);

  // hasPatternAccess: Pro users always have it; free users unlock after FREE_PATTERN_DETECTION_ROUNDS
  const hasPatternAccess = features.pattern_detection || eligibleRoundCount >= FREE_PATTERN_DETECTION_ROUNDS;

  return {
    summary,
    eligibleRoundCount,
    isLoading,
    isPro: features.pattern_detection,
    hasPatternAccess,
  };
}
