import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  header: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  headerRegionClassName?: string;
}

export function AppShell({
  header,
  children,
  className,
  contentClassName,
  headerRegionClassName,
}: AppShellProps) {
  const debugSafeArea =
    typeof window !== "undefined" && window.localStorage.getItem("DEBUG_SAFEAREA") === "1";

  return (
    <div className={cn("app-shell", className)}>
      <header
        className={cn(
          "app-shell-header",
          debugSafeArea && "safearea-debug-header",
          headerRegionClassName
        )}
      >
        {header}
      </header>
      <main className={cn("app-shell-content", debugSafeArea && "safearea-debug-content", contentClassName)}>
        {children}
      </main>
    </div>
  );
}
