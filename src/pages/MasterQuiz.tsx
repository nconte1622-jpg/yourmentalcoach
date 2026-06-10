import { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Target, Brain, Flame, Trophy } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import {
  type GolferProfile,
  DEFAULT_PROFILE,
  saveGolferProfile,
  parseHeight,
} from "@/lib/golferProfile";
import { toast } from "sonner";

/* ─────────────────────────────────────────────
   Quiz step definitions
   ───────────────────────────────────────────── */

type QuizStep = {
  id: string;
  icon: typeof Target;
  title: string;
  subtitle: string;
};

const STEPS: QuizStep[] = [
  { id: "basics", icon: Target, title: "The Basics", subtitle: "Let's get to know you." },
  { id: "game", icon: Trophy, title: "Your Game", subtitle: "Tell us about your golf." },
  { id: "mental", icon: Brain, title: "Your Mind", subtitle: "How you handle the course." },
  { id: "goals", icon: Flame, title: "Your Goals", subtitle: "Where you want to go." },
];

type OptionItem = { value: string; label: string; description?: string };

/* ─────────────────────────────────────────────
   Reusable option selector
   ───────────────────────────────────────────── */
function OptionGrid({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: OptionItem[];
  value: string | null;
  onChange: (v: string) => void;
  columns?: number;
}) {
  return (
    <div className={cn("grid gap-3", columns === 2 ? "grid-cols-2" : "grid-cols-1")}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              triggerHaptic("soft");
              onChange(opt.value);
            }}
            className={cn(
              "rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.97]",
              selected
                ? "border-[rgba(203,184,146,0.35)] bg-[rgba(203,184,146,0.12)] shadow-[0_0_20px_rgba(203,184,146,0.08)]"
                : "border-[var(--border)] bg-[rgba(14,42,31,0.3)] hover:bg-[rgba(14,42,31,0.5)]"
            )}
          >
            <p className={cn("text-sm font-medium", selected ? "text-[var(--sand-0)]" : "text-[var(--text-0)]")}>
              {opt.label}
            </p>
            {opt.description && (
              <p className="text-[11px] text-[var(--text-1)] mt-1">{opt.description}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Number input
   ───────────────────────────────────────────── */
function NumberInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  const [localValue, setLocalValue] = useState(value != null ? String(value) : "");

  // Sync from parent when value changes externally
  useEffect(() => {
    setLocalValue(value != null ? String(value) : "");
  }, [value]);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sand-0)]">
        {label}
      </label>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={localValue}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9-]/g, "");
          setLocalValue(raw);
          if (!raw || raw === "-") {
            onChange(null);
            return;
          }
          const n = parseInt(raw, 10);
          if (!isNaN(n)) {
            onChange(n);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--border)] bg-[rgba(14,42,31,0.4)] px-4 py-3 text-[var(--text-0)] placeholder:text-[var(--text-1)] placeholder:opacity-40 outline-none focus:border-[rgba(203,184,146,0.3)] transition-colors"
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Text input
   ───────────────────────────────────────────── */
function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sand-0)]">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--border)] bg-[rgba(14,42,31,0.4)] px-4 py-3 text-[var(--text-0)] placeholder:text-[var(--text-1)] placeholder:opacity-40 outline-none focus:border-[rgba(203,184,146,0.3)] transition-colors"
      />
    </div>
  );
}

/* ═════════════════════════════════════════════
   MASTER QUIZ PAGE
   ═════════════════════════════════════════════ */
export default function MasterQuiz() {
  const navigate = useNavigate();
  const location = useLocation();
  // If we came here from onboarding, go to round-setup after saving so the
  // user immediately starts their first round with a fully-populated profile.
  const fromOnboarding = (location.state as { fromOnboarding?: boolean } | null)?.fromOnboarding === true;
  const [currentStep, setCurrentStep] = useState(0);
  const [profile, setProfile] = useState<GolferProfile>({ ...DEFAULT_PROFILE });
  const [heightFeet, setHeightFeet] = useState<number | null>(null);
  const [heightInches, setHeightInches] = useState<number | null>(null);

  const update = useCallback(<K extends keyof GolferProfile>(key: K, value: GolferProfile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }, []);

  const totalSteps = STEPS.length;
  const step = STEPS[currentStep];
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const goNext = () => {
    triggerHaptic("medium");
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      // Finish quiz
      const finalProfile = { ...profile };
      if (heightFeet != null) {
        finalProfile.heightInches = parseHeight(heightFeet, heightInches ?? 0);
      }
      finalProfile.quizCompletedAt = new Date().toISOString();
      finalProfile.quizVersion = 1;
      saveGolferProfile(finalProfile);
      toast.success("Profile saved! Your coach now knows you.");
      // From onboarding → go start the first round. Otherwise go home.
      navigate(fromOnboarding ? "/round-setup" : "/", { replace: true });
    }
  };

  const goBack = () => {
    triggerHaptic("light");
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    } else {
      navigate(-1);
    }
  };

  const Icon = step.icon;

  return (
    <PageShell backgroundVariant="default">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="shrink-0 pt-[max(16px,env(safe-area-inset-top))] px-5 pb-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text-1)] transition-all duration-200 hover:bg-white/5 active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
              {currentStep === 0 ? "Back" : "Previous"}
            </button>
            <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-1)]">
              {currentStep + 1} / {totalSteps}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
            <div
              className="h-full rounded-full bg-[var(--sand-0)] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-[calc(100px+env(safe-area-inset-bottom))]">
          <div className="max-w-md mx-auto space-y-8">
            {/* Step header */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl border border-[rgba(203,184,146,0.2)] bg-[rgba(203,184,146,0.08)] mx-auto">
                <Icon className="h-6 w-6 text-[var(--sand-0)]" />
              </div>
              <h2 className="text-2xl font-serif text-[var(--text-0)] tracking-wide">{step.title}</h2>
              <p className="text-sm text-[var(--text-1)]">{step.subtitle}</p>
            </div>

            {/* Step content */}
            {currentStep === 0 && (
              <div className="space-y-5">
                <TextInput
                  label="First name"
                  value={profile.firstName}
                  onChange={(v) => update("firstName", v)}
                  placeholder="What should we call you?"
                />
                <NumberInput
                  label="Age"
                  value={profile.age}
                  onChange={(v) => update("age", v)}
                  placeholder="25"
                  min={10}
                  max={99}
                />
                <div className="grid grid-cols-2 gap-3">
                  <NumberInput
                    label="Height (feet)"
                    value={heightFeet}
                    onChange={setHeightFeet}
                    placeholder="5"
                    min={4}
                    max={7}
                  />
                  <NumberInput
                    label="Height (inches)"
                    value={heightInches}
                    onChange={setHeightInches}
                    placeholder="10"
                    min={0}
                    max={11}
                  />
                </div>
                <NumberInput
                  label="Weight (lbs)"
                  value={profile.weightLbs}
                  onChange={(v) => update("weightLbs", v)}
                  placeholder="175"
                  min={80}
                  max={400}
                />
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <NumberInput
                  label="Handicap (leave blank if unsure)"
                  value={profile.handicap}
                  onChange={(v) => update("handicap", v)}
                  placeholder="15"
                  min={-5}
                  max={54}
                />
                <NumberInput
                  label="Average 18-hole score"
                  value={profile.averageScore}
                  onChange={(v) => update("averageScore", v)}
                  placeholder="92"
                  min={55}
                  max={150}
                />
                <NumberInput
                  label="Years playing"
                  value={profile.yearsPlaying}
                  onChange={(v) => update("yearsPlaying", v)}
                  placeholder="5"
                  min={0}
                  max={60}
                />
                <NumberInput
                  label="Rounds per month"
                  value={profile.roundsPerMonth}
                  onChange={(v) => update("roundsPerMonth", v)}
                  placeholder="4"
                  min={0}
                  max={30}
                />
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sand-0)] mb-3">Playing style</p>
                  <OptionGrid
                    options={[
                      { value: "aggressive", label: "Aggressive", description: "Go for it, take risks" },
                      { value: "conservative", label: "Conservative", description: "Play safe, minimize mistakes" },
                      { value: "situational", label: "Situational", description: "Depends on the moment" },
                    ]}
                    value={profile.playingStyle}
                    onChange={(v) => update("playingStyle", v as GolferProfile["playingStyle"])}
                    columns={1}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sand-0)] mb-3">Best part of your game</p>
                  <OptionGrid
                    options={[
                      { value: "driving", label: "Driving" },
                      { value: "irons", label: "Irons" },
                      { value: "short-game", label: "Short Game" },
                      { value: "putting", label: "Putting" },
                    ]}
                    value={profile.bestPart}
                    onChange={(v) => update("bestPart", v as GolferProfile["bestPart"])}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sand-0)] mb-3">Weakest part of your game</p>
                  <OptionGrid
                    options={[
                      { value: "driving", label: "Driving" },
                      { value: "irons", label: "Irons" },
                      { value: "short-game", label: "Short Game" },
                      { value: "putting", label: "Putting" },
                    ]}
                    value={profile.weakestPart}
                    onChange={(v) => update("weakestPart", v as GolferProfile["weakestPart"])}
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sand-0)] mb-3">Biggest mental challenge</p>
                  <OptionGrid
                    options={[
                      { value: "first-tee-nerves", label: "First-Tee Nerves", description: "Anxiety before the round starts" },
                      { value: "bouncing-back", label: "Bouncing Back", description: "Hard to recover from bad shots" },
                      { value: "closing-out", label: "Closing Out", description: "Struggle on the last few holes" },
                      { value: "staying-patient", label: "Staying Patient", description: "Get impatient or rushed" },
                      { value: "focus", label: "Focus", description: "Mind wanders on the course" },
                      { value: "anger-management", label: "Anger", description: "Frustration takes over" },
                    ]}
                    value={profile.biggestChallenge}
                    onChange={(v) => update("biggestChallenge", v as GolferProfile["biggestChallenge"])}
                    columns={1}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sand-0)] mb-3">After a bad shot, you usually...</p>
                  <OptionGrid
                    options={[
                      { value: "dwell", label: "Dwell on it", description: "Can't let it go" },
                      { value: "quick-reset", label: "Reset quickly", description: "Move on to the next shot" },
                      { value: "gets-angry", label: "Get angry", description: "Frustration builds up" },
                      { value: "overthink", label: "Overthink", description: "Start analyzing everything" },
                    ]}
                    value={profile.afterBadShot}
                    onChange={(v) => update("afterBadShot", v as GolferProfile["afterBadShot"])}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sand-0)] mb-3">Under pressure, you tend to...</p>
                  <OptionGrid
                    options={[
                      { value: "thrive", label: "Thrive", description: "Love the pressure" },
                      { value: "tighten-up", label: "Tighten up", description: "Get a little stiff" },
                      { value: "collapse", label: "Fall apart", description: "Score goes sideways" },
                      { value: "inconsistent", label: "Hit or miss", description: "Sometimes great, sometimes not" },
                    ]}
                    value={profile.underPressure}
                    onChange={(v) => update("underPressure", v as GolferProfile["underPressure"])}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sand-0)] mb-3">How do you practice?</p>
                  <OptionGrid
                    options={[
                      { value: "range-grinder", label: "Range Grinder", description: "Hit balls regularly" },
                      { value: "course-only", label: "Course Only", description: "Only play, no range" },
                      { value: "casual", label: "Casual", description: "Play when I can" },
                      { value: "competitive", label: "Competitive", description: "Structured practice + tournaments" },
                    ]}
                    value={profile.practiceHabit}
                    onChange={(v) => update("practiceHabit", v as GolferProfile["practiceHabit"])}
                  />
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sand-0)] mb-3">Primary golf goal</p>
                  <OptionGrid
                    options={[
                      { value: "break-80", label: "Break 80", description: "Single digits, here I come" },
                      { value: "break-90", label: "Break 90", description: "Consistently in the 80s" },
                      { value: "break-100", label: "Break 100", description: "Get under triple digits" },
                      { value: "enjoy-more", label: "Enjoy golf more", description: "Less stress, more fun" },
                      { value: "compete", label: "Compete", description: "Win tournaments, beat friends" },
                      { value: "consistency", label: "Consistency", description: "Stop the big numbers" },
                    ]}
                    value={profile.primaryGoal}
                    onChange={(v) => update("primaryGoal", v as GolferProfile["primaryGoal"])}
                    columns={1}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sand-0)]">
                    What&apos;s your #1 mental goal?
                  </label>
                  <textarea
                    value={profile.mentalGoal ?? ""}
                    onChange={(e) => update("mentalGoal", e.target.value || null)}
                    placeholder="e.g. I want to stop getting angry after a bad hole and just focus on the next shot..."
                    rows={3}
                    className="w-full rounded-xl border border-[var(--border)] bg-[rgba(14,42,31,0.4)] px-4 py-3 text-[var(--text-0)] placeholder:text-[var(--text-1)] placeholder:opacity-40 outline-none focus:border-[rgba(203,184,146,0.3)] transition-colors resize-none"
                  />
                </div>

                {/* Summary preview */}
                <div className="rounded-2xl border border-[rgba(203,184,146,0.15)] bg-[rgba(203,184,146,0.06)] p-5 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sand-0)]">
                    Your coaching profile
                  </p>
                  <div className="space-y-1.5 text-sm text-[var(--text-0)]">
                    {profile.firstName && <p>{profile.firstName}</p>}
                    {profile.handicap != null && <p>Handicap: {profile.handicap}</p>}
                    {profile.averageScore != null && <p>Avg score: {profile.averageScore}</p>}
                    {profile.playingStyle && <p>Style: {profile.playingStyle}</p>}
                    {profile.biggestChallenge && (
                      <p>Challenge: {profile.biggestChallenge.replace(/-/g, " ")}</p>
                    )}
                    {profile.primaryGoal && (
                      <p>Goal: {profile.primaryGoal.replace(/-/g, " ")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <div className="h-8 w-8 rounded-full bg-[rgba(203,184,146,0.15)] flex items-center justify-center">
                      <span className="text-xs font-medium text-[var(--sand-0)]">N/A</span>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--text-1)]">Mental Coach Rating</p>
                      <p className="text-[10px] text-[var(--text-1)] opacity-60">Unlocks after 3 rounds</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="shrink-0 fixed bottom-0 left-0 right-0 z-20 px-6 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4 bg-gradient-to-t from-[var(--bg-0)] via-[var(--bg-0)] to-transparent">
          <div className="max-w-md mx-auto">
            <button
              type="button"
              onClick={goNext}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[52px] rounded-2xl bg-[rgba(31,106,74,0.6)] border border-[rgba(31,180,100,0.25)] text-base font-medium text-[var(--text-0)] shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-all duration-200 hover:bg-[rgba(31,106,74,0.75)] active:scale-[0.97]"
            >
              {currentStep === totalSteps - 1 ? (
                <>
                  <Check className="h-5 w-5" />
                  Save Profile
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
