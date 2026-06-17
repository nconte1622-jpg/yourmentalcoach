/**
 * revenueCat.ts — RevenueCat IAP integration for The Caddie
 *
 * Setup checklist (one-time):
 * 1. Run: npm install @revenuecat/purchases-capacitor
 * 2. In Xcode: add StoreKit capability to your target
 * 3. Create RevenueCat account at app.revenuecat.com
 * 4. Add your iOS app (bundle ID: com.nconte.thecaddie)
 * 5. Copy your RevenueCat iOS public API key → paste into RC_API_KEY_IOS below
 * 6. In App Store Connect: create two subscription products:
 *      com.nconte.thecaddie.pro.monthly  →  $9.99/month
 *      com.nconte.thecaddie.pro.annual   →  $99/year
 * 7. Import those products into RevenueCat → create an entitlement called "pro"
 * 8. Create an "Offering" (RevenueCat) with the two packages.
 *
 * The functions below are no-ops on web — only activate on iOS native.
 */

import { Capacitor } from "@capacitor/core";

// ──────────────────────────────────────────────
//  ⚠️  PASTE YOUR REVENUECAT iOS API KEY HERE
// ──────────────────────────────────────────────
export const RC_API_KEY_IOS = "appl_vnnquVfDgzWmdIUyRniZvGifoaX";

/** RevenueCat entitlement ID — must match what you create in the RC dashboard */
export const RC_ENTITLEMENT_ID = "pro";

/** App Store product identifiers — must match App Store Connect */
export const RC_PRODUCT_IDS = {
  monthly: "com.nconte.thecaddie.pro.monthly",
  annual:  "com.nconte.thecaddie.pro.annual",
} as const;

export type BillingCycle = keyof typeof RC_PRODUCT_IDS;

// Dynamic import so the module doesn't break on web where the
// native plugin is unavailable.
async function getSDK() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const mod = await import("@revenuecat/purchases-capacitor");
    return mod.Purchases;
  } catch {
    console.warn("[RevenueCat] SDK not installed. Run: npm install @revenuecat/purchases-capacitor");
    return null;
  }
}

/** Call once on app start (after the user is identified or as anonymous). */
export async function configureRevenueCat(userId?: string | null) {
  const SDK = await getSDK();
  if (!SDK) return;

  try {
    await SDK.configure({
      apiKey: RC_API_KEY_IOS,
      appUserID: userId ?? undefined, // undefined = RevenueCat anonymous user
    });
    if (import.meta.env.DEV) {
      const { LOG_LEVEL } = await import("@revenuecat/purchases-capacitor");
      await SDK.setLogLevel({ level: LOG_LEVEL.DEBUG });
    }
  } catch (err) {
    console.error("[RevenueCat] configure error:", err);
  }
}

/** Switch to a logged-in user ID after sign-in (merges anonymous purchases). */
export async function identifyRevenueCatUser(userId: string) {
  const SDK = await getSDK();
  if (!SDK) return;
  try {
    await SDK.logIn({ appUserID: userId });
  } catch (err) {
    console.error("[RevenueCat] logIn error:", err);
  }
}

/** Log out on sign-out (resets to anonymous). */
export async function logOutRevenueCatUser() {
  const SDK = await getSDK();
  if (!SDK) return;
  try {
    await SDK.logOut();
  } catch (err) {
    console.error("[RevenueCat] logOut error:", err);
  }
}

export interface PurchaseResult {
  isPro: boolean;
  productId: string | null;
  error: string | null;
  cancelled: boolean;
}

/** Purchase a subscription package. Returns isPro=true on success. */
export async function purchaseSubscription(cycle: BillingCycle): Promise<PurchaseResult> {
  const SDK = await getSDK();
  if (!SDK) {
    return { isPro: false, productId: null, error: "Purchases not available on web", cancelled: false };
  }

  try {
    const offerings = await SDK.getOfferings();
    const current = offerings.current;
    if (!current) {
      return { isPro: false, productId: null, error: "No offerings available", cancelled: false };
    }

    // Find the matching package by product identifier
    const targetId = RC_PRODUCT_IDS[cycle];
    const pkg = current.availablePackages.find(
      (p) => p.product.identifier === targetId
    );

    if (!pkg) {
      return { isPro: false, productId: null, error: `Package not found: ${targetId}`, cancelled: false };
    }

    const { customerInfo } = await SDK.purchasePackage({ aPackage: pkg });
    const isPro = Boolean(customerInfo.entitlements.active[RC_ENTITLEMENT_ID]);

    return {
      isPro,
      productId: targetId,
      error: null,
      cancelled: false,
    };
  } catch (err: unknown) {
    // RevenueCat throws a typed error for user cancellation
    const message = err instanceof Error ? err.message : String(err);
    const cancelled = message.includes("userCancelled") || message.includes("cancelled");
    return { isPro: false, productId: null, error: message, cancelled };
  }
}

export interface RestoreResult {
  isPro: boolean;
  error: string | null;
}

/** Restore existing App Store purchases. */
export async function restoreRevenueCatPurchases(): Promise<RestoreResult> {
  const SDK = await getSDK();
  if (!SDK) {
    return { isPro: false, error: "Purchases not available on web" };
  }

  try {
    const { customerInfo } = await SDK.restorePurchases();
    const isPro = Boolean(customerInfo.entitlements.active[RC_ENTITLEMENT_ID]);
    return { isPro, error: null };
  } catch (err) {
    return { isPro: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Check current entitlement status (fast, uses cached customer info). */
export async function checkRevenueCatEntitlement(): Promise<boolean> {
  const SDK = await getSDK();
  if (!SDK) return false;

  try {
    const { customerInfo } = await SDK.getCustomerInfo();
    return Boolean(customerInfo.entitlements.active[RC_ENTITLEMENT_ID]);
  } catch {
    return false;
  }
}
