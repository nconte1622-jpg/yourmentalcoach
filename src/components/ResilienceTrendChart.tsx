/**
 * Resilience Trend Chart
 *
 * Renders a mini SVG line chart showing resilience scores over time.
 * Displays the last 10-20 rounds with clear visual trend indication.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ResilienceEntry } from "@/lib/resilienceScore";

interface ResilienceTrendChartProps {
  scores: ResilienceEntry[];
  className?: string;
}

export function ResilienceTrendChart({
  scores,
  className,
}: ResilienceTrendChartProps) {
  // Only show data if we have at least 2 data points
  if (!scores || scores.length < 2) {
    return (
      <div
        className={cn(
          "rounded-[20px]",
          "border border-[var(--border)]",
          "bg-[rgba(14,42,31,0.35)]",
          "p-6",
          "text-center",
          className
        )}
      >
        <p className="text-sm text-[var(--text-1)] mb-2">Resilience Trend</p>
        <p className="text-xs text-[var(--text-1)] opacity-70">
          Play a few more rounds to see your trend
        </p>
      </div>
    );
  }

  // Get the last 10-20 entries
  const displayData = useMemo(() => {
    return scores.slice(0, 20).reverse(); // Show oldest to newest
  }, [scores]);

  // Calculate chart dimensions and scaling
  const chartData = useMemo(() => {
    if (displayData.length === 0) {
      return { points: [], maxScore: 100, minScore: 0 };
    }

    const scores_values = displayData.map((e) => e.score);
    const maxScore = Math.max(...scores_values, 100);
    const minScore = Math.min(...scores_values, 0);

    const padding = 40;
    const chartWidth = 300;
    const chartHeight = 180;

    const points = displayData.map((entry, index) => {
      const x =
        padding +
        (index / (displayData.length - 1 || 1)) * (chartWidth - padding * 2);
      const yPercent = (entry.score - minScore) / (maxScore - minScore || 1);
      const y = padding + (1 - yPercent) * (chartHeight - padding * 2);

      return {
        x,
        y,
        score: entry.score,
        date: entry.date,
      };
    });

    return {
      points,
      maxScore,
      minScore,
      width: chartWidth + padding * 2,
      height: chartHeight + padding * 2,
    };
  }, [displayData]);

  const currentScore = displayData[displayData.length - 1]?.score ?? 0;
  const previousScore = displayData[displayData.length - 2]?.score ?? 0;
  const trend = currentScore - previousScore;
  const trendPercent = previousScore > 0 ? ((trend / previousScore) * 100).toFixed(0) : 0;

  // Generate SVG path for the line chart
  const pathData = useMemo(() => {
    if (chartData.points.length === 0) return "";

    const points = chartData.points;
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    return path;
  }, [chartData.points]);

  return (
    <div
      className={cn(
        "rounded-[20px]",
        "border border-[var(--border)]",
        "bg-[rgba(14,42,31,0.35)]",
        "p-6",
        "space-y-4",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-0)] mb-1">
            Resilience Trend
          </p>
          <p className="text-xs text-[var(--text-1)] opacity-70">
            Last {displayData.length} rounds
          </p>
        </div>

        {/* Current Score Badge */}
        <div className="text-right">
          <p className="text-2xl font-semibold text-[rgba(132,204,22,0.92)]">
            {Math.round(currentScore)}
          </p>
          <p
            className={cn(
              "text-xs font-medium mt-0.5",
              trend >= 0
                ? "text-[rgba(132,204,22,0.92)]"
                : "text-[rgba(239,68,68,0.92)]"
            )}
          >
            {trend >= 0 ? "+" : ""}
            {Math.round(trend)} ({trendPercent}%)
          </p>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="flex justify-center">
        <svg
          width={chartData.width}
          height={chartData.height}
          className="overflow-visible"
          style={{ maxWidth: "100%", height: "auto" }}
        >
          {/* Grid background */}
          <defs>
            <linearGradient id="resilience-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(132, 204, 22, 0.15)" />
              <stop offset="100%" stopColor="rgba(132, 204, 22, 0.02)" />
            </linearGradient>
          </defs>

          {/* Fill area under curve */}
          {chartData.points.length > 0 && (
            <path
              d={
                pathData +
                ` L ${chartData.points[chartData.points.length - 1].x} ${chartData.height - 40} L ${chartData.points[0].x} ${chartData.height - 40} Z`
              }
              fill="url(#resilience-gradient)"
              strokeWidth="0"
            />
          )}

          {/* Line path */}
          <path
            d={pathData}
            stroke="rgba(132, 204, 22, 0.8)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {chartData.points.map((point, index) => (
            <g key={index}>
              {/* Outer circle */}
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill="rgba(14, 42, 31, 0.8)"
                stroke="rgba(132, 204, 22, 0.8)"
                strokeWidth="2"
              />
              {/* Inner highlight */}
              <circle
                cx={point.x}
                cy={point.y}
                r="2"
                fill="rgba(132, 204, 22, 0.8)"
              />
            </g>
          ))}

          {/* Y-axis labels */}
          <text x="25" y="45" fontSize="11" fill="rgba(233, 241, 236, 0.55)" textAnchor="end">
            100
          </text>
          <text
            x="25"
            y={chartData.height - 35}
            fontSize="11"
            fill="rgba(233, 241, 236, 0.55)"
            textAnchor="end"
          >
            0
          </text>

          {/* X-axis labels (first and last dates) */}
          {displayData.length > 0 && (
            <>
              <text
                x={chartData.points[0]?.x ?? 0}
                y={chartData.height - 8}
                fontSize="10"
                fill="rgba(233, 241, 236, 0.55)"
                textAnchor="middle"
              >
                {formatDateShort(displayData[0].date)}
              </text>
              {displayData.length > 1 && (
                <text
                  x={chartData.points[chartData.points.length - 1]?.x ?? 0}
                  y={chartData.height - 8}
                  fontSize="10"
                  fill="rgba(233, 241, 236, 0.55)"
                  textAnchor="middle"
                >
                  {formatDateShort(displayData[displayData.length - 1].date)}
                </text>
              )}
            </>
          )}
        </svg>
      </div>

      {/* Score Range Legend */}
      <div className="flex items-center justify-center gap-6 text-xs border-t border-[var(--border)] pt-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[rgba(132,204,22,0.4)]" />
          <span className="text-[var(--text-1)] opacity-70">0</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[rgba(132,204,22,0.3)] to-transparent" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-1)] opacity-70">100</span>
          <div className="w-2 h-2 rounded-full bg-[rgba(132,204,22,0.8)]" />
        </div>
      </div>
    </div>
  );
}

/**
 * Format date to short format (e.g., "Mar 15")
 */
function formatDateShort(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString.slice(0, 5);
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateString.slice(0, 5);
  }
}
