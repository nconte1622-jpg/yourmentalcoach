/**
 * Check-In Card — Non-intrusive proactive coaching prompt
 *
 * Slides in from bottom during a round to ask how the golfer is feeling.
 * Shows emotion quick-taps for 1-tap response. Auto-dismisses after 60s.
 */

import { X } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const CHECKIN_EMOTIONS = [
  "Confident",
  "Calm",
  "Anxious",
  "Overwhelmed",
  "Tight",
  "Rushed",
  "Frustrated",
  "Distracted",
] as const;

interface CheckInCardProps {
  message: string;
  onEmotion: (emotion: string) => void;
  onDismiss: () => void;
  className?: string;
}

export function CheckInCard({ message, onEmotion, onDismiss, className }: CheckInCardProps) {
  return (
    <div
      className={cn(
        "fixed bottom-[calc(var(--bottom-dock-h)+var(--sab)+120px)] left-4 right-4 z-[60]",
        "animate-slide-up",
        className,
      )}
    >
      <div className="mx-auto max-w-md rounded-3xl border border-[rgba(203,184,146,0.15)] bg-[rgba(9,19,15,0.95)] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        {/* Header with dismiss */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--sand-0)] opacity-70 mb-1">
              Check-in
            </p>
            <p className="text-sm text-[var(--text-0)] leading-relaxed">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onDismiss();
            }}
            className="shrink-0 rounded-full p-1.5 text-white/40 hover:text-white/70 hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Emotion quick-taps */}
        <div className="flex flex-wrap gap-2">
          {CHECKIN_EMOTIONS.map((emotion) => (
            <button
              key={emotion}
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                onEmotion(emotion);
              }}
              className="rounded-full border border-[var(--border)] bg-[rgba(18,64,47,0.42)] px-4 py-2.5 text-sm font-medium tracking-wide text-[var(--text-0)] transition-all duration-200 hover:bg-[rgba(18,64,47,0.62)] active:scale-95"
            >
              {emotion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
