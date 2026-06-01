import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Adds a soft ambient glow around the card */
  glow?: boolean;
  /** "default" | "sand" — sand variant has a warmer highlight */
  variant?: "default" | "sand";
}

export function GlassCard({ children, className, glow, variant = "default", ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        // Base shape & blur
        "relative overflow-hidden rounded-[24px] border backdrop-blur-xl",
        // Colour variants
        variant === "sand"
          ? "border-[rgba(203,184,146,0.18)] bg-[rgba(20,46,34,0.52)]"
          : "border-[var(--border)] bg-[rgba(14,42,31,0.42)]",
        // Shadow — inner top highlight + outer depth
        "shadow-[0_1px_0_rgba(203,184,146,0.07)_inset,_0_16px_40px_rgba(0,0,0,0.36)]",
        // Optional ambient glow
        glow && "shadow-[0_1px_0_rgba(203,184,146,0.07)_inset,_0_16px_40px_rgba(0,0,0,0.36),_0_0_36px_rgba(18,64,47,0.45)]",
        className,
      )}
      {...props}
    >
      {/* Glass edge highlight — thin sand-tinted line at top */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(203,184,146,0.2)] to-transparent"
      />
      {children}
    </div>
  );
}
