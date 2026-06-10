import { useMemo } from "react";
import { useEntitlements } from "@/hooks/useEntitlements";

export type FeatureFlags = {
  round_dna: boolean;
  pattern_detection: boolean;
  personalized_brief: boolean;
  quick_tap: boolean;
  unlimited_ai: boolean;
};

export const FREE_AI_MESSAGES_PER_ROUND = 15;
export const FREE_PATTERN_DETECTION_ROUNDS = 3;

export function useFeatureFlags() {
  const { isPro, entitlements, isLoading } = useEntitlements();

  const features = useMemo<FeatureFlags>(() => {
    if (isPro) {
      return {
        round_dna: true,
        pattern_detection: true,
        personalized_brief: true,
        quick_tap: true,
        unlimited_ai: true,
      };
    }

    return {
      round_dna: false,
      pattern_detection: false,
      personalized_brief: false,
      quick_tap: false,
      unlimited_ai: false,
    };
  }, [isPro]);

  return {
    features,
    isPro,
    isLoading,
    plan: entitlements.plan,
    aiMessagesPerRoundLimit: isPro ? null : FREE_AI_MESSAGES_PER_ROUND,
  };
}
