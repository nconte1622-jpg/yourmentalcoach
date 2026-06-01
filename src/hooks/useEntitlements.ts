import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";
import { toast } from "sonner";

export interface Entitlements {
  plan: "free" | "pro";
  entitlement_source: string;
  apple_entitlement_active: boolean;
  apple_product_id: string | null;
  expires_at: string | null;
}

const DEFAULT_ENTITLEMENTS: Entitlements = {
  plan: "free",
  entitlement_source: "free",
  apple_entitlement_active: false,
  apple_product_id: null,
  expires_at: null,
};

// How long to wait for Supabase edge functions before giving up
const ENTITLEMENTS_TIMEOUT_MS = 2500;

// localStorage key for persisting entitlements between sessions
const ENTITLEMENTS_CACHE_KEY = "ymc_entitlements_v1";

function loadCachedEntitlements(): Entitlements | null {
  try {
    const raw = localStorage.getItem(ENTITLEMENTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Entitlements>;
    return normalizeEntitlements(parsed);
  } catch {
    return null;
  }
}

function saveCachedEntitlements(e: Entitlements) {
  try {
    localStorage.setItem(ENTITLEMENTS_CACHE_KEY, JSON.stringify(e));
  } catch {
    // localStorage might be full or disabled — ignore
  }
}

type EntitlementsContextValue = {
  entitlements: Entitlements;
  isPro: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  refresh: () => Promise<Entitlements>;
  setTestOverride: (plan: "pro" | "free") => Promise<{ error: unknown }>;
  recordApplePurchase: (purchaseData: {
    isPro: boolean;
    productId?: string;
    transactionId?: string;
    expiresAt?: string;
  }) => Promise<{ error: unknown }>;
  restorePurchases: () => Promise<{ error: unknown; restored: boolean }>;
};

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

function normalizeEntitlements(data: Partial<Entitlements> | null | undefined): Entitlements {
  return {
    plan: data?.plan === "pro" ? "pro" : "free",
    entitlement_source: data?.entitlement_source || "free",
    apple_entitlement_active: data?.apple_entitlement_active || false,
    apple_product_id: data?.apple_product_id || null,
    expires_at: data?.expires_at || null,
  };
}

/** Races a promise against a timeout. Rejects with "timeout" if too slow. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  // Seed from localStorage cache so subsequent loads are instant
  const cached = useRef(loadCachedEntitlements());
  const [entitlements, setEntitlements] = useState<Entitlements>(cached.current ?? DEFAULT_ENTITLEMENTS);
  // If we have a cache, consider ourselves already loaded (will refresh silently)
  const [isLoading, setIsLoading] = useState(cached.current === null);
  const [isAdmin, setIsAdmin] = useState(false);

  const hasLoadedOnce = useRef(cached.current !== null);

  const fetchEntitlements = useCallback(async () => {
    if (!user?.id) {
      setEntitlements(DEFAULT_ENTITLEMENTS);
      setIsAdmin(false);
      setIsLoading(false);
      return DEFAULT_ENTITLEMENTS;
    }

    // Only show loading state on FIRST fetch — subsequent refreshes
    // happen silently to avoid unmounting the entire app router
    if (!hasLoadedOnce.current) {
      setIsLoading(true);
    }

    try {
      const [{ data, error }, { data: adminData }] = await withTimeout(
        Promise.all([
          supabase.functions.invoke("manage-entitlements", {
            body: { action: "get" },
          }),
          supabase.functions.invoke("manage-entitlements", {
            body: { action: "check_admin" },
          }),
        ]),
        ENTITLEMENTS_TIMEOUT_MS
      );

      if (error) throw error;

      const normalized = normalizeEntitlements(data);
      setEntitlements((current) => {
        if (JSON.stringify(current) === JSON.stringify(normalized)) return current;
        saveCachedEntitlements(normalized);
        return normalized;
      });
      setIsAdmin(adminData?.isAdmin === true);
      return normalized;
    } catch (err) {
      // Timeout or network error — use cached plan if available so Pro users
      // aren't silently downgraded; warn them but don't crash the app.
      console.warn("Entitlements fetch failed or timed out:", err);
      const fallback = cached.current ?? DEFAULT_ENTITLEMENTS;
      setEntitlements(fallback);
      setIsAdmin(false);
      if (hasLoadedOnce.current) {
        // Only show toast on subsequent failures, not on first cold load
        toast.warning("Couldn't verify your plan. Using last known status.", {
          duration: 4000,
          id: "entitlements-fallback",
        });
      }
      return fallback;
    } finally {
      hasLoadedOnce.current = true;
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    void fetchEntitlements();
  }, [authLoading, fetchEntitlements]);

  const isPro = entitlements.plan === "pro" || entitlements.apple_entitlement_active;

  const setTestOverride = useCallback(async (plan: "pro" | "free") => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-entitlements", {
        body: { action: "test_override", plan },
      });
      if (error) throw error;
      if (data) setEntitlements(normalizeEntitlements(data));
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  }, []);

  const recordApplePurchase = useCallback(async (purchaseData: {
    isPro: boolean;
    productId?: string;
    transactionId?: string;
    expiresAt?: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-entitlements", {
        body: { action: "apple_purchase", ...purchaseData },
      });
      if (error) throw error;
      if (data) setEntitlements(normalizeEntitlements(data));
      trackEvent("subscription_started", {
        productId: purchaseData.productId ?? null,
        isPro: purchaseData.isPro,
      });
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    trackEvent("restore_purchases_tapped");
    try {
      const latest = await fetchEntitlements();
      return {
        error: null,
        restored: latest.apple_entitlement_active || latest.plan === "pro",
      };
    } catch (err) {
      return { error: err, restored: false };
    }
  }, [fetchEntitlements]);

  const value = useMemo<EntitlementsContextValue>(
    () => ({
      entitlements,
      isPro,
      isLoading,
      isAdmin,
      refresh: fetchEntitlements,
      setTestOverride,
      recordApplePurchase,
      restorePurchases,
    }),
    [entitlements, fetchEntitlements, isAdmin, isLoading, isPro, recordApplePurchase, restorePurchases, setTestOverride]
  );

  return createElement(EntitlementsContext.Provider, { value }, children);
}

export function useEntitlements() {
  const context = useContext(EntitlementsContext);
  if (!context) {
    throw new Error("useEntitlements must be used within an EntitlementsProvider");
  }
  return context;
}
