import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface PreGameTalkProps {
  onClose: () => void;
}

const PRE_GAME_TALKS = [
  `Nerves are normal. They mean you care. Today, forget the score. Your one job: {{focus:commit}} to every shot. Nothing else matters. "One shot, full commitment."`,
  `You don't need to play perfect today. You just need to be {{focus:present}}. Stay in this shot, not the next. "Eyes on the target. Trust your swing."`,
  `Pressure is just focus with tension. Let the tension go. Today's word is {{focus:patience}}. Let the round unfold. "One shot at a time."`,
  `You've done the work. Now get out of your own way. Today is about {{focus:trust}}. Trust your preparation. "See it, commit, let go."`,
  `Excitement and nerves feel the same. Channel it. Today's priority: {{focus:simplicity}}. Target, commit, swing. That's it. "Keep it simple."`,
  `No predictions. No expectations. Just {{focus:process}}. Every shot is a fresh start. "This shot, right now."`,
];

export function PreGameTalk({ onClose }: PreGameTalkProps) {
  const [talk] = useState(() =>
    PRE_GAME_TALKS[Math.floor(Math.random() * PRE_GAME_TALKS.length)]
  );

  const renderContent = useCallback((text: string) => {
    const parts = text.split(/({{[^}]+}})/g);
    return parts.map((part, index) => {
      const match = part.match(/{{focus:([^}]+)}}/);
      if (match) {
        const [, word] = match;
        return (
          <span key={index} className="font-semibold text-cue-focus">
            {word}
          </span>
        );
      }
      return part;
    });
  }, []);

  // Extract the final quote line
  const lines = talk.split('"');
  const mainText = lines.slice(0, -2).join('"') + '"' + lines[lines.length - 2] + '"';
  const closingQuote = lines.length > 2 ? `"${lines[lines.length - 2]}"` : null;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-1">
          <h2 className="text-lg font-serif text-foreground">Pre-Game Talk</h2>
          <p className="text-xs text-muted-foreground/60">Before you step to the first tee.</p>
        </div>

        {/* Talk content */}
        <div className="bg-card rounded-xl p-5 border border-border/50">
          <p className="text-sm leading-relaxed font-light text-foreground">
            {renderContent(talk)}
          </p>
        </div>

        {/* Close button */}
        <div className="text-center">
          <Button onClick={onClose} className="px-8">
            Let's Go
          </Button>
        </div>
      </div>
    </div>
  );
}
