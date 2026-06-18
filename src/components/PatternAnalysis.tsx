/**
 * PatternAnalysis — Cross-round shot pattern insights
 *
 * Shows 3–5 AI-derived insights after a round is completed.
 * Surfaces tee shot miss direction, putting patterns, mental state trends,
 * recovery ability, and early-hole performance patterns.
 *
 * Usage: <PatternAnalysis /> on the RoundSummary or PostRound page.
 */

import { useMemo } from "react";
import { TrendingUp, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { derivePatternInsights, type CrossRoundPatternInsight } from "@/lib/gpsPatternStorage";

function InsightIcon({ type, severity }: { type: CrossRoundPatternInsight["type"]; severity: CrossRoundPatternInsight["severity"] }) {
  if (severity === "positive") return <CheckCircle2 className="h-4 w-4 text-[rgba(31,180,100,0.9)]" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-[rgba(249,115,22,0.9)]" />;
  return <Info className="h-4 w-4 text-[#2d6a4f]" />;
}

function severityBg(severity: CrossRoundPatternInsight["severity"]): string {
  switch (severity) {
    case "positive": return "border-[rgba(31,180,100,0.2)] bg-[rgba(31,180,100,0.06)]";
    case "warning": return "border-[rgba(249,115,22,0.2)] bg-[rgba(249,115,22,0.06)]";
    default: return "border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)]";
  }
}

interface PatternAnalysisProps {
  /** Minimum rounds required before showing insights. Default 2. */
  minRounds?: number;
  /** Max insights to show. Default 5. */
  maxInsights?: number;
  className?: string;
}

export function PatternAnalysis({ minRounds = 2, maxInsights = 5, className }: PatternAnalysisProps) {
  const insights = useMemo(() => derivePatternInsights(10).slice(0, maxInsights), [maxInsights]);

  if (insights.length === 0) {
    return (
      <GlassCard className={cn("p-5", className)}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-[#2d6a4f]" />
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#2d6a4f]">
            Pattern Analysis
          </p>
        </div>
        <p className="text-sm text-[rgba(26,26,26,0.6)]">
          Log shots on {minRounds}+ rounds using the Mental GPS to unlock pattern insights.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 px-1">
        <TrendingUp className="h-4 w-4 text-[#2d6a4f]" />
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#2d6a4f]">
          Pattern Analysis
        </p>
        <span className="rounded-full bg-[rgba(45,106,79,0.06)] px-2 py-0.5 text-[10px] text-[#2d6a4f]">
          {insights.length} insight{insights.length !== 1 ? "s" : ""}
        </span>
      </div>

      {insights.map((insight, i) => (
        <div
          key={i}
          className={cn("rounded-2xl border p-4 space-y-1.5", severityBg(insight.severity))}
        >
          <div className="flex items-start gap-2.5">
            <InsightIcon type={insight.type} severity={insight.severity} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug text-[#1a1a1a]">
                {insight.headline}
              </p>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-[rgba(26,26,26,0.6)] pl-6">
            {insight.detail}
          </p>
        </div>
      ))}
    </div>
  );
}
