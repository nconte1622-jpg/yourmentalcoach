import { useState } from "react";
import { cn } from "@/lib/utils";

interface LRMActiveBadgeProps {
  className?: string;
}

export function LRMActiveBadge({ className }: LRMActiveBadgeProps) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setShowInfo((v) => !v)}
        className={cn(
          "lrm-active-badge min-h-11 rounded-full px-3.5 py-2",
          "inline-flex items-center gap-2",
          className,
        )}
        aria-label="Memory Active — tap to learn more"
        aria-expanded={showInfo}
      >
        <span className="lrm-active-dot" aria-hidden="true" />
        <span className="text-xs font-medium tracking-wide text-[var(--sand-0)]">
          Memory Active
        </span>
        <span className="text-[8px] text-[var(--sand-0)] opacity-50 ml-0.5">?</span>
      </button>

      {showInfo && (
        <>
          {/* Backdrop tap-away */}
          <div
            className="fixed inset-0 z-[70]"
            onClick={() => setShowInfo(false)}
          />
          {/* Tooltip panel */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[80] w-[260px] rounded-2xl border border-[rgba(203,184,146,0.18)] bg-[rgba(9,19,15,0.97)] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-fade-in">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--sand-0)] mb-2">What is Memory?</p>
            <p className="text-xs leading-5 text-[var(--text-1)]">
              Your coach remembers your cue words, highlights, and emotional patterns from past rounds. The more you use the app, the more personal and specific the coaching becomes.
            </p>
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="mt-3 w-full rounded-xl bg-white/6 py-2 text-xs text-[var(--text-1)] hover:bg-white/10 transition-colors"
            >
              Got it
            </button>
          </div>
        </>
      )}
    </div>
  );
}

