/**
 * useProStatus - backward-compatible wrapper around useEntitlements.
 * All PRO status is now sourced from user_entitlements table.
 */
import { useEntitlements } from "@/hooks/useEntitlements";

interface ProStatus {
  isPro: boolean;
  isLoading: boolean;
}

export function useProStatus(): ProStatus {
  const { isPro, isLoading } = useEntitlements();
  return { isPro, isLoading };
}
