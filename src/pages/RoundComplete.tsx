import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { loadRoundContext, clearRoundContext } from "@/lib/roundContext";
import { loadHighlights } from "@/lib/memoryStorage";

const RoundComplete = () => {
  const navigate = useNavigate();
  const [fadeOut, setFadeOut] = useState(false);

  const roundContext = useMemo(() => loadRoundContext(), []);
  
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

  // Auto-redirect to Home after delay
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 3500);

    const redirectTimer = setTimeout(() => {
      clearRoundContext();
      navigate("/");
    }, 4500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(redirectTimer);
    };
  }, [navigate]);

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

            {/* Subtle return indicator */}
            <div className="pt-6 text-center">
              <p className="text-xs text-muted-foreground/40 tracking-wide">
                Returning home...
              </p>
            </div>
          </div>
        </main>
      </div>
    </PageShell>
  );
};

export default RoundComplete;
