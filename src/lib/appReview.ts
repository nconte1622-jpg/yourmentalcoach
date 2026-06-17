/**
 * appReview.ts
 *
 * Requests an App Store review after milestone round completions.
 * Thresholds: 3rd, 10th, 25th completed round.
 *
 * Uses @capacitor-community/rate-app (SKStoreReviewController on iOS) with
 * a graceful fallback to the App Store write-review URL if the plugin is
 * unavailable or the user is on a non-native platform.
 */

import { Capacitor } from "@capacitor/core";

const REVIEW_KEY = "caddie-completed-round-count";
const REVIEW_THRESHOLDS = new Set([3, 10, 25]);

export function incrementCompletedRounds(): void {
  try {
    const count = getCompletedRoundCount() + 1;
    localStorage.setItem(REVIEW_KEY, String(count));
  } catch {
    /* storage unavailable — silent */
  }
}

export function getCompletedRoundCount(): number {
  try {
    return parseInt(localStorage.getItem(REVIEW_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Call after `incrementCompletedRounds()` on RoundComplete.
 * Silently does nothing if the current count isn't a threshold.
 */
export async function maybeRequestReview(): Promise<void> {
  const count = getCompletedRoundCount();
  if (!REVIEW_THRESHOLDS.has(count)) return;

  if (Capacitor.isNativePlatform()) {
    try {
      // Dynamic import — won't error at build time if plugin isn't installed
      const pkgName = "@capacitor-community/" + "rate-app";
      const mod = await import(/* @vite-ignore */ pkgName) as {
        RateApp: { requestReview: () => Promise<void> };
      };
      await mod.RateApp.requestReview();
      return;
    } catch {
      // Plugin missing or iOS denied — fall through to URL fallback
    }
  }

  // Web / plugin unavailable: deep-link directly to App Store review sheet
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({
      url: "https://apps.apple.com/app/id6759075246?action=write-review",
    });
  } catch {
    /* ignore */
  }
}
