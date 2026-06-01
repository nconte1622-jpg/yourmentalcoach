/**
 * Round Briefing Card — Tier 2 Feature
 *
 * Shows at the top of the Round page when a round begins.
 * Pulls from round history and insight journal to surface pattern-based warnings.
 * Displays 1-3 short pattern-based observations like:
 * - "Last 3 rounds: frustration tends to spike after hole 10"
 * - "Your stated goal: stay patient on par 3s"
 * - "Cue word that's been working: trust"
 */

import { useMemo } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadRoundHistory } from "@/lib/roundContext";
import { loadJournal } from "@/lib/insightJournal";
import { loadPreferredWords } from "@/lib/memoryStorage";
import { getBack9Warning } from "@/lib/back9Detection";

interface RoundBriefingCardProps {
  onDismiss: () => void;
  className?: string;
}

interface BriefingItem {
  icon: string;
  text: string;
}

export const RoundBriefingCard = ({ onDismiss, className }: RoundBriefingCardProps) => {
  const briefingItems = useMemo(() => {
    const items: BriefingItem[] = [];

    // 1. Back-9 warning from cross-round pattern detection
    const back9Warning = getBack9Warning();
    if (back9Warning) {
      items.push({ icon: "⚡", text: back9Warning });
    } else {
      // Fallback: check round history for frustration keywords
      const roundHistory = loadRoundHistory();
      if (roundHistory.length >= 3) {
        const lastThree = roundHistory.slice(-3);
        const hasPatternKeywords = lastThree.some(r =>
          r.mentalTakeaway.toLowerCase().includes("frustrat") ||
          r.mentalTakeaway.toLowerCase().includes("tense") ||
          r.mentalTakeaway.toLowerCase().includes("tight")
        );
        if (hasPatternKeywords) {
          items.push({ icon: "⚡", text: "Last 3 rounds: frustration patterns detected" });
        }
      }
    }

    // 2. Goal from insight journal
    const journal = loadJournal();
    const goalInsights = journal.filter(i => i.category === "goal");
    if (goalInsights.length > 0) {
      const mostRecent = goalInsights[goalInsights.length - 1];
      items.push({
        icon: "🎯",
        text: `Your stated goal: ${mostRecent.summary}`,
      });
    }

    // 3. Preferred cue word (LRM)
    const preferredWords = loadPreferredWords();
    if (preferredWords.length > 0) {
      const topWord = preferredWords[0];
      items.push({
        icon: "💡",
        text: `Cue word that's been working: ${topWord}`,
      });
    }

    // Limit to 3 items
    return items.slice(0, 3);
  }, []);

  // Only render if there are briefing items
  if (briefingItems.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "pt-4 shrink-0 animate-slide-up",
        className
      )}
    >
      <div className="max-w-2xl mx-auto">
        <div
          className={cn(
            "rounded-3xl border border-[rgba(203,184,146,0.15)] bg-[rgba(9,19,15,0.95)]",
            "px-5 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl",
            "space-y-3"
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--sand-0)] opacity-70">
                Round Briefing
              </p>
            </div>
            <button
              onClick={onDismiss}
              className="shrink-0 text-muted-foreground/25 hover:text-muted-foreground/50 transition-all duration-300 mt-0.5"
              aria-label="Dismiss briefing"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Briefing items */}
          <div className="space-y-2">
            {briefingItems.map((item, index) => (
              <div key={index} className="flex items-start gap-3">
                <span className="text-lg mt-0.5 shrink-0">{item.icon}</span>
                <p className="text-sm text-foreground/75 leading-relaxed tracking-wide pt-0.5">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
