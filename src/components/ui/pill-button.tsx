import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "sand" | "green" | "ghost";
}

export function PillButton({ className, tone = "sand", ...props }: PillButtonProps) {
  return (
    <button
      className={cn(
        "calm-pro-focus calm-pro-press inline-flex items-center min-h-11 rounded-full px-5 py-2 text-sm font-medium",
        "transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
        tone === "sand" && [
          "bg-[var(--sand-0)] text-[#1a1e1c]",
          "shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,_0_2px_8px_rgba(203,184,146,0.18)]",
          "hover:bg-[var(--sand-1)] hover:shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,_0_4px_12px_rgba(203,184,146,0.24)]",
        ],
        tone === "green" && [
          "bg-[rgba(31,106,74,0.95)] text-[var(--text-0)]",
          "shadow-[0_1px_0_rgba(255,255,255,0.07)_inset,_0_2px_8px_rgba(18,64,47,0.4)]",
          "hover:bg-[rgba(31,106,74,1)] hover:shadow-[0_1px_0_rgba(255,255,255,0.07)_inset,_0_4px_14px_rgba(18,64,47,0.5)]",
        ],
        tone === "ghost" && [
          "bg-transparent border border-[var(--border)] text-[var(--text-1)]",
          "hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-0)]",
        ],
        className,
      )}
      {...props}
    />
  );
}
