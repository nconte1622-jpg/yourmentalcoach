import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { FrostedSandCard } from "@/components/ui/frosted-sand-card";
import { Button } from "@/components/ui/button";
import { Brain, MessageCircle, Sparkles, TrendingUp } from "lucide-react";
import { completeOnboarding } from "@/lib/onboarding";

const STEPS = [
  {
    title: "Before the round",
    body: "Use Pre-Game Talk to settle nerves, set intention, and start with one clear mental cue.",
    icon: Sparkles,
  },
  {
    title: "During the round",
    body: "Use live coaching, reset cues, and quick emotional taps to recover faster after mistakes.",
    icon: MessageCircle,
  },
  {
    title: "After the round",
    body: "Post-Round 2.0 stores what happened so Memory Bank and Insights can get sharper over time.",
    icon: Brain,
  },
  {
    title: "What improves with Pro",
    body: "Pro unlocks Round DNA, pattern detection, unlimited AI, and more personalized support across sessions.",
    icon: TrendingUp,
  },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const step = useMemo(() => STEPS[stepIndex], [stepIndex]);
  const Icon = step.icon;

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((current) => current + 1);
      return;
    }
    completeOnboarding();
    navigate("/round-setup");
  };

  return (
    <PageShell backgroundVariant="default">
      <AppShell
        contentClassName="flex flex-col"
        header={
          <AppHeader
            left={<div className="tap-44" />}
            center={<h1 className="truncate text-base md:text-lg font-serif tracking-wide text-foreground">Welcome</h1>}
            right={
              <button
                type="button"
                onClick={() => {
                  completeOnboarding();
                  navigate("/");
                }}
                className="header-hit-button tap-44 text-sm text-muted-foreground/75 hover:text-foreground"
              >
                Skip
              </button>
            }
          />
        }
      >
        <main className="flex flex-1 items-center justify-center px-5 pb-8">
          <div className="w-full max-w-lg space-y-6">
            <div className="space-y-2 text-center">
              <p className="text-xs tracking-[0.18em] text-muted-foreground/60">
                STEP {stepIndex + 1} OF {STEPS.length}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-foreground/8">
                <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
              </div>
            </div>

            <FrostedSandCard className="space-y-6 p-6 md:p-7">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: "rgba(214,197,163,0.24)", color: "var(--ink-0)" }}
              >
                <Icon className="h-7 w-7" />
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-serif tracking-wide readable-on-sand">{step.title}</h2>
                <p className="text-base leading-7" style={{ color: "var(--ink-1)" }}>
                  {step.body}
                </p>
              </div>
              <Button onClick={handleNext} className="min-h-11 w-full rounded-2xl">
                {stepIndex === STEPS.length - 1 ? "Start first round" : "Continue"}
              </Button>
            </FrostedSandCard>
          </div>
        </main>
      </AppShell>
    </PageShell>
  );
};

export default Onboarding;
