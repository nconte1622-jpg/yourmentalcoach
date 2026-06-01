import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type MoodMode = "calm" | "reset" | "pressure" | "frustration";

interface LRMIndicatorProps {
  className?: string;
  mode?: MoodMode;
  /** When true, enhances the glow to indicate personalized memory is active */
  memoryActive?: boolean;
  /** Ambient mode: more subtle, always-visible presence */
  ambient?: boolean;
}

/**
 * Premium animated LRM orb indicator
 * A symbolic, breathing indicator that signals the adaptive response system is active.
 * Represents quiet intelligence — not a feature, but ambient awareness.
 */
export function LRMIndicator({ 
  className, 
  mode = "calm", 
  memoryActive = false,
  ambient = false 
}: LRMIndicatorProps) {
  // Get glow color based on mode
  const getGlowColor = () => {
    switch (mode) {
      case "reset":
        return "hsl(195 45% 45%)";
      case "pressure":
        return "hsl(270 35% 50%)";
      case "frustration":
        return "hsl(28 30% 45%)";
      default:
        return "hsl(158 40% 40%)";
    }
  };

  const getCoreColor = () => {
    switch (mode) {
      case "reset":
        return "hsl(195 50% 55%)";
      case "pressure":
        return "hsl(270 40% 60%)";
      case "frustration":
        return "hsl(28 35% 55%)";
      default:
        return "hsl(158 45% 45%)";
    }
  };

  const getRingColor = () => {
    switch (mode) {
      case "reset":
        return "hsl(195 40% 50% / 0.5)";
      case "pressure":
        return "hsl(270 30% 55% / 0.5)";
      case "frustration":
        return "hsl(28 25% 50% / 0.4)";
      default:
        return "hsl(158 35% 45% / 0.5)";
    }
  };

  // Slower animation for frustration mode, faster pulse when memory active
  const getAnimationDuration = () => {
    if (memoryActive) return "3s";
    if (mode === "frustration") return "8s";
    if (ambient) return "7s";
    return "5s";
  };

  const animationDuration = getAnimationDuration();
  
  // Ambient mode: more subtle, reduced opacity
  const baseOpacity = ambient ? 0.6 : 1;
  const glowIntensity = memoryActive ? 1.4 : ambient ? 0.7 : 1;
  const size = ambient ? "w-6 h-6" : "w-8 h-8";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "relative flex items-center justify-center cursor-help transition-all duration-500",
            size,
            className
          )}
          style={{
            opacity: baseOpacity,
            filter: memoryActive 
              ? `drop-shadow(0 0 12px ${getGlowColor()}) drop-shadow(0 0 24px ${getGlowColor()}) drop-shadow(0 0 36px ${getGlowColor()})`
              : `drop-shadow(0 0 ${8 * glowIntensity}px ${getGlowColor()}) drop-shadow(0 0 ${16 * glowIntensity}px ${getGlowColor()})`,
          }}
        >
          {/* Outer breathing ring */}
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, ${getRingColor()} 0%, transparent 70%)`,
              opacity: memoryActive ? 0.5 : 0.3,
              animation: `lrm-breathe ${animationDuration} ease-in-out infinite`,
            }}
          />

          {/* Middle pulsing ring */}
          <div 
            className="absolute inset-1 rounded-full"
            style={{
              border: `1px solid ${getRingColor()}`,
              animation: `lrm-breathe ${animationDuration} ease-in-out infinite`,
              animationDelay: "0.5s",
            }}
          />

          {/* Inner ring */}
          <div 
            className="absolute inset-2 rounded-full"
            style={{
              border: `1px solid ${getRingColor()}`,
              opacity: memoryActive ? 0.8 : 0.6,
              animation: `lrm-breathe ${animationDuration} ease-in-out infinite`,
              animationDelay: "1s",
            }}
          />

          {/* Core dot - steady glow, enhanced when memory active */}
          <div 
            className={cn(
              "rounded-full transition-all duration-500",
              ambient ? "w-1.5 h-1.5" : "w-2 h-2"
            )}
            style={{
              backgroundColor: getCoreColor(),
              boxShadow: memoryActive 
                ? `0 0 10px 4px ${getCoreColor()}`
                : `0 0 6px 2px ${getCoreColor()}`,
              animation: `lrm-core-pulse ${animationDuration} ease-in-out infinite`,
            }}
          />

          {/* Memory active halo - only shows when personalized recall is used */}
          {memoryActive && (
            <div 
              className="absolute -inset-1 rounded-full pointer-events-none"
              style={{
                border: `1px solid ${getCoreColor()}`,
                opacity: 0.4,
                animation: `lrm-memory-pulse 2s ease-in-out infinite`,
              }}
            />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent 
        side="bottom" 
        className="bg-card/95 backdrop-blur-md border-foreground/10 text-foreground/70 text-[11px] max-w-[180px] text-center py-2 px-3"
      >
        <p>{memoryActive ? "Memory recall active" : "Adaptive responses active"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
