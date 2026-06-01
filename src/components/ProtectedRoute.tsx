import { ReactNode, useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PageShell } from "@/components/PageShell";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const hasShownToast = useRef(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !hasShownToast.current) {
      hasShownToast.current = true;
      toast.info("Please sign in to continue");
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <PageShell backgroundVariant="default">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};