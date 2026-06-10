/**
 * MentalHandicapChart
 *
 * Line chart showing Mental Handicap (resilience score) trend over rounds.
 * Uses recharts — already in the project dependencies.
 *
 * This is the "progress arc" visualization — the core proof that the app works.
 * Shows up in Insights. Makes improvement visible and shareable.
 */

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import { loadResilienceScores, type ResilienceEntry } from "@/lib/resilienceScore";
import { GlassCard } from "@/components/ui/glass-card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/* ─── Custom Tooltip ─────────────────────────────────────── */

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const score = payload[0].value;
  const band = score >= 75 ? "Strong" : score >= 50 ? "Building" : "Early";
  return (
    <div className="rounded-xl border border-[rgba(203,184,146,0.2)] bg-[rgba(9,19,15,0.97)] px-3 py-2 shadow-lg backdrop-blur-xl">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--sand-0)]">{label}</p>
      <p className="font-serif text-lg text-[var(--text-0)]">
        {score} <span className="text-[11px] text-[var(--text-1)]">/ 100</span>
      </p>
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
          score >= 75
            ? "text-[rgba(31,180,100,0.9)]"
            : score >= 50
            ? "text-[var(--sand-0)]"
            : "text-[var(--text-1)]"
        }`}
      >
        {band}
      </p>
    </div>
  );
}

/* ─── Trend calculation ──────────────────────────────────── */

function getTrend(entries: ResilienceEntry[]): "up" | "down" | "flat" {
  if (entries.length < 3) return "flat";
  const last3 = entries.slice(-3).map((e) => e.score);
  const first = last3[0];
  const last = last3[last3.length - 1];
  const diff = last - first;
  if (diff > 4) return "up";
  if (diff < -4) return "down";
  return "flat";
}

/* ─── Main component ─────────────────────────────────────── */

interface MentalHandicapChartProps {
  /** Maximum number of rounds to show (default: 20) */
  maxRounds?: number;
}

export function MentalHandicapChart({ maxRounds = 20 }: MentalHandicapChartProps) {
  const allScores = useMemo(() => loadResilienceScores(), []);

  const data = useMemo(() => {
    const scores = allScores.slice(-maxRounds);
    return scores.map((entry, idx) => ({
      label: `Round ${allScores.length - scores.length + idx + 1}`,
      score: entry.score,
      date: new Date(entry.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));
  }, [allScores, maxRounds]);

  const trend = useMemo(() => getTrend(allScores), [allScores]);
  const latest = data[data.length - 1]?.score ?? null;
  const earliest = data[0]?.score ?? null;
  const change = latest != null && earliest != null ? latest - earliest : null;

  /* ── Empty state ─────────────────────────────────────── */
  if (data.length < 2) {
    return (
      <GlassCard className="flex flex-col items-center gap-3 p-7 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(203,184,146,0.2)] bg-[rgba(203,184,146,0.06)]">
          <TrendingUp className="h-5 w-5 text-[var(--sand-0)] opacity-60" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--text-0)]">Your progress chart starts here</p>
          <p className="text-xs leading-5 text-[var(--text-1)]">
            Complete {2 - data.length} more round{2 - data.length !== 1 ? "s" : ""} with emotion tracking to see your Mental Handicap trend.
          </p>
        </div>
      </GlassCard>
    );
  }

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-[rgba(31,180,100,0.9)]"
      : trend === "down"
      ? "text-[rgba(220,80,60,0.85)]"
      : "text-[var(--text-1)]";

  return (
    <GlassCard className="calm-pro-mount p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--sand-0)]">
            Mental Handicap Trend
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-1)]">
            Last {data.length} rounds
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon className="h-4 w-4" />
            {change != null && change !== 0 && (
              <span className="text-sm font-semibold">
                {change > 0 ? "+" : ""}{Math.round(change)}
              </span>
            )}
          </div>
          {latest != null && (
            <p className="font-serif text-2xl text-[var(--text-0)] tabular-nums">{latest}</p>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="mhGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(203,184,146,0.3)" />
                <stop offset="100%" stopColor="rgba(203,184,146,0.0)" />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "rgba(203,184,146,0.5)", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "rgba(203,184,146,0.5)", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(203,184,146,0.2)", strokeWidth: 1 }} />
            {/* Benchmark lines */}
            <ReferenceLine
              y={75}
              stroke="rgba(31,180,100,0.2)"
              strokeDasharray="4 4"
              label={{ value: "Strong", position: "right", fill: "rgba(31,180,100,0.4)", fontSize: 9 }}
            />
            <ReferenceLine
              y={50}
              stroke="rgba(203,184,146,0.15)"
              strokeDasharray="4 4"
              label={{ value: "Building", position: "right", fill: "rgba(203,184,146,0.35)", fontSize: 9 }}
            />
            <Area
              type="monotone"
              dataKey="score"
              fill="url(#mhGradient)"
              stroke="none"
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="rgba(203,184,146,0.9)"
              strokeWidth={2}
              dot={{ fill: "rgba(203,184,146,0.9)", r: 3, strokeWidth: 0 }}
              activeDot={{ fill: "rgba(203,184,146,1)", r: 5, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Band legend */}
      <div className="flex gap-4 pt-1">
        {[
          { label: "Early", color: "bg-[rgba(255,255,255,0.15)]" },
          { label: "Building (50+)", color: "bg-[rgba(203,184,146,0.4)]" },
          { label: "Strong (75+)", color: "bg-[rgba(31,180,100,0.5)]" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${color}`} />
            <span className="text-[10px] text-[var(--text-1)]">{label}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
