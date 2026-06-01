import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { TypingIndicator } from "@/components/TypingIndicator";
import { LRMIndicator } from "@/components/LRMIndicator";
import { PageShell } from "@/components/PageShell";
import { useMentalCoach } from "@/hooks/useMentalCoach";
import { Button } from "@/components/ui/button";
import { triggerHaptic } from "@/lib/haptics";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";

const RoundReset = () => {
  const navigate = useNavigate();
  const { messages = [], isTyping, sendMessage, getResetCue, setFeedback } = useMentalCoach();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerHaptic("medium");
      getResetCue("reset");
    }, 400);
    return () => clearTimeout(timer);
  }, [getResetCue]);

  const displayMessages = messages?.slice(-3) || [];

  return (
    <PageShell backgroundVariant="calm">
      <AppShell
        contentClassName="flex flex-col"
        header={
          <AppHeader
            left={
              <button
                type="button"
                onClick={() => navigate("/round")}
                className="header-hit-button tap-44 text-foreground/75 hover:text-foreground hover:bg-foreground/10 transition-all duration-300"
              >
                ← Back
              </button>
            }
            center={<div className="mx-auto max-w-[240px]"><h1 className="truncate text-base md:text-lg font-serif tracking-wide text-foreground">Reset Mode</h1></div>}
            right={<div className="tap-44 flex items-center justify-end"><LRMIndicator mode="reset" /></div>}
          />
        }
      >
        <main className="flex-1 overflow-y-auto py-8 flex items-center min-h-0">
          <div className="max-w-xl mx-auto w-full space-y-6">
            {displayMessages.map((message, index) => (
              <div key={message.id} className="transition-all duration-500 animate-fade-in">
                <ChatMessage
                  content={message.content}
                  isUser={message.isUser}
                  isLatest={index === displayMessages.length - 1}
                  messageId={message.id}
                  feedback={message.feedback}
                  onFeedback={setFeedback}
                  showFeedback={message.id !== "greeting"}
                  isFrustrationMode={false}
                />
              </div>
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <div className="shrink-0 max-w-xl mx-auto w-full pb-8 space-y-4">
          <Button
            onClick={() => {
              triggerHaptic("medium");
              getResetCue("reset");
            }}
            disabled={isTyping}
            className="w-full py-7 text-base font-medium rounded-3xl bg-cue-calm/90 hover:bg-cue-calm shadow-lg shadow-cue-calm/20 hover:shadow-xl transition-all duration-300 btn-press"
            size="lg"
          >
            Reset Again
          </Button>
          <ChatInput
            onSend={sendMessage}
            disabled={isTyping}
            placeholder="Take your time..."
          />
        </div>
      </AppShell>
    </PageShell>
  );
};

export default RoundReset;
