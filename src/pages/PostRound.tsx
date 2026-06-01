import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/PageShell";
import { useRounds } from "@/hooks/useRounds";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoachResponse } from "@/lib/mentalCoachApi";
import { serializePostRoundPayload, StructuredPostRoundReflection, RoundDNA } from "@/lib/roundDna";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { ProUpgradeModal } from "@/components/ProUpgradeModal";

type EmotionOption =
  | "Calm"
  | "Slightly tight"
  | "Nervous"
  | "Fired up"
  | "Distracted";

type TriggerOption =
  | "After bad hole"
  | "Front to back shift"
  | "Playing partner"
  | "Specific hole"
  | "Never lost control";

type RecoveryOption =
  | "Spiraled"
  | "Neutral"
  | "Reset quickly"
  | "Best stretch followed";

type CueOption =
  | "Tempo"
  | "Commit to target"
  | "Slow breath"
  | "Trust swing"
  | "Aggression"
  | "Custom";

type StepId =
  | "emotional_start"
  | "emotional_finish"
  | "trigger_type"
  | "recovery_quality"
  | "effective_cue"
  | "identity_sentence";

const EMOTION_OPTIONS: EmotionOption[] = [
  "Calm",
  "Slightly tight",
  "Nervous",
  "Fired up",
  "Distracted",
];

const TRIGGER_OPTIONS: TriggerOption[] = [
  "After bad hole",
  "Front to back shift",
  "Playing partner",
  "Specific hole",
  "Never lost control",
];

const RECOVERY_OPTIONS: RecoveryOption[] = [
  "Spiraled",
  "Neutral",
  "Reset quickly",
  "Best stretch followed",
];

const CUE_OPTIONS: CueOption[] = [
  "Tempo",
  "Commit to target",
  "Slow breath",
  "Trust swing",
  "Aggression",
  "Custom",
];

const STEPS: Array<{
  id: StepId;
  title: string;
  subtitle: string;
}> = [
  {
    id: "emotional_start",
    title: "Emotional Start",
    subtitle: "How did you feel on the first tee?",
  },
  {
    id: "emotional_finish",
    title: "Emotional Finish",
    subtitle: "How did you feel walking off the last hole?",
  },
  {
    id: "trigger_type",
    title: "Round Shift Trigger",
    subtitle: "What changed the emotional direction of the day?",
  },
  {
    id: "recovery_quality",
    title: "Recovery Quality",
    subtitle: "How well did you recover once the round shifted?",
  },
  {
    id: "effective_cue",
    title: "Effective Cue",
    subtitle: "Which cue helped most when you needed it?",
  },
  {
    id: "identity_sentence",
    title: "Future Self",
    subtitle: "Write one sentence your future self should remember.",
  },
];

function buildLegacyBestSummary(data: StructuredPostRoundReflection): string {
  return `Start: ${data.emotional_start} -> Finish: ${data.emotional_finish}`;
}

function buildLegacyCostSummary(data: StructuredPostRoundReflection): string {
  const triggerDetail =
    data.trigger_type === "Specific hole" && data.trigger_hole
      ? ` (${data.trigger_hole.trim()})`
      : "";

  return `Trigger: ${data.trigger_type}${triggerDetail} | Recovery: ${data.recovery_quality}`;
}

function SelectionCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-3xl border px-4 py-4 text-left transition-all duration-300 min-h-11",
        selected
          ? "border-primary/45 bg-primary/12 shadow-[0_10px_30px_rgba(16,40,28,0.18)]"
          : "border-foreground/10 bg-card/75 hover:border-foreground/20 hover:bg-card/90"
      )}
    >
      <span className={cn("text-sm md:text-base", selected ? "text-foreground" : "text-foreground/78")}>
        {label}
      </span>
    </button>
  );
}

const PostRound = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roundId = searchParams.get("roundId");
  const { updateRound, getActiveRound, createRoundEvent } = useRounds();
  const { features, isPro } = useFeatureFlags();

  const [activeRoundId, setActiveRoundId] = useState<string | null>(roundId);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [emotionalStart, setEmotionalStart] = useState<EmotionOption | null>(null);
  const [emotionalFinish, setEmotionalFinish] = useState<EmotionOption | null>(null);
  const [triggerType, setTriggerType] = useState<TriggerOption | null>(null);
  const [triggerHole, setTriggerHole] = useState("");
  const [recoveryQuality, setRecoveryQuality] = useState<RecoveryOption | null>(null);
  const [effectiveCue, setEffectiveCue] = useState<CueOption | null>(null);
  const [customCue, setCustomCue] = useState("");
  const [identitySentence, setIdentitySentence] = useState("");

  useEffect(() => {
    if (!isPro) {
      setShowUpgradeModal(true);
      return;
    }
    if (!roundId) {
      getActiveRound().then((round) => {
        if (round) {
          setActiveRoundId(round.id);
        }
      });
    }
  }, [getActiveRound, isPro, roundId]);

  if (!isPro) {
    return (
      <PageShell backgroundVariant="default">
        <AppShell
          contentClassName="flex flex-col"
          header={
            <AppHeader
              left={
                <button
                  type="button"
                  onClick={() => navigate("/round-setup")}
                  className="header-hit-button tap-44 text-muted-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all duration-300"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Start Round
                </button>
              }
              center={<h1 className="truncate text-base md:text-lg font-serif tracking-wide text-foreground">Post-Round</h1>}
              right={<div className="tap-44" />}
            />
          }
        >
          <main className="flex flex-1 items-center justify-center px-5 pb-12">
            <div className="max-w-md rounded-[28px] border border-[var(--border)] bg-[rgba(14,42,31,0.52)] p-6 text-center shadow-[0_16px_40px_rgba(0,0,0,0.32)] backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--sand-0)]">Pro Feature</p>
              <h1 className="mt-3 text-2xl font-serif text-[var(--text-0)]">Post-Round Reflection</h1>
              <p className="mt-3 text-sm leading-6 text-[var(--text-1)]">
                Structured post-round reflection is available on Pro. You can still end the round from the round screen without reflection.
              </p>
              <Button className="mt-5 min-h-11 w-full rounded-2xl" onClick={() => navigate("/upgrade")}>
                Unlock Pro
              </Button>
            </div>
          </main>
          <ProUpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
        </AppShell>
      </PageShell>
    );
  }

  const currentStep = STEPS[currentStepIndex];
  const progressPercent = ((currentStepIndex + 1) / STEPS.length) * 100;

  const canContinue = useMemo(() => {
    switch (currentStep.id) {
      case "emotional_start":
        return emotionalStart !== null;
      case "emotional_finish":
        return emotionalFinish !== null;
      case "trigger_type":
        if (!triggerType) return false;
        if (triggerType === "Specific hole") return triggerHole.trim().length > 0;
        return true;
      case "recovery_quality":
        return recoveryQuality !== null;
      case "effective_cue":
        if (!effectiveCue) return false;
        if (effectiveCue === "Custom") return customCue.trim().length > 0;
        return true;
      case "identity_sentence":
        return identitySentence.trim().length > 0;
      default:
        return false;
    }
  }, [
    currentStep.id,
    emotionalStart,
    emotionalFinish,
    triggerType,
    triggerHole,
    recoveryQuality,
    effectiveCue,
    customCue,
    identitySentence,
  ]);

  const handleBack = useCallback(() => {
    if (isSaving) return;
    if (currentStepIndex === 0) {
      navigate("/");
      return;
    }
    setCurrentStepIndex((index) => Math.max(0, index - 1));
  }, [currentStepIndex, isSaving, navigate]);

  const handleSave = useCallback(async () => {
    if (
      !emotionalStart ||
      !emotionalFinish ||
      !triggerType ||
      !recoveryQuality ||
      !effectiveCue ||
      !identitySentence.trim()
    ) {
      toast.error("Complete every step before saving.");
      return;
    }

    const resolvedCue = effectiveCue === "Custom" ? customCue.trim() : effectiveCue;
    if (!resolvedCue) {
      toast.error("Add your custom cue before saving.");
      return;
    }

    setIsSaving(true);

    const structuredReflection: StructuredPostRoundReflection = {
      emotional_start: emotionalStart,
      emotional_finish: emotionalFinish,
      trigger_type: triggerType,
      trigger_hole: triggerType === "Specific hole" ? triggerHole.trim() : undefined,
      recovery_quality: recoveryQuality,
      effective_cue: resolvedCue,
      identity_sentence: identitySentence.trim(),
      timestamp: new Date().toISOString(),
      round_id: activeRoundId,
    };

    try {
      let roundDna: RoundDNA | undefined;

      if (features.round_dna) {
        try {
          const dnaResponse = await getCoachResponse({
            messages: [
              {
                role: "user",
                content:
                  "You are generating a golfer's Round DNA from structured post-round data. " +
                  "Return strict JSON only with keys strongest_quality, biggest_trigger, resilience_score, most_effective_cue, one_growth_insight. " +
                  "Keep each string concise, grounded, and specific. resilience_score must be an integer 1-10.\n\n" +
                  JSON.stringify(structuredReflection),
              },
            ],
            context: "locker-room",
          });

          const jsonMatch = dnaResponse.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse((jsonMatch?.[0] ?? dnaResponse).trim()) as {
            strongest_quality?: unknown;
            biggest_trigger?: unknown;
            resilience_score?: unknown;
            most_effective_cue?: unknown;
            one_growth_insight?: unknown;
          };

          if (
            typeof parsed.strongest_quality === "string" &&
            typeof parsed.biggest_trigger === "string" &&
            typeof parsed.most_effective_cue === "string" &&
            typeof parsed.one_growth_insight === "string"
          ) {
            const numericScore = Number(parsed.resilience_score);
            roundDna = {
              strongest_quality: parsed.strongest_quality,
              biggest_trigger: parsed.biggest_trigger,
              resilience_score: Number.isFinite(numericScore)
                ? Math.min(10, Math.max(1, Math.round(numericScore)))
                : 5,
              most_effective_cue: parsed.most_effective_cue,
              growth_insight: parsed.one_growth_insight,
            };
          }
        } catch (dnaError) {
          console.error("Failed to generate Round DNA:", dnaError);
        }
      }

      if (activeRoundId) {
        await updateRound(activeRoundId, {
          ended_at: structuredReflection.timestamp,
          status: "completed",
          post_round_best: buildLegacyBestSummary(structuredReflection),
          post_round_cost: buildLegacyCostSummary(structuredReflection),
          post_round_adjustment: serializePostRoundPayload(structuredReflection, roundDna),
        });

        await createRoundEvent({
          round_id: activeRoundId,
          event_type: "post_round_completed",
          label: "Post-Round 2.0",
          notes: JSON.stringify({
            timestamp: structuredReflection.timestamp,
            emotional_start: structuredReflection.emotional_start,
            emotional_finish: structuredReflection.emotional_finish,
          }),
        });
      }

      trackEvent("post_round_completed", {
        roundId: activeRoundId,
        hasRoundDna: Boolean(roundDna),
      });

      toast.success("Round saved successfully");
      setIsComplete(true);

      setTimeout(() => {
        navigate("/round-complete");
      }, 1200);
    } catch (error) {
      console.error("Failed to save Post-Round 2.0 reflection:", error);
      toast.error("Failed to save round data");
    } finally {
      setIsSaving(false);
    }
  }, [
    activeRoundId,
    customCue,
    effectiveCue,
    features.round_dna,
    emotionalFinish,
    emotionalStart,
    identitySentence,
    navigate,
    recoveryQuality,
    triggerHole,
    triggerType,
    updateRound,
    createRoundEvent,
  ]);

  const handleNext = useCallback(() => {
    if (!canContinue || isSaving) return;
    if (currentStepIndex === STEPS.length - 1) {
      void handleSave();
      return;
    }
    setCurrentStepIndex((index) => Math.min(STEPS.length - 1, index + 1));
  }, [canContinue, currentStepIndex, handleSave, isSaving]);

  const renderStepContent = () => {
    switch (currentStep.id) {
      case "emotional_start":
        return (
          <div className="grid gap-3">
            {EMOTION_OPTIONS.map((option) => (
              <SelectionCard
                key={option}
                label={option}
                selected={emotionalStart === option}
                onClick={() => setEmotionalStart(option)}
              />
            ))}
          </div>
        );
      case "emotional_finish":
        return (
          <div className="grid gap-3">
            {EMOTION_OPTIONS.map((option) => (
              <SelectionCard
                key={option}
                label={option}
                selected={emotionalFinish === option}
                onClick={() => setEmotionalFinish(option)}
              />
            ))}
          </div>
        );
      case "trigger_type":
        return (
          <div className="space-y-4">
            <div className="grid gap-3">
              {TRIGGER_OPTIONS.map((option) => (
                <SelectionCard
                  key={option}
                  label={option}
                  selected={triggerType === option}
                  onClick={() => setTriggerType(option)}
                />
              ))}
            </div>
            {triggerType === "Specific hole" && (
              <input
                value={triggerHole}
                onChange={(event) => setTriggerHole(event.target.value)}
                placeholder="Which hole? e.g. 7 or 14"
                autoComplete="off"
                className="w-full min-h-11 rounded-2xl border border-foreground/12 bg-card/80 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/55 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            )}
          </div>
        );
      case "recovery_quality":
        return (
          <div className="grid gap-3">
            {RECOVERY_OPTIONS.map((option) => (
              <SelectionCard
                key={option}
                label={option}
                selected={recoveryQuality === option}
                onClick={() => setRecoveryQuality(option)}
              />
            ))}
          </div>
        );
      case "effective_cue":
        return (
          <div className="space-y-4">
            <div className="grid gap-3">
              {CUE_OPTIONS.map((option) => (
                <SelectionCard
                  key={option}
                  label={option === "Custom" ? "Custom input" : option}
                  selected={effectiveCue === option}
                  onClick={() => setEffectiveCue(option)}
                />
              ))}
            </div>
            {effectiveCue === "Custom" && (
              <input
                value={customCue}
                onChange={(event) => setCustomCue(event.target.value)}
                placeholder="Enter your cue"
                autoComplete="off"
                className="w-full min-h-11 rounded-2xl border border-foreground/12 bg-card/80 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/55 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            )}
          </div>
        );
      case "identity_sentence":
        return (
          <textarea
            value={identitySentence}
            onChange={(event) => setIdentitySentence(event.target.value)}
            placeholder="I stay calm, commit, and recover fast when the round turns."
            className="w-full min-h-[148px] resize-none rounded-3xl border border-foreground/12 bg-card/80 p-5 text-base text-foreground placeholder:text-muted-foreground/55 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        );
      default:
        return null;
    }
  };

  return (
    <PageShell backgroundVariant="default">
      <AppShell
        contentClassName="flex flex-col"
        header={
          <AppHeader
            left={
              <button
                type="button"
                onClick={handleBack}
                className="header-hit-button tap-44 text-muted-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all duration-300"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {currentStepIndex === 0 ? "Home" : "Back"}
              </button>
            }
            center={
              <div className="mx-auto max-w-[280px]">
                <h1 className="truncate text-base md:text-lg font-serif tracking-wide text-foreground">
                  Post-Round 2.0
                </h1>
                <p className="truncate text-[11px] text-muted-foreground/65">
                  Structured reflection, one decision at a time.
                </p>
              </div>
            }
            right={<div className="tap-44 text-xs text-muted-foreground/55">{currentStepIndex + 1}/{STEPS.length}</div>}
          />
        }
      >
        <div className="flex flex-1 flex-col items-center justify-center py-8">
          <div className="w-full max-w-xl space-y-6">
            <div className="space-y-3 animate-fade-in">
              <div className="h-2 overflow-hidden rounded-full bg-foreground/8">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs tracking-[0.16em] text-muted-foreground/55">
                <span>REFLECTION</span>
                <span>STEP {currentStepIndex + 1}</span>
              </div>
            </div>

            <section
              key={currentStep.id}
              className="animate-fade-in rounded-[28px] border border-foreground/10 bg-card/80 p-6 shadow-[0_16px_50px_rgba(0,0,0,0.18)] backdrop-blur-sm"
            >
              {!isComplete ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs tracking-[0.18em] text-primary/70">
                      {currentStep.title.toUpperCase()}
                    </p>
                    <h2 className="text-2xl font-serif tracking-wide text-foreground">
                      {currentStep.title}
                    </h2>
                    <p className="text-sm text-muted-foreground/75">{currentStep.subtitle}</p>
                  </div>

                  {renderStepContent()}

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleBack}
                      className="flex-1 rounded-2xl min-h-11"
                      disabled={isSaving}
                    >
                      {currentStepIndex === 0 ? "Cancel" : "Back"}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleNext}
                      disabled={!canContinue || isSaving}
                      className="flex-1 rounded-2xl min-h-11"
                    >
                      {isSaving ? (
                        "Saving..."
                      ) : currentStepIndex === STEPS.length - 1 ? (
                        "Save Round"
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-lg text-foreground">✓ Round saved</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </AppShell>
    </PageShell>
  );
};

export default PostRound;
