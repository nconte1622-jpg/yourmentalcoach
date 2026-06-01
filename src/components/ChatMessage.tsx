import { cn } from "@/lib/utils";
import { FeedbackType } from "@/hooks/useMentalCoach";
import { normalizeToCanonical } from "@/lib/canonicalCues";
import { useState, useEffect, useMemo } from "react";
import { getBubbleClasses, ChatTheme } from "@/lib/chatTheme";

interface ChatMessageProps {
  content: string;
  isUser: boolean;
  isLatest?: boolean;
  messageId?: string;
  feedback?: FeedbackType;
  onFeedback?: (messageId: string, feedback: FeedbackType) => void;
  showFeedback?: boolean;
  isFrustrationMode?: boolean;
  theme?: ChatTheme;
}

// Check if a cue word appears elsewhere in the text (outside tags)
const cueAppearsInPlainText = (text: string, cueWord: string): boolean => {
  const plainText = text.replace(/{{[^}]+}}/g, "").toLowerCase();
  const cue = cueWord.toLowerCase();
  const pattern = new RegExp(`\\b${cue}\\b|\\b${cue}s?\\b|\\b${cue}ing\\b|\\b${cue}ed\\b`, "i");
  return pattern.test(plainText);
};

// Parse content into segments for staggered rendering
interface ContentSegment {
  type: "mirror" | "cue" | "directive";
  content: string;
}

const parseIntoSegments = (text: string): ContentSegment[] => {
  const segments: ContentSegment[] = [];
  
  // Find cue tag position
  const cueMatch = text.match(/{{(focus|calm):([^}]+)}}/);
  
  if (!cueMatch) {
    // No cue tag, treat entire text as mirror+directive
    const sentences = text.split(/(?<=[.!?])\s+/);
    if (sentences.length >= 2) {
      // First ~half is mirror+meaning, rest is directive
      const midpoint = Math.ceil(sentences.length / 2);
      segments.push({ type: "mirror", content: sentences.slice(0, midpoint).join(" ") });
      segments.push({ type: "directive", content: sentences.slice(midpoint).join(" ") });
    } else {
      segments.push({ type: "mirror", content: text });
    }
    return segments;
  }
  
  const cueIndex = text.indexOf(cueMatch[0]);
  const beforeCue = text.slice(0, cueIndex).trim();
  const afterCue = text.slice(cueIndex + cueMatch[0].length).trim();
  
  if (beforeCue) {
    segments.push({ type: "mirror", content: beforeCue });
  }
  segments.push({ type: "cue", content: cueMatch[0] });
  if (afterCue) {
    segments.push({ type: "directive", content: afterCue });
  }
  
  return segments;
};

export function ChatMessage({ 
  content, 
  isUser, 
  isLatest = false,
  messageId,
  feedback,
  onFeedback,
  showFeedback = false,
  isFrustrationMode = false,
  theme,
}: ChatMessageProps) {
  // Track which segments are visible for staggered animation
  const [visibleSegments, setVisibleSegments] = useState<Set<number>>(new Set([0]));
  
  const segments = useMemo(() => parseIntoSegments(content), [content]);
  
  // Determine theme - use prop if provided, otherwise derive from frustration mode
  const activeTheme: ChatTheme = theme || (isFrustrationMode ? "frustration" : "default");
  const bubbleClasses = getBubbleClasses(activeTheme);
  
  // Stagger the appearance of segments for coach messages
  useEffect(() => {
    if (isUser || segments.length <= 1) {
      setVisibleSegments(new Set(segments.map((_, i) => i)));
      return;
    }
    
    // Reset and start stagger animation
    setVisibleSegments(new Set([0]));
    
    const timers: NodeJS.Timeout[] = [];
    
    segments.forEach((segment, index) => {
      if (index === 0) return; // First segment is already visible
      
      // Cue gets extra delay (400ms), directive follows (200ms after cue)
      const delay = segment.type === "cue" ? 400 : 
                    segment.type === "directive" ? 600 : 
                    200;
      
      const timer = setTimeout(() => {
        setVisibleSegments(prev => new Set([...prev, index]));
      }, delay);
      
      timers.push(timer);
    });
    
    return () => timers.forEach(t => clearTimeout(t));
  }, [content, isUser, segments]);

  // Render a cue tag with proper styling
  const renderCueTag = (part: string) => {
    const match = part.match(/{{(focus|calm):([^}]+)}}/);
    if (!match) return part;
    
    const [, type, rawWord] = match;
    const word = normalizeToCanonical(rawWord);
    
    // If cue already appears in the plain text, skip the tag entirely
    if (cueAppearsInPlainText(content, word)) {
      return null;
    }
    
    const displayWord = word.charAt(0).toUpperCase() + word.slice(1);
    // Use brighter colors for dark themes
    const colorClass = activeTheme === "dark" 
      ? (type === "focus" ? "text-emerald-400" : "text-sky-400")
      : (type === "focus" ? "text-cue-focus" : "text-cue-calm");
    
    return (
      <span className={`font-medium ${colorClass}`}>
        {displayWord}
      </span>
    );
  };

  // Render content with {{type:word}} syntax parsing
  const renderContent = (text: string) => {
    const parts = text.split(/({{[^}]+}})/g);
    return parts.map((part, index) => {
      const match = part.match(/{{(focus|calm):([^}]+)}}/);
      if (match) {
        return <span key={index}>{renderCueTag(part)}</span>;
      }
      return part;
    });
  };

  const handleFeedback = (type: FeedbackType) => {
    if (messageId && onFeedback) {
      onFeedback(messageId, type);
    }
  };

  const shouldShowFeedbackButtons = showFeedback && !isUser && !feedback && messageId;
  const hasGivenFeedback = !isUser && feedback;

  // Feedback button classes based on theme
  const feedbackBtnClass = activeTheme === "dark"
    ? "text-white/40 hover:text-white/70 hover:bg-white/10"
    : "text-muted-foreground/45 hover:text-muted-foreground/70 hover:bg-muted/30";

  // For user messages or short content, render simply
  if (isUser || segments.length <= 1) {
    return (
      <div
        className={cn(
          "flex w-full flex-col transition-all duration-500",
          isUser ? "items-end" : "items-start",
          isLatest && "animate-fade-in"
        )}
      >
        <div
          className={cn(
            "max-w-[85%] md:max-w-[72%] transition-all duration-500",
            isUser ? bubbleClasses.user : bubbleClasses.coach
          )}
        >
          <p className={cn(
            "text-sm md:text-base leading-relaxed font-light tracking-wide",
            isUser ? bubbleClasses.userText : bubbleClasses.coachText,
            isFrustrationMode && "text-base md:text-lg leading-loose"
          )}>
            {renderContent(content)}
          </p>
        </div>
        
        {shouldShowFeedbackButtons && (
          <div className="flex gap-4 mt-3 ml-2 animate-fade-in-gentle">
            <button
              onClick={() => handleFeedback("helpful")}
              className={cn("text-xs transition-all duration-300 px-3 py-1.5 rounded-xl", feedbackBtnClass)}
            >
              👍 Helpful
            </button>
            <button
              onClick={() => handleFeedback("neutral")}
              className={cn("text-xs transition-all duration-300 px-3 py-1.5 rounded-xl", feedbackBtnClass)}
            >
              ➖ Neutral
            </button>
          </div>
        )}
        
        {hasGivenFeedback && (
          <span className={cn(
            "text-xs mt-2 ml-2 animate-fade-in-gentle",
            activeTheme === "dark" ? "text-white/30" : "text-muted-foreground/30"
          )}>
            {feedback === "helpful" ? "👍" : "➖"}
          </span>
        )}
      </div>
    );
  }

  // Staggered rendering for coach messages with multiple segments
  return (
    <div
      className={cn(
        "flex w-full flex-col transition-all duration-500",
        "items-start",
        isLatest && "animate-fade-in"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] md:max-w-[72%] transition-all duration-500",
          bubbleClasses.coach
        )}
      >
        <div className={cn(
          "text-sm md:text-base leading-relaxed font-light tracking-wide space-y-1",
          bubbleClasses.coachText,
          isFrustrationMode && "text-base md:text-lg leading-loose"
        )}>
          {segments.map((segment, index) => {
            const isVisible = visibleSegments.has(index);
            
            return (
              <span
                key={index}
                className={cn(
                  "inline transition-all duration-300 ease-out",
                  isVisible ? "opacity-100" : "opacity-0",
                  segment.type === "cue" && "mx-1"
                )}
                style={{
                  transitionDelay: isVisible ? "0ms" : "0ms"
                }}
              >
                {segment.type === "cue" 
                  ? renderCueTag(segment.content)
                  : segment.content}
                {segment.type !== "cue" && index < segments.length - 1 && " "}
              </span>
            );
          })}
        </div>
      </div>
      
      {shouldShowFeedbackButtons && (
        <div className="flex gap-4 mt-3 ml-2 animate-fade-in-gentle">
          <button
            onClick={() => handleFeedback("helpful")}
            className={cn("text-xs transition-all duration-300 px-3 py-1.5 rounded-xl", feedbackBtnClass)}
          >
            👍 Helpful
          </button>
          <button
            onClick={() => handleFeedback("neutral")}
            className={cn("text-xs transition-all duration-300 px-3 py-1.5 rounded-xl", feedbackBtnClass)}
          >
            ➖ Neutral
          </button>
        </div>
      )}
      
      {hasGivenFeedback && (
        <span className={cn(
          "text-xs mt-2 ml-2 animate-fade-in-gentle",
          activeTheme === "dark" ? "text-white/30" : "text-muted-foreground/30"
        )}>
          {feedback === "helpful" ? "👍" : "➖"}
        </span>
      )}
    </div>
  );
}
