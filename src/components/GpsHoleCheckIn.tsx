/**
 * GpsHoleCheckIn
 *
 * Slide-up modal that fires when GPS Smart Round Mode detects a hole
 * transition. Asks: "How was your mental game on that hole?"
 *
 * Three quick options:
 *   Solid ✓  |  Shaky ✗  |  Bounced back ↑
 *
 * On selection, records the check-in via recordHoleCheckIn() and dismisses.
 * Designed to be operable with one thumb in under 3 seconds.
 */

import { useEffect, useRef } from "react";
import { HoleMentalRating, recordHoleCheckIn } from "@/lib/gpsRoundTracker";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface GpsHoleCheckInProps {
  /** Hole number the player just finished */
  holeNumber: number;
  /** Whether the modal is visible */
  visible: boolean;
  /** Called after the player selects an option or dismisses */
  onDismiss: () => void;
  /** Optional GPS position to attach to the check-in */
  position?: { lat: number; lng: number; timestamp: number };
}

const OPTIONS: { rating: HoleMentalRating; label: string; sublabel: string; color: string; icon: string }[] = [
  {
    rating: "solid",
    label: "Solid",
    sublabel: "Stayed present and clear",
    color: "rgba(31,180,100,0.9)",
    icon: "✓",
  },
  {
    rating: "shaky",
    label: "Shaky",
    sublabel: "Got in my head a bit",
    color: "rgba(220,100,70,0.85)",
    icon: "↯",
  },
  {
    rating: "bounced_back",
    label: "Bounced back",
    sublabel: "Started rough, recovered",
    color: "rgba(203,184,146,0.95)",
    icon: "↑",
  },
];

export function GpsHoleCheckIn({ holeNumber, visible, onDismiss, position }: GpsHoleCheckInProps) {
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss after 20 seconds if ignored (don't block the round)
  useEffect(() => {
    if (!visible) return;
    dismissTimer.current = setTimeout(() => {
      onDismiss();
    }, 20000);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [visible, onDismiss]);

  function handleSelect(rating: HoleMentalRating) {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    triggerHaptic("medium");
    recordHoleCheckIn(rating, position);
    onDismiss();
  }

  function handleSkip() {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    triggerHaptic("light");
    onDismiss();
  }

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-[200] transition-all duration-350 ease-out",
        visible ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-full opacity-0 pointer-events-none"
      )}
      aria-modal="true"
      role="dialog"
      aria-label={`Hole ${holeNumber} mental check-in`}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="relative z-10 mx-auto max-w-lg rounded-t-3xl border-t border-[rgba(203,184,146,0.12)] bg-[#08130d] px-5 pb-10 pt-5 shadow-[0_-20px_60px_rgba(0,0,0,0.5)]">
        {/* Drag handle */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15" />

        {/* Header */}
        <div className="mb-5 space-y-1 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(203,184,146,0.55)" }}>
            Hole {holeNumber} complete
          </p>
          <h2 className="text-xl font-serif" style={{ color: "rgba(255,255,255,0.9)" }}>
            How was your mental game?
          </h2>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            Quick tap — your coach learns from this
          </p>
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {OPTIONS.map((opt) => (
            <button
              key={opt.rating}
              type="button"
              onClick={() => handleSelect(opt.rating)}
              className="group flex w-full items-center gap-4 rounded-2xl border border-white/8 bg-white/5 px-4 py-4 text-left transition-all duration-150 active:scale-[0.97] hover:bg-white/9"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold transition-all"
                style={{
                  background: `${opt.color.replace("0.9", "0.15").replace("0.85", "0.12").replace("0.95", "0.1")}`,
                  color: opt.color,
                  boxShadow: `0 0 0 1px ${opt.color.replace("0.9", "0.25").replace("0.85", "0.2").replace("0.95", "0.2")}`,
                }}
              >
                {opt.icon}
              </span>
              <div>
                <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
                  {opt.label}
                </p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {opt.sublabel}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Skip */}
        <button
          type="button"
          onClick={handleSkip}
          className="mt-4 w-full py-3 text-xs"
          style={{ color: "rgba(255,255,255,0.25)" }}
        >
          Skip — just keep playing
        </button>
      </div>
    </div>
  );
}
