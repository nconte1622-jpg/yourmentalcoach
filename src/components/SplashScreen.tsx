import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

/**
 * Premium opening presence animation
 * 
 * Sequence:
 * 1. Breathing glyph appears (0-600ms)
 * 2. Title fades in (600-1200ms)
 * 3. Hold briefly, then exit (1200-1800ms)
 * 
 * Feel: calm, intelligent, non-technical
 */
export const SplashScreen = ({ onComplete, duration = 1800 }: SplashScreenProps) => {
  const [phase, setPhase] = useState<"glyph" | "text" | "exit">("glyph");

  useEffect(() => {
    // Phase 1: Glyph breathes alone (600ms)
    const textTimer = setTimeout(() => {
      setPhase("text");
    }, 600);

    // Phase 2: Begin exit
    const exitTimer = setTimeout(() => {
      setPhase("exit");
    }, duration - 400);

    // Complete and unmount
    const completeTimer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center",
        "bg-gradient-to-b from-[hsl(158_22%_8%)] via-[hsl(160_20%_7%)] to-[hsl(155_18%_6%)]",
        "transition-opacity duration-500 ease-out",
        phase === "exit" && "opacity-0 pointer-events-none"
      )}
    >
      {/* Breathing Glyph - centered, calm presence */}
      <div
        className={cn(
          "relative flex items-center justify-center transition-all duration-700 ease-out",
          phase === "glyph" && "opacity-100 scale-100",
          phase === "text" && "opacity-100 scale-100 -translate-y-6",
          phase === "exit" && "opacity-0 scale-95 -translate-y-8"
        )}
      >
        {/* Outer breathing ring */}
        <div 
          className="absolute w-16 h-16 rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(158 35% 30% / 0.3) 0%, transparent 70%)",
            animation: "splash-breathe 2.5s ease-in-out infinite",
          }}
        />
        
        {/* Middle ring */}
        <div 
          className="absolute w-10 h-10 rounded-full border border-[hsl(158_30%_35%_/_0.4)]"
          style={{
            animation: "splash-breathe 2.5s ease-in-out infinite",
            animationDelay: "0.3s",
          }}
        />
        
        {/* Inner ring */}
        <div 
          className="absolute w-6 h-6 rounded-full border border-[hsl(158_30%_40%_/_0.5)]"
          style={{
            animation: "splash-breathe 2.5s ease-in-out infinite",
            animationDelay: "0.6s",
          }}
        />
        
        {/* Core dot - steady glow */}
        <div 
          className="w-2.5 h-2.5 rounded-full bg-[hsl(158_40%_45%)]"
          style={{
            boxShadow: "0 0 12px 4px hsl(158 40% 40% / 0.5)",
            animation: "splash-core-pulse 2.5s ease-in-out infinite",
          }}
        />
      </div>

      {/* Title - fades in after glyph */}
      <div
        className={cn(
          "mt-12 text-center transition-all duration-700 ease-out",
          phase === "glyph" && "opacity-0 translate-y-4",
          phase === "text" && "opacity-100 translate-y-0",
          phase === "exit" && "opacity-0 -translate-y-2"
        )}
      >
        <h1 className="text-2xl md:text-3xl font-serif text-[hsl(150_12%_85%)] tracking-wide">
          Your Mental Coach
        </h1>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes splash-breathe {
          0%, 100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.15);
            opacity: 1;
          }
        }
        
        @keyframes splash-core-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
