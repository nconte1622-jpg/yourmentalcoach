/**
 * Mental Coach Rating Card Component
 *
 * Displays the MCR as a visually appealing card with:
 * - Total score prominently displayed
 * - Label (e.g., "Strong")
 * - Breakdown of 5 components with progress bars AND actionable next steps
 * - Users always see what they need to do to earn more points
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { calculateMCR, type MCRComponentDetail } from "@/lib/mentalCoachRating";
import { Target, Brain, Shield, Wrench, TrendingUp } from "lucide-react";

interface MentalCoachRatingCardProps {
  className?: string;
}

const COMPONENT_CONFIG: {
  key: string;
  name: string;
  icon: typeof Target;
}[] = [
  { key: "consistency", name: "Consistency", icon: Target },
  { key: "selfAwareness", name: "Self-Awareness", icon: Brain },
  { key: "resilience", name: "Resilience", icon: Shield },
  { key: "toolUsage", name: "Tool Usage", icon: Wrench },
  { key: "growth", name: "Growth", icon: TrendingUp },
];

export function MentalCoachRatingCard({
  className,
}: MentalCoachRatingCardProps) {
  const mcr = useMemo(() => calculateMCR(), []);

  const componentData: (MCRComponentDetail & { name: string; icon: typeof Target })[] = [
    { ...mcr.consistency, name: "Consistency", icon: Target },
    { ...mcr.selfAwareness, name: "Self-Awareness", icon: Brain },
    { ...mcr.resilience, name: "Resilience", icon: Shield },
    { ...mcr.toolUsage, name: "Tool Usage", icon: Wrench },
    { ...mcr.growth, name: "Growth", icon: TrendingUp },
  ];

  const percentage = (mcr.total / 100) * 100;

  // Color based on label
  const getLabelColor = (label: string) => {
    switch (label) {
      case "Elite":
        return "text-[rgba(132,204,22,0.92)]";
      case "Strong":
        return "text-[rgba(132,204,22,0.92)]";
      case "Progressing":
        return "text-[rgba(250,204,21,0.92)]";
      case "Developing":
        return "text-[rgba(248,113,113,0.92)]";
      default:
        return "text-[rgba(148,163,184,0.92)]";
    }
  };

  const getBarColor = (score: number, max: number) => {
    const pct = max > 0 ? score / max : 0;
    if (pct >= 0.8) return "rgba(132,204,22,0.92)"; // lime
    if (pct >= 0.5) return "rgba(250,204,21,0.85)"; // yellow
    if (pct > 0) return "rgba(248,113,113,0.7)"; // red-ish
    return "rgba(148,163,184,0.3)"; // empty gray
  };

  return (
    <div
      className={cn(
        "rounded-[20px]",
        "border border-[rgba(45,106,79,0.12)]",
        "bg-[rgba(45,106,79,0.06)]",
        "p-6",
        "space-y-6",
        className
      )}
    >
      {/* Plain-language explainer */}
      <div className="rounded-2xl border border-[rgba(45,106,79,0.12)] bg-white/[0.04] px-4 py-3.5 text-sm text-[rgba(26,26,26,0.6)] leading-relaxed">
        Your <span className="text-[#1a1a1a] font-medium">Mental Coach Rating</span> tracks how consistently you use mental tools, manage emotions, and bounce back under pressure. It improves automatically — just keep showing up, tapping how you feel, and using your coach during rounds.
      </div>

      {/* Header with score and label */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-primary/70 mb-2">
            Mental Coach Rating
          </p>
          <p className="text-[rgba(26,26,26,0.6)] text-sm mb-3">
            Your overall mental game strength
          </p>
        </div>
        <div className="text-right">
          <p className="text-5xl font-bold text-[rgba(132,204,22,0.92)] tracking-tight">
            {mcr.total}
          </p>
          <p
            className={cn("text-sm font-semibold mt-1", getLabelColor(mcr.label))}
          >
            {mcr.label}
          </p>
        </div>
      </div>

      {/* Outer ring progress indicator */}
      <div className="relative flex justify-center">
        <div className="relative w-32 h-32">
          <svg
            className="w-full h-full transform -rotate-90"
            viewBox="0 0 120 120"
          >
            <circle
              cx="60"
              cy="60"
              r="55"
              fill="none"
              stroke="rgba(132,204,22,0.15)"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r="55"
              fill="none"
              stroke="rgba(132,204,22,0.92)"
              strokeWidth="8"
              strokeDasharray={`${(percentage / 100) * 2 * Math.PI * 55} ${2 * Math.PI * 55}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-[rgba(26,26,26,0.6)]">Score</p>
              <p className="text-2xl font-bold text-[rgba(132,204,22,0.92)]">
                {mcr.total}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Components breakdown with progress guidance */}
      <div className="space-y-5 border-t border-[rgba(45,106,79,0.12)] pt-6">
        <p className="text-xs uppercase tracking-[0.18em] text-primary/70 mb-4">
          Component Breakdown
        </p>

        {componentData.map((comp) => {
          const Icon = comp.icon;
          const isMaxed = comp.score >= comp.max;

          return (
            <div key={comp.name} className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-white/5">
                  <Icon className="w-3.5 h-3.5 text-[rgba(26,26,26,0.6)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#1a1a1a]">
                      {comp.name}
                    </p>
                    <p className="text-sm font-semibold text-[#1a1a1a] ml-4 min-w-fit">
                      {comp.score}/{comp.max}
                    </p>
                  </div>

                  {/* Current status */}
                  <p className="text-xs text-[rgba(26,26,26,0.6)] opacity-70 mt-0.5">
                    {comp.current}
                  </p>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-[rgba(132,204,22,0.1)] rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: comp.score > 0 ? `${(comp.score / comp.max) * 100}%` : "0%",
                        background: getBarColor(comp.score, comp.max),
                      }}
                    />
                  </div>

                  {/* Next step hint — only shown when not maxed out */}
                  {!isMaxed && comp.nextStep && (
                    <p className="text-xs text-[rgba(132,204,22,0.65)] mt-1.5 leading-snug">
                      {comp.nextStep}
                    </p>
                  )}

                  {isMaxed && (
                    <p className="text-xs text-[rgba(132,204,22,0.65)] mt-1.5">
                      Maxed out
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-xs text-[rgba(26,26,26,0.6)] opacity-60 border-t border-[rgba(45,106,79,0.12)] pt-4">
        Your MCR updates as you complete rounds, use mental tools, and track your
        insights.
      </p>
    </div>
  );
}
