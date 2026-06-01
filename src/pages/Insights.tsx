import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Sparkles, TrendingUp, BarChart3, Activity, MessageSquare, Info } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/button";
import { usePatternInsights } from "@/hooks/usePatternInsights";
import { FrostedSandCard } from "@/components/ui/frosted-sand-card";
import { BottomDock } from "@/components/ui/BottomDock";
import { ActiveRoundResumeChip } from "@/components/ui/ActiveRoundResumeChip";
import { ResilienceTrendChart } from "@/components/ResilienceTrendChart";
import { MentalCoachRatingCard } from "@/components/MentalCoachRatingCard";
import { loadResilienceScores } from "@/lib/resilienceScore";

/** Small tap-to-reveal tooltip for section headers */
function SectionTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted-ink)] hover:text-[var(--text-1)] transition-colors"
        aria-label="What is this?"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 top-full z-[70] mt-2 w-[220px] -translate-x-1/2 rounded-2xl border border-[rgba(203,184,146,0.18)] bg-[rgba(9,19,15,0.97)] p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-fade-in">
            <p className="text-xs leading-5 text-[var(--text-1)]">{text}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 w-full rounded-xl bg-white/6 py-1.5 text-xs text-[var(--text-1)] hover:bg-white/10 transition-colors"
            >
              Got it
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const Insights = () => {
  const navigate = useNavigate();
  const { summary, eligibleRoundCount, isLoading, isPro, hasPatternAccess } = usePatternInsights();
  const resilienceScores = useMemo(() => loadResilienceScores(), []);

  return (
    <PageShell backgroundVariant="default">
      <AppShell
        className="relative z-10 mx-auto w-full max-w-3xl"
        contentClassName="flex flex-col"
        header={
          <AppHeader
            left={
              <button
                type="button"
                onClick={() => navigate("/")}
                className="header-hit-button tap-44 text-muted-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all duration-300"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Home
              </button>
            }
            center={
              <div className="mx-auto max-w-[280px]">
                <h1 className="truncate text-base md:text-lg font-serif tracking-wide text-foreground">
                  Insights
                </h1>
                <p className="truncate text-[11px] text-muted-foreground/65">
                  Pattern intelligence from your structured rounds.
                </p>
              </div>
            }
            right={<div className="tap-44" />}
          />
        }
      >
        <div className="with-bottom-dock mx-auto w-full max-w-2xl space-y-6 py-6 fluid-glow-backdrop">
          {/* Not yet earned pattern access — show progress toward unlock */}
          {!hasPatternAccess && (
            <FrostedSandCard className="space-y-3">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-primary/70" />
                <p className="text-xs uppercase tracking-[0.18em] text-primary/70">Pattern Intelligence</p>
                <SectionTooltip text="Pattern Intelligence reads across all your rounds to find your emotional triggers, what cue words work best for you, and how you typically recover from setbacks." />
              </div>
              <p className="text-sm readable-on-sand">
                Complete <span className="font-medium">{Math.max(0, 3 - eligibleRoundCount)} more structured round{Math.max(0, 3 - eligibleRoundCount) !== 1 ? "s" : ""}</span> to unlock your personal pattern analysis — free.
              </p>
              <p className="text-xs" style={{ color: "var(--muted-ink)" }}>
                After 3 rounds with post-round reflections, you'll see your emotional triggers, recovery patterns, and most effective mental cues.
              </p>
              <div className="flex items-center gap-2 pt-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-2 flex-1 rounded-full transition-all duration-300"
                    style={{
                      background: i < eligibleRoundCount
                        ? "rgba(132,204,22,0.7)"
                        : "rgba(132,204,22,0.12)",
                    }}
                  />
                ))}
                <span className="text-xs text-[var(--text-1)] opacity-50 ml-1">
                  {eligibleRoundCount}/3
                </span>
              </div>
            </FrostedSandCard>
          )}

          {hasPatternAccess && isLoading && (
            <FrostedSandCard>
              <p className="text-sm" style={{ color: "var(--ink-1)" }}>Analyzing your rounds...</p>
            </FrostedSandCard>
          )}

          {/* Mental Coach Rating — Pro only */}
          {isPro && (
            <MentalCoachRatingCard />
          )}

          {/* Resilience Trend Chart — Pro only */}
          {isPro && resilienceScores.length > 0 && (
            <ResilienceTrendChart scores={resilienceScores} />
          )}

          {isPro && resilienceScores.length === 0 && (
            <FrostedSandCard className="space-y-3">
              <div className="flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-primary/70" />
                <p className="text-xs uppercase tracking-[0.18em] text-primary/70">Resilience Trend</p>
                <SectionTooltip text="Resilience measures how well you emotionally recover within a round — staying steady after bad holes. It's calculated from your emotion check-ins and reflects your mental bounce-back over time." />
              </div>
              <p className="text-sm readable-on-sand">
                Your resilience chart will appear here after your first round with emotion tracking.
              </p>
              <p className="text-xs" style={{ color: "var(--muted-ink)" }}>
                During a round, tap emotions as you feel them and respond to check-ins. Your resilience score is calculated when you end the round.
              </p>
            </FrostedSandCard>
          )}

          {/* Pattern Summary — available for free users with 3+ rounds AND Pro users */}
          {hasPatternAccess && !isLoading && summary && (
            <>
              <FrostedSandCard className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs uppercase tracking-[0.18em] text-primary/70">Pattern Summary</p>
                      <SectionTooltip text="A summary of the mental patterns your coach has spotted across your rounds — your triggers, strengths, and how your emotions trend over time." />
                    </div>
                    <p className="text-sm" style={{ color: "var(--muted-ink)" }}>{summary.round_count} structured rounds analyzed</p>
                  </div>
                  <TrendingUp className="h-5 w-5" style={{ color: "var(--ink-0)" }} />
                </div>
                <div className="space-y-3">
                  <p className="text-base readable-on-sand">{summary.struggle_summary}</p>
                  <p className="text-base" style={{ color: "var(--ink-1)" }}>{summary.best_summary}</p>
                </div>
              </FrostedSandCard>

              <div className="grid gap-4 sm:grid-cols-2">
                <FrostedSandCard className="p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--muted-ink)" }}>Most Common Trigger</p>
                  <p className="mt-2 text-sm readable-on-sand">{summary.most_common_trigger_type}</p>
                </FrostedSandCard>
                <FrostedSandCard className="p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--muted-ink)" }}>Most Common Start</p>
                  <p className="mt-2 text-sm readable-on-sand">{summary.most_common_emotional_start}</p>
                </FrostedSandCard>
                <FrostedSandCard className="p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--muted-ink)" }}>Emotional Trend</p>
                  <p className="mt-2 text-sm readable-on-sand">{summary.emotional_trend}</p>
                </FrostedSandCard>
                <FrostedSandCard className="p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--muted-ink)" }}>Most Effective Cue</p>
                  <p className="mt-2 text-sm readable-on-sand">{summary.most_effective_cue}</p>
                </FrostedSandCard>
                <FrostedSandCard className="p-5 sm:col-span-2">
                  <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--muted-ink)" }}>Recovery Trend</p>
                  <p className="mt-2 text-sm readable-on-sand">{summary.recovery_trend}</p>
                </FrostedSandCard>
              </div>

              {/* Pro upsell for free users who have unlocked pattern access */}
              {!isPro && (
                <FrostedSandCard className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary/70" />
                    <p className="text-xs uppercase tracking-[0.18em] text-primary/70">Go Deeper with Pro</p>
                  </div>
                  <p className="text-sm readable-on-sand">
                    You've unlocked your patterns. Pro adds your Mental Coach Rating score, resilience trend charts, and deeper round-by-round breakdowns.
                  </p>
                  <Button variant="outline" className="mt-1 rounded-2xl" onClick={() => navigate("/upgrade")}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Explore Pro
                  </Button>
                </FrostedSandCard>
              )}
            </>
          )}

          {hasPatternAccess && !isLoading && !summary && (
            <FrostedSandCard className="space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary/70" />
                <p className="text-xs uppercase tracking-[0.18em] text-primary/70">Pattern Intelligence</p>
              </div>
              <p className="text-sm readable-on-sand">
                No patterns detected yet — complete rounds with full post-round reflections to build your picture.
              </p>
            </FrostedSandCard>
          )}
        </div>
      </AppShell>
      <ActiveRoundResumeChip />
      <BottomDock />
    </PageShell>
  );
};

export default Insights;
