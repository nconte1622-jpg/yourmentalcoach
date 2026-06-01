/**
 * MentalScoreReveal — Phase 3
 * Full-screen branded reveal card shown after a round ends.
 * Displays the round's Mental Score, hole-by-hole emotional arc, and 2 insights.
 */
import { useEffect, useRef, useState } from "react";
import { HoleMood, MoodType } from "@/lib/holeMoods";

// ─── Score calculation (single-round, mood-based) ─────────────────────────────

function calcRoundScore(moods: HoleMood[]): number {
  if (moods.length === 0) return 62;
  const total = moods.length;
  const locked = moods.filter((m) => m.mood === "locked").length;
  const steady = moods.filter((m) => m.mood === "steady").length;
  const frustrated = total - locked - steady;
  // locked=10pts, steady=6pts, frustrated=1pt  out of max 10pts/hole
  const raw = ((locked * 10 + steady * 6 + frustrated * 1) / (total * 10)) * 100;
  return Math.max(10, Math.min(98, Math.round(raw)));
}

// ─── Tier label + accent colour ───────────────────────────────────────────────

function getTier(score: number): { label: string; color: string; glow: string } {
  if (score >= 82) return { label: "Elite Focus",   color: "rgba(31,180,100,0.92)",  glow: "rgba(31,180,100,0.15)"  };
  if (score >= 65) return { label: "Strong Round",  color: "rgba(203,184,146,0.95)", glow: "rgba(203,184,146,0.12)" };
  if (score >= 50) return { label: "Building",      color: "rgba(220,175,80,0.9)",   glow: "rgba(220,175,80,0.12)"  };
  if (score >= 35) return { label: "Room to Grow",  color: "rgba(203,184,146,0.7)",  glow: "rgba(203,184,146,0.08)" };
  return             { label: "Tough Day",          color: "rgba(220,80,60,0.85)",   glow: "rgba(220,80,60,0.1)"    };
}

// ─── Insight generation (from moods array) ────────────────────────────────────

function getInsights(moods: HoleMood[]): [string, string] {
  if (moods.length === 0) {
    return [
      "Round complete — your mental game grows one round at a time.",
      "Log your mood hole-by-hole next round to unlock deeper emotional patterns.",
    ];
  }

  const total = moods.length;
  const locked = moods.filter((m) => m.mood === "locked").length;
  const steady = moods.filter((m) => m.mood === "steady").length;
  const frustrated = total - locked - steady;

  // Insight 1 — frustration spikes and recovery
  let insight1 = "";
  let frustStreak = 0;
  let frustStart = 0;
  const spikes: string[] = [];

  for (let i = 0; i < moods.length; i++) {
    const m = moods[i];
    if (m.mood === "frustrated") {
      if (frustStreak === 0) frustStart = m.hole;
      frustStreak++;
    } else {
      if (frustStreak >= 2) {
        const recovery = m.mood === "locked"
          ? "bounced back locked in"
          : "steadied out";
        spikes.push(
          `Holes ${frustStart}–${moods[i - 1].hole} were a mental challenge, then you ${recovery} at hole ${m.hole}. That recovery is the skill.`
        );
      }
      frustStreak = 0;
    }
  }
  if (frustStreak >= 2) {
    spikes.push(
      `A mental challenge from hole ${frustStart} to the finish — recognising it is step one. Every frustrated hole is data.`
    );
  }

  if (spikes.length > 0) {
    insight1 = spikes[0];
  } else if (frustrated === 0 && locked > 0) {
    insight1 = `Zero frustration across ${total} logged holes. Clean mental execution — take note of exactly what you did today.`;
  } else if (locked / total >= 0.5) {
    insight1 = `Locked in for ${locked} of ${total} holes. That's elite-level presence. The score reflects it.`;
  } else {
    insight1 = `${steady + locked} of ${total} holes in a focused or steady state — consistency is the compounding skill.`;
  }

  // Insight 2 — first-half vs second-half trend
  let insight2 = "";
  const mid = Math.floor(moods.length / 2);
  const firstHalf = moods.slice(0, mid);
  const secondHalf = moods.slice(mid);

  const halfAvg = (half: HoleMood[]) =>
    half.length === 0
      ? 0
      : half.reduce((s, m) => s + (m.mood === "locked" ? 3 : m.mood === "steady" ? 2 : 0), 0) / half.length;

  const fa = halfAvg(firstHalf);
  const sa = halfAvg(secondHalf);

  if (firstHalf.length > 0 && secondHalf.length > 0) {
    if (sa > fa + 0.35) {
      insight2 = "Your mental game got stronger as the round went on. Finishing with more focus than you started — that's trainable.";
    } else if (fa > sa + 0.35) {
      insight2 = "You started sharp. Building mental endurance for the back nine is where your next edge lives.";
    } else {
      const pct = Math.round(((locked + steady) / total) * 100);
      insight2 = `${pct}% of logged holes in a positive mental state — consistent across the whole round. Steady is underrated.`;
    }
  } else {
    insight2 =
      locked + steady > frustrated
        ? "More positive than negative mental states today. That matters more than the scorecard."
        : "Tough day mentally — but logging it puts you ahead of every golfer who isn't tracking this.";
  }

  return [insight1, insight2];
}

// ─── Animated count-up ────────────────────────────────────────────────────────

function CountUp({ target, run }: { target: number; run: boolean }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const DURATION = 1300;

  useEffect(() => {
    if (!run) return;
    startRef.current = null;

    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, run]);

  return <>{display}</>;
}

// ─── Mood visual config ───────────────────────────────────────────────────────

const MOOD_FILL: Record<MoodType, string> = {
  locked:     "rgb(31,180,100)",
  steady:     "rgba(203,184,146,0.72)",
  frustrated: "rgb(220,80,60)",
};

const MOOD_GLOW: Record<MoodType, string> = {
  locked:     "0 0 6px rgba(31,180,100,0.4)",
  steady:     "none",
  frustrated: "0 0 5px rgba(220,80,60,0.32)",
};

const BAR_HEIGHT: Record<MoodType, number> = {
  locked:     26,
  steady:     17,
  frustrated: 10,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface MentalScoreRevealProps {
  moods: HoleMood[];
  onContinue: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MentalScoreReveal({ moods, onContinue }: MentalScoreRevealProps) {
  const score = calcRoundScore(moods);
  const tier  = getTier(score);
  const [insight1, insight2] = getInsights(moods);
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const locked = moods.filter((m) => m.mood === "locked").length;
    const total  = moods.length;
    const shareText = [
      `🏌️ Mental Score: ${score} — ${tier.label}`,
      total > 0 ? `Locked in for ${locked} of ${total} holes.` : "",
      insight1,
      "",
      "Tracked with Your Mental Coach.",
    ].filter(Boolean).join("\n");

    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: "My Mental Score", text: shareText }).catch(() => {/* user cancelled */});
    } else {
      navigator.clipboard?.writeText(shareText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => {/* silent */});
    }
  };

  // Staggered entrance phases
  const [overlayIn,   setOverlayIn]   = useState(false);
  const [cardIn,      setCardIn]      = useState(false);
  const [scoreIn,     setScoreIn]     = useState(false);
  const [barsIn,      setBarsIn]      = useState(false);
  const [insightsIn,  setInsightsIn]  = useState(false);
  const [ctaIn,       setCtaIn]       = useState(false);

  useEffect(() => {
    const t0 = setTimeout(() => setOverlayIn(true),  30);
    const t1 = setTimeout(() => setCardIn(true),     90);
    const t2 = setTimeout(() => setScoreIn(true),   380);
    const t3 = setTimeout(() => setBarsIn(true),    560);
    const t4 = setTimeout(() => setInsightsIn(true),760);
    const t5 = setTimeout(() => setCtaIn(true),    1000);
    return () => {
      clearTimeout(t0); clearTimeout(t1); clearTimeout(t2);
      clearTimeout(t3); clearTimeout(t4); clearTimeout(t5);
    };
  }, []);

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-label="Your Mental Score"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center overflow-y-auto"
      style={{
        background: "radial-gradient(ellipse at 50% 18%, rgba(18,64,47,0.62) 0%, rgba(3,8,6,0.97) 60%)",
        opacity:    overlayIn ? 1 : 0,
        transition: "opacity 400ms ease",
      }}
    >
      {/* Ambient score glow */}
      <div
        className="pointer-events-none fixed top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width:      320,
          height:     320,
          background: `radial-gradient(circle, ${tier.glow} 0%, transparent 70%)`,
          filter:     "blur(4px)",
          opacity:    scoreIn ? 1 : 0,
          transition: "opacity 1.1s ease 0.15s",
        }}
      />

      {/* Card wrapper — spring unwrap animation */}
      <div
        className="relative w-full max-w-[400px] mx-4 my-8 sm:my-0"
        style={{
          transform: cardIn
            ? "perspective(900px) rotateX(0deg) translateY(0px) scale(1)"
            : "perspective(900px) rotateX(7deg)  translateY(56px) scale(0.86)",
          opacity:    cardIn ? 1 : 0,
          transition: "transform 680ms cubic-bezier(0.34,1.5,0.64,1), opacity 480ms ease",
        }}
      >
        {/* ── Glass shell ── */}
        <div
          className="relative overflow-hidden rounded-[32px]"
          style={{
            background:  "linear-gradient(155deg, rgba(19,48,33,0.95) 0%, rgba(6,15,10,0.98) 100%)",
            border:      "1px solid rgba(203,184,146,0.15)",
            boxShadow:   [
              "inset 0 1px 0 rgba(203,184,146,0.1)",
              "inset 0 -1px 0 rgba(0,0,0,0.35)",
              "0 48px 120px rgba(0,0,0,0.7)",
            ].join(", "),
            backdropFilter: "blur(32px)",
          }}
        >
          {/* Top-edge shimmer */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-10 top-0 h-px"
            style={{
              background: "linear-gradient(to right, transparent, rgba(203,184,146,0.28), transparent)",
            }}
          />

          {/* ── Score section ── */}
          <div className="px-8 pt-10 pb-7 flex flex-col items-center text-center gap-5">
            {/* Eyebrow */}
            <p
              style={{
                fontSize:      9,
                fontFamily:    "Inter, sans-serif",
                fontWeight:    600,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color:         "rgba(203,184,146,0.45)",
              }}
            >
              Round Complete
            </p>

            {/* Score ring */}
            <div
              style={{
                opacity:    scoreIn ? 1 : 0,
                transform:  scoreIn ? "translateY(0) scale(1)" : "translateY(18px) scale(0.9)",
                transition: "opacity 520ms ease, transform 520ms cubic-bezier(0.34,1.4,0.64,1)",
              }}
            >
              {/* Outer ring */}
              <div
                style={{
                  position:     "relative",
                  width:        144,
                  height:       144,
                  borderRadius: "50%",
                  border:       `1.5px solid ${tier.color}28`,
                  boxShadow:    `0 0 0 7px ${tier.glow}, 0 0 40px ${tier.glow}`,
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "center",
                }}
              >
                {/* Inner tinted fill */}
                <div
                  style={{
                    position:     "absolute",
                    inset:        10,
                    borderRadius: "50%",
                    background:   `radial-gradient(circle at 40% 35%, ${tier.glow}, rgba(6,15,10,0.85) 68%)`,
                    border:       `1px solid ${tier.color}16`,
                  }}
                />
                {/* Number */}
                <span
                  className="relative z-10"
                  style={{
                    fontFamily:    "'Cormorant Garamond', 'Cormorant', Georgia, serif",
                    fontSize:      72,
                    fontWeight:    400,
                    lineHeight:    1,
                    letterSpacing: "-0.02em",
                    color:         tier.color,
                    textShadow:    `0 0 32px ${tier.glow}`,
                  }}
                >
                  <CountUp target={score} run={scoreIn} />
                </span>
              </div>
            </div>

            {/* Sub-label */}
            <div
              style={{
                opacity:    scoreIn ? 1 : 0,
                transition: "opacity 400ms ease 280ms",
                display:    "flex",
                alignItems: "center",
                gap:        10,
              }}
            >
              <span
                style={{
                  fontSize:      10,
                  fontFamily:    "Inter, sans-serif",
                  fontWeight:    600,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  padding:       "3px 12px",
                  borderRadius:  99,
                  background:    `${tier.color}14`,
                  border:        `1px solid ${tier.color}28`,
                  color:         tier.color,
                }}
              >
                {tier.label}
              </span>
              <span style={{ fontSize: 12, color: "rgba(203,184,146,0.32)" }}>
                / 100
              </span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ margin: "0 32px", height: 1, background: "rgba(203,184,146,0.07)" }} />

          {/* ── Emotional Arc ── */}
          <div
            className="px-8 py-6"
            style={{
              opacity:    barsIn ? 1 : 0,
              transform:  barsIn ? "translateY(0)" : "translateY(10px)",
              transition: "opacity 420ms ease, transform 420ms ease",
            }}
          >
            <p
              style={{
                fontSize:      9,
                fontFamily:    "Inter, sans-serif",
                fontWeight:    600,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color:         "rgba(203,184,146,0.38)",
                marginBottom:  12,
              }}
            >
              Emotional Arc
            </p>

            {moods.length > 0 ? (
              <>
                {/* Variable-height bars — one per logged hole */}
                <div
                  style={{
                    display:    "flex",
                    flexWrap:   "wrap",
                    gap:        "5px",
                    alignItems: "flex-end",
                    minHeight:  36,
                  }}
                >
                  {moods.map((m, idx) => (
                    <div
                      key={m.hole}
                      title={`Hole ${m.hole}: ${m.mood}`}
                      style={{
                        display:       "flex",
                        flexDirection: "column",
                        alignItems:    "center",
                        gap:           3,
                        opacity:       barsIn ? 1 : 0,
                        transform:     barsIn ? "translateY(0)" : "translateY(12px)",
                        transition:    `opacity 300ms ease ${Math.min(idx * 30, 500)}ms, transform 300ms ease ${Math.min(idx * 30, 500)}ms`,
                      }}
                    >
                      <div
                        style={{
                          width:        11,
                          height:       BAR_HEIGHT[m.mood],
                          borderRadius: 3,
                          background:   MOOD_FILL[m.mood],
                          opacity:      0.84,
                          boxShadow:    MOOD_GLOW[m.mood],
                        }}
                      />
                      <span
                        style={{
                          fontSize: 7.5,
                          color:    "rgba(203,184,146,0.28)",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {m.hole}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                  {(["locked", "steady", "frustrated"] as MoodType[]).map((mood) => (
                    <div key={mood} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div
                        style={{
                          width:        8,
                          height:       8,
                          borderRadius: 2,
                          background:   MOOD_FILL[mood],
                          opacity:      0.8,
                        }}
                      />
                      <span
                        style={{
                          fontSize:   9,
                          fontFamily: "Inter, sans-serif",
                          color:      "rgba(203,184,146,0.36)",
                          textTransform: "capitalize",
                        }}
                      >
                        {mood}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 12, color: "rgba(203,184,146,0.35)", fontFamily: "Inter, sans-serif" }}>
                No hole moods logged this round. Tap holes during your next round to build your arc.
              </p>
            )}
          </div>

          {/* Divider */}
          <div
            style={{
              margin:     "0 32px",
              height:     1,
              background: "rgba(203,184,146,0.07)",
              opacity:    insightsIn ? 1 : 0,
              transition: "opacity 400ms ease",
            }}
          />

          {/* ── Insights ── */}
          <div
            className="px-8 pt-6 pb-2 space-y-3"
            style={{
              opacity:    insightsIn ? 1 : 0,
              transform:  insightsIn ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 420ms ease, transform 420ms ease",
            }}
          >
            <p
              style={{
                fontSize:      9,
                fontFamily:    "Inter, sans-serif",
                fontWeight:    600,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color:         "rgba(203,184,146,0.38)",
                marginBottom:  4,
              }}
            >
              Round Insights
            </p>

            {[insight1, insight2].map((text, i) => (
              <div
                key={i}
                style={{
                  padding:    "14px 16px",
                  borderRadius: 16,
                  background: i === 0
                    ? "rgba(18,64,47,0.3)"
                    : "rgba(8,20,14,0.45)",
                  border:     "1px solid rgba(203,184,146,0.09)",
                  opacity:    insightsIn ? 1 : 0,
                  transform:  insightsIn ? "translateY(0)" : "translateY(8px)",
                  transition: `opacity 380ms ease ${i * 110}ms, transform 380ms ease ${i * 110}ms`,
                }}
              >
                <p
                  style={{
                    fontFamily:  "Inter, sans-serif",
                    fontSize:    13,
                    lineHeight:  1.65,
                    color:       "rgba(240,229,203,0.78)",
                  }}
                >
                  {text}
                </p>
              </div>
            ))}
          </div>

          {/* ── CTA ── */}
          <div
            className="px-8 pt-5 pb-9 space-y-3"
            style={{
              opacity:    ctaIn ? 1 : 0,
              transform:  ctaIn ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 400ms ease, transform 400ms ease",
            }}
          >
            {/* Share button */}
            <button
              type="button"
              onClick={handleShare}
              style={{
                width:         "100%",
                padding:       "13px 0",
                borderRadius:  18,
                border:        "1px solid rgba(203,184,146,0.18)",
                background:    "rgba(203,184,146,0.07)",
                color:         "rgba(203,184,146,0.75)",
                fontFamily:    "Inter, sans-serif",
                fontSize:      13,
                fontWeight:    500,
                letterSpacing: "0.04em",
                cursor:        "pointer",
                transition:    "background 200ms ease, color 200ms ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(203,184,146,0.13)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(203,184,146,0.07)"; }}
            >
              {copied ? "✓ Copied to clipboard" : "Share my score"}
            </button>

            <button
              type="button"
              onClick={onContinue}
              style={{
                width:         "100%",
                padding:       "15px 0",
                borderRadius:  18,
                border:        "1px solid rgba(31,180,100,0.2)",
                background:    "linear-gradient(145deg, rgba(22,72,52,0.95) 0%, rgba(14,48,32,1) 100%)",
                color:         "rgba(240,229,203,0.92)",
                fontFamily:    "Inter, sans-serif",
                fontSize:      14,
                fontWeight:    600,
                letterSpacing: "0.05em",
                boxShadow:     [
                  "inset 0 1px 0 rgba(203,184,146,0.09)",
                  "0 10px 28px rgba(3,8,6,0.5)",
                ].join(", "),
                cursor:      "pointer",
                transition:  "transform 150ms ease, opacity 150ms ease",
              }}
              onPointerDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)"; }}
              onPointerUp={(e)   => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              onPointerLeave={(e)=> { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
            >
              Continue
            </button>
          </div>

        </div>

        {/* Branding watermark */}
        <p
          style={{
            textAlign:     "center",
            marginTop:     20,
            fontSize:      9,
            fontFamily:    "Inter, sans-serif",
            fontWeight:    500,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color:         "rgba(203,184,146,0.18)",
            opacity:       insightsIn ? 1 : 0,
            transition:    "opacity 500ms ease 350ms",
          }}
        >
          YOUR MENTAL COACH
        </p>
      </div>
    </div>
  );
}
