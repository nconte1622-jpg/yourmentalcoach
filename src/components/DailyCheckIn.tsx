/**
 * DailyCheckIn — 30-second mental ritual for the Home "Today" slide.
 *
 * Drives daily app opens even on non-golf days. Three quick interactions:
 *  1. Focus level (5 dots — tap to rate)
 *  2. Intention tap (3 preset options)
 *  3. Confirmation + cue word for today
 *
 * Stores completion per-day so the card collapses after the ritual is done.
 */

import { useState, useCallback } from "react";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { Check, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

/* ─── Types ───────────────────────────────────────────────── */

export interface DailyCheckInData {
  date: string;           // YYYY-MM-DD
  focusLevel: number;     // 1–5
  intention: string;
  cueWord: string | null;
  completedAt: string;
}

/* ─── Storage ─────────────────────────────────────────────── */

const CHECKIN_KEY_PREFIX = "caddie-daily-checkin-";

function todayKey(): string {
  return CHECKIN_KEY_PREFIX + new Date().toISOString().split("T")[0];
}

export function getTodayCheckIn(): DailyCheckInData | null {
  try {
    const raw = localStorage.getItem(todayKey());
    if (!raw) return null;
    return JSON.parse(raw) as DailyCheckInData;
  } catch {
    return null;
  }
}

function saveTodayCheckIn(data: DailyCheckInData): void {
  try {
    localStorage.setItem(todayKey(), JSON.stringify(data));
  } catch { /* silent */ }
}

/* ─── Data ────────────────────────────────────────────────── */

const INTENTIONS = [
  { value: "stay-present", label: "Stay Present", emoji: "🎯" },
  { value: "trust-my-game", label: "Trust My Game", emoji: "🌿" },
  { value: "play-free", label: "Play Free", emoji: "🔥" },
  { value: "compete-hard", label: "Compete Hard", emoji: "🏆" },
  { value: "enjoy-the-process", label: "Enjoy the Process", emoji: "☀️" },
] as const;

type IntentionValue = typeof INTENTIONS[number]["value"];

const FOCUS_LABELS = ["Low", "Below avg", "Average", "Good", "Locked in"] as const;

/* ─── Sub-components ──────────────────────────────────────── */

function FocusDots({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => { triggerHaptic("soft"); onChange(i); }}
          className={cn(
            "h-9 w-9 rounded-full border transition-all duration-200 active:scale-90",
            i <= value
              ? "border-[rgba(203,184,146,0.6)] bg-[rgba(203,184,146,0.25)] shadow-[0_0_10px_rgba(203,184,146,0.15)]"
              : "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)]"
          )}
          aria-label={`Focus level ${i}`}
        />
      ))}
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────── */

type CheckInStep = "focus" | "intention" | "complete";

interface DailyCheckInProps {
  savedCueWord?: string | null;
  onComplete?: (data: DailyCheckInData) => void;
}

export function DailyCheckIn({ savedCueWord, onComplete }: DailyCheckInProps) {
  const existing = getTodayCheckIn();

  const [step, setStep] = useState<CheckInStep>(existing ? "complete" : "focus");
  const [focusLevel, setFocusLevel] = useState<number>(existing?.focusLevel ?? 0);
  const [intention, setIntention] = useState<IntentionValue | null>(
    (existing?.intention as IntentionValue) ?? null
  );
  const [completedData, setCompletedData] = useState<DailyCheckInData | null>(existing);

  const handleFocusNext = useCallback(() => {
    if (focusLevel === 0) return;
    triggerHaptic("medium");
    setStep("intention");
  }, [focusLevel]);

  const handleIntentionSelect = useCallback(
    (v: IntentionValue) => {
      triggerHaptic("medium");
      setIntention(v);
      const data: DailyCheckInData = {
        date: new Date().toISOString().split("T")[0],
        focusLevel,
        intention: v,
        cueWord: savedCueWord ?? null,
        completedAt: new Date().toISOString(),
      };
      saveTodayCheckIn(data);
      setCompletedData(data);
      setStep("complete");
      onComplete?.(data);
    },
    [focusLevel, savedCueWord, onComplete]
  );

  /* ── Completed state ──────────────────────────────────── */
  if (step === "complete" && completedData) {
    const intentionObj = INTENTIONS.find((i) => i.value === completedData.intention);
    return (
      <GlassCard className="calm-pro-mount p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(31,180,100,0.15)] border border-[rgba(31,180,100,0.3)]">
            <Check className="h-4 w-4 text-[rgba(31,180,100,0.9)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[var(--text-0)]">
              {intentionObj?.emoji} {intentionObj?.label ?? completedData.intention}
            </p>
            <p className="text-[11px] text-[var(--text-1)]">
              Focus {completedData.focusLevel}/5 · Checked in for today
              {completedData.cueWord ? ` · "${completedData.cueWord}"` : ""}
            </p>
          </div>
        </div>
      </GlassCard>
    );
  }

  /* ── Focus step ───────────────────────────────────────── */
  if (step === "focus") {
    return (
      <GlassCard className="calm-pro-mount space-y-4 p-5">
        <div className="space-y-1 text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--sand-0)]">
            Daily Check-In
          </p>
          <p className="font-serif text-lg text-[var(--text-0)]">
            How&apos;s your mental focus today?
          </p>
          {focusLevel > 0 && (
            <p className="text-xs text-[var(--text-1)] animate-fade-in">
              {FOCUS_LABELS[focusLevel - 1]}
            </p>
          )}
        </div>

        <FocusDots value={focusLevel} onChange={setFocusLevel} />

        <button
          type="button"
          onClick={handleFocusNext}
          disabled={focusLevel === 0}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-medium transition-all duration-200",
            focusLevel > 0
              ? "bg-[rgba(203,184,146,0.12)] border border-[rgba(203,184,146,0.25)] text-[var(--text-0)] hover:bg-[rgba(203,184,146,0.18)] active:scale-[0.97]"
              : "border border-[rgba(255,255,255,0.06)] text-[var(--text-1)] opacity-40 cursor-not-allowed"
          )}
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </GlassCard>
    );
  }

  /* ── Intention step ───────────────────────────────────── */
  return (
    <GlassCard className="calm-pro-mount space-y-4 p-5">
      <div className="space-y-1 text-center">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--sand-0)]">
          Set Your Intention
        </p>
        <p className="font-serif text-lg text-[var(--text-0)]">
          What&apos;s your focus for today?
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {INTENTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleIntentionSelect(opt.value)}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 active:scale-[0.97]",
              intention === opt.value
                ? "border-[rgba(203,184,146,0.4)] bg-[rgba(203,184,146,0.12)]"
                : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]"
            )}
          >
            <span className="text-xl leading-none">{opt.emoji}</span>
            <span className="text-sm font-medium text-[var(--text-0)]">{opt.label}</span>
          </button>
        ))}
      </div>
    </GlassCard>
  );
}
