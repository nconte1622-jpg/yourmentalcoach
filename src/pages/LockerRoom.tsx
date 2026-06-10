import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/PageShell";
import { LRMIndicator } from "@/components/LRMIndicator";
import { streamCoachResponse, ChatMessage } from "@/lib/mentalCoachApi";
import { saveHighlight, extractCueWords, inferContextTag } from "@/lib/memoryStorage";
import { useMemories } from "@/hooks/useMemories";
import { useProStatus } from "@/hooks/useProStatus";
import { extractMemoriesFromReflection } from "@/lib/memoryExtraction";

type StepType = "initial" | "feeling" | "processing" | "reflection" | "saved";

const LockerRoomPage = () => {
  const navigate = useNavigate();
  const { createMemories } = useMemories();
  const { isPro } = useProStatus();
  const [step, setStep] = useState<StepType>("initial");
  const [momentInput, setMomentInput] = useState("");
  const [feelingInput, setFeelingInput] = useState("");
  const [reflection, setReflection] = useState("");
  const [clarifyingQuestion, setClarifyingQuestion] = useState("");
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);

  const handleMomentSubmit = useCallback(() => {
    setStep("processing");
    
    const messages: ChatMessage[] = [
      { role: "user", content: `I want to reflect on a moment from my round today: ${momentInput}` },
    ];
    
    setConversationHistory(messages);
    let content = "";

    streamCoachResponse({
      messages,
      context: "locker-room",
      onDelta: (delta) => {
        content += delta;
        setClarifyingQuestion(content);
      },
      onDone: () => {
        setStep("feeling");
      },
      onError: (error) => {
        setClarifyingQuestion(error);
        setStep("feeling");
      },
    });
  }, [momentInput]);

  const handleFeelingSubmit = useCallback(() => {
    setStep("processing");
    
    const messages: ChatMessage[] = [
      ...conversationHistory,
      { role: "assistant", content: clarifyingQuestion },
      { role: "user", content: feelingInput },
    ];
    
    let content = "";

    streamCoachResponse({
      messages,
      context: "locker-room",
      onDelta: (delta) => {
        content += delta;
        setReflection(content);
      },
      onDone: () => {
        setStep("reflection");
      },
      onError: (error) => {
        setReflection(error);
        setStep("reflection");
      },
    });
  }, [conversationHistory, clarifyingQuestion, feelingInput]);

  // Extract normalized memory object from reflection
  const extractNormalizedMemory = useCallback(() => {
    // Extract the single emphasized cue word
    const cueWords = extractCueWords(reflection);
    const cueWord = cueWords[0] || "focus";

    // Infer context tag from the moment description
    const contextTag = inferContextTag(momentInput);

    // Build a meaningful mental rule from the full reflection text.
    // Strip cue-word syntax tags, grab the most useful sentence (the
    // REFRAME or NEXT ACTION line), and make it forward-facing.
    // Falls back to a cue-based rule if parsing fails.
    let mentalRule = `When it matters, ${cueWord}.`;
    try {
      // Remove {{focus:word}} / {{calm:word}} markup for plain text
      const plainReflection = reflection.replace(/{{(?:focus|calm):([^}]+)}}/g, "$1");
      const sentences = plainReflection
        .split(/[.!?\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20 && s.length < 180);

      // Prefer the last substantive sentence — it's usually the ACTION line
      if (sentences.length > 0) {
        const candidate = sentences[sentences.length - 1];
        // Make it forward-facing if it isn't already
        if (/^(next|for|when|before|after|on|keep|stay|use|pick|trust|commit|breathe|reset|let|see|slow|be)/i.test(candidate)) {
          mentalRule = candidate.endsWith(".") ? candidate : candidate + ".";
        } else if (sentences.length > 1) {
          const secondLast = sentences[sentences.length - 2];
          mentalRule = secondLast.endsWith(".") ? secondLast : secondLast + ".";
        } else {
          mentalRule = candidate.endsWith(".") ? candidate : candidate + ".";
        }
      }
    } catch {
      /* silent — fall back to cue-based rule */
    }

    return { cueWord, mentalRule, contextTag };
  }, [reflection, momentInput]);

  const handleSaveHighlight = useCallback(async (save: boolean) => {
    try {
      if (save && reflection) {
        const { cueWord, mentalRule, contextTag } = extractNormalizedMemory();
        
        // Only save highlight if we have a valid cue word (positive lesson)
        if (cueWord) {
          saveHighlight({
            date: new Date().toISOString(),
            cueWord,
            mentalRule,
            contextTag,
          });
        }

        // Pro users: Extract and save 2-4 memories to the database for long-term recall
        // Free users: Still get local highlights (above), but no database memories
        if (isPro) {
          const memoryInputs = extractMemoriesFromReflection(
            momentInput,
            feelingInput,
            reflection
          );
          
          if (memoryInputs.length > 0) {
            await createMemories(memoryInputs);
          }
        }
      }
    } catch (error) {
      console.error("Failed to save highlight or memories:", error);
      // Continue anyway - don't block navigation
    }
    
    setStep("saved");
    
    // Navigate to Round Complete page
    setTimeout(() => {
      navigate("/round-complete");
    }, 1200);
  }, [reflection, extractNormalizedMemory, navigate, momentInput, feelingInput, createMemories, isPro]);

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
    <PageShell backgroundVariant="default">
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
          <div className="max-w-md w-full space-y-10">
            {/* Header with LRM indicator top-right */}
            <div className="text-center space-y-3 animate-fade-in-slow relative content-vignette">
              <div className="absolute top-0 right-0">
                <LRMIndicator mode="calm" />
              </div>
              <h2 className="text-3xl font-serif text-foreground/90 tracking-wide">Post-Round Locker Room</h2>
              <p className="text-sm text-muted-foreground/60 tracking-wide helper-text">A moment to reflect.</p>
            </div>

            {step === "initial" && (
              <div className="space-y-6 animate-fade-in">
                <p className="text-base text-muted-foreground/80 text-center leading-relaxed helper-text">
                  Pick one moment from today. Good or bad. What happened?
                </p>
                <textarea
                  value={momentInput}
                  onChange={(e) => setMomentInput(e.target.value)}
                  placeholder="Describe the moment..."
                  className="w-full min-h-[140px] p-5 rounded-2xl bg-white/90 backdrop-blur-sm border border-foreground/12 shadow-inner shadow-foreground/5 text-base text-foreground/90 placeholder:text-muted-foreground/55 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:bg-white/95 focus:shadow-md resize-none transition-all duration-300"
                />
                <div className="flex gap-4">
                  <Button variant="ghost" onClick={() => navigate("/")} className="flex-1 text-muted-foreground/60 hover:text-foreground transition-colors duration-300">
                    Back
                  </Button>
                  <Button onClick={handleMomentSubmit} disabled={!momentInput.trim()} className="flex-1 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 ease-out">
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {step === "processing" && (
              <div className="text-center py-16 animate-fade-in">
                <div className="flex justify-center gap-1.5">
                  <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-breathe" />
                  <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-breathe" style={{ animationDelay: '0.3s' }} />
                  <span className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-breathe" style={{ animationDelay: '0.6s' }} />
                </div>
              </div>
            )}

            {step === "feeling" && (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-foreground/10 shadow-sm">
                  <p className="text-base leading-relaxed font-light text-foreground/90">
                    {renderContent(clarifyingQuestion)}
                  </p>
                </div>
                <textarea
                  value={feelingInput}
                  onChange={(e) => setFeelingInput(e.target.value)}
                  placeholder="Be honest..."
                  className="w-full min-h-[120px] p-5 rounded-2xl bg-white/90 backdrop-blur-sm border border-foreground/12 shadow-inner shadow-foreground/5 text-base text-foreground/90 placeholder:text-muted-foreground/55 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:bg-white/95 focus:shadow-md resize-none transition-all duration-300"
                />
                <Button onClick={handleFeelingSubmit} disabled={!feelingInput.trim()} className="w-full rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 ease-out">
                  Reflect
                </Button>
              </div>
            )}

            {step === "reflection" && (
              <div className="space-y-8 animate-fade-in">
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-foreground/10 shadow-sm">
                  <p className="text-base leading-relaxed font-light text-foreground/90">
                    {renderContent(reflection)}
                  </p>
                </div>
                
                <div className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground/70 helper-text">Save this reflection?</p>
                  <div className="flex gap-4 justify-center">
                    <Button variant="ghost" size="sm" onClick={() => handleSaveHighlight(false)} className="text-muted-foreground/60 hover:text-foreground transition-colors duration-300 px-6">
                      No
                    </Button>
                    <Button size="sm" onClick={() => handleSaveHighlight(true)} className="rounded-xl shadow-sm hover:shadow-md transition-all duration-300 ease-out px-6">
                      Yes
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === "saved" && (
              <div className="text-center py-16 animate-fade-in">
                <p className="text-base text-muted-foreground/70">
                  ✓ Saved to your reflections.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default LockerRoomPage;
