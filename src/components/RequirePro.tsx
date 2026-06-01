import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useEntitlements } from "@/hooks/useEntitlements";

interface RequireProProps {
  children: ReactNode;
  fallbackPath?: string;
}

/**
 * Route guard: redirects free users to the upgrade page.
 * Wrap any PRO-only route with this component.
 */
export function RequirePro({ children, fallbackPath = "/upgrade" }: RequireProProps) {
  const { isPro, isLoading } = useEntitlements();

  if (isLoading) return null;

  if (!isPro) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
