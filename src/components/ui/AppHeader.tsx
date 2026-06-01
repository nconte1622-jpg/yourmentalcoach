import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  subrow?: ReactNode;
  children?: ReactNode;
  className?: string;
  innerClassName?: string;
  subrowClassName?: string;
}

export function AppHeader({
  left,
  center,
  right,
  subrow,
  children,
  className,
  innerClassName,
  subrowClassName,
}: AppHeaderProps) {
  const hasSlots = left !== undefined || center !== undefined || right !== undefined;

  return (
    <div className={cn("app-header", className)}>
      {hasSlots ? (
        <div className={cn("app-header-row app-header-grid", innerClassName)}>
          <div className="app-header-left pointer-events-auto">{left}</div>
          <div className="app-header-center pointer-events-none">{center}</div>
          <div className="app-header-right pointer-events-auto">{right}</div>
        </div>
      ) : (
        <div className={cn("app-header-row", innerClassName)}>{children}</div>
      )}
      <div className={cn("app-header-subrow", subrowClassName)}>{subrow}</div>
    </div>
  );
}
