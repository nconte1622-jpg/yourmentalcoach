import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { loadHighlights, loadPreferredWords } from "@/lib/memoryStorage";
import { loadGolferProfile } from "@/lib/golferProfile";
import {
  Sparkles,
  Timer,
  Flag,
  Target,
  MessageCircle,
  ChevronRight,
  Lock,
  TrendingUp,
  Play,
  Flame,
  Crosshair,
  ArrowRight,
  Video,
} from "lucide-react";
import { LRMIndicator } from "@/components/LRMIndicator";
import { useProStatus } from "@/hooks/useProStatus";
import { triggerHaptic } from "@/lib/haptics";
import { GlassCard } from "@/components/ui/glass-card";
import { PillButton } from "@/components/ui/pill-button";
import { ModeRow } from "@/components/ui/mode-row";
import { AppHeader } from "@/components/ui/AppHeader";
import { AppShell } from "@/components/ui/AppShell";
import { usePatternInsights } from "@/hooks/usePatternInsights";
import { ProUpgradeModal } from "@/components/ProUpgradeModal";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { isOnboardingComplete } from "@/lib/onboarding";
import { getDailyFocus, setDailyFocus } from "@/lib/dailyFocus";
import { useRounds } from "@/hooks/useRounds";
import { MentalHandicapWidget } from "@/components/MentalHandicapWidget";
import { toast } from "sonner";
import { BottomDock } from "@/components/ui/BottomDock";
import { loadActiveRoundSession } from "@/lib/roundSession";
import { ActiveRoundResumeChip } from "@/components/ui/ActiveRoundResumeChip";
import { cn } from "@/lib/utils";
import { getStreakData, streakLabel, daysSinceLastRound, type StreakData } from "@/lib/streakStorage";
import { formatRoundDuration } from "@/lib/roundTime";
import { DailyCheckIn } from "@/components/DailyCheckIn";
import { loadPreferredWords as loadCueWords } from "@/lib/memoryStorage";
import { InAppAlertBanner } from "@/components/InAppAlertBanner";
import { AccountSlide } from "@/components/AccountSlide";
import { GolfNewsView } from "@/components/GolfNewsView";
import { StaleRoundPrompt } from "@/components/StaleRoundPrompt";

// Daily focus rotates through a curated 30-item library keyed to day-of-year.
// This keeps the habit loop alive — same phrase every day kills engagement.
const DAILY_FOCUSES = [
  "One committed decision at a time.",
  "Pick the target. Trust the swing. Accept the result.",
  "Stay in the present shot. Nothing before it matters.",
  "Breathe once before every swing. Then commit.",
  "Your job is process, not outcome.",
  "Quiet mind, clear target, full swing.",
  "Let the last shot go. This one is all that exists.",
  "Slow down the walk. Speed up the commitment.",
  "Play the course, not the scoreboard.",
  "Grip soft. Swing free. Trust it.",
  "One cue word. One target. One swing.",
  "Reset after every hole. Start clean.",
  "Energy follows attention. Point it forward.",
  "See the shot before you hit it.",
  "Confidence is a choice you make before the swing.",
  "Be aggressive to the target, not to the result.",
  "Fairway or rough — you recover the same way.",
  "Nerves mean you care. Channel that.",
  "Walk slower. Think less. Commit more.",
  "Shoulders down. Target in. Let it go.",
  "The score will take care of itself. Focus on the process.",
  "Every hole is a fresh start. Use it.",
  "Stay curious about the challenge, not afraid of it.",
  "One deep breath is the most powerful reset.",
  "Trust what you've built in practice.",
  "Make a decision and commit fully. Doubt costs strokes.",
  "Simple swing thought. One target. No hesitation.",
  "Play within yourself. That's where the good shots live.",
  "The only shot you control is the next one.",
  "When it gets hard, get quieter.",
] as const;

function getDailyFocusText(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return DAILY_FOCUSES[dayOfYear % DAILY_FOCUSES.length];
}

const TODAY_FOCUS_TEXT = getDailyFocusText();
const PAGE_LABELS = ["Today", "Profile", "Intel"] as const;
const HOME_TUTORED_KEY = "home-swipe-tutored-v1";

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/* ═══════════════════════════════════════════════════════════
   HOME — 3-page swipeable experience
   ═══════════════════════════════════════════════════════════ */
const Home = () => {
  const navigate = useNavigate();
  const { isPro } = useProStatus();
  const { features } = useFeatureFlags();
  const { summary: patternSummary, eligibleRoundCount, hasPatternAccess } = usePatternInsights();
  const { getActiveRound, createRoundEvent, attachDailyFocusToActiveRound } = useRounds();
  const [hasHighlights, setHasHighlights] = useState(false);
  const [hasLocalMemory, setHasLocalMemory] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [dailyFocusLocked, setDailyFocusLocked] = useState(false);
  const [hasGolferProfile, setHasGolferProfile] = useState(true); // optimistic
  const [activePage, setActivePage] = useState(0);
  const [widgetRefreshKey, setWidgetRefreshKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSwipeTutorial, setShowSwipeTutorial] = useState(false);
  const [streak, setStreak] = useState<StreakData>(() => getStreakData());

  const [activeRoundSummary, setActiveRoundSummary] = useState<{
    id: string;
    roundType: string;
    environment: string;
    createdAt: string;
    goal?: string | null;
    todayFocus?: string | null;
  } | null>(null);

  /* ── Scroll tracking for page dots ──────────────────── */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const page = Math.round(el.scrollLeft / el.clientWidth);
      setActivePage(page);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Refresh widget and streak when app resumes ─────── */
  useEffect(() => {
    let handle: Awaited<ReturnType<typeof App.addListener>> | null = null;
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        setWidgetRefreshKey((k) => k + 1);
        setStreak(getStreakData());
      }
    }).then((h) => { handle = h; });
    return () => { handle?.remove(); };
  }, []);

  const scrollToPage = useCallback((i: number) => {
    scrollRef.current?.scrollTo({ left: i * window.innerWidth, behavior: "smooth" });
  }, []);

  /* ── Data loading (unchanged logic) ─────────────────── */
  useEffect(() => {
    if (!isOnboardingComplete()) {
      navigate("/onboarding", { replace: true });
      return;
    }

    // Show swipe tutorial on first visit
    try {
      if (!localStorage.getItem(HOME_TUTORED_KEY)) {
        setShowSwipeTutorial(true);
      }
    } catch { /* silent */ }

    const highlights = loadHighlights();
    const preferredWords = loadPreferredWords();
    const savedFocus = getDailyFocus();
    const persistedRound = loadActiveRoundSession();
    const golferProfile = loadGolferProfile();
    setHasHighlights(highlights.length > 0);
    setHasLocalMemory(highlights.length > 0 || preferredWords.length > 0);
    setDailyFocusLocked(savedFocus?.text === TODAY_FOCUS_TEXT);
    // Show profile CTA if the golfer hasn't completed the Master Quiz
    setHasGolferProfile(Boolean(golferProfile?.firstName?.trim()));
    setActiveRoundSummary(
      persistedRound
        ? {
            id: persistedRound.roundId,
            roundType: persistedRound.roundType,
            environment: persistedRound.environment,
            createdAt: persistedRound.createdAt,
            goal: persistedRound.goal,
            todayFocus: persistedRound.todayFocus,
          }
        : null
    );

    let cancelled = false;
    void getActiveRound().then((round) => {
      if (cancelled) return;
      if (!round) {
        setActiveRoundSummary(null);
        return;
      }
      const currentFocus = getDailyFocus();
      setActiveRoundSummary({
        id: round.id,
        roundType: round.round_type,
        environment: round.environment,
        createdAt: round.created_at ?? round.started_at,
        goal: round.goal,
        todayFocus: currentFocus?.round_id === round.id ? currentFocus.text : null,
      });
    });
    return () => { cancelled = true; };
  }, [navigate]);

  const activeRoundMeta = useMemo(() => {
    if (!activeRoundSummary) return null;
    const duration = formatRoundDuration(activeRoundSummary.createdAt);
    return {
      roundType: activeRoundSummary.roundType.replace("-", " "),
      environment: activeRoundSummary.environment,
      // When the round is stale (e.g. a session left open overnight) we drop the
      // misleading counter and prompt the user to resume or wrap it up instead.
      durationLabel: duration.stale ? "Still open — resume to finish" : `${duration.label} active`,
    };
  }, [activeRoundSummary]);

  // Re-engagement nudge: if it's been a few days since the last round (and one
  // isn't already in progress), gently pull the golfer back to keep the habit alive.
  const reEngageDays = useMemo(() => {
    if (activeRoundSummary) return null;
    const days = daysSinceLastRound(streak);
    return days !== null && days >= 3 ? days : null;
  }, [activeRoundSummary, streak]);

  const withTap = (to: string) => {
    triggerHaptic("soft");
    navigate(to);
  };

  const handleLockTodayFocus = async () => {
    triggerHaptic("medium");
    const activeRound = await attachDailyFocusToActiveRound(TODAY_FOCUS_TEXT);
    const nextFocus = {
      text: TODAY_FOCUS_TEXT,
      saved_at: new Date().toISOString(),
      round_id: activeRound?.id,
    };
    setDailyFocus(nextFocus);
    if (activeRound?.id) {
      try {
        await createRoundEvent({
          round_id: activeRound.id,
          event_type: "note",
          label: "daily_focus",
          notes: JSON.stringify(nextFocus),
        });
      } catch {}
    }
    setDailyFocusLocked(true);
    if (activeRound?.id) {
      setActiveRoundSummary((c) =>
        c && c.id === activeRound.id ? { ...c, todayFocus: TODAY_FOCUS_TEXT } : c
      );
    }
    toast.success("Today's focus locked in");
  };

  /* ══════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════ */
  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[#e8f0e9]">

      {/* ── Horizontal swipe container ──────────────────── */}
      <div
        ref={scrollRef}
        className="flex h-full snap-x snap-mandatory overflow-x-auto scrollbar-hide"
      >

        {/* ════════════════════════════════════════════════
            SLIDE 1 — TODAY  (Dashboard)
            ════════════════════════════════════════════════ */}
        <section className="relative h-full w-screen shrink-0 snap-center">
          <div className="calm-pro-bg absolute inset-0" />
          <AppShell
            className="relative z-10 mx-auto w-full max-w-3xl"
            header={
              <AppHeader
                className="calm-pro-mount"
                left={<div className="tap-44" />}
                center={
                  <div className="text-center">
                    <h1 className="truncate font-serif text-[30px] font-semibold leading-[1.05] tracking-[0.01em] text-[#1a1a1a]">
                      The Caddie
                    </h1>
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2d6a4f]">
                      Focus · Commit · Trust
                    </p>
                  </div>
                }
                right={
                  <div className="tap-44 flex items-center justify-end">
                    <LRMIndicator ambient memoryActive={isPro && hasLocalMemory} />
                  </div>
                }
                subrow={
                  <div className="flex items-center gap-2">
                    <div className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] px-3.5 py-1 text-xs font-medium text-[#2d6a4f]">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#2d6a4f] opacity-70" />
                      {todayLabel()}
                    </div>
                    {streak.currentStreak >= 2 && (
                      <div className="inline-flex min-h-11 items-center gap-1 rounded-full border border-[rgba(255,160,50,0.3)] bg-[rgba(255,120,20,0.12)] px-3 py-1 text-xs font-medium text-[rgba(255,160,80,0.9)]">
                        <Flame className="h-3 w-3" />
                        {streakLabel(streak)}
                      </div>
                    )}
                  </div>
                }
              />
            }
          >
            <div className="with-bottom-dock space-y-4 overflow-y-auto px-5 pb-8 pt-5">

              {/* In-app notification alerts */}
              <InAppAlertBanner />

              {/* Active Round */}
              {activeRoundSummary && activeRoundMeta && (
                <GlassCard variant="sand" className="calm-pro-mount p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-[rgba(31,180,100,0.5)]" />
                          <span className="h-2 w-2 rounded-full bg-[rgba(31,180,100,0.9)]" />
                        </span>
                        <p className="text-sm font-medium tracking-wide text-[#2d6a4f]">
                          Round in Progress
                        </p>
                      </div>
                      <p className="text-base capitalize text-[#1a1a1a]">
                        {activeRoundMeta.roundType} · {activeRoundMeta.environment}
                      </p>
                      <p className="text-sm text-[rgba(26,26,26,0.6)]">{activeRoundMeta.durationLabel}</p>
                    </div>
                    <PillButton
                      tone="green"
                      onClick={() => withTap(`/round?roundId=${activeRoundSummary.id}`)}
                    >
                      Resume →
                    </PillButton>
                  </div>
                </GlassCard>
              )}

              {/* Re-engagement nudge — keep the habit loop alive */}
              {reEngageDays !== null && (
                <button
                  onClick={() => withTap("/round-setup")}
                  className="calm-pro-focus calm-pro-press calm-pro-mount group block w-full text-left"
                >
                  <GlassCard variant="sand" className="p-5">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[rgba(255,160,50,0.3)] bg-[rgba(255,120,20,0.12)] text-[rgba(255,160,80,0.95)]">
                        <Flame className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-serif text-lg text-[#1a1a1a]">
                          {reEngageDays} days since your last round
                        </p>
                        <p className="text-sm text-[#2d6a4f] opacity-80">
                          {streak.currentStreak >= 2
                            ? "Keep your streak alive — play before it resets."
                            : "Step back on the course and keep the momentum going."}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-[#2d6a4f] opacity-70 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </GlassCard>
                </button>
              )}

              {/* Mental Handicap */}
              <MentalHandicapWidget refreshKey={widgetRefreshKey} />

              {/* Today's Focus */}
              <GlassCard glow className="calm-pro-mount p-5">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-[#2d6a4f]" />
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#2d6a4f]">
                      Today&apos;s Focus
                    </p>
                  </div>
                  <p className="font-serif text-2xl leading-8 text-[#1a1a1a]">
                    {TODAY_FOCUS_TEXT}
                  </p>
                  <p className="text-sm text-[rgba(26,26,26,0.6)]">
                    Keep your process quiet and clear before every shot.
                  </p>
                  <PillButton
                    tone={dailyFocusLocked ? "green" : "sand"}
                    onClick={handleLockTodayFocus}
                    disabled={dailyFocusLocked}
                  >
                    {dailyFocusLocked ? "✓ Focus locked" : "Make it my focus"}
                  </PillButton>
                </div>
              </GlassCard>

              {/* Daily Check-In — 30-second mental ritual, drives daily opens */}
              <DailyCheckIn
                savedCueWord={(() => {
                  try { return loadCueWords()[0] ?? null; } catch { return null; }
                })()}
              />

              {/* Pattern Insight */}
              <GlassCard className="calm-pro-mount p-5">
                {hasPatternAccess && patternSummary ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-[#2d6a4f]" />
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#2d6a4f]">
                        Pattern Insight
                      </p>
                    </div>
                    <p className="text-sm leading-6 text-[#1a1a1a]">{patternSummary?.struggle_summary}</p>
                    <p className="text-sm leading-6 text-[rgba(26,26,26,0.6)]">{patternSummary?.best_summary}</p>
                    <PillButton tone="sand" onClick={() => withTap("/insights")}>
                      Open Insights
                    </PillButton>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-[#2d6a4f]" />
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#2d6a4f]">
                        Pattern Insight
                      </p>
                    </div>
                    <p className="text-sm text-[rgba(26,26,26,0.6)]">
                      Complete <span className="text-[#1a1a1a]">{Math.max(0, 3 - eligibleRoundCount)} more structured round{Math.max(0, 3 - eligibleRoundCount) !== 1 ? "s" : ""}</span> to unlock — free.
                    </p>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-[rgba(0,0,0,0.03)]">
                      <div
                        className="h-full rounded-full bg-[rgba(203,184,146,0.5)] transition-all"
                        style={{ width: `${Math.min(100, (eligibleRoundCount / 3) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-[rgba(26,26,26,0.6)]">{eligibleRoundCount} / 3 rounds</p>
                  </div>
                )}
              </GlassCard>

              {/* Master Quiz CTA — only shown when golfer profile is not set up */}
              {!hasGolferProfile && (
                <button
                  onClick={() => withTap("/master-quiz")}
                  className="calm-pro-focus calm-pro-press calm-pro-mount group block w-full"
                >
                  <GlassCard className="min-h-11 p-5 border-[rgba(45,106,79,0.12)]">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] text-[#2d6a4f]">
                        <Target className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="font-serif text-xl text-[#1a1a1a]">Set Up Your Profile</p>
                        <p className="text-sm text-[#2d6a4f] opacity-80">Tell your coach about your game — personalizes every response.</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-[#2d6a4f] opacity-70" />
                    </div>
                  </GlassCard>
                </button>
              )}

              {/* Start a Round — primary play CTA (replaces the old swipe slide) */}
              {!activeRoundSummary && (
                <div className="calm-pro-mount grid grid-cols-2 gap-3">
                  <button
                    onClick={() => withTap("/round-setup")}
                    className="calm-pro-focus calm-pro-press group flex flex-col items-start gap-2 rounded-2xl bg-[#1a5c2e] p-5 text-left text-white shadow-[0_8px_24px_rgba(26,92,46,0.28)]"
                  >
                    <Flag className="h-6 w-6 text-[#e8a84c]" />
                    <span className="font-serif text-xl leading-tight">Start a Round</span>
                    <span className="text-xs text-white/80">Setup · track · reflect</span>
                  </button>
                  <button
                    onClick={() => withTap("/pre-game")}
                    className="calm-pro-focus calm-pro-press group flex flex-col items-start gap-2 rounded-2xl border border-[#c8ddc8] bg-white p-5 text-left shadow-[0_1px_6px_rgba(15,31,15,0.05)]"
                  >
                    <Timer className="h-6 w-6 text-[#1a5c2e]" />
                    <span className="font-serif text-xl leading-tight text-[#0f1f0f]">Pre-Game Talk</span>
                    <span className="text-xs text-[#2d4d2d]">Calm nerves · set intention</span>
                  </button>
                </div>
              )}

              {/* Quick Coach */}
              <button
                onClick={() => withTap("/round")}
                className="calm-pro-focus calm-pro-press calm-pro-mount group block w-full"
              >
                <GlassCard className="min-h-11 p-5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] text-[#2d6a4f]">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="font-serif text-xl text-[#1a1a1a]">Quick Coach</p>
                      <p className="text-sm text-[rgba(26,26,26,0.6)]">Jump in for a live cue.</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[#2d6a4f] opacity-70" />
                  </div>
                </GlassCard>
              </button>

              {/* Swing Analysis */}
              <button
                onClick={() => withTap("/swing-analysis")}
                className="calm-pro-focus calm-pro-press calm-pro-mount group block w-full"
              >
                <GlassCard className="min-h-11 p-5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] text-[#2d6a4f]">
                      <Video className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="font-serif text-xl text-[#1a1a1a]">Swing Analysis</p>
                      <p className="text-sm text-[rgba(26,26,26,0.6)]">Video mental coaching.</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[#2d6a4f] opacity-70" />
                  </div>
                </GlassCard>
              </button>

              {/* Swipe hint */}
              <div className="flex items-center justify-center gap-2 pt-2 text-[rgba(26,26,26,0.6)] opacity-50">
                <p className="text-xs tracking-wide">Swipe → Profile &amp; Daily Intel</p>
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </AppShell>
        </section>

        {/* ════════════════════════════════════════════════
            SLIDE 2 — PROFILE  (Account + Mental Handicap)
            ════════════════════════════════════════════════ */}
        <section className="relative h-full w-screen shrink-0 snap-center overflow-hidden">
          <div className="calm-pro-bg absolute inset-0" />
          <div className="relative z-10 h-full">
            <AccountSlide refreshKey={widgetRefreshKey} />
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            SLIDE 3 — INTEL  (Daily Golf News)
            ════════════════════════════════════════════════ */}
        <section className="relative h-full w-screen shrink-0 snap-center overflow-hidden">
          <div className="calm-pro-bg absolute inset-0" />
          <div className="relative z-10 h-full">
            <GolfNewsView />
          </div>
        </section>

        {/* ── retired swipe slides (Start Round / Close Strong) — start a round
            from the Today tab's actions or the bottom dock instead ── */}
        {false && (
        <>
        <section className="relative h-full w-screen shrink-0 snap-center overflow-hidden">
          {/* Liquid background */}
          <div className="liquid-bg-round absolute inset-0">
            {/* Floating liquid orbs */}
            <div className="absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-[rgba(31,106,74,0.45)] blur-[100px] animate-liquid-1" />
            <div className="absolute -right-16 bottom-[30%] h-[320px] w-[320px] rounded-full bg-[rgba(45,106,79,0.06)] blur-[90px] animate-liquid-2" />
            <div className="absolute left-[30%] top-[55%] h-[250px] w-[250px] rounded-full bg-[rgba(31,180,100,0.18)] blur-[80px] animate-liquid-3" />
            {/* Subtle grain */}
            <div className="absolute inset-0 opacity-[0.08]" style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 0.5px, transparent 0.5px)",
              backgroundSize: "20px 20px",
            }} />
          </div>

          {/* Content */}
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-8">
            {/* Top label */}
            <div className="absolute left-0 right-0 top-[max(60px,env(safe-area-inset-top))] flex justify-center">
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#2d6a4f] opacity-60">
                The Caddie
              </span>
            </div>

            {/* Main title */}
            <div className="text-center space-y-4 mb-12">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-3xl border border-[rgba(31,106,74,0.5)] bg-[rgba(45,106,79,0.06)] mx-auto mb-4">
                <Play className="h-7 w-7 text-[rgba(31,180,100,0.8)] ml-0.5" />
              </div>
              <h2 className="font-serif text-[42px] leading-[1.1] tracking-wide text-[#1a1a1a]">
                Start Your<br />Round
              </h2>
              <p className="text-base leading-relaxed text-[rgba(26,26,26,0.6)] max-w-[260px] mx-auto">
                Step onto the course with clarity and intention.
              </p>
            </div>

            {/* Action cards */}
            <div className="w-full max-w-sm space-y-3">
              <button
                onClick={() => withTap("/pre-game")}
                className="calm-pro-press group flex w-full items-center gap-4 rounded-[20px] border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] p-4 backdrop-blur-md transition-all hover:bg-[rgba(45,106,79,0.06)]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(31,106,74,0.5)] text-[#2d6a4f]">
                  <Timer className="h-5 w-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-serif text-lg text-[#1a1a1a]">Pre-Game Talk</p>
                  <p className="text-xs text-[rgba(26,26,26,0.6)]">Calm nerves · Set intention</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#2d6a4f] opacity-50 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={() => withTap("/round-setup")}
                className="calm-pro-press group flex w-full items-center gap-4 rounded-[20px] border border-[rgba(31,106,74,0.35)] bg-[rgba(45,106,79,0.06)] p-4 backdrop-blur-md transition-all hover:bg-[rgba(45,106,79,0.06)]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(31,180,100,0.2)] text-[rgba(31,180,100,0.9)]">
                  <Flag className="h-5 w-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-serif text-lg text-[#1a1a1a]">Full Round</p>
                  <p className="text-xs text-[rgba(26,26,26,0.6)]">Setup · Track · Reflect after</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#2d6a4f] opacity-50 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

            {/* Swipe hint */}
            <div className="absolute bottom-[calc(100px+env(safe-area-inset-bottom))] left-0 right-0 flex items-center justify-center gap-2 text-[rgba(26,26,26,0.6)] opacity-40">
              <p className="text-xs tracking-wide">Swipe for Close Strong</p>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            SLIDE 3 — FINISH  (Close Strong)
            ════════════════════════════════════════════════ */}
        <section className="relative h-full w-screen shrink-0 snap-center overflow-hidden">
          {/* Dramatic background */}
          <div className="liquid-bg-close absolute inset-0">
            {/* Gold/amber orbs */}
            <div className="absolute -left-20 top-[15%] h-[380px] w-[380px] rounded-full bg-[rgba(180,140,50,0.25)] blur-[100px] animate-liquid-4" />
            <div className="absolute -right-20 bottom-[25%] h-[300px] w-[300px] rounded-full bg-[rgba(160,120,40,0.2)] blur-[90px] animate-liquid-1" />
            <div className="absolute left-[40%] top-[60%] h-[200px] w-[200px] rounded-full bg-[rgba(45,106,79,0.06)] blur-[70px] animate-liquid-2" />
            {/* Light sweep */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -left-[50%] top-0 h-full w-[200%] bg-gradient-to-r from-transparent via-[rgba(203,184,146,0.04)] to-transparent animate-light-sweep" />
            </div>
            {/* Grain */}
            <div className="absolute inset-0 opacity-[0.06]" style={{
              backgroundImage: "radial-gradient(rgba(203,184,146,0.08) 0.5px, transparent 0.5px)",
              backgroundSize: "18px 18px",
            }} />
          </div>

          {/* Content */}
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-8">
            {/* Top label */}
            <div className="absolute left-0 right-0 top-[max(60px,env(safe-area-inset-top))] flex justify-center">
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#2d6a4f] opacity-60">
                The Caddie
              </span>
            </div>

            {/* Main title */}
            <div className="text-center space-y-4 mb-12">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-3xl border border-[rgba(180,140,50,0.4)] bg-[rgba(160,120,40,0.25)] mx-auto mb-4">
                <Crosshair className="h-7 w-7 text-[#2d6a4f]" />
              </div>
              <h2 className="font-serif text-[44px] leading-[1.05] tracking-[0.04em] text-[#1a1a1a]">
                Close<br />Strong
              </h2>
              <p className="text-base leading-relaxed text-[rgba(26,26,26,0.6)] max-w-[280px] mx-auto">
                Lock in. Execute when it matters most. No thinking — just trust.
              </p>
            </div>

            {/* CTA */}
            <div className="w-full max-w-sm space-y-4">
              <button
                onClick={() => {
                  if (!isPro) {
                    setShowUpgradeModal(true);
                    return;
                  }
                  withTap("/round/close-strong");
                }}
                className="calm-pro-press group relative w-full overflow-hidden rounded-2xl border border-[rgba(45,106,79,0.12)] bg-[rgba(180,140,50,0.18)] px-6 py-5 text-center backdrop-blur-md transition-all hover:bg-[rgba(180,140,50,0.28)]"
              >
                {/* Shimmer effect */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(203,184,146,0.08)] to-transparent animate-light-sweep pointer-events-none" />
                <span className="relative flex items-center justify-center gap-3">
                  <Flame className="h-5 w-5 text-[#2d6a4f]" />
                  <span className="font-serif text-xl tracking-wide text-[#1a1a1a]">
                    Enter Close Strong
                  </span>
                </span>
                {!isPro && (
                  <span className="absolute top-3 right-3 rounded-full border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#2d6a4f]">
                    Pro
                  </span>
                )}
              </button>

              {/* Micro-message */}
              <p className="text-center text-xs text-[rgba(26,26,26,0.6)] opacity-50 italic">
                "The last three holes define the round."
              </p>
            </div>
          </div>
        </section>
        </>
        )}
      </div>

      {/* ── Page indicator dots ──────────────────────────── */}
      <div className="fixed bottom-[calc(var(--bottom-dock-h)+var(--sab)+16px)] left-0 right-0 z-30 flex items-center justify-center gap-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[rgba(45,106,79,0.12)] bg-white/90 px-3 py-1.5 backdrop-blur-md">
          {PAGE_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => scrollToPage(i)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-all duration-300",
                activePage === i
                  ? "bg-[rgba(45,106,79,0.06)] text-[#2d6a4f]"
                  : "text-[rgba(26,26,26,0.6)] opacity-50 hover:opacity-80"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all duration-300",
                  activePage === i ? "bg-[#2d6a4f]" : "bg-[rgba(26,26,26,0.25)]"
                )}
              />
              {label}
            </button>
          ))}
        </div>
      </div>

      <ActiveRoundResumeChip />
      <StaleRoundPrompt />
      <BottomDock highlightDot={hasHighlights} />
      <ProUpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />

      {/* ── First-visit swipe tutorial ───────────────────── */}
      {showSwipeTutorial && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-end pb-[calc(var(--bottom-dock-h)+var(--sab)+80px)] pointer-events-none"
          style={{ background: "rgba(3,8,6,0.72)" }}
        >
          <div
            className="pointer-events-auto mx-4 w-full max-w-sm rounded-3xl border border-[rgba(45,106,79,0.12)] bg-white p-6 backdrop-blur-xl animate-slide-up"
          >
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#2d6a4f] opacity-60 mb-3">
              Quick tour
            </p>
            <h2 className="font-serif text-xl text-[#1a1a1a] mb-2">
              Three pages, one swipe away
            </h2>
            <div className="space-y-3 mt-4">
              {[
                { dot: "bg-[#1a5c2e]", label: "Today", desc: "Your dashboard — focus, patterns, quick coach" },
                { dot: "bg-[#2d7a4a]", label: "Profile", desc: "Mental handicap, stats & subscription" },
                { dot: "bg-[#e8a84c]", label: "Intel", desc: "Daily AI golf news tied to your game" },
              ].map(({ dot, label, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                  <div>
                    <span className="text-sm font-medium text-[#1a1a1a]">{label}</span>
                    <span className="text-sm text-[rgba(26,26,26,0.6)]"> — {desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowSwipeTutorial(false);
                try { localStorage.setItem(HOME_TUTORED_KEY, "1"); } catch { /* silent */ }
              }}
              className="mt-6 w-full rounded-2xl border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] py-3.5 text-sm font-medium tracking-wide text-[#2d6a4f] transition-all hover:bg-[rgba(45,106,79,0.06)]"
            >
              Got it →
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

export default Home;
