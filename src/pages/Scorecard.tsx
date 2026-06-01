/**
 * Scorecard — hole-by-hole score entry page.
 * Accessible from the Round page header.
 * Works during AND after a round. Score data feeds the AI coach context.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { triggerHaptic } from "@/lib/haptics";
import { PageShell } from "@/components/PageShell";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { cn } from "@/lib/utils";
import {
  loadScorecard,
  createBlankScorecard,
  saveScorecard,
  updateHolePar,
  updateHoleScore,
  getScorecardSummary,
  type Scorecard,
  type HoleScore,
} from "@/lib/scorecardStorage";
import { loadActiveRoundSession } from "@/lib/roundSession";
import { Info, ClipboardList } from "lucide-react";

/**
 * Parse a pasted scorecard string into an array of 18 scores.
 * Accepts formats like:
 *   "4 5 3 4 5 4 3 5 4  5 4 3 5 4 4 5 3 4"   (space-separated)
 *   "4,5,3,4,5,4,3,5,4 / 5,4,3,5,4,4,5,3,4"   (comma/slash separated)
 *   "4-5-3-4-5-4-3-5-4"                         (dash-separated)
 * Returns null if fewer than 9 numbers found.
 */
function parseScorecardText(raw: string): number[] | null {
  const nums = raw.match(/\d+/g);
  if (!nums) return null;
  const scores = nums.map(Number).filter((n) => n >= 1 && n <= 15);
  if (scores.length < 9) return null;
  return scores.slice(0, 18);
}

// Score color relative to par
function scoreColor(score: number | null, par: number): string {
  if (score === null) return "text-[var(--text-2)]";
  const diff = score - par;
  if (diff <= -2) return "text-yellow-300"; // eagle+
  if (diff === -1) return "text-[var(--sand-0)]"; // birdie
  if (diff === 0) return "text-[var(--text-0)]"; // par
  if (diff === 1) return "text-orange-400"; // bogey
  return "text-red-400"; // double+
}

function scoreBg(score: number | null, par: number): string {
  if (score === null) return "bg-white/5 border-white/10";
  const diff = score - par;
  if (diff <= -2) return "bg-yellow-400/20 border-yellow-400/30";
  if (diff === -1) return "bg-[rgba(203,184,146,0.18)] border-[rgba(203,184,146,0.3)]";
  if (diff === 0) return "bg-white/8 border-white/15";
  if (diff === 1) return "bg-orange-500/12 border-orange-400/25";
  return "bg-red-500/12 border-red-400/25";
}

function scoreLabel(score: number | null, par: number): string {
  if (score === null) return "-";
  const diff = score - par;
  if (diff <= -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Dbl";
  return `+${diff}`;
}

function formatScoreToPar(n: number): string {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

interface HoleRowProps {
  hole: HoleScore;
  onChangePar: (hole: number, par: number) => void;
  onChangeScore: (hole: number, delta: number) => void;
  onClearScore: (hole: number) => void;
}

function HoleRow({ hole, onChangePar, onChangeScore, onClearScore }: HoleRowProps) {
  const diff = hole.score !== null ? hole.score - hole.par : null;

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 last:border-b-0">
      {/* Hole number */}
      <div className="w-7 shrink-0 text-center">
        <span className="text-[11px] text-[var(--text-2)] font-medium tracking-wide">{hole.hole}</span>
      </div>

      {/* Par selector */}
      <div className="flex gap-1 shrink-0">
        {[3, 4, 5].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              triggerHaptic("soft");
              onChangePar(hole.hole, p);
            }}
            className={cn(
              "w-7 h-7 rounded-lg text-[11px] font-medium transition-all duration-150",
              hole.par === p
                ? "bg-[rgba(203,184,146,0.22)] text-[var(--sand-0)] border border-[rgba(203,184,146,0.3)]"
                : "bg-white/5 text-[var(--text-2)] border border-white/8 hover:bg-white/10"
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Score controls */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Decrement */}
        <button
          type="button"
          onPointerDown={() => triggerHaptic("soft")}
          onClick={() => onChangeScore(hole.hole, -1)}
          className="w-9 h-9 rounded-xl border border-white/12 bg-white/5 text-[var(--text-1)] text-lg font-light hover:bg-white/12 active:scale-95 transition-all duration-100 flex items-center justify-center"
        >
          −
        </button>

        {/* Score display */}
        <button
          type="button"
          onPointerDown={() => triggerHaptic("soft")}
          onLongPress={() => onClearScore(hole.hole)}
          onClick={() => {
            if (hole.score === null) onChangeScore(hole.hole, 1);
          }}
          className={cn(
            "min-w-[52px] h-9 rounded-xl border text-center transition-all duration-200 flex flex-col items-center justify-center",
            scoreBg(hole.score, hole.par)
          )}
        >
          <span className={cn("text-sm font-semibold leading-none", scoreColor(hole.score, hole.par))}>
            {hole.score ?? "—"}
          </span>
          {hole.score !== null && (
            <span className={cn("text-[9px] leading-none mt-0.5 opacity-80", scoreColor(hole.score, hole.par))}>
              {scoreLabel(hole.score, hole.par)}
            </span>
          )}
        </button>

        {/* Increment */}
        <button
          type="button"
          onPointerDown={() => triggerHaptic("soft")}
          onClick={() => onChangeScore(hole.hole, 1)}
          className="w-9 h-9 rounded-xl border border-white/12 bg-white/5 text-[var(--text-1)] text-lg font-light hover:bg-white/12 active:scale-95 transition-all duration-100 flex items-center justify-center"
        >
          +
        </button>
      </div>

      {/* Score vs par pill */}
      <div className="w-9 text-right shrink-0">
        <span className={cn("text-[11px] font-medium", diff !== null ? scoreColor(hole.score, hole.par) : "text-[var(--text-2)]")}>
          {diff !== null ? formatScoreToPar(diff) : ""}
        </span>
      </div>
    </div>
  );
}

const Scorecard = () => {
  const navigate = useNavigate();
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [showImportTip, setShowImportTip] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteSuccess, setPasteSuccess] = useState(false);

  // Resolve round ID from active session
  useEffect(() => {
    const session = loadActiveRoundSession();
    const id = session?.roundId ?? null;
    setRoundId(id);
    if (id) {
      setScorecard(loadScorecard(id) ?? createBlankScorecard(id));
    }
  }, []);

  const handleChangePar = useCallback(
    (hole: number, par: number) => {
      if (!roundId) return;
      const updated = updateHolePar(roundId, hole, par);
      setScorecard(updated);
    },
    [roundId]
  );

  const handleChangeScore = useCallback(
    (hole: number, delta: number) => {
      if (!roundId || !scorecard) return;
      const current = scorecard.holes.find((h) => h.hole === hole);
      if (!current) return;
      const base = current.score ?? current.par;
      const next = Math.max(1, base + delta);
      const updated = updateHoleScore(roundId, hole, next);
      setScorecard(updated);
    },
    [roundId, scorecard]
  );

  const handleClearScore = useCallback(
    (hole: number) => {
      if (!roundId) return;
      triggerHaptic("medium");
      const updated = updateHoleScore(roundId, hole, null);
      setScorecard(updated);
    },
    [roundId]
  );

  const handleClearAll = useCallback(() => {
    if (!roundId) return;
    triggerHaptic("medium");
    const blank = createBlankScorecard(roundId);
    saveScorecard(blank);
    setScorecard(blank);
  }, [roundId]);

  const handlePasteImport = useCallback(() => {
    if (!roundId || !scorecard) return;
    setPasteError(null);
    const scores = parseScorecardText(pasteText);
    if (!scores) {
      setPasteError("Couldn't read those scores — make sure you have at least 9 numbers separated by spaces, commas, or dashes.");
      return;
    }
    let updated: Scorecard | null = scorecard;
    scores.forEach((score, i) => {
      const hole = i + 1;
      updated = updateHoleScore(roundId, hole, score) ?? updated;
    });
    setScorecard(updated);
    setPasteText("");
    setPasteSuccess(true);
    triggerHaptic("medium");
    setTimeout(() => setPasteSuccess(false), 3000);
  }, [roundId, scorecard, pasteText]);

  if (!roundId || !scorecard) {
    return (
      <PageShell backgroundVariant="default">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <ClipboardList className="w-10 h-10 text-[var(--text-2)]" />
          <p className="text-sm text-[var(--text-1)]">
            No active round found. Start a round first, then come back to track your score.
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-[var(--sand-0)] underline underline-offset-4"
          >
            ← Go back
          </button>
        </div>
      </PageShell>
    );
  }

  const summary = getScorecardSummary(scorecard);
  const hasScores = summary.holesCompleted > 0;

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
                  navigate(-1);
                }}
                className="header-hit-button tap-44 text-muted-foreground/85 hover:text-foreground hover:bg-foreground/5 transition-all duration-300"
              >
                ← Round
              </button>
            }
            center={
              <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-1)]">Scorecard</span>
            }
            right={
              hasScores ? (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="header-hit-button tap-44 text-[11px] uppercase tracking-[0.12em] text-[var(--text-2)] hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              ) : null
            }
          />
        }
      >
        <div className="flex-1 overflow-y-auto pb-[calc(80px+var(--sab))]">

          {/* Quick-entry paste area */}
          <div className="px-4 pt-4 pb-2 space-y-2">

            {/* Paste scores section */}
            <div className="rounded-2xl border border-[rgba(203,184,146,0.15)] bg-[rgba(203,184,146,0.05)] px-4 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-[var(--sand-0)] shrink-0" />
                <p className="text-xs font-medium text-[var(--sand-0)] uppercase tracking-wider">Paste scores instantly</p>
              </div>
              <p className="text-xs text-[var(--text-1)] leading-5">
                Paste a row of scores separated by spaces, commas, or dashes — e.g. from your 18Birdies email or notes.
              </p>
              <p className="text-[10px] text-[var(--text-2)] font-mono tracking-wide">
                Example: 4 5 3 4 4 5 3 5 4  5 4 3 5 4 4 5 3 4
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); setPasteError(null); }}
                placeholder="Paste your scores here…"
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-[var(--text-0)] placeholder:text-[var(--text-2)] resize-none focus:outline-none focus:ring-1 focus:ring-[rgba(203,184,146,0.3)] transition-all"
              />
              {pasteError && (
                <p className="text-xs text-red-400 leading-5">{pasteError}</p>
              )}
              {pasteSuccess && (
                <p className="text-xs text-emerald-400 leading-5">✓ Scores imported successfully</p>
              )}
              <button
                type="button"
                onClick={handlePasteImport}
                disabled={!pasteText.trim()}
                className="w-full rounded-xl border border-[rgba(203,184,146,0.2)] bg-[rgba(203,184,146,0.1)] py-2.5 text-xs font-medium text-[var(--sand-0)] transition-all hover:bg-[rgba(203,184,146,0.18)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Import scores
              </button>
            </div>

            {/* 18Birdies guide */}
            <button
              type="button"
              onClick={() => setShowImportTip(!showImportTip)}
              className="w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-all hover:bg-white/8"
            >
              <span className="text-xs text-[var(--text-1)] flex-1">
                How to get scores from 18Birdies
              </span>
              <span className="text-[var(--text-2)] text-xs">{showImportTip ? "▲" : "▼"}</span>
            </button>

            {showImportTip && (
              <div className="rounded-2xl border border-white/10 bg-[rgba(203,184,146,0.06)] px-4 py-4 space-y-2 animate-fade-in">
                <ol className="text-xs text-[var(--text-1)] leading-6 space-y-1.5 list-decimal list-inside">
                  <li>Finish your round in 18Birdies as normal.</li>
                  <li>Open your scorecard → tap Share → Email to yourself.</li>
                  <li>From the email, copy the row of scores and paste above.</li>
                </ol>
                <p className="text-[10px] text-[var(--text-2)] pt-1">
                  Native 18Birdies sync is on our roadmap.
                </p>
              </div>
            )}
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="w-7 text-center">
              <span className="text-[10px] text-[var(--text-2)] uppercase tracking-wider">Hole</span>
            </div>
            <div className="flex gap-1 shrink-0">
              <span className="text-[10px] text-[var(--text-2)] uppercase tracking-wider w-[73px] text-center">Par</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-[var(--text-2)] uppercase tracking-wider w-[122px] text-center">Score</span>
            </div>
            <div className="w-9 text-right">
              <span className="text-[10px] text-[var(--text-2)] uppercase tracking-wider">±</span>
            </div>
          </div>

          {/* Front 9 */}
          <div className="mx-4 mb-3 rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
            <div className="px-4 py-2 border-b border-white/8 bg-white/3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-2)]">Front 9</span>
            </div>
            {scorecard.holes.slice(0, 9).map((hole) => (
              <HoleRow
                key={hole.hole}
                hole={hole}
                onChangePar={handleChangePar}
                onChangeScore={handleChangeScore}
                onClearScore={handleClearScore}
              />
            ))}
            {/* Front 9 total */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white/4 border-t border-white/8">
              <span className="text-xs text-[var(--text-2)] uppercase tracking-wider">Front 9</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-[var(--text-0)]">
                  {summary.front9Strokes > 0 ? summary.front9Strokes : "—"}
                </span>
                {summary.front9Strokes > 0 && (
                  <span className={cn(
                    "text-xs font-medium min-w-[28px] text-right",
                    summary.front9Strokes - summary.front9Par < 0 ? "text-[var(--sand-0)]" :
                    summary.front9Strokes - summary.front9Par > 0 ? "text-orange-400" : "text-[var(--text-1)]"
                  )}>
                    {formatScoreToPar(summary.front9Strokes - summary.front9Par)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Back 9 */}
          <div className="mx-4 mb-3 rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
            <div className="px-4 py-2 border-b border-white/8 bg-white/3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-2)]">Back 9</span>
            </div>
            {scorecard.holes.slice(9).map((hole) => (
              <HoleRow
                key={hole.hole}
                hole={hole}
                onChangePar={handleChangePar}
                onChangeScore={handleChangeScore}
                onClearScore={handleClearScore}
              />
            ))}
            {/* Back 9 total */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white/4 border-t border-white/8">
              <span className="text-xs text-[var(--text-2)] uppercase tracking-wider">Back 9</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-[var(--text-0)]">
                  {summary.back9Strokes > 0 ? summary.back9Strokes : "—"}
                </span>
                {summary.back9Strokes > 0 && (
                  <span className={cn(
                    "text-xs font-medium min-w-[28px] text-right",
                    summary.back9Strokes - summary.back9Par < 0 ? "text-[var(--sand-0)]" :
                    summary.back9Strokes - summary.back9Par > 0 ? "text-orange-400" : "text-[var(--text-1)]"
                  )}>
                    {formatScoreToPar(summary.back9Strokes - summary.back9Par)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Total bar */}
          {hasScores && (
            <div className="mx-4 mb-4 rounded-2xl border border-[rgba(203,184,146,0.2)] bg-[rgba(203,184,146,0.06)] px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-2)]">
                    Total · {summary.holesCompleted} of 18 holes
                  </p>
                  <p className="text-2xl font-serif text-[var(--text-0)] mt-0.5">
                    {summary.totalStrokes}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-2)]">vs par</p>
                  <p className={cn(
                    "text-2xl font-serif mt-0.5",
                    summary.scoreToPar < 0 ? "text-[var(--sand-0)]" :
                    summary.scoreToPar > 0 ? "text-orange-400" : "text-[var(--text-0)]"
                  )}>
                    {formatScoreToPar(summary.scoreToPar)}
                  </p>
                </div>
              </div>

              {/* Quick stats row */}
              {summary.holesCompleted >= 9 && (
                <div className="mt-3 pt-3 border-t border-white/8 flex gap-4">
                  {(summary.birdieOrBetterHoles.length + summary.eagleOrBetterHoles.length) > 0 && (
                    <div>
                      <p className="text-[10px] text-[var(--sand-0)] uppercase tracking-wider">
                        Birdie{(summary.birdieOrBetterHoles.length + summary.eagleOrBetterHoles.length) > 1 ? "s" : ""}
                      </p>
                      <p className="text-sm font-medium text-[var(--text-0)]">
                        {summary.birdieOrBetterHoles.length + summary.eagleOrBetterHoles.length}
                      </p>
                    </div>
                  )}
                  {summary.bogeyHoles.length > 0 && (
                    <div>
                      <p className="text-[10px] text-orange-400 uppercase tracking-wider">Bogeys</p>
                      <p className="text-sm font-medium text-[var(--text-0)]">{summary.bogeyHoles.length}</p>
                    </div>
                  )}
                  {summary.doubleOrWorse.length > 0 && (
                    <div>
                      <p className="text-[10px] text-red-400 uppercase tracking-wider">Dbl+</p>
                      <p className="text-sm font-medium text-[var(--text-0)]">{summary.doubleOrWorse.length}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <p className="text-center text-[10px] text-[var(--text-2)] pb-6 px-4">
            Long-press a score cell to clear it. Your coach sees this scorecard automatically.
          </p>
        </div>
      </AppShell>
    </PageShell>
  );
};

export default Scorecard;
