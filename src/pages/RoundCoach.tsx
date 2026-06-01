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

const RoundCoach = () => {
  const navigate = useNavigate();
  const { messages = [], isTyping, sendMessage, getQuickCue, setFeedback } = useMentalCoach();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerHaptic("soft");
      getQuickCue("coach");
    }, 400);
    return () => clearTimeout(timer);
  }, [getQuickCue]);

  const displayMessages = messages?.slice(-3) || [];

  return (
    <PageShell backgroundVariant="deep">
      <AppShell
        contentClassName="flex flex-col"
        header={
          <AppHeader
            left={
              <button
                type="button"
                onClick={() => navigate("/round")}
                className="header-hit-button tap-44 text-white/75 hover:text-white hover:bg-white/10 transition-all duration-300"
              >
                ← Back
              </button>
            }
            center={
              <div className="mx-auto max-w-[240px]">
                <h1 className="truncate text-base md:text-lg font-serif tracking-wide text-white/95">
                  Coach Mode
                </h1>
              </div>
            }
            right={<div className="tap-44 flex items-center justify-end"><LRMIndicator mode="calm" /></div>}
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
              triggerHaptic("soft");
              getQuickCue("coach");
            }}
            disabled={isTyping}
            className="w-full py-7 text-base font-medium rounded-3xl bg-cue-focus/90 hover:bg-cue-focus shadow-lg shadow-cue-focus/20 hover:shadow-xl transition-all duration-300 btn-press"
            size="lg"
          >
            Another Cue
          </Button>
          <ChatInput
            onSend={sendMessage}
            disabled={isTyping}
            placeholder="What's on your mind..."
          />
        </div>
      </AppShell>
    </PageShell>
  );
};

export default RoundCoach;
