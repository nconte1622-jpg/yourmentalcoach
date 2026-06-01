import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  isFrustrationMode?: boolean;
}

export function TypingIndicator({ isFrustrationMode = false }: TypingIndicatorProps) {
  return (
    <div className="flex justify-start animate-fade-in">
      <div 
        className={cn(
          "rounded-3xl rounded-bl-xl px-6 py-5 transition-flow",
          isFrustrationMode 
            ? "bg-gradient-to-br from-[hsl(158_25%_14%)] to-[hsl(155_22%_16%)] glow-calm animate-breathe" 
            : "chat-bubble-coach"
        )}
      >
        <div className="flex items-center gap-2.5">
          <span 
            className={cn(
              "w-2 h-2 rounded-full animate-pulse-gentle",
              isFrustrationMode ? "bg-[hsl(195_28%_48%)]/50" : "bg-muted-foreground/30"
            )} 
          />
          <span 
            className={cn(
              "w-2 h-2 rounded-full animate-pulse-gentle",
              isFrustrationMode ? "bg-[hsl(195_28%_48%)]/50" : "bg-muted-foreground/30"
            )} 
            style={{ animationDelay: "0.4s" }} 
          />
          <span 
            className={cn(
              "w-2 h-2 rounded-full animate-pulse-gentle",
              isFrustrationMode ? "bg-[hsl(195_28%_48%)]/50" : "bg-muted-foreground/30"
            )} 
            style={{ animationDelay: "0.8s" }} 
          />
        </div>
      </div>
    </div>
  );
}