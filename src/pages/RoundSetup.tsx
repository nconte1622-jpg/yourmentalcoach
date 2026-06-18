import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageShell } from "@/components/PageShell";
import { triggerHaptic } from "@/lib/haptics";
import { usePreRoundRecall } from "@/hooks/usePreRoundRecall";
import { useRounds, RoundType, RoundEnvironment } from "@/hooks/useRounds";
import { toast } from "sonner";
import { AppHeader } from "@/components/ui/AppHeader";
import { AppShell } from "@/components/ui/AppShell";
import { trackEvent } from "@/lib/analytics";
import { getDailyFocus } from "@/lib/dailyFocus";
import { GlassCard } from "@/components/ui/glass-card";
import { fetchAndCacheCourse } from "@/lib/courseData";

const RoundSetup = () => {
  const navigate = useNavigate();
  const { recallLine } = usePreRoundRecall();
  const { createRound, getActiveRound, discardRound } = useRounds();
  const [roundType, setRoundType] = useState<RoundType>("on-course");
  const [environment, setEnvironment] = useState<RoundEnvironment>("casual");
  const [location, setLocation] = useState("");
  const [goal, setGoal] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [activeRound, setActiveRound] = useState<{
    id: string;
    round_type: string;
    environment: string;
    created_at: string;
    goal: string | null;
  } | null>(null);
  const [dailyFocusText, setDailyFocusText] = useState<string | null>(null);
  const [gpsMode, setGpsMode] = useState<boolean>(() => {
    try { return localStorage.getItem("caddie-gps-mode") === "true"; } catch { return false; }
  });
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  const [showBeginnerGuide, setShowBeginnerGuide] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getActiveRound().then((round) => {
      if (!cancelled) {
        setActiveRound(
          round
            ? {
                id: round.id,
                round_type: round.round_type,
                environment: round.environment,
                created_at: round.created_at ?? round.started_at,
                goal: round.goal,
              }
            : null
        );
        setDailyFocusText(getDailyFocus()?.text ?? null);
      }
    });

    return () => {
      cancelled = true;
      setIsConfirmingDiscard(false);
    };
  }, []);

  const handleDiscardRound = async () => {
    if (!activeRound?.id) return;

    if (!isConfirmingDiscard) {
      setIsConfirmingDiscard(true);
      return;
    }

    setIsConfirmingDiscard(false);
    setIsDiscarding(true);
    try {
      const discarded = await discardRound(activeRound.id);
      if (discarded) {
        setActiveRound(null);
        toast.success("Active round discarded");
      } else {
        toast.error("Unable to discard active round");
      }
    } catch (error) {
      console.error("Failed to discard active round:", error);
      toast.error("Unable to discard active round");
    } finally {
      setIsDiscarding(false);
    }
  };

  const handleBeginRound = async () => {
    triggerHaptic("medium");
    setIsCreating(true);

    const createPayload = {
      round_type: roundType,
      environment,
      course_location: location.trim() || undefined,
      goal: goal.trim() || undefined,
      daily_focus: dailyFocusText ?? null,
    };

    // Pre-fetch course data in the background (non-blocking)
    // so the AI has hole-by-hole data ready during the round
    if (location.trim()) {
      const courseName = location.trim();
      const fetchToastId = `course-fetch-${Date.now()}`;
      toast.loading(`Loading hole data for ${courseName}…`, { id: fetchToastId, duration: 10000 });
      fetchAndCacheCourse(courseName).then((result) => {
        if (result) {
          toast.success(`${courseName} loaded — hole tips ready`, { id: fetchToastId, duration: 3000 });
        } else {
          // No API key or course not found — AI will use built-in knowledge, no error needed
          toast.dismiss(fetchToastId);
        }
      }).catch(() => {
        toast.dismiss(fetchToastId);
      });
    }

    try {
      const round = await createRound(createPayload);

      if (round) {
        trackEvent("round_started", {
          roundId: round.id,
          roundType: round.round_type,
          environment: round.environment,
        });
        toast.success("Round started");
        navigate(`/round?roundId=${round.id}`);
      } else {
        toast.error("Unable to start round.");
        setIsCreating(false);
      }
    } catch (err) {
      const error = err as {
        kind?: "schema" | "unknown";
        payload?: unknown;
        cause?: {
          code?: string;
          message?: string;
          details?: string;
          hint?: string;
        };
      };

      console.error("[RoundSetup] failed to create round", {
        error: err,
        payload: createPayload,
        code: error?.cause?.code,
        message: error?.cause?.message,
        details: error?.cause?.details,
        hint: error?.cause?.hint,
      });

      if (error?.kind === "schema") {
        toast.error("Round setup unavailable. Please update app data.");
      } else if (error?.cause?.message) {
        toast.error(error.cause.message);
      } else {
        toast.error("Unable to start round right now.");
      }
      setIsCreating(false);
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
                onClick={() => {
                  triggerHaptic("light");
                  navigate("/");
                }}
                className="header-hit-button tap-44 text-muted-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all duration-300"
              >
                ← Home
              </button>
            }
            center={
              <h1 className="text-base md:text-lg font-serif text-gradient-calm tracking-wide truncate">
                Start Round
              </h1>
            }
            right={<div className="tap-44" />}
          />
        }
      >
        <main className="flex-1 flex flex-col items-center justify-center pb-12">
          <div className="w-full max-w-md space-y-10 animate-fade-in">
            {/* Title */}
            <div className="text-center space-y-3 content-vignette">
              <h1 className="text-3xl md:text-4xl font-serif text-gradient-calm tracking-wide">
                Set Your Mind
              </h1>
              <p
                className="text-sm font-light tracking-wide helper-text"
                style={{ color: 'rgba(26,26,26,0.55)' }}
              >
                Define the mental context for this round
              </p>

              {/* Beginner guide toggle */}
              <div className="mx-auto max-w-sm">
                <button
                  type="button"
                  onClick={() => setShowBeginnerGuide(!showBeginnerGuide)}
                  className="w-full flex items-center justify-between gap-2 rounded-2xl border border-[rgba(45,106,79,0.12)] bg-[rgba(0,0,0,0.03)] px-4 py-3 text-left transition-all hover:bg-[rgba(0,0,0,0.04)]"
                >
                  <span className="text-xs text-[rgba(26,26,26,0.6)]">New to golf? Tap for a quick glossary</span>
                  <span className="text-[rgba(26,26,26,0.4)] text-xs shrink-0">{showBeginnerGuide ? "▲" : "▼"}</span>
                </button>
                {showBeginnerGuide && (
                  <div className="mt-2 rounded-2xl border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.04)] px-4 py-4 space-y-3 animate-fade-in text-left">
                    <p className="text-[10px] uppercase tracking-wider text-[#2d6a4f] font-medium">Quick glossary</p>
                    {[
                      { term: "On Course", def: "Playing real golf outside on a golf course" },
                      { term: "Simulator", def: "Playing indoors on a screen-based golf simulator" },
                      { term: "Range / Practice", def: "Hitting balls at a driving range, no scorecard" },
                      { term: "Casual", def: "Playing for fun — no tournament, no pressure" },
                      { term: "Competitive", def: "Playing in a club match, bet, or tournament" },
                      { term: "Scoring", def: "Tracking your strokes carefully for your handicap" },
                      { term: "Par", def: "The expected number of strokes for a hole (usually 3, 4, or 5)" },
                      { term: "Handicap", def: "A number showing your skill level — lower is better" },
                    ].map(({ term, def }) => (
                      <div key={term} className="flex gap-2">
                        <span className="text-xs font-medium text-[#2d6a4f] min-w-[90px] shrink-0">{term}</span>
                        <span className="text-xs text-[rgba(26,26,26,0.6)] leading-5">{def}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Pro Recall Line - subtle, non-intrusive */}
              {recallLine && (
                <p 
                  className="text-xs font-light italic mt-3 animate-fade-in" 
                  style={{ animationDelay: '0.3s', color: 'rgba(26,26,26,0.4)' }}
                >
                  {recallLine}
                </p>
              )}

              {activeRound && (
                <GlassCard className="mx-auto max-w-sm p-4 text-left">
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "#1a5c2e" }}>
                        Active Round
                      </p>
                      <p className="mt-1 text-sm leading-6" style={{ color: "#0f1f0f" }}>
                        {activeRound.round_type.replace("-", " ")} · {activeRound.environment}
                      </p>
                      {activeRound.goal && (
                        <p className="text-sm" style={{ color: "#2d4d2d" }}>
                          Goal: {activeRound.goal}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isConfirmingDiscard ? (
                        <>
                          <button
                            type="button"
                            onClick={() => navigate(`/round?roundId=${activeRound.id}`)}
                            className="inline-flex min-h-11 items-center justify-center rounded-full border border-primary/25 bg-primary/8 px-4 py-2 text-xs font-medium tracking-wide text-primary transition-all duration-300 hover:bg-primary/12"
                          >
                            Resume current round
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDiscardRound()}
                            disabled={isDiscarding}
                            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] px-4 py-2 text-xs font-medium tracking-wide text-[#2d6a4f] transition-all duration-300 hover:bg-[rgba(45,106,79,0.06)] disabled:opacity-60"
                          >
                            {isDiscarding ? "Ending..." : "End current round"}
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="w-full text-xs text-[#2d6a4f] mb-1">
                            This will discard the round and clear its chat history. Continue?
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsConfirmingDiscard(false)}
                            className="inline-flex min-h-11 items-center justify-center rounded-full border border-primary/25 bg-primary/8 px-4 py-2 text-xs font-medium tracking-wide text-primary transition-all duration-300 hover:bg-primary/12"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDiscardRound()}
                            disabled={isDiscarding}
                            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] px-4 py-2 text-xs font-medium tracking-wide text-[#2d6a4f] transition-all duration-300 hover:bg-[rgba(45,106,79,0.06)] disabled:opacity-60"
                          >
                            {isDiscarding ? "Ending..." : "Yes, discard"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </GlassCard>
              )}

              {dailyFocusText && (
                <div className="mx-auto max-w-sm rounded-2xl border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] px-4 py-3 text-left shadow-[0_10px_25px_rgba(0,0,0,0.12)]">
                  <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "#1a5c2e" }}>
                    Active Focus
                  </p>
                  <p className="mt-1 text-sm leading-6" style={{ color: "#0f1f0f" }}>
                    {dailyFocusText}
                  </p>
                </div>
              )}
            </div>

            {/* Round Type */}
            <div className="space-y-4">
              <label 
                className="text-sm tracking-wide font-light helper-text"
                style={{ color: '#2d4d2d' }}
              >
                Round Type
              </label>
              <RadioGroup
                value={roundType}
                onValueChange={(value) => setRoundType(value as RoundType)}
                className="flex flex-col gap-3"
              >
                <label
                  className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300 ${
                    roundType === "on-course"
                      ? "bg-white/95 border-2 border-primary/50 shadow-md shadow-primary/15 ring-2 ring-primary/10 ring-inset"
                      : "bg-white/88 shadow-inner shadow-foreground/5 hover:bg-white/92 hover:shadow-sm border border-foreground/8 hover:border-foreground/12"
                  }`}
                >
                  <RadioGroupItem value="on-course" id="on-course" />
                  <span 
                    className={`tracking-wide transition-all duration-300 ${roundType === "on-course" ? "font-medium" : "font-[450]"}`}
                    style={{ color: roundType === "on-course" ? '#0F172A' : '#5a7a5a' }}
                  >On Course</span>
                </label>
                <label
                  className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300 ${
                    roundType === "simulator"
                      ? "bg-white/95 border-2 border-primary/50 shadow-md shadow-primary/15 ring-2 ring-primary/10 ring-inset"
                      : "bg-white/88 shadow-inner shadow-foreground/5 hover:bg-white/92 hover:shadow-sm border border-foreground/8 hover:border-foreground/12"
                  }`}
                >
                  <RadioGroupItem value="simulator" id="simulator" />
                  <span 
                    className={`tracking-wide transition-all duration-300 ${roundType === "simulator" ? "font-medium" : "font-[450]"}`}
                    style={{ color: roundType === "simulator" ? '#0F172A' : '#5a7a5a' }}
                  >Simulator</span>
                </label>
                <label
                  className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300 ${
                    roundType === "practice"
                      ? "bg-white/95 border-2 border-primary/50 shadow-md shadow-primary/15 ring-2 ring-primary/10 ring-inset"
                      : "bg-white/88 shadow-inner shadow-foreground/5 hover:bg-white/92 hover:shadow-sm border border-foreground/8 hover:border-foreground/12"
                  }`}
                >
                  <RadioGroupItem value="practice" id="practice" />
                  <span 
                    className={`tracking-wide transition-all duration-300 ${roundType === "practice" ? "font-medium" : "font-[450]"}`}
                    style={{ color: roundType === "practice" ? '#0F172A' : '#5a7a5a' }}
                  >Range / Practice</span>
                </label>
              </RadioGroup>
            </div>

            {/* Environment */}
            <div className="space-y-4">
              <label 
                className="text-sm tracking-wide font-light helper-text"
                style={{ color: '#2d4d2d' }}
              >
                Environment
              </label>
              <RadioGroup
                value={environment}
                onValueChange={(value) => setEnvironment(value as RoundEnvironment)}
                className="flex flex-col gap-3"
              >
                <label
                  className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300 ${
                    environment === "casual"
                      ? "bg-white/95 border-2 border-primary/50 shadow-md shadow-primary/15 ring-2 ring-primary/10 ring-inset"
                      : "bg-white/88 shadow-inner shadow-foreground/5 hover:bg-white/92 hover:shadow-sm border border-foreground/8 hover:border-foreground/12"
                  }`}
                >
                  <RadioGroupItem value="casual" id="casual" />
                  <span 
                    className={`tracking-wide transition-all duration-300 ${environment === "casual" ? "font-medium" : "font-[450]"}`}
                    style={{ color: environment === "casual" ? '#0F172A' : '#5a7a5a' }}
                  >Casual</span>
                </label>
                <label
                  className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300 ${
                    environment === "competitive"
                      ? "bg-white/95 border-2 border-primary/50 shadow-md shadow-primary/15 ring-2 ring-primary/10 ring-inset"
                      : "bg-white/88 shadow-inner shadow-foreground/5 hover:bg-white/92 hover:shadow-sm border border-foreground/8 hover:border-foreground/12"
                  }`}
                >
                  <RadioGroupItem value="competitive" id="competitive" />
                  <span 
                    className={`tracking-wide transition-all duration-300 ${environment === "competitive" ? "font-medium" : "font-[450]"}`}
                    style={{ color: environment === "competitive" ? '#0F172A' : '#5a7a5a' }}
                  >Competitive</span>
                </label>
                <label
                  className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300 ${
                    environment === "scoring"
                      ? "bg-white/95 border-2 border-primary/50 shadow-md shadow-primary/15 ring-2 ring-primary/10 ring-inset"
                      : "bg-white/88 shadow-inner shadow-foreground/5 hover:bg-white/92 hover:shadow-sm border border-foreground/8 hover:border-foreground/12"
                  }`}
                >
                  <RadioGroupItem value="scoring" id="scoring" />
                  <span 
                    className={`tracking-wide transition-all duration-300 ${environment === "scoring" ? "font-medium" : "font-[450]"}`}
                    style={{ color: environment === "scoring" ? '#0F172A' : '#5a7a5a' }}
                  >Scoring</span>
                </label>
              </RadioGroup>
            </div>

            {/* Location (Optional) */}
            <div className="space-y-4">
              <label 
                className="text-sm tracking-wide font-light helper-text"
                style={{ color: '#2d4d2d' }}
              >
                Course Name{" "}
                <span style={{ color: '#5a7a5a' }}>(your coach gives hole-specific tips)</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bethpage Black, Pebble Beach, my local muni"
                maxLength={80}
                className="w-full p-4 rounded-2xl bg-white/90 border border-foreground/12 shadow-inner shadow-foreground/5 text-foreground placeholder:text-foreground/45 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 focus:bg-white/95 focus:shadow-md focus:scale-[1.01] origin-center transition-all duration-300 tracking-wide disabled:bg-white/50 disabled:text-foreground/40 hover:bg-white/95 hover:border-foreground/18"
              />
            </div>

            {/* Today's Goal (Optional) */}
            <div className="space-y-4">
              <label 
                className="text-sm tracking-wide font-light helper-text"
                style={{ color: '#2d4d2d' }}
              >
                Goal for Today{" "}
                <span style={{ color: '#5a7a5a' }}>(optional)</span>
              </label>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g., Stay patient on the greens"
                maxLength={60}
                className="w-full p-4 rounded-2xl bg-white/90 border border-foreground/12 shadow-inner shadow-foreground/5 text-foreground placeholder:text-foreground/45 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 focus:bg-white/95 focus:shadow-md focus:scale-[1.01] origin-center transition-all duration-300 tracking-wide disabled:bg-white/50 disabled:text-foreground/40 hover:bg-white/95 hover:border-foreground/18"
              />
            </div>

            {/* GPS Smart Round Mode toggle — on-course only */}
            {roundType === "on-course" && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("soft");
                    const next = !gpsMode;
                    setGpsMode(next);
                    try { localStorage.setItem("caddie-gps-mode", String(next)); } catch { /* silent */ }
                  }}
                  className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-4 transition-all duration-200 active:scale-[0.98] ${
                    gpsMode
                      ? "border-[#1a5c2e]/40 bg-[#1a5c2e]/10"
                      : "border-[#c8ddc8] bg-white/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📍</span>
                    <div className="text-left">
                      <p className={`text-sm font-medium ${gpsMode ? "text-[#2d6a4f]" : "text-[rgba(26,26,26,0.6)]"}`}>
                        GPS Smart Mode
                      </p>
                      <p className="text-xs text-[rgba(26,26,26,0.4)] mt-0.5">
                        {gpsMode
                          ? "On — your caddie will check in hole by hole"
                          : "Detects hole transitions, asks how each hole went"}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`relative h-6 w-11 rounded-full transition-all duration-200 ${
                      gpsMode ? "bg-[rgba(45,106,79,0.5)]" : "bg-[rgba(0,0,0,0.08)]"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
                        gpsMode ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </div>
                </button>
              </div>
            )}

            {/* Begin Round Button */}
            <div className="pt-4">
              <Button
                onClick={handleBeginRound}
                disabled={isCreating || Boolean(activeRound)}
                className="w-full py-8 text-lg font-medium rounded-3xl shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 btn-press"
                size="lg"
              >
                {isCreating ? "Starting..." : activeRound ? "End current round to start new" : "Begin Round"}
              </Button>
            </div>
          </div>
        </main>
      </AppShell>
    </PageShell>
  );
};

export default RoundSetup;
