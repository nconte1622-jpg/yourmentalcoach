// Haptic feedback utility for mobile devices
// Uses the Vibration API where available

type HapticStyle = "light" | "medium" | "soft" | "success";

const hapticPatterns: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 20,
  soft: 5,
  success: [10, 50, 10],
};

export function triggerHaptic(style: HapticStyle = "light"): void {
  const impactStyle =
    style === "soft" || style === "light"
      ? "LIGHT"
      : style === "medium"
        ? "MEDIUM"
        : "HEAVY";

  // Try Capacitor Haptics plugin first (iOS/Android app runtime)
  try {
    const cap = (window as Window & {
      Capacitor?: {
        Plugins?: {
          Haptics?: {
            impact?: (opts: { style: "LIGHT" | "MEDIUM" | "HEAVY" }) => Promise<void> | void;
            notification?: (opts: { type: "SUCCESS" | "WARNING" | "ERROR" }) => Promise<void> | void;
          };
        };
      };
    }).Capacitor;

    const haptics = cap?.Plugins?.Haptics;
    if (haptics) {
      if (style === "success" && haptics.notification) {
        void haptics.notification({ type: "SUCCESS" });
        return;
      }
      if (haptics.impact) {
        void haptics.impact({ style: impactStyle });
        return;
      }
    }
  } catch {
    // Continue to vibration fallback
  }

  // Check if vibration API is available
  if (!("vibrate" in navigator)) return;

  try {
    const pattern = hapticPatterns[style];
    navigator.vibrate(pattern);
  } catch {
    // Silently fail if vibration not supported
  }
}

// Hook for components
import { useCallback } from "react";

export function useHaptic() {
  const haptic = useCallback((style: HapticStyle = "light") => {
    triggerHaptic(style);
  }, []);

  return { haptic };
}
