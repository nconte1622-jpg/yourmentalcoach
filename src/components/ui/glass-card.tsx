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
          ? "border-[rgba(45,106,79,0.1)] bg-white/90"
          : "border-[rgba(45,106,79,0.06)] bg-white/85",
        // Soft green-tinted depth so cards feel grounded and premium, not flat.
        "shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,_0_4px_16px_rgba(26,92,46,0.08),_0_2px_6px_rgba(0,0,0,0.04)]",
        glow && "shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,_0_4px_16px_rgba(26,92,46,0.08),_0_2px_6px_rgba(0,0,0,0.04),_0_0_28px_rgba(45,106,79,0.10)]",
        className,
      )}
      {...props}
    >
      {/* Glass edge highlight — thin sand-tinted line at top */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(45,106,79,0.08)] to-transparent"
      />
      {children}
    </div>
  );
}
