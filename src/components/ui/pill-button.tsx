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
          "bg-[#2d6a4f] text-white",
          "shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,_0_2px_8px_rgba(45,106,79,0.18)]",
          "hover:bg-[#256244] hover:shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,_0_4px_12px_rgba(45,106,79,0.24)]",
        ],
        tone === "green" && [
          "bg-[#2d6a4f] text-white",
          "shadow-[0_1px_0_rgba(255,255,255,0.07)_inset,_0_2px_8px_rgba(45,106,79,0.25)]",
          "hover:bg-[#256244] hover:shadow-[0_1px_0_rgba(255,255,255,0.07)_inset,_0_4px_14px_rgba(45,106,79,0.3)]",
        ],
        tone === "ghost" && [
          "bg-transparent border border-[rgba(45,106,79,0.12)] text-[rgba(26,26,26,0.6)]",
          "hover:bg-[rgba(0,0,0,0.03)] hover:text-[#1a1a1a]",
        ],
        className,
      )}
      {...props}
    />
  );
}
