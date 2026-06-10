import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

/**
 * The Caddie — Premium opening splash
 *
 * Sequence:
 * 1. Flag logo breathes into view (0–600ms)
 * 2. "THE CADDIE" wordmark + tagline fade in (600–1200ms)
 * 3. Hold briefly, then exit (1200–1800ms)
 *
 * Feel: calm, premium, golf-native. Not tech. Not gym.
 */
export const SplashScreen = ({ onComplete, duration = 1800 }: SplashScreenProps) => {
  const [phase, setPhase] = useState<"glyph" | "text" | "exit">("glyph");

  useEffect(() => {
    const textTimer = setTimeout(() => setPhase("text"), 600);
    const exitTimer = setTimeout(() => setPhase("exit"), duration - 400);
    const completeTimer = setTimeout(() => onComplete(), duration);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  return (
    <div
      className={cn(
        // z-index must sit above all app chrome (the active-round chip is z-65,
        // toasts/modals up to z-70) so nothing pokes through during boot.
        "fixed inset-0 z-[120] flex flex-col items-center justify-center",
        "bg-gradient-to-b from-[#050c08] via-[#080f0b] to-[#040705]",
        "transition-opacity duration-500 ease-out",
        phase === "exit" && "opacity-0 pointer-events-none"
      )}
    >
      {/* Logo mark */}
      <div
        className={cn(
          "relative flex flex-col items-center justify-center transition-all duration-700 ease-out",
          phase === "glyph" && "opacity-100 scale-100",
          phase === "text" && "opacity-100 scale-100 -translate-y-8",
          phase === "exit" && "opacity-0 scale-95 -translate-y-12"
        )}
      >
        {/* Outer breathing aura */}
        <div
          className="absolute w-28 h-28 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(203,184,146,0.10) 0%, transparent 70%)",
            animation: "splash-breathe 3s ease-in-out infinite",
          }}
        />

        {/* The Caddie SVG flag mark */}
        <svg
          width="60"
          height="60"
          viewBox="0 0 56 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ animation: "splash-core-pulse 3s ease-in-out infinite" }}
        >
          {/* Flag pole */}
          <line x1="20" y1="7" x2="20" y2="49" stroke="#CBB892" strokeWidth="2.2" strokeLinecap="round" />
          {/* Flag */}
          <path d="M20 7 L39 14.5 L20 22 Z" fill="#CBB892" opacity="0.92" />
          {/* Ground */}
          <line x1="11" y1="49" x2="29" y2="49" stroke="rgba(203,184,146,0.38)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="20" cy="49" r="2" fill="rgba(203,184,146,0.3)" />
        </svg>
      </div>

      {/* Wordmark + tagline */}
      <div
        className={cn(
          "mt-10 text-center transition-all duration-700 ease-out space-y-2.5",
          phase === "glyph" && "opacity-0 translate-y-4",
          phase === "text" && "opacity-100 translate-y-0",
          phase === "exit" && "opacity-0 -translate-y-2"
        )}
      >
        <h1 className="text-3xl md:text-4xl font-serif tracking-[0.14em]" style={{ color: "rgba(203,184,146,0.95)" }}>
          THE CADDIE
        </h1>
        <p className="text-[10px] tracking-[0.22em] font-light" style={{ color: "rgba(255,255,255,0.32)" }}>
          GOLF IS 90% MENTAL
        </p>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes splash-breathe {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.18); opacity: 1; }
        }
        @keyframes splash-core-pulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
