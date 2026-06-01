import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface LockerRoomProps {
  onClose: () => void;
  onSaveHighlight?: (reflection: string) => void;
}

const INITIAL_PROMPT = "Pick one moment from today. Good or bad. What happened?";

const FEELING_PROMPTS = [
  "What were you feeling right before that shot?",
  "Were you committed, or was there hesitation?",
  "What was going through your mind in that moment?",
];

const POSITIVE_REFLECTIONS = [
  `That's {{calm:clarity}}. You committed and let it go. The word is {{focus:commit}}. It's there when you need it.`,
  `That was {{calm:freedom}}. No steering, no forcing. Your cue is {{focus:trust}}. Carry it forward.`,
  `You found {{calm:presence}}. Quiet mind, clear target. The word is {{focus:present}}. That's your anchor.`,
  `That's what {{calm:certainty}} feels like. One decision, full commitment. Your cue is {{focus:decide}}. Use it.`,
];

const MIXED_REFLECTIONS = [
  `The doubt was there, but you swung anyway. That's honest. Next time, notice the hesitation earlier. One word: {{focus:commit}} — before you start.`,
  `Tension crept in. That's useful to notice. The cue for next time: {{focus:breathe}}. Soften before you swing.`,
  `You felt the pull to steer it. Most golfers do. The reminder is simple: {{focus:target}}. Lock your eyes, trust your hands.`,
];

const NEGATIVE_TAKEAWAYS = [
  "That's real. Not every round has a highlight. What you noticed today — that's data. Use it next time.",
  "Sometimes the lesson is just awareness. You saw it. That's progress, even if it didn't feel like it.",
  "No highlight needed. But you showed up and paid attention. That matters more than one shot.",
];

type StepType = "initial" | "feeling" | "processing" | "positive" | "mixed" | "negative" | "saved";

const POSITIVE_KEYWORDS = ["committed", "free", "calm", "clear", "confident", "trusted", "focused", "smooth", "easy", "pure", "effortless"];
const NEGATIVE_KEYWORDS = ["doubt", "tight", "scared", "nervous", "hesitant", "tense", "rushed", "forced", "steered", "anxious", "worried"];

export function LockerRoom({ onClose, onSaveHighlight }: LockerRoomProps) {
  const [step, setStep] = useState<StepType>("initial");
  const [momentInput, setMomentInput] = useState("");
  const [feelingInput, setFeelingInput] = useState("");
  const [currentReflection, setCurrentReflection] = useState("");
  const [feelingPrompt] = useState(() => 
    FEELING_PROMPTS[Math.floor(Math.random() * FEELING_PROMPTS.length)]
  );

  const analyzeFeeling = useCallback((text: string) => {
    const lower = text.toLowerCase();
    const hasPositive = POSITIVE_KEYWORDS.some(word => lower.includes(word));
    const hasNegative = NEGATIVE_KEYWORDS.some(word => lower.includes(word));
    
    if (hasPositive && !hasNegative) return "positive";
    if (hasNegative && !hasPositive) return "negative";
    if (hasPositive && hasNegative) return "mixed";
    // Default to mixed if unclear
    return "mixed";
  }, []);

  const handleMomentSubmit = useCallback(() => {
    setStep("feeling");
  }, []);

  const handleFeelingSubmit = useCallback(() => {
    setStep("processing");
    
    setTimeout(() => {
      const sentiment = analyzeFeeling(feelingInput);
      
      if (sentiment === "positive") {
        setCurrentReflection(POSITIVE_REFLECTIONS[Math.floor(Math.random() * POSITIVE_REFLECTIONS.length)]);
        setStep("positive");
      } else if (sentiment === "mixed") {
        setCurrentReflection(MIXED_REFLECTIONS[Math.floor(Math.random() * MIXED_REFLECTIONS.length)]);
        setStep("mixed");
      } else {
        setCurrentReflection(NEGATIVE_TAKEAWAYS[Math.floor(Math.random() * NEGATIVE_TAKEAWAYS.length)]);
        setStep("negative");
      }
    }, 1200);
  }, [feelingInput, analyzeFeeling]);

  const handleSaveHighlight = useCallback((save: boolean) => {
    if (save && onSaveHighlight) {
      onSaveHighlight(currentReflection);
    }
    setStep("saved");
    setTimeout(() => {
      onClose();
    }, 1500);
  }, [currentReflection, onSaveHighlight, onClose]);

  const renderContent = (text: string) => {
    const parts = text.split(/({{[^}]+}})/g);
    return parts.map((part, index) => {
      const match = part.match(/{{(focus|calm):([^}]+)}}/);
      if (match) {
        const [, type, word] = match;
        const colorClass = type === "focus" ? "text-cue-focus" : "text-cue-calm";
        return (
          <span key={index} className={`font-medium ${colorClass}`}>
            {word}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-1">
          <h2 className="text-lg font-serif text-foreground">Post-Round Locker Room</h2>
          <p className="text-xs text-muted-foreground/60">A moment to reflect.</p>
        </div>

        {step === "initial" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              {INITIAL_PROMPT}
            </p>
            <textarea
              value={momentInput}
              onChange={(e) => setMomentInput(e.target.value)}
              placeholder="Describe the moment..."
              className="w-full min-h-[100px] p-3 rounded-lg bg-card border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
            />
            <div className="flex gap-3">
              <Button variant="ghost" onClick={onClose} className="flex-1 text-muted-foreground">
                Skip
              </Button>
              <Button onClick={handleMomentSubmit} disabled={!momentInput.trim()} className="flex-1">
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "feeling" && (
          <div className="space-y-4 animate-fade-in">
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              {feelingPrompt}
            </p>
            <textarea
              value={feelingInput}
              onChange={(e) => setFeelingInput(e.target.value)}
              placeholder="Be honest..."
              className="w-full min-h-[80px] p-3 rounded-lg bg-card border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
            />
            <Button onClick={handleFeelingSubmit} disabled={!feelingInput.trim()} className="w-full">
              Reflect
            </Button>
          </div>
        )}

        {step === "processing" && (
          <div className="text-center py-8">
            <div className="flex justify-center gap-1">
              <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-pulse" />
              <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-pulse [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-pulse [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {(step === "positive" || step === "mixed") && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-card rounded-xl p-4 border border-border/50">
              <p className="text-sm leading-relaxed font-light text-foreground">
                {renderContent(currentReflection)}
              </p>
            </div>
            
            <div className="text-center space-y-3">
              <p className="text-xs text-muted-foreground">Save this feeling as a highlight?</p>
              <div className="flex gap-3 justify-center">
                <Button variant="ghost" size="sm" onClick={() => handleSaveHighlight(false)} className="text-muted-foreground">
                  No
                </Button>
                <Button size="sm" onClick={() => handleSaveHighlight(true)}>
                  Yes
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "negative" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-card rounded-xl p-4 border border-border/50">
              <p className="text-sm leading-relaxed font-light text-foreground">
                {currentReflection}
              </p>
            </div>
            
            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
                Close
              </Button>
            </div>
          </div>
        )}

        {step === "saved" && (
          <div className="text-center py-8 animate-fade-in">
            <p className="text-sm text-muted-foreground">
              ✓ Saved to your highlights.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
