import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { TypingIndicator } from "@/components/TypingIndicator";
import { RecallCard } from "@/components/RecallCard";
import { LRMModesModal } from "@/components/LRMModesModal";
import { LRMActiveBadge } from "@/components/LRMActiveBadge";
import { PageShell } from "@/components/PageShell";
import { useMentalCoach } from "@/hooks/useMentalCoach";
import { useRecallEngine } from "@/hooks/useRecallEngine";
import { useRounds } from "@/hooks/useRounds";
import { Button } from "@/components/ui/button";
import { loadHighlights, loadPreferredWords } from "@/lib/memoryStorage";
import { normalizeCueWord } from "@/lib/recallEngine";
import { triggerHaptic } from "@/lib/haptics";
import { detectCloseStrong } from "@/lib/closeStrongDetection";
import { cn } from "@/lib/utils";
import { getAiBackendLabel, showAiBackendIndicator } from "@/lib/aiBackend";
import { AppHeader } from "@/components/ui/AppHeader";
import { AppShell } from "@/components/ui/AppShell";
import { Lock, Wind, ClipboardList, Flag, Zap } from "lucide-react";
import { ProUpgradeModal } from "@/components/ProUpgradeModal";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { loadActiveRoundSession } from "@/lib/roundSession";
import { extractAndSaveQuickEndData } from "@/lib/quickEndRound";
import { recordCompletedRound } from "@/lib/streakStorage";
import { loadScorecard } from "@/lib/scorecardStorage";
import { getCurrentHole, loadCachedCourse } from "@/lib/courseData";
import { loadRoundContext } from "@/lib/roundContext";
import { useCheckIn } from "@/hooks/useCheckIn";
import { CheckInCard } from "@/components/CheckInCard";
import { PreShotReset } from "@/components/PreShotReset";
import { RoundBriefingCard } from "@/components/RoundBriefingCard";
import { HoleMoodTracker } from "@/components/HoleMoodTracker";
import { clearHoleMoods, getHoleMoods, type HoleMood } from "@/lib/holeMoods";
import { MentalScoreReveal } from "@/components/MentalScoreReveal";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RecallData = {
  type: "highlight" | "cue";
  cueWord: string;
} | null;

const Round = () => {
  const navigate = useNavigate();
  // quickMode must be declared before useMentalCoach so it can be passed as an option
  const [quickMode, setQuickMode] = useState<boolean>(() => {
    try { return localStorage.getItem("quick-mode-v1") === "true"; } catch { return false; }
  });
  const {
    messages = [],
    isTyping,
    isFrustrationMode,
    sendMessage,
    getEmotionCue,
    setFeedback,
    aiMessagesRemaining,
  } = useMentalCoach({ quickMode });
  const { currentRecall, checkForRecall, dismissRecall } = useRecallEngine();
  const { getActiveRound, createRoundEvent, updateRound } = useRounds();
  const { features } = useFeatureFlags();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [recallDismissed, setRecallDismissed] = useState(false);
  const [briefingDismissed, setBriefingDismissed] = useState(false);
  const [lrmModalOpen, setLrmModalOpen] = useState(false);
  const [closeStrongTransition, setCloseStrongTransition] = useState(false);
  const [closeStrongReason, setCloseStrongReason] = useState<string | null>(null);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [activeRoundSummary, setActiveRoundSummary] = useState<{
    roundType: string;
    environment: string;
  } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [endRoundDialogOpen, setEndRoundDialogOpen] = useState(false);
  const [endRoundStep, setEndRoundStep] = useState<"actions" | "rating">("actions");
  const [postRoundFeeling, setPostRoundFeeling] = useState<number | null>(null);
  const [isEndingRound, setIsEndingRound] = useState(false);
  const [holeTipInfo, setHoleTipInfo] = useState<{ hole: number; course: string } | null>(null);
  const [preShotOpen, setPreShotOpen] = useState(false);
  const [revealData, setRevealData] = useState<{ moods: HoleMood[]; roundId: string } | null>(null);
  const backendLabel = getAiBackendLabel();
  const showBackendLabel = showAiBackendIndicator();
  const coachEnabled = Boolean(import.meta.env.VITE_COACH_API_URL);
  const EMOTION_TAGS = ["Anxious", "Rushed", "Tight", "Angry", "Distracted", "Confident"] as const;

  // Proactive timed check-ins
  const handleCheckInEmotion = useCallback((emotion: string) => {
    getEmotionCue(emotion, isFrustrationMode ? "round-frustrated" : "round");
    // Log the check-in response
    if (activeRoundId) {
      void createRoundEvent({
        round_id: activeRoundId,
        event_type: "emotion_tap",
        label: `checkin:${emotion}`,
        notes: JSON.stringify({ source: "timed_checkin", emotion, timestamp: new Date().toISOString() }),
      });
    }
  }, [activeRoundId, createRoundEvent, getEmotionCue, isFrustrationMode]);

  const checkIn = useCheckIn(handleCheckInEmotion);

  // Check for contextual recall and Close Strong auto-detection
  const handleSendMessage = useCallback((message: string) => {
    if (!features.unlimited_ai && aiMessagesRemaining !== null && aiMessagesRemaining <= 0) {
      setShowUpgradeModal(true);
      return;
    }

    // Check for Close Strong trigger
    const closeStrongResult = detectCloseStrong(message);
    
    if (closeStrongResult.triggered) {
      triggerHaptic("medium");
      setCloseStrongReason(closeStrongResult.reason);
      setCloseStrongTransition(true);
      
      // Store reason in sessionStorage for the Close Strong page
      try { sessionStorage.setItem("closeStrongTriggerReason", closeStrongResult.reason || ""); } catch { /* silent */ }
      
      // Smooth transition then navigate
      setTimeout(() => {
        navigate("/round/close-strong", { 
          state: { 
            triggerReason: closeStrongResult.reason,
            initialMessage: message 
          } 
        });
      }, 500);
      return;
    }
    
    checkForRecall(message);
    sendMessage(message);
  }, [aiMessagesRemaining, checkForRecall, features.unlimited_ai, navigate, sendMessage]);

  // Get recall data: prioritize highlights, then preferred words
  const recallData = useMemo(() => {
    const highlights = loadHighlights();
    if (highlights.length > 0) {
      const mostRecent = highlights[highlights.length - 1];
      const cue = normalizeCueWord(mostRecent.cueWord || "commit");
      return {
        type: "highlight" as const,
        cueWord: cue,
      };
    }
    
    const preferredWords = loadPreferredWords();
    if (preferredWords.length > 0) {
      return {
        type: "cue" as const,
        cueWord: normalizeCueWord(preferredWords[0]),
      };
    }
    
    return null;
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Re-derive current hole when user navigates back from Scorecard
  useEffect(() => {
    const onFocus = () => {
      if (!activeRoundId) return;
      const ctx = loadRoundContext();
      const course = ctx?.location?.trim() || null;
      if (course) {
        const sc = loadScorecard(activeRoundId);
        const hole = getCurrentHole(sc);
        setHoleTipInfo({ hole, course });
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [activeRoundId]);

  useEffect(() => {
    let cancelled = false;

    const persisted = loadActiveRoundSession();
    if (persisted?.roundId) {
      setActiveRoundId(persisted.roundId);
      setActiveRoundSummary({
        roundType: persisted.roundType,
        environment: persisted.environment,
      });
    }

    getActiveRound().then((round) => {
      if (!cancelled && round) {
        setActiveRoundId(round.id);
        setActiveRoundSummary({
          roundType: round.round_type,
          environment: round.environment,
        });

        // Derive current hole + course for hole-tip button
        const ctx = loadRoundContext();
        const course = ctx?.location?.trim() || null;
        if (course) {
          const sc = loadScorecard(round.id);
          const hole = getCurrentHole(sc);
          setHoleTipInfo({ hole, course });
        } else {
          setHoleTipInfo(null);
        }
      } else if (!cancelled) {
        setActiveRoundId(null);
        setActiveRoundSummary(null);
        setHoleTipInfo(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const finalizeEndRound = useCallback(async () => {
    if (!activeRoundId) {
      toast.error("No active round found");
      setEndRoundDialogOpen(false);
      return;
    }

    try {
      setIsEndingRound(true);

      // Capture moods BEFORE clearing storage (reveal card needs them)
      const capturedMoods = getHoleMoods(activeRoundId);
      const capturedRoundId = activeRoundId;

      // Extract and save data from chat BEFORE the round closes and clears storage
      extractAndSaveQuickEndData(activeRoundId);

      // Record round completion for streak tracking
      recordCompletedRound();

      // Only log post-round feeling if the user actually chose a rating
      if (postRoundFeeling !== null) {
        await createRoundEvent({
          round_id: activeRoundId,
          event_type: "note",
          label: "post_round_feeling",
          notes: JSON.stringify({
            feeling_score: postRoundFeeling,
            timestamp: new Date().toISOString(),
          }),
        });
      }

      const ended = await updateRound(activeRoundId, {
        ended_at: new Date().toISOString(),
        status: "completed",
      });
      if (ended) {
        setEndRoundDialogOpen(false);
        setEndRoundStep("actions");
        setPostRoundFeeling(null);
        // Show the Mental Score reveal card instead of navigating immediately
        setRevealData({ moods: capturedMoods, roundId: capturedRoundId });
      } else {
        toast.error("Unable to end round");
      }
    } catch (error) {
      console.error("Failed to end active round:", error);
      toast.error("Unable to end round");
    } finally {
      setIsEndingRound(false);
    }
  }, [activeRoundId, createRoundEvent, postRoundFeeling, updateRound]);

  const handleRevealContinue = useCallback(() => {
    if (revealData) {
      clearHoleMoods(revealData.roundId);
    }
    setRevealData(null);
    navigate("/", { replace: true });
  }, [revealData, navigate]);

  // In frustration mode, show all messages (frustration styling is handled per-message).
  // We do NOT slice — hiding chat history causes loss of context and confuses users.
  const displayMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    return messages;
  }, [messages]);

  const handleHoleTip = useCallback(() => {
    if (!holeTipInfo) return;
    triggerHaptic("medium");
    // Update current hole from scorecard before sending
    if (activeRoundId) {
      const sc = loadScorecard(activeRoundId);
      const currentHole = getCurrentHole(sc);
      setHoleTipInfo((prev) => prev ? { ...prev, hole: currentHole } : prev);
      const msg = `I'm about to play hole ${currentHole} at ${holeTipInfo.course}. Give me a specific mental tip for this hole — what's the course challenge here, where should I stay away from, and what should I be focused on?`;
      handleSendMessage(msg);
    }
  }, [activeRoundId, holeTipInfo, handleSendMessage]);

  const handleEmotionTap = useCallback(async (emotionTag: string) => {
    triggerHaptic("soft");
    
    // Log emotion to sessionStorage for emotional arc tracking
    try {
      const existing = JSON.parse(sessionStorage.getItem("round-emotion-log") || "[]");
      existing.push({ tag: emotionTag, timestamp: new Date().toISOString() });
      sessionStorage.setItem("round-emotion-log", JSON.stringify(existing));
    } catch { /* silent */ }
    
    getEmotionCue(emotionTag, isFrustrationMode ? "round-frustrated" : "round");

    if (!activeRoundId) return;

    try {
      await createRoundEvent({
        round_id: activeRoundId,
        event_type: "emotion_tap",
        label: emotionTag,
        notes: JSON.stringify({
          timestamp: new Date().toISOString(),
          emotion_tag: emotionTag,
        }),
      });
    } catch (error) {
      console.error("Failed to log emotion tap:", error);
    }
  }, [activeRoundId, createRoundEvent, getEmotionCue, isFrustrationMode]);

  return (
    <PageShell backgroundVariant={isFrustrationMode ? "frustration" : "default"}>
      {/* h-[100dvh] gives flex children a real upper bound so overflow-y-auto works */}
      <div className="relative h-[100dvh] w-full overflow-hidden">

      {/* Close Strong Transition Overlay */}
      {closeStrongTransition && (
        <div className="fixed inset-0 z-50 bg-gradient-close-strong animate-fade-in flex items-center justify-center pointer-events-none">
          <div className="text-center animate-scale-in">
            <h2 className="text-3xl font-serif text-foreground/90 tracking-wide mb-2">
              CLOSE STRONG
            </h2>
            <p className="text-sm text-foreground/50 font-light">{closeStrongReason}</p>
          </div>
        </div>
      )}

      <AppShell
        className={cn(
          "relative z-10",
          closeStrongTransition && "opacity-0 scale-105 transition-all duration-500"
        )}
        contentClassName="flex flex-col"
        header={
          <AppHeader
            left={
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  navigate("/");
                }}
                className="header-hit-button tap-44 text-muted-foreground/85 hover:text-foreground hover:bg-foreground/5 transition-all duration-300"
              >
                ← Home
              </button>
            }
            center={
              activeRoundSummary ? (
                <div className="max-w-[280px] mx-auto">
                  <p className="text-[11px] text-muted-foreground/70 text-center">
                    {activeRoundSummary.roundType.replace("-", " ")} · {activeRoundSummary.environment}
                  </p>
                </div>
              ) : null
            }
            right={
              <div className="flex items-center gap-1">
                {/* Quick Mode toggle — labeled so users know what it does */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("soft");
                    const next = !quickMode;
                    setQuickMode(next);
                    try { localStorage.setItem("quick-mode-v1", String(next)); } catch { /* silent */ }
                    if (next) toast("Quick mode on — no interruptions", { duration: 2000 });
                    else toast("Full coaching mode restored", { duration: 2000 });
                  }}
                  className={cn(
                    "tap-44 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide transition-all duration-300",
                    quickMode
                      ? "border border-[rgba(203,184,146,0.35)] bg-[rgba(203,184,146,0.12)] text-[var(--sand-0)]"
                      : "text-muted-foreground/50 hover:text-foreground/70 hover:bg-foreground/5"
                  )}
                >
                  <Zap className="w-3 h-3" />
                  <span>Quick</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    navigate("/round/scorecard");
                  }}
                  className="header-hit-button tap-44 text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-all duration-300"
                  title="Scorecard"
                >
                  <ClipboardList className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEndRoundStep("actions");
                    setEndRoundDialogOpen(true);
                  }}
                  className="header-hit-button tap-44 text-[11px] uppercase tracking-[0.16em] text-[var(--sand-0)] transition-all duration-300 hover:bg-white/5"
                >
                  End
                </button>
              </div>
            }
            subrow={coachEnabled && !isFrustrationMode ? <LRMActiveBadge /> : null}
          />
        }
      >
        <div className="flex-1 flex flex-col min-h-0">
          {/* Round Briefing Card - Tier 2 feature with pattern-based warnings */}
          {!briefingDismissed && !isFrustrationMode && !quickMode && (
            <RoundBriefingCard onDismiss={() => setBriefingDismissed(true)} />
          )}

          {/* Pre-Round Recall Card - hide in frustration mode */}
          {recallData && !recallDismissed && !isFrustrationMode && !currentRecall && (
            <div className="pt-4 shrink-0">
              <div className="max-w-2xl mx-auto card-floating p-5 animate-fade-in">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-foreground/75 leading-relaxed tracking-wide">
                      Recall: When it mattered, you{" "}
                      <span className="font-medium text-cue-focus">
                        {recallData.cueWord}
                      </span>
                      .
                    </p>
                  </div>
                  <button
                    onClick={() => setRecallDismissed(true)}
                    className="text-muted-foreground/25 hover:text-muted-foreground/50 text-sm transition-all duration-300 mt-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Contextual Recall Card - triggered by user input */}
          {currentRecall && !isFrustrationMode && (
            <div className="pt-4 shrink-0">
              <div className="max-w-2xl mx-auto">
                <RecallCard
                  text={currentRecall.text}
                  onDismiss={dismissRecall}
                />
              </div>
            </div>
          )}

          {/* Hole-by-hole mood tracker */}
          {activeRoundId && !isFrustrationMode && (
            <HoleMoodTracker roundId={activeRoundId} className="mx-4 mb-3" />
          )}

          {/* Messages Area - scrollable, takes remaining space */}
          <main
            className={cn(
              "flex-1 overflow-y-auto min-h-0",
              isFrustrationMode ? "py-16 flex items-center" : "py-10"
            )}
          >
            <div 
              className={cn(
                "max-w-2xl mx-auto w-full",
                "pb-[calc(180px+var(--sab))]",
                isFrustrationMode ? "space-y-8" : "space-y-6"
              )}
            >
              {displayMessages.map((message, index) => (
                <div
                  key={message.id}
                  className={cn(
                    "transition-all duration-500",
                    isFrustrationMode && !message.isUser && "animate-fade-in"
                  )}
                >
                  <ChatMessage
                    content={message.content}
                    isUser={message.isUser}
                    isLatest={index === displayMessages.length - 1}
                    messageId={message.id}
                    feedback={message.feedback}
                    onFeedback={setFeedback}
                    showFeedback={!isFrustrationMode && message.id !== "greeting"}
                    isFrustrationMode={isFrustrationMode}
                  />
                </div>
              ))}
              {isTyping && <TypingIndicator isFrustrationMode={isFrustrationMode} />}
              <div ref={messagesEndRef} />
            </div>
          </main>
        </div>

        {/* Input Area - docked at bottom */}
        <div className="chat-composer-dock shrink-0">
          <div className={cn("max-w-2xl mx-auto w-full", isFrustrationMode ? "space-y-4" : "space-y-5")}>
          <div className="rounded-3xl border border-foreground/10 bg-black/20 px-3 py-3 backdrop-blur-sm">
            {features.quick_tap ? (
              <div className="flex gap-2 overflow-x-auto overscroll-contain pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
                {EMOTION_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => void handleEmotionTap(tag)}
                    disabled={isTyping}
                    className="min-h-11 shrink-0 rounded-full border border-[var(--border)] bg-[rgba(18,64,47,0.42)] px-4 text-sm font-medium tracking-wide text-[var(--text-0)] transition-all duration-300 hover:bg-[rgba(18,64,47,0.62)] disabled:opacity-50"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                className="relative block w-full overflow-hidden rounded-2xl"
              >
                <div className="pointer-events-none flex gap-2 blur-[2px] opacity-65">
                  {EMOTION_TAGS.map((tag) => (
                    <div
                      key={tag}
                      className="min-h-11 shrink-0 rounded-full border border-[var(--border)] bg-[rgba(18,64,47,0.32)] px-4 text-xs font-medium tracking-wide text-[var(--text-0)] inline-flex items-center"
                    >
                      {tag}
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[rgba(5,8,7,0.18)]">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-black/25 text-[var(--sand-0)]">
                    <Lock className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-medium tracking-wide text-[var(--sand-0)]">
                    Pro only
                  </span>
                </div>
              </button>
            )}
          </div>
          {!features.unlimited_ai && aiMessagesRemaining !== null && (
            <button
              type="button"
              onClick={() => setShowUpgradeModal(true)}
              className="w-full rounded-2xl border border-[var(--border)] bg-black/15 px-4 py-3 text-left transition-all duration-300 hover:bg-black/25"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--sand-0)]">Free Plan</p>
              <p className="mt-1 text-sm text-[var(--text-1)]">
                {aiMessagesRemaining > 0
                  ? `${aiMessagesRemaining} live coaching messages left this round. Upgrade for unlimited AI.`
                  : "Free round limit reached. Upgrade for unlimited AI."}
              </p>
            </button>
          )}
          {/* Action buttons - only show in normal mode */}
          {!isFrustrationMode && (
            <div className="space-y-2">
              {/* Hole tip chip — only shows when a course is set */}
              {holeTipInfo && (
                <button
                  type="button"
                  disabled={isTyping}
                  onClick={handleHoleTip}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-[rgba(203,184,146,0.2)] bg-[rgba(203,184,146,0.07)] hover:bg-[rgba(203,184,146,0.12)] transition-all duration-200 disabled:opacity-50"
                >
                  <Flag className="w-4 h-4 text-[var(--sand-0)] shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="text-[10px] text-[var(--sand-0)] uppercase tracking-[0.16em]">
                      {holeTipInfo.course}
                    </p>
                    <p className="text-sm text-[var(--text-0)] font-medium leading-none mt-0.5">
                      Hole {holeTipInfo.hole} — get mental tip
                    </p>
                  </div>
                  <span className="text-[var(--text-2)] text-xs">→</span>
                </button>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    triggerHaptic("soft");
                    setLrmModalOpen(true);
                  }}
                  disabled={isTyping}
                  variant="outline"
                  className="flex-1 py-6 text-sm font-medium rounded-2xl border-foreground/10 bg-black/25 hover:bg-black/35 transition-all duration-300"
                  size="lg"
                >
                  <span className="flex items-center gap-3 text-white font-medium drop-shadow-sm">
                    <span className="relative flex items-center justify-center w-5 h-5">
                      <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping opacity-40" />
                      <span className="w-2 h-2 rounded-full bg-primary" />
                    </span>
                    Reset or Cue
                  </span>
                </Button>
                <Button
                  onClick={() => {
                    triggerHaptic("medium");
                    setPreShotOpen(true);
                  }}
                  variant="outline"
                  className="shrink-0 py-6 px-5 rounded-2xl border-foreground/10 bg-black/25 hover:bg-black/35 transition-all duration-300"
                  size="lg"
                >
                  <span className="flex items-center gap-2 text-white font-medium drop-shadow-sm">
                    <Wind className="w-5 h-5" />
                    <span className="text-sm">Breathe</span>
                  </span>
                </Button>
              </div>
            </div>
          )}
          
          <LRMModesModal open={lrmModalOpen} onOpenChange={setLrmModalOpen} />
          
          <ChatInput
            onSend={handleSendMessage}
            disabled={isTyping}
            placeholder={isFrustrationMode ? "Take your time..." : "Tell me what's happening on the course..."}
            isFrustrationMode={isFrustrationMode}
            className="rounded-2xl bg-[rgba(7,15,12,0.74)] border border-[var(--border)] px-3 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.32)]"
            inputClassName="min-h-[44px] rounded-xl"
            sendButtonClassName="h-11 w-11"
          />
          </div>
        </div>
      </AppShell>
      <Dialog
        open={endRoundDialogOpen}
        onOpenChange={(open) => {
          setEndRoundDialogOpen(open);
          if (!open) {
            setEndRoundStep("actions");
            setPostRoundFeeling(null);
          }
        }}
      >
        <DialogContent
          className="max-w-md rounded-[28px] border-[var(--border)] bg-[rgba(9,19,15,0.96)] p-0 text-[var(--text-0)] shadow-[0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-xl overflow-y-auto max-h-[90dvh]"
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="p-6">
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle className="text-2xl font-serif text-[var(--text-0)]">
                End this round?
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-[var(--text-1)]">
                You&apos;re about to end the round. What would you like to do next?
              </DialogDescription>
            </DialogHeader>

            {endRoundStep === "actions" ? (
              <div className="mt-6 space-y-3">
                <Button
                  type="button"
                  onClick={() => {
                    if (features.round_dna) {
                      setEndRoundDialogOpen(false);
                      navigate(`/post-round?roundId=${activeRoundId}`);
                      return;
                    }
                    setEndRoundDialogOpen(false);
                    setShowUpgradeModal(true);
                  }}
                  className="min-h-11 w-full rounded-2xl bg-primary/90 text-base"
                >
                  Go to Post-Round Reflection
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEndRoundStep("rating")}
                  className="min-h-11 w-full rounded-2xl border-[var(--border)] bg-[rgba(203,184,146,0.08)] text-[var(--sand-0)] hover:bg-[rgba(203,184,146,0.14)]"
                >
                  Just end round
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEndRoundDialogOpen(false)}
                  className="min-h-11 w-full rounded-2xl text-[var(--text-1)] hover:bg-white/5"
                >
                  Keep Round Going
                </Button>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-sm text-[var(--text-1)]">How did the round leave you feeling?</p>
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {Array.from({ length: 10 }, (_, index) => {
                      const score = index + 1;
                      const selected = postRoundFeeling === score;
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setPostRoundFeeling(score)}
                          className={cn(
                            "min-h-11 rounded-2xl border text-sm font-medium transition-all duration-200",
                            selected
                              ? "border-[rgba(203,184,146,0.28)] bg-[rgba(203,184,146,0.16)] text-[var(--sand-0)]"
                              : "border-[var(--border)] bg-[rgba(14,42,31,0.46)] text-[var(--text-1)] hover:bg-[rgba(18,64,47,0.58)]"
                          )}
                        >
                          {score}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-3">
                  <Button
                    type="button"
                    onClick={() => void finalizeEndRound()}
                    disabled={isEndingRound}
                    className="min-h-11 w-full rounded-2xl bg-primary/90 text-base"
                  >
                    {isEndingRound ? "Ending..." : "End Round"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEndRoundStep("actions")}
                    className="min-h-11 w-full rounded-2xl text-[var(--text-1)] hover:bg-white/5"
                  >
                    Back
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ProUpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />

      {/* Tier 1: Timed Check-In Card — hidden in Quick Mode */}
      {checkIn.isActive && !quickMode && (
        <CheckInCard
          message={checkIn.message}
          onEmotion={checkIn.respondWithEmotion}
          onDismiss={checkIn.dismiss}
        />
      )}

      {/* Tier 1: Pre-Shot Reset Breathing Overlay */}
      <PreShotReset
        open={preShotOpen}
        onClose={() => {
          setPreShotOpen(false);
          // Track usage for resilience scoring
          try { sessionStorage.setItem("round-used-pre-shot-reset", "true"); } catch { /* silent */ }
        }}
      />

      {/* Phase 3: Mental Score Reveal Card */}
      {revealData !== null && (
        <MentalScoreReveal
          moods={revealData.moods}
          onContinue={handleRevealContinue}
        />
      )}
      </div>
    </PageShell>
  );
};

export default Round;
