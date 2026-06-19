import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { LRMIndicator } from "@/components/LRMIndicator";
import { useProStatus } from "@/hooks/useProStatus";
import { useRounds, Round } from "@/hooks/useRounds";
import { useMemories, Memory, MemoryCategory } from "@/hooks/useMemories";
import { ProUpgradeModal } from "@/components/ProUpgradeModal";
import { ChevronLeft, Brain, Sparkles, TrendingUp, Lock, Wind } from "lucide-react";
import { loadBreathingSessions, type BreathingSession } from "@/lib/breathingLog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { parseRoundDnaFromRound, parseStructuredReflectionFromRound } from "@/lib/roundDna";
import { FrostedSandCard } from "@/components/ui/frosted-sand-card";
import { BottomDock } from "@/components/ui/BottomDock";
import { ActiveRoundResumeChip } from "@/components/ui/ActiveRoundResumeChip";

const CATEGORY_CONFIG: Record<MemoryCategory, { 
  label: string; 
  icon: typeof Brain;
  description: string;
}> = {
  cue: {
    label: "Cue Words",
    icon: Sparkles,
    description: "Words that resonate when it matters",
  },
  success: {
    label: "What Worked",
    icon: TrendingUp,
    description: "Mental states that led to good outcomes",
  },
  pattern: {
    label: "Patterns",
    icon: Brain,
    description: "Tendencies and awareness points",
  },
  breakdown: {
    label: "Breakdowns",
    icon: Brain,
    description: "Moments of challenge",
  },
};

const MemoryBank = () => {
  const navigate = useNavigate();
  const { isPro, isLoading: proLoading } = useProStatus();
  const { getMemories } = useMemories();
  const { getRecentRounds } = useRounds();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [breathing, setBreathing] = useState<BreathingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    const fetchMemories = async () => {
      if (proLoading) return;
      
      if (!isPro) {
        setIsLoading(false);
        return;
      }

      try {
        const [memoryData, roundData] = await Promise.all([getMemories(), getRecentRounds(12)]);
        setMemories(memoryData);
        setRounds(roundData.filter((round) => Boolean(round.ended_at)));
        // Breathing history is stored locally — newest first.
        setBreathing(
          [...loadBreathingSessions()].sort(
            (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
          )
        );
      } catch (error) {
        console.error("Failed to fetch memories:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemories();
  }, [isPro, proLoading, getMemories, getRecentRounds]);

  // Group memories by category
  const groupedMemories = memories.reduce((acc, memory) => {
    const category = memory.category as MemoryCategory;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(memory);
    return acc;
  }, {} as Record<MemoryCategory, Memory[]>);

  // Order categories for display
  const categoryOrder: MemoryCategory[] = ["cue", "success", "pattern"];
  const completedRoundsWithDna = rounds
    .map((round) => ({
      round,
      dna: parseRoundDnaFromRound(round),
      reflection: parseStructuredReflectionFromRound(round),
    }))
    .filter((entry) => entry.reflection);

  if (proLoading || isLoading) {
    return (
      <PageShell backgroundVariant="default">
        <AppShell
          contentClassName="flex flex-col"
          header={
            <AppHeader
              left={
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="header-hit-button tap-44 text-muted-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all duration-300"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Home
                </button>
              }
              center={<h1 className="truncate text-base md:text-lg font-serif tracking-wide text-foreground">Memory Bank</h1>}
              right={<div className="tap-44" />}
            />
          }
        >
          <div className="flex flex-1 items-center justify-center">
            <div className="flex justify-center gap-1.5">
              <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-breathe" />
              <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-breathe" style={{ animationDelay: "0.3s" }} />
              <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-breathe" style={{ animationDelay: "0.6s" }} />
            </div>
          </div>
        </AppShell>
        <BottomDock />
      </PageShell>
    );
  }

  // Free user view
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
                  onClick={() => navigate("/")}
                  className="header-hit-button tap-44 text-muted-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all duration-300"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Home
                </button>
              }
              center={<h1 className="truncate text-base md:text-lg font-serif tracking-wide text-foreground">Memory Bank</h1>}
              right={<div className="tap-44" />}
            />
          }
        >
          <main className="with-bottom-dock flex-1 flex flex-col items-center justify-center pb-16">
            <div className="max-w-sm w-full space-y-8 animate-fade-in fluid-glow-backdrop">
              {/* LRM Orb */}
              <div className="flex justify-center">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center border"
                  style={{
                    background: "linear-gradient(180deg, rgba(45,106,79,0.15) 0%, rgba(220,203,168,0.92) 100%)",
                    borderColor: "rgba(45,106,79,0.12)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                  }}
                >
                  <Brain 
                    className="w-10 h-10" 
                    style={{ color: "#1a1a1a" }}
                  />
                </div>
              </div>

              {/* Message */}
              <div className="text-center space-y-4">
                <h1 
                  className="text-3xl font-serif font-semibold tracking-[0.5px]"
                  style={{ color: "#1a1a1a" }}
                >
                  Memory Bank
                </h1>
                <p 
                  className="text-base leading-relaxed font-light"
                  style={{ color: "rgba(26,26,26,0.6)" }}
                >
                  Long-term memory recall helps your coach remember what works for you — 
                  across rounds, over time.
                </p>
              </div>

              {/* Soft upgrade prompt */}
              <FrostedSandCard className="space-y-4">
                <p 
                  className="text-sm leading-relaxed text-center"
                  style={{ color: "rgba(26,26,26,0.7)" }}
                >
                  With Pro, your coach recalls patterns, cue words, and breakthroughs 
                  from past rounds to personalize every response.
                </p>
                <Button
                  onClick={() => setShowUpgradeModal(true)}
                  variant="outline"
                  className="w-full rounded-xl border-primary/30 text-primary hover:bg-primary/10 transition-all duration-300"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Learn more about Pro
                </Button>
              </FrostedSandCard>

              <FrostedSandCard className="space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium tracking-wide" style={{ color: "#1a1a1a" }}>Round DNA</p>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(26,26,26,0.7)" }}>
                  Unlock Pro to see your Round DNA.
                </p>
              </FrostedSandCard>

              {/* Back to Home */}
              <div className="text-center">
                <button
                  onClick={() => navigate("/")}
                  className="text-sm tracking-wide transition-colors duration-300 hover:underline"
                  style={{ color: '#C9D2CF' }}
                >
                  Return to Home
                </button>
              </div>
            </div>
          </main>
        </AppShell>

        <BottomDock />
        <ProUpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
      </PageShell>
    );
  }

  // Pro user view
  return (
    <PageShell backgroundVariant="default">
      <AppShell
        contentClassName="flex flex-col"
        header={
          <AppHeader
            left={
              <button
                type="button"
                onClick={() => navigate("/")}
                className="header-hit-button tap-44 text-muted-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all duration-300"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Home
              </button>
            }
            center={<h1 className="truncate text-base md:text-lg font-serif tracking-wide text-foreground">Memory Bank</h1>}
            right={<div className="tap-44" />}
            subrow={<LRMIndicator memoryActive />}
          />
        }
      >
        <main className="with-bottom-dock flex-1 pb-16">
          <div className="max-w-lg mx-auto space-y-8 fluid-glow-backdrop">
            {/* Title */}
            <div className="text-center space-y-2">
              <h1 
                className="text-5xl font-serif font-semibold tracking-[0.5px]"
                style={{ color: "#1a1a1a" }}
              >
                Memory Bank
              </h1>
              <p 
                className="text-sm font-light tracking-wide"
                style={{ color: "rgba(26,26,26,0.6)" }}
              >
                What your coach remembers
              </p>
            </div>

            {/* Empty state */}
            {memories.length === 0 && (
              <FrostedSandCard className="text-center space-y-4 animate-fade-in p-8">
                <div 
                  className="w-16 h-16 mx-auto rounded-full flex items-center justify-center border"
                  style={{
                    background: "linear-gradient(180deg, rgba(45,106,79,0.15) 0%, rgba(220,203,168,0.92) 100%)",
                    borderColor: "rgba(45,106,79,0.12)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                  }}
                >
                  <Brain 
                    className="w-8 h-8" 
                    style={{ color: "#1a1a1a" }}
                  />
                </div>
                <p style={{ color: "rgba(26,26,26,0.7)" }} className="font-light">
                  No memories yet. Complete a Post-Round reflection to start building your memory bank.
                </p>
              </FrostedSandCard>
            )}

            <div className="space-y-4">
            <div className="space-y-1">
                <h2
                  className="text-[32px] font-serif font-medium tracking-[0.5px]"
                  style={{ color: "#1a1a1a" }}
                >
                  Round DNA
                </h2>
                <p
                  className="text-sm font-light tracking-wide"
                  style={{ color: "rgba(26,26,26,0.6)" }}
                >
                  AI pattern summaries from your completed Post-Round reflections.
                </p>
              </div>

              {completedRoundsWithDna.length === 0 && (
                <FrostedSandCard>
                  <p className="text-sm font-light" style={{ color: "rgba(26,26,26,0.7)" }}>
                    Complete a Post-Round reflection to generate your first Round DNA card.
                  </p>
                </FrostedSandCard>
              )}

              {completedRoundsWithDna.map(({ round, dna, reflection }) => {
                const completedAt = round.ended_at || round.started_at;
                const label = new Date(completedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <FrostedSandCard
                    key={round.id}
                    className="space-y-4 animate-fade-in"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-primary/70">Completed Round</p>
                        <p className="text-base font-medium readable-on-sand">
                          {label}
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-xs text-primary">
                        {round.environment}
                      </span>
                    </div>

                    {dna ? (
                      <div className="grid gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(45,106,79,0.12)", background: "rgba(255,255,255,0.18)" }}>
                            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(26,26,26,0.6)" }}>Strongest Quality</p>
                            <p className="mt-2 text-sm readable-on-sand">{dna.strongest_quality}</p>
                          </div>
                          <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(45,106,79,0.12)", background: "rgba(255,255,255,0.18)" }}>
                            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(26,26,26,0.6)" }}>Biggest Trigger</p>
                            <p className="mt-2 text-sm readable-on-sand">{dna.biggest_trigger}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(45,106,79,0.12)", background: "rgba(255,255,255,0.18)" }}>
                            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(26,26,26,0.6)" }}>Resilience Score</p>
                            <p className="mt-2 text-sm readable-on-sand">{dna.resilience_score}/10</p>
                          </div>
                          <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(45,106,79,0.12)", background: "rgba(255,255,255,0.18)" }}>
                            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(26,26,26,0.6)" }}>Most Effective Cue</p>
                            <p className="mt-2 text-sm readable-on-sand">{dna.most_effective_cue}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(45,106,79,0.12)", background: "rgba(45,106,79,0.04)" }}>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-primary/70">Growth Insight</p>
                          <p className="mt-2 text-sm leading-relaxed readable-on-sand">
                            {dna.growth_insight}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(45,106,79,0.12)", background: "rgba(255,255,255,0.18)" }}>
                        <p className="text-sm font-light" style={{ color: "rgba(26,26,26,0.7)" }}>
                          Round DNA was not generated for this round.
                        </p>
                      </div>
                    )}

                    <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(45,106,79,0.12)", background: "rgba(255,255,255,0.18)" }}>
                      <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(26,26,26,0.6)" }}>Reflection Snapshot</p>
                      <p className="mt-2 text-sm readable-on-sand">
                        {reflection?.emotional_start} to {reflection?.emotional_finish} · {reflection?.effective_cue}
                      </p>
                    </div>
                  </FrostedSandCard>
                );
              })}
            </div>

            {/* Breathing Sessions */}
            {breathing.length > 0 && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Wind className="h-4 w-4 text-[#1a5c2e]" />
                    <h2
                      className="text-[32px] font-serif font-medium tracking-[0.5px]"
                      style={{ color: "#1a1a1a" }}
                    >
                      Breathing Sessions
                    </h2>
                  </div>
                  <p className="text-sm font-light tracking-wide" style={{ color: "rgba(26,26,26,0.6)" }}>
                    Each reset, scored 1-10 for how helpful it appeared — calibrated after the round.
                  </p>
                </div>

                {breathing.slice(0, 20).map((session) => {
                  const label = new Date(session.startedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year:
                      new Date(session.startedAt).getFullYear() !== new Date().getFullYear()
                        ? "numeric"
                        : undefined,
                  });
                  const mins = Math.max(1, Math.round(session.durationSeconds / 60));
                  return (
                    <FrostedSandCard key={session.id} className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-primary/70">Breathing</p>
                          <p className="text-base font-medium readable-on-sand">{label}</p>
                        </div>
                        {session.aiScore != null ? (
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                            {session.aiScore}/10
                          </span>
                        ) : (
                          <span className="rounded-full bg-[rgba(26,26,26,0.06)] px-3 py-1 text-xs text-[rgba(26,26,26,0.5)]">
                            Scores after round
                          </span>
                        )}
                      </div>
                      <p className="text-sm readable-on-sand">
                        {session.cyclesCompleted} cycle{session.cyclesCompleted !== 1 ? "s" : ""} · {mins} min
                      </p>
                      {session.aiNotes && (
                        <p className="text-sm leading-relaxed" style={{ color: "rgba(26,26,26,0.7)" }}>
                          {session.aiNotes}
                        </p>
                      )}
                    </FrostedSandCard>
                  );
                })}
              </div>
            )}

            {/* Memory categories */}
            {categoryOrder.map((category) => {
              const categoryMemories = groupedMemories[category];
              if (!categoryMemories || categoryMemories.length === 0) return null;

              const config = CATEGORY_CONFIG[category];
              const Icon = config.icon;

              return (
                <div key={category} className="space-y-4 animate-fade-in">
                  {/* Category header */}
                  <FrostedSandCard className="flex items-center gap-3 rounded-2xl p-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(214,197,163,0.3)" }}>
                      <Icon 
                        className="w-4 h-4" 
                        style={{ color: "#1a1a1a" }}
                      />
                    </div>
                    <div>
                      <h2 
                        className="text-base font-medium tracking-wide"
                        style={{ color: "#1a1a1a" }}
                      >
                        {config.label}
                      </h2>
                      <p 
                        className="text-xs font-light"
                        style={{ color: "rgba(26,26,26,0.6)" }}
                      >
                        {config.description}
                      </p>
                    </div>
                  </FrostedSandCard>

                  {/* Memory items */}
                  <div className="space-y-2 pl-11">
                    {categoryMemories.map((memory) => {
                      const isExpanded = expandedId === memory.id;
                      const date = new Date(memory.created_at);
                      
                      return (
                        <button
                          key={memory.id}
                          onClick={() => setExpandedId(isExpanded ? null : memory.id)}
                          className={cn(
                            "w-full text-left rounded-xl p-4 transition-all duration-300",
                            "border",
                            isExpanded && "scale-[1.005]"
                          )}
                          style={{
                            background: "linear-gradient(180deg, rgba(245,236,216,0.68) 0%, rgba(235,222,195,0.58) 100%)",
                            borderColor: isExpanded ? "rgba(45,106,79,0.12)" : "rgba(45,106,79,0.12)",
                            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                          }}
                        >
                          <p 
                            className="text-sm leading-relaxed font-light"
                            style={{ color: "rgba(26,26,26,0.7)" }}
                          >
                            {memory.content}
                          </p>
                          
                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-foreground/5 flex items-center justify-between">
                              <span 
                                className="text-xs"
                                style={{ color: "rgba(26,26,26,0.6)" }}
                              >
                                {date.toLocaleDateString("en-US", { 
                                  month: "short", 
                                  day: "numeric",
                                  year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
                                })}
                              </span>
                              <span 
                                className="text-xs"
                                style={{ color: "rgba(26,26,26,0.6)" }}
                              >
                                Confidence: {Math.round(memory.confidence * 100)}%
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </AppShell>
      <ActiveRoundResumeChip />
      <BottomDock />
    </PageShell>
  );
};

export default MemoryBank;
