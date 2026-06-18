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
    <div className={cn("animate-fade-in", className)}>
      <div
        className={cn(
          "rounded-2xl border border-[rgba(45,106,79,0.12)] bg-white/95",
          "px-4 py-3.5 backdrop-blur-xl",
          "space-y-2"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#2d6a4f] opacity-60">
            Round Briefing
          </p>
          <button
            onClick={onDismiss}
            className="shrink-0 text-white/20 hover:text-white/50 transition-all duration-200"
            aria-label="Dismiss briefing"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Briefing items */}
        <div className="space-y-1.5">
          {briefingItems.map((item, index) => (
            <div key={index} className="flex items-start gap-2.5">
              <span className="text-sm mt-0.5 shrink-0">{item.icon}</span>
              <p className="text-[13px] text-[rgba(233,241,236,0.68)] leading-relaxed tracking-wide">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
