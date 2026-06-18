import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { loadRoundContext, clearRoundContext } from "@/lib/roundContext";
import { loadHighlights, loadPreferredWords } from "@/lib/memoryStorage";
import { getStreakData } from "@/lib/streakStorage";
import { ShareRoundCard } from "@/components/ShareRoundCard";
import { loadResilienceScores } from "@/lib/resilienceScore";
import { schedulePostRoundPrompt } from "@/lib/notifications";
import { generateRoundWord, loadRoundWord, clearRoundWord } from "@/lib/roundWord";
import { buildSnapshotFromRoundData, updateRoundMemory } from "@/lib/playerMemory";
import { loadActiveRoundSession } from "@/lib/roundSession";
import { incrementCompletedRounds, maybeRequestReview } from "@/lib/appReview";

const RoundComplete = () => {
  const navigate = useNavigate();
  const [fadeOut, setFadeOut] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [roundWord, setRoundWord] = useState<string | null>(() => loadRoundWord()?.word ?? null);
  // Cancel auto-redirect timers when user taps the manual button
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleGoHome = useCallback(() => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    setDismissed(true);
    clearRoundContext();
    navigate("/");
  }, [navigate]);

  const roundContext = useMemo(() => loadRoundContext(), []);
  const latestScore = useMemo(() => {
    const scores = loadResilienceScores();
    return scores.length > 0 ? scores[scores.length - 1].score : 50;
  }, []);
  const cueWord = useMemo(() => {
    try { return loadPreferredWords()[0] ?? null; } catch { return null; }
  }, []);
  const streak = useMemo(() => getStreakData().currentStreak, []);

  // Schedule a post-round reflection nudge for next app open
  useEffect(() => { schedulePostRoundPrompt(); }, []);

  // Increment completed-round counter and maybe request App Store review
  useEffect(() => {
    incrementCompletedRounds();
    void maybeRequestReview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist round memory snapshot for adaptive AI
  useEffect(() => {
    try {
      const session = loadActiveRoundSession();
      if (!roundContext) return;
      const snapshot = buildSnapshotFromRoundData({
        roundId: session?.roundId ?? `round-${Date.now()}`,
        location: roundContext.location,
        roundType: roundContext.roundType,
        environment: roundContext.environment,
        mentalTakeaway: roundContext.intent ?? "",
        emotionalStart: "neutral", // populated by GPS tracker when available
        emotionalFinish: "neutral",
        biggestChallenge: "",
        bestMoment: todaysHighlights[0]
          ? `Committed to "${todaysHighlights[0].cueWord}" on a key shot`
          : "",
        cueWordUsed: cueWord ?? undefined,
        mentalHandicap: latestScore,
      });
      updateRoundMemory(snapshot);
    } catch { /* never crash round complete screen */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generate AI round word on mount (non-blocking)
  useEffect(() => {
    if (roundWord) return; // Already generated (e.g. from prior load)
    clearRoundWord();
    generateRoundWord().then((word) => {
      setRoundWord(word);
    }).catch(() => {
      // Silently ignore — share card still works without word
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Get highlights from today's round
  const todaysHighlights = useMemo(() => {
    const allHighlights = loadHighlights();
    if (!roundContext?.startedAt) return allHighlights.slice(-2);
    
    const roundStart = new Date(roundContext.startedAt);
    const roundStartMs = roundStart.getTime();
    
    return allHighlights.filter((h) => {
      const highlightDate = new Date(h.date);
      return highlightDate.getTime() >= roundStartMs;
    });
  }, [roundContext]);

  // Generate 2 summary bullets based on available context
  const summaryBullets = useMemo(() => {
    const bullets: string[] = [];
    
    // First bullet: based on intent or cue word
    if (todaysHighlights.length > 0) {
      const highlight = todaysHighlights[0];
      bullets.push(`You committed to "${highlight.cueWord}" when it mattered.`);
    } else if (roundContext?.intent) {
      bullets.push(`You set an intention and stayed present.`);
    } else {
      bullets.push(`Another round in the books.`);
    }
    
    // Second bullet: forward-looking
    if (todaysHighlights.length > 0) {
      bullets.push(`This memory is saved for next time.`);
    } else {
      bullets.push(`Every round builds awareness.`);
    }
    
    return bullets;
  }, [roundContext, todaysHighlights]);

  // Auto-redirect to Home after delay (cancelled if user taps button)
  useEffect(() => {
    if (dismissed) return;

    fadeTimerRef.current = setTimeout(() => {
      setFadeOut(true);
    }, 3500);

    redirectTimerRef.current = setTimeout(() => {
      clearRoundContext();
      navigate("/");
    }, 4500);

    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [dismissed, navigate]);

  return (
    <PageShell backgroundVariant="default">
      <div
        className={`flex flex-col h-full transition-opacity duration-1000 ${
          fadeOut ? "opacity-0" : "opacity-100"
        }`}
      >
        <main className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="w-full max-w-sm space-y-10 animate-fade-in">
            {/* Calm checkmark */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <svg 
                  className="w-8 h-8 text-primary/70" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M5 13l4 4L19 7" 
                  />
                </svg>
              </div>
            </div>

            {/* Main message */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-serif text-foreground/90 tracking-wide">
                Round saved. Good work.
              </h1>
            </div>

            {/* Hero round-word reveal — fades in + scales 0.8→1.0 with a gold glow */}
            {roundWord && (
              <div className="text-center space-y-1.5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#2d6a4f] opacity-50">
                  You kept yourself
                </p>
                <p
                  key={roundWord}
                  className="round-word-reveal font-serif text-[44px] leading-none tracking-wide text-[#2d6a4f]"
                >
                  {roundWord}
                </p>
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#2d6a4f] opacity-50">
                  today
                </p>
              </div>
            )}

            {/* Summary bullets */}
            <div className="space-y-4 py-4">
              {summaryBullets.map((bullet, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 animate-fade-in"
                  style={{ animationDelay: `${(index + 1) * 300}ms` }}
                >
                  <span className="text-primary/50 mt-0.5">•</span>
                  <p className="text-base text-muted-foreground/70 leading-relaxed">
                    {bullet}
                  </p>
                </div>
              ))}
            </div>

            {/* Share card — organic social growth */}
            <div className="w-full max-w-xs">
              <ShareRoundCard
                score={latestScore}
                cueWord={cueWord}
                streak={streak}
                roundWord={roundWord}
                onDismiss={handleGoHome}
              />
            </div>

            {/* Manual continue button + subtle auto-return indicator */}
            <div className="pt-2 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleGoHome}
                className="min-h-[44px] w-full max-w-xs rounded-2xl border border-foreground/12 bg-foreground/5 px-6 py-3 text-sm font-medium text-muted-foreground/70 transition-all duration-200 hover:bg-foreground/8 hover:text-foreground/90 active:scale-[0.97]"
              >
                Go Home
              </button>
              <p className="text-xs text-muted-foreground/35 tracking-wide">
                Auto-returning in a moment…
              </p>
            </div>
          </div>
        </main>
      </div>
    </PageShell>
  );
};

export default RoundComplete;
