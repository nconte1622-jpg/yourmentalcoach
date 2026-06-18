import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { useProStatus } from "@/hooks/useProStatus";

interface LRMModesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user taps Close Strong but isn't Pro — lets the parent show the upgrade modal */
  onCloseStrongUpgrade?: () => void;
}

type SelectedMode = "coach" | "reset" | "close-strong" | null;

export function LRMModesModal({ open, onOpenChange, onCloseStrongUpgrade }: LRMModesModalProps) {
  const navigate = useNavigate();
  const { isPro } = useProStatus();
  const [selectedMode, setSelectedMode] = useState<SelectedMode>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleModeSelect = useCallback((mode: SelectedMode) => {
    if (!mode) return;

    // Close Strong is Pro-only — gate it consistently here too
    if (mode === "close-strong" && !isPro) {
      triggerHaptic("soft");
      onOpenChange(false);
      onCloseStrongUpgrade?.();
      return;
    }

    triggerHaptic("medium");
    setSelectedMode(mode);
    setIsTransitioning(true);

    // Animate then navigate
    setTimeout(() => {
      navigate(`/round/${mode}`);
      onOpenChange(false);
      // Reset state after navigation
      setTimeout(() => {
        setSelectedMode(null);
        setIsTransitioning(false);
      }, 100);
    }, 500);
  }, [isPro, navigate, onCloseStrongUpgrade, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay 
        className={cn(
          "fixed inset-0 z-50 transition-all duration-500",
          isTransitioning 
            ? "bg-black/60 backdrop-blur-md" 
            : "bg-black/40 backdrop-blur-sm"
        )} 
      />
      <DialogContent 
        className={cn(
          "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
          "w-[90vw] max-w-md p-0 border-0 bg-transparent shadow-none",
          "transition-all duration-500",
          isTransitioning && "scale-105 opacity-0"
        )}
      >
        {/* Transitioning overlay pulse effect */}
        {isTransitioning && (
          <div 
            className={cn(
              "absolute inset-[-100px] rounded-full animate-lrm-pulse z-0",
              selectedMode === "coach" && "bg-cue-focus/20",
              selectedMode === "reset" && "bg-cue-calm/20",
              selectedMode === "close-strong" && "bg-close-strong-accent/20"
            )}
          />
        )}

        <div className={cn(
          "relative z-10 flex flex-col gap-5 transition-all duration-300",
          isTransitioning && "opacity-0 scale-95"
        )}>
          {/* Header */}
          <div className="text-center mb-2">
            <h2 className="text-2xl md:text-3xl font-serif text-white/95 tracking-wide">
              Choose Mode
            </h2>
            <p className="text-sm text-white/50 mt-2 font-light tracking-wide">
              Choose your focus
            </p>
          </div>

          {/* Coach Mode Option */}
          <button
            onClick={() => handleModeSelect("coach")}
            disabled={isTransitioning}
            className={cn(
              "group relative rounded-3xl p-8 text-left transition-all duration-300",
              "bg-gradient-to-br from-[hsl(158_38%_22%)] to-[hsl(158_30%_26%)]",
              "hover:from-[hsl(158_40%_24%)] hover:to-[hsl(158_32%_28%)]",
              "shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-cue-focus/20",
              "btn-press",
              selectedMode === "coach" && "ring-2 ring-cue-focus/50"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                <span className="text-2xl">🎯</span>
              </div>
              <div>
                <h3 className="text-xl font-serif text-white/95 tracking-wide">
                  Coach Mode
                </h3>
                <p className="text-sm text-white/60 mt-1 font-light">
                  Focus cues for the next shot
                </p>
              </div>
            </div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-white/30 group-hover:text-white/50 transition-colors">
              →
            </div>
          </button>

          {/* Reset Mode Option */}
          <button
            onClick={() => handleModeSelect("reset")}
            disabled={isTransitioning}
            className={cn(
              "group relative rounded-3xl p-8 text-left transition-all duration-300",
              "bg-gradient-to-br from-[hsl(195_28%_28%)] to-[hsl(190_24%_32%)]",
              "hover:from-[hsl(195_30%_30%)] hover:to-[hsl(190_26%_34%)]",
              "shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-cue-calm/20",
              "btn-press",
              selectedMode === "reset" && "ring-2 ring-cue-calm/50"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                <span className="text-2xl">🌿</span>
              </div>
              <div>
                <h3 className="text-xl font-serif text-white/95 tracking-wide">
                  Reset Mode
                </h3>
                <p className="text-sm text-white/60 mt-1 font-light">
                  Ground and refocus your mind
                </p>
              </div>
            </div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-white/30 group-hover:text-white/50 transition-colors">
              →
            </div>
          </button>

          {/* Close Strong Mode Option */}
          <button
            onClick={() => handleModeSelect("close-strong")}
            disabled={isTransitioning}
            className={cn(
              "group relative rounded-3xl p-8 text-left transition-all duration-300",
              "bg-gradient-to-br from-[hsl(158_20%_12%)] to-[hsl(160_18%_8%)]",
              "hover:from-[hsl(158_22%_14%)] hover:to-[hsl(160_20%_10%)]",
              "shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-close-strong-accent/15",
              "btn-press border border-white/5",
              selectedMode === "close-strong" && "ring-2 ring-close-strong-accent/50"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                <span className="text-2xl">🏁</span>
              </div>
              <div>
                <h3 className="text-xl font-serif text-white/95 tracking-wide">
                  Close Strong
                </h3>
                <p className="text-sm text-white/50 mt-1 font-light">
                  Finish with intention
                </p>
              </div>
            </div>
            {!isPro && (
              <span className="absolute top-3 right-3 rounded-full border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[rgba(203,184,146,0.85)]">
                Pro
              </span>
            )}
            <div className={cn(
              "absolute right-6 top-1/2 -translate-y-1/2 transition-colors",
              isPro ? "text-white/25 group-hover:text-white/40" : "text-white/15"
            )}>
              {isPro ? "→" : "🔒"}
            </div>
          </button>

          {/* Cancel hint */}
          <p className="text-center text-xs text-white/30 mt-2">
            Tap outside to cancel
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
