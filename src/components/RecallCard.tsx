import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecallCardProps {
  text: string;
  onDismiss: () => void;
  className?: string;
}

export const RecallCard = ({ text, onDismiss, className }: RecallCardProps) => {
  return (
    <div
      className={cn(
        "card-floating card-active-backdrop is-active px-5 py-4 animate-fade-in",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* LRM Label */}
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1 h-1 bg-cue-focus/50 rounded-full" />
            <span className="text-[10px] text-muted-foreground/35 tracking-widest uppercase font-light">
              LRM Recall
            </span>
          </div>
          <p className="text-sm text-foreground/75 leading-relaxed tracking-wide">
            {text}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-muted-foreground/20 hover:text-muted-foreground/45 transition-flow flex-shrink-0 mt-1 btn-press"
          aria-label="Dismiss recall"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};