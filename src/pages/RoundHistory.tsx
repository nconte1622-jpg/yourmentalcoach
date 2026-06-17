import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { FrostedSandCard } from "@/components/ui/frosted-sand-card";
import { useRounds, type Round } from "@/hooks/useRounds";
import { ArrowLeft, Calendar, MapPin, Target } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRoundType(type: string): string {
  switch (type) {
    case "on-course": return "On Course";
    case "simulator": return "Simulator";
    case "practice": return "Practice";
    default: return type;
  }
}

function formatEnvironment(env: string): string {
  switch (env) {
    case "casual": return "Casual";
    case "competitive": return "Competitive";
    case "scoring": return "Scoring";
    default: return env;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "completed": return "text-[rgba(31,180,100,0.85)]";
    case "abandoned": return "text-[rgba(203,184,146,0.5)]";
    default: return "text-[var(--text-1)]";
  }
}

function RoundRow({ round }: { round: Round }) {
  const hasMentalHighlight =
    round.post_round_best || round.post_round_cost || round.post_round_adjustment;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(14,42,31,0.35)] px-4 py-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--text-0)]">
              {formatRoundType(round.round_type)}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-1)] opacity-60">
              {formatEnvironment(round.environment)}
            </span>
          </div>
          {round.course_location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 shrink-0 text-[var(--text-1)] opacity-50" />
              <span className="text-xs text-[var(--text-1)] truncate">{round.course_location}</span>
            </div>
          )}
        </div>
        <div className="text-right shrink-0 space-y-1">
          <div className="flex items-center gap-1.5 justify-end">
            <Calendar className="h-3 w-3 text-[var(--text-1)] opacity-50" />
            <span className="text-xs text-[var(--text-1)]">{formatDate(round.started_at)}</span>
          </div>
          <span className={cn("text-[10px] uppercase tracking-wider font-medium", statusColor(round.status))}>
            {round.status}
          </span>
        </div>
      </div>

      {/* Goal */}
      {round.goal && (
        <div className="flex items-start gap-2">
          <Target className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[rgba(203,184,146,0.5)]" />
          <p className="text-xs text-[var(--text-1)] leading-relaxed">
            <span className="opacity-60">Goal: </span>{round.goal}
          </p>
        </div>
      )}

      {/* Mental highlights */}
      {hasMentalHighlight && (
        <div
          className="rounded-xl border border-[rgba(203,184,146,0.12)] bg-[rgba(203,184,146,0.05)] px-3 py-2.5 space-y-1.5"
        >
          <p className="text-[9px] uppercase tracking-[0.18em] text-[rgba(203,184,146,0.5)]">
            Mental Highlights
          </p>
          {round.post_round_best && (
            <p className="text-xs text-[var(--text-0)] leading-snug">
              <span className="text-[rgba(31,180,100,0.7)] mr-1">✓</span>
              {round.post_round_best}
            </p>
          )}
          {round.post_round_cost && (
            <p className="text-xs text-[var(--text-1)] leading-snug">
              <span className="text-[rgba(203,184,146,0.5)] mr-1">−</span>
              {round.post_round_cost}
            </p>
          )}
          {round.post_round_adjustment && (
            <p className="text-xs text-[var(--text-1)] leading-snug opacity-70">
              <span className="mr-1">→</span>
              {round.post_round_adjustment}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const RoundHistory = () => {
  const navigate = useNavigate();
  const { getRecentRounds } = useRounds();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getRecentRounds(30);
      setRounds(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [getRecentRounds]);

  useEffect(() => { void load(); }, [load]);

  const completedRounds = rounds.filter((r) => r.status === "completed");
  const otherRounds = rounds.filter((r) => r.status !== "completed");

  return (
    <PageShell backgroundVariant="default">
      <AppShell
        contentClassName="flex flex-col"
        header={
          <AppHeader
            left={
              <button
                type="button"
                onClick={() => navigate("/account")}
                className="header-hit-button tap-44 text-muted-foreground/70 hover:text-foreground transition-all duration-300"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Account
              </button>
            }
            center={
              <h1 className="truncate text-base md:text-lg font-serif tracking-wide text-foreground">
                Round History
              </h1>
            }
            right={<div className="tap-44" />}
          />
        }
      >
        <main className="flex-1 px-4 pb-12 pt-2">
          <div className="mx-auto w-full max-w-lg space-y-6">
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(203,184,146,0.2)] border-t-[var(--sand-0)]" />
                <p className="text-sm text-[var(--text-1)]">Loading rounds…</p>
              </div>
            )}

            {!loading && error && (
              <FrostedSandCard className="p-6 text-center space-y-3">
                <p className="text-sm text-[var(--text-1)]">Couldn't load rounds. Check your connection.</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="text-xs text-[var(--sand-0)] underline underline-offset-2"
                >
                  Retry
                </button>
              </FrostedSandCard>
            )}

            {!loading && !error && rounds.length === 0 && (
              <FrostedSandCard className="p-8 text-center space-y-2">
                <p className="text-base font-serif text-[var(--text-0)]">No rounds yet</p>
                <p className="text-sm text-[var(--text-1)]">
                  Start your first round and your history will appear here.
                </p>
              </FrostedSandCard>
            )}

            {!loading && !error && rounds.length > 0 && (
              <>
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <FrostedSandCard className="p-4 text-center space-y-1 rounded-2xl">
                    <p className="text-2xl font-serif text-[var(--text-0)]">{completedRounds.length}</p>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-1)] opacity-60">Completed</p>
                  </FrostedSandCard>
                  <FrostedSandCard className="p-4 text-center space-y-1 rounded-2xl">
                    <p className="text-2xl font-serif text-[var(--text-0)]">{rounds.length}</p>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-1)] opacity-60">Total</p>
                  </FrostedSandCard>
                </div>

                {/* Completed rounds */}
                {completedRounds.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-1)] opacity-60 px-1">
                      Completed
                    </p>
                    {completedRounds.map((r) => (
                      <RoundRow key={r.id} round={r} />
                    ))}
                  </div>
                )}

                {/* Other rounds */}
                {otherRounds.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-1)] opacity-60 px-1">
                      Other
                    </p>
                    {otherRounds.map((r) => (
                      <RoundRow key={r.id} round={r} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </AppShell>
    </PageShell>
  );
};

export default RoundHistory;
