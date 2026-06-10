/**
 * MentalHandicapBadge
 *
 * Whoop-style identity mark for The Caddie's Mental Handicap score.
 * A clean, self-contained SVG that works at any size.
 *
 * Variants:
 *   - "score" (default) — shows the numeric score inside the badge ring
 *   - "icon" — shows just the MH emblem without a number (for small contexts)
 *
 * Score bands:
 *   0–49  Early    (white/muted)
 *  50–74  Building (sand/gold)
 *  75–100 Strong   (green)
 *
 * Usage:
 *   <MentalHandicapBadge score={72} size={80} />
 *   <MentalHandicapBadge score={0} variant="icon" size={28} />
 */

interface MentalHandicapBadgeProps {
  score?: number;
  size?: number;
  variant?: "score" | "icon";
  className?: string;
}

function getBand(score: number): {
  primary: string;
  secondary: string;
  label: string;
  arcColor: string;
} {
  if (score >= 75) {
    return {
      primary: "rgba(31,180,100,0.95)",
      secondary: "rgba(31,180,100,0.2)",
      label: "STRONG",
      arcColor: "#1FB464",
    };
  }
  if (score >= 50) {
    return {
      primary: "rgba(203,184,146,0.95)",
      secondary: "rgba(203,184,146,0.2)",
      label: "BUILDING",
      arcColor: "#CBB892",
    };
  }
  return {
    primary: "rgba(255,255,255,0.65)",
    secondary: "rgba(255,255,255,0.1)",
    label: "EARLY",
    arcColor: "rgba(255,255,255,0.5)",
  };
}

/** Generates the SVG arc path for the progress ring */
function describeArc(cx: number, cy: number, r: number, fraction: number): string {
  // Clamp so we never draw a full circle (which collapses to nothing)
  const f = Math.min(Math.max(fraction, 0), 0.999);
  const startAngle = -Math.PI / 2; // Top
  const endAngle = startAngle + 2 * Math.PI * f;

  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);

  const largeArc = f > 0.5 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export function MentalHandicapBadge({
  score = 0,
  size = 64,
  variant = "score",
  className = "",
}: MentalHandicapBadgeProps) {
  const band = getBand(score);
  const fraction = Math.min(score / 100, 1);

  // Layout constants — all relative to size
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.44; // Progress arc radius
  const strokeW = size * 0.065;

  // Track path (full circle, muted)
  const trackPath = describeArc(cx, cy, outerR, 0.999);
  // Progress arc
  const progressPath = describeArc(cx, cy, outerR, fraction);

  if (variant === "icon") {
    // Minimal emblem — just the ring + "MH" monogram
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label={`Mental Handicap ${score}`}
      >
        {/* Background circle */}
        <circle cx={cx} cy={cy} r={cx - 1} fill="rgba(8,19,13,0.8)" stroke={band.secondary} strokeWidth="1" />

        {/* Track */}
        <path d={trackPath} stroke={band.secondary} strokeWidth={strokeW} strokeLinecap="round" fill="none" />

        {/* Progress */}
        {fraction > 0 && (
          <path d={progressPath} stroke={band.arcColor} strokeWidth={strokeW} strokeLinecap="round" fill="none" />
        )}

        {/* MH monogram */}
        <text
          x={cx}
          y={cy + size * 0.08}
          textAnchor="middle"
          fill={band.primary}
          fontSize={size * 0.3}
          fontFamily="Georgia, serif"
          fontWeight="bold"
        >
          MH
        </text>
      </svg>
    );
  }

  // Score variant — score number + band label
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={`Mental Handicap ${score} — ${band.label}`}
    >
      {/* Background circle */}
      <circle cx={cx} cy={cy} r={cx - 1} fill="rgba(8,19,13,0.85)" stroke={band.secondary} strokeWidth="1" />

      {/* Track ring */}
      <path d={trackPath} stroke={band.secondary} strokeWidth={strokeW} strokeLinecap="round" fill="none" />

      {/* Progress ring */}
      {fraction > 0 && (
        <path
          d={progressPath}
          stroke={band.arcColor}
          strokeWidth={strokeW}
          strokeLinecap="round"
          fill="none"
          style={{
            filter: `drop-shadow(0 0 ${size * 0.04}px ${band.arcColor})`,
          }}
        />
      )}

      {/* Score number */}
      <text
        x={cx}
        y={cy + size * 0.06}
        textAnchor="middle"
        fill={band.primary}
        fontSize={size * 0.36}
        fontFamily="Georgia, serif"
        fontWeight="bold"
        letterSpacing="-1"
      >
        {score}
      </text>

      {/* Band label */}
      <text
        x={cx}
        y={cy + size * 0.28}
        textAnchor="middle"
        fill={band.secondary.replace("0.2", "0.7")}
        fontSize={size * 0.1}
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        letterSpacing="2"
      >
        {band.label}
      </text>
    </svg>
  );
}
