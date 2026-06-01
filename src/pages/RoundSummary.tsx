import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/PageShell";
import { triggerHaptic } from "@/lib/haptics";
import { loadRoundContext, clearRoundContext, saveRoundToHistory } from "@/lib/roundContext";
import { loadHighlights } from "@/lib/memoryStorage";
import { getCoachResponse } from "@/lib/mentalCoachApi";
import { format } from "date-fns";

const RoundSummary = () => {
  const navigate = useNavigate();
  const [mentalTakeaway, setMentalTakeaway] = useState("");
  const [isGenerating, setIsGenerating] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const roundContext = useMemo(() => loadRoundContext(), []);
  
  // Get highlights from today's round (within the last 24 hours from round start)
  const todaysHighlights = useMemo(() => {
    const allHighlights = loadHighlights();
    if (!roundContext?.startedAt) return allHighlights.slice(-3); // fallback to last 3
    
    const roundStart = new Date(roundContext.startedAt);
    const roundStartMs = roundStart.getTime();
    
    // Filter highlights created after round started
    return allHighlights.filter((h) => {
      const highlightDate = new Date(h.date);
      return highlightDate.getTime() >= roundStartMs;
    });
  }, [roundContext]);

  // Generate mental takeaway
  useEffect(() => {
    const generateTakeaway = async () => {
      try {
        const context = roundContext;
        const highlights = todaysHighlights;
        
        // Build context for LLM
        const highlightSummary = highlights.length > 0 
          ? highlights.map(h => `${h.contextTag}: ${h.cueWord}`).join(", ")
          : "no specific moments saved";
        
        const intent = context?.intent || "no specific intent set";
        const envLabel = context?.environment === "competitive" 
          ? "competitive" 
          : context?.environment === "scoring" 
            ? "scoring focused" 
            : "casual";

        const content = await getCoachResponse({
          messages: [
            {
              role: "user",
              content: `Generate a single-sentence mental takeaway for my round. Environment: ${envLabel}. Intent: ${intent}. Key moments: ${highlightSummary}. Keep it reflective and grounded, not celebratory.`,
            },
          ],
          context: "locker-room",
        });
        setMentalTakeaway(content);
        setIsGenerating(false);
      } catch (error) {
        console.error("Failed to generate takeaway:", error);
        setMentalTakeaway("Every round teaches something. Carry the lesson forward.");
        setIsGenerating(false);
      }
    };

    generateTakeaway();
  }, [roundContext, todaysHighlights]);

  const handleSaveRound = () => {
    triggerHaptic("medium");
    
    if (roundContext) {
      saveRoundToHistory({
        date: new Date().toISOString(),
        roundType: roundContext.roundType,
        environment: roundContext.environment,
        location: roundContext.location,
        intent: roundContext.intent,
        mentalTakeaway: mentalTakeaway.replace(/{{[^}]+:([^}]+)}}/g, "$1"), // strip formatting
        highlightIds: todaysHighlights.map((h) => h.id),
      });
    }
    
    clearRoundContext();
    setIsSaved(true);
    
    setTimeout(() => {
      navigate("/");
    }, 1500);
  };

  const handleSkip = () => {
    clearRoundContext();
    navigate("/");
  };

  const renderContent = (text: string) => {
    const parts = text.split(/({{[^}]+}})/g);
    return parts.map((part, index) => {
      const match = part.match(/{{(focus|calm):([^}]+)}}/);
      if (match) {
        const [, type, word] = match;
        const colorClass = type === "focus" ? "text-cue-focus" : "text-cue-calm";
        return (
          <span key={index} className={`font-medium ${colorClass}`}>
            {word}
          </span>
        );
      }
      return part;
    });
  };

  const typeLabels = {
    "on-course": "On Course",
    "simulator": "Simulator",
    "practice": "Practice",
  };

  const envLabels = {
    "casual": "Casual",
    "competitive": "Competitive",
    "scoring": "Scoring",
  };

  if (isSaved) {
    return (
      <PageShell backgroundVariant="default">
        <div className="flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center animate-fade-in">
              <p className="text-lg text-foreground/70">✓ Round saved.</p>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell backgroundVariant="default">
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="py-6 px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-muted-foreground/60 hover:text-foreground hover:bg-transparent transition-all duration-300"
          >
            ← Skip
          </Button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md space-y-10 animate-fade-in">
            {/* Title */}
            <div className="text-center space-y-3">
              <h1 className="text-3xl md:text-4xl font-serif text-gradient-calm tracking-wide">
                Round Complete
              </h1>
              <p className="text-sm text-muted-foreground/60 font-light tracking-wide">
                {format(new Date(), "EEEE, MMMM d")}
              </p>
              {roundContext?.location && (
                <p className="text-sm text-muted-foreground/50 tracking-wide">
                  {roundContext.location}
                </p>
              )}
            </div>

            {/* Today's Intent */}
            {roundContext?.intent && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground/50 tracking-widest uppercase font-light">
                  Today's Intent
                </p>
                <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-5 border border-border/10">
                  <p className="text-base text-foreground/80 tracking-wide italic">
                    "{roundContext.intent}"
                  </p>
                </div>
              </div>
            )}

            {/* Round Details */}
            {roundContext && (
              <div className="flex gap-3 justify-center">
                <span className="px-4 py-2 rounded-full bg-card/40 text-sm text-muted-foreground/70 tracking-wide">
                  {typeLabels[roundContext.roundType]}
                </span>
                <span className="px-4 py-2 rounded-full bg-card/40 text-sm text-muted-foreground/70 tracking-wide">
                  {envLabels[roundContext.environment]}
                </span>
              </div>
            )}

            {/* Saved Highlights */}
            {todaysHighlights.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground/50 tracking-widest uppercase font-light">
                  Saved Highlights
                </p>
                <div className="space-y-2">
                  {todaysHighlights.map((highlight) => (
                    <div
                      key={highlight.id}
                      className="bg-card/40 rounded-xl p-4 border border-border/10"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground/40 tracking-wide">
                          {highlight.contextTag}
                        </span>
                        <span className="text-foreground/70">→</span>
                        <span className="font-medium text-cue-focus tracking-wide">
                          {highlight.cueWord}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mental Takeaway */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground/50 tracking-widest uppercase font-light">
                Mental Takeaway
              </p>
              <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-6 border border-border/10">
                {isGenerating ? (
                  <div className="flex justify-center gap-1.5 py-2">
                    <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-breathe" />
                    <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-breathe" style={{ animationDelay: "0.3s" }} />
                    <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-breathe" style={{ animationDelay: "0.6s" }} />
                  </div>
                ) : (
                  <p className="text-base text-foreground/80 leading-relaxed tracking-wide">
                    {renderContent(mentalTakeaway)}
                  </p>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 space-y-4">
              <Button
                onClick={handleSaveRound}
                disabled={isGenerating}
                className="w-full py-8 text-lg font-medium rounded-3xl shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 btn-press"
                size="lg"
              >
                Save to History
              </Button>
              <button
                onClick={handleSkip}
                className="w-full text-sm text-muted-foreground/50 hover:text-muted-foreground/70 transition-all duration-300 py-2"
              >
                Close without saving
              </button>
            </div>
          </div>
        </main>
      </div>
    </PageShell>
  );
};

export default RoundSummary;
