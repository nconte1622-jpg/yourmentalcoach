import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { LRMIndicator } from "@/components/LRMIndicator";
import { PageShell } from "@/components/PageShell";
import { useMentalCoach } from "@/hooks/useMentalCoach";
import { useRounds } from "@/hooks/useRounds";
import { useEffect, useRef, useState, useCallback } from "react";
import { triggerHaptic } from "@/lib/haptics";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { cn } from "@/lib/utils";
import { extractAndSaveQuickEndData } from "@/lib/quickEndRound";
import { clearActiveRoundSession, clearRoundMessages } from "@/lib/roundSession";
import { recordCompletedRound } from "@/lib/streakStorage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function RoundCloseStrong() {
  const navigate = useNavigate();
  const location = useLocation();
  const { messages = [], isTyping, sendMessage, getQuickCue, setFeedback } = useMentalCoach({
    sessionPrefix: "close-strong",
  });
  const { getActiveRound, createRoundEvent, updateRound } = useRounds();
  const hasTriggeredCue = useRef(false);
  const [triggerReason, setTriggerReason] = useState<string | null>(null);
  const [endRoundDialogOpen, setEndRoundDialogOpen] = useState(false);
  const [endRoundStep, setEndRoundStep] = useState<"actions" | "rating">("actions");
  const [postRoundFeeling, setPostRoundFeeling] = useState<number | null>(null);
  const [isEndingRound, setIsEndingRound] = useState(false);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getActiveRound().then((round) => {
      if (!cancelled && round) {
        setActiveRoundId(round.id);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const stateReason = location.state?.triggerReason;
    const storedReason = sessionStorage.getItem("closeStrongTriggerReason");

    if (stateReason) {
      setTriggerReason(stateReason);
    } else if (storedReason) {
      setTriggerReason(storedReason);
      sessionStorage.removeItem("closeStrongTriggerReason");
    }
  }, [location.state]);

  useEffect(() => {
    if (!hasTriggeredCue.current) {
      hasTriggeredCue.current = true;
      triggerHaptic("medium");

      const initialMessage = location.state?.initialMessage;
      if (initialMessage) {
        sendMessage(initialMessage);
      } else {
        sendMessage("I'm in the closing stretch. Help me finish strong.");
      }
    }
  }, [location.state, sendMessage]);

  const handleBack = () => {
    triggerHaptic("light");
    navigate("/");
  };

  const handleAnotherCue = () => {
    triggerHaptic("medium");
    getQuickCue("close-strong");
  };

  const finalizeEndRound = useCallback(async () => {
    if (!activeRoundId) {
      navigate("/");
      return;
    }

    setIsEndingRound(true);

    // Local-first: extract chat data + record the streak with no network dependency.
    extractAndSaveQuickEndData(activeRoundId);
    recordCompletedRound();

    // Post-round feeling is non-critical telemetry — fire and forget so it can
    // never hang the "End Round" flow.
    void createRoundEvent({
      round_id: activeRoundId,
      event_type: "note",
      label: "post_round_feeling",
      notes: JSON.stringify({
        feeling_score: postRoundFeeling,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => { /* non-critical */ });

    // Persist the close, but never let a slow/failed request trap the user behind
    // an "Ending..." spinner. Race the DB write against a hard timeout; either way
    // we clear the local active-round state and head home.
    const ENDED_TIMEOUT_MS = 6000;
    try {
      await Promise.race([
        updateRound(activeRoundId, {
          ended_at: new Date().toISOString(),
          status: "completed",
        }),
        new Promise((resolve) => setTimeout(resolve, ENDED_TIMEOUT_MS)),
      ]);
    } catch (error) {
      console.error("Failed to end active round:", error);
    }

    clearActiveRoundSession();
    clearRoundMessages(activeRoundId);

    setIsEndingRound(false);
    setEndRoundDialogOpen(false);
    navigate("/", { replace: true });
  }, [activeRoundId, createRoundEvent, navigate, postRoundFeeling, updateRound]);

  const recentMessages = messages.slice(-4);

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
                className="header-hit-button tap-44 text-[rgba(26,26,26,0.6)] hover:text-[#1a1a1a] hover:bg-[rgba(0,0,0,0.03)] transition-all duration-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Home
              </button>
            }
            center={
              <div className="mx-auto max-w-[240px]">
                <h1 className="truncate text-base md:text-lg font-serif tracking-wide text-[#1a1a1a] text-center">
                  Close Strong
                </h1>
              </div>
            }
            right={
              <button
                type="button"
                onClick={() => {
                  setEndRoundStep("actions");
                  setEndRoundDialogOpen(true);
                }}
                className="header-hit-button tap-44 text-[11px] uppercase tracking-[0.16em] text-[#2d6a4f] transition-all duration-300 hover:bg-[rgba(0,0,0,0.03)]"
              >
                End
              </button>
            }
            subrow={
              triggerReason ? (
                <p className="text-[10px] text-[rgba(26,26,26,0.4)] tracking-[0.18em] uppercase">{triggerReason}</p>
              ) : null
            }
          />
        }
      >
        <main className="flex-1 flex flex-col overflow-y-auto min-h-0 pb-6">
          <div className="w-full max-w-md mx-auto space-y-4 flex-1 pt-6">
            {recentMessages.map((message, index) => (
              <ChatMessage
                key={message.id}
                content={message.content}
                isUser={message.isUser}
                isLatest={index === recentMessages.length - 1 && !message.isUser}
                messageId={message.id}
                feedback={message.feedback}
                onFeedback={setFeedback}
                showFeedback={!message.isUser}
                theme="light"
              />
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="rounded-3xl rounded-bl-xl px-6 py-4 bg-[rgba(45,106,79,0.06)] backdrop-blur-sm border border-[rgba(45,106,79,0.08)]">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-[rgba(26,26,26,0.2)] rounded-full animate-pulse" />
                    <span className="w-2 h-2 bg-[rgba(26,26,26,0.2)] rounded-full animate-pulse delay-75" />
                    <span className="w-2 h-2 bg-[rgba(26,26,26,0.2)] rounded-full animate-pulse delay-150" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {messages.length > 0 && !isTyping && (
            <div className="text-center pt-6 shrink-0">
              <button
                onClick={handleAnotherCue}
                className="px-6 py-3 rounded-2xl bg-[rgba(45,106,79,0.06)] text-[#2d6a4f] text-sm font-medium hover:bg-[rgba(45,106,79,0.1)] transition-all duration-300 border border-[rgba(45,106,79,0.1)]"
              >
                Another Cue
              </button>
            </div>
          )}
        </main>

        <div className="shrink-0 p-4">
          <div className="max-w-md mx-auto">
            <ChatInput
              onSend={sendMessage}
              disabled={isTyping}
              placeholder="What's the situation?"
              theme="light"
            />
          </div>
        </div>
      </AppShell>

      {/* End Round Dialog */}
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
        <DialogContent className="max-w-md rounded-[28px] border-[rgba(45,106,79,0.12)] bg-white p-0 text-[#1a1a1a] shadow-[0_24px_60px_rgba(0,0,0,0.1)] backdrop-blur-xl">
          <div className="p-6">
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle className="text-2xl font-serif text-[#1a1a1a]">
                End this round?
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-[rgba(26,26,26,0.6)]">
                Great finish. Ready to wrap up?
              </DialogDescription>
            </DialogHeader>

            {endRoundStep === "actions" ? (
              <div className="mt-6 space-y-3">
                <Button
                  type="button"
                  onClick={() => {
                    setEndRoundDialogOpen(false);
                    navigate(`/post-round?roundId=${activeRoundId}`);
                  }}
                  className="min-h-11 w-full rounded-2xl bg-primary/90 text-base"
                >
                  Go to Post-Round Reflection
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEndRoundStep("rating")}
                  className="min-h-11 w-full rounded-2xl border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] text-[#2d6a4f] hover:bg-[rgba(45,106,79,0.1)]"
                >
                  Just end round
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEndRoundDialogOpen(false)}
                  className="min-h-11 w-full rounded-2xl text-[rgba(26,26,26,0.6)] hover:bg-[rgba(0,0,0,0.03)]"
                >
                  Keep Going
                </Button>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-sm text-[rgba(26,26,26,0.6)]">How did the round leave you feeling?</p>
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
                              ? "border-[rgba(45,106,79,0.2)] bg-[rgba(45,106,79,0.1)] text-[#2d6a4f]"
                              : "border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.04)] text-[rgba(26,26,26,0.6)] hover:bg-[rgba(45,106,79,0.08)]"
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
                    className="min-h-11 w-full rounded-2xl text-[rgba(26,26,26,0.6)] hover:bg-[rgba(0,0,0,0.03)]"
                  >
                    Back
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
