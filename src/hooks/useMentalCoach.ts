import { useState, useCallback, useEffect, useRef } from "react";
import {
  streamCoachResponse,
  ChatMessage as ApiMessage,
  CoachContext,
  getLocalCoachFallback,
} from "@/lib/mentalCoachApi";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useRounds } from "@/hooks/useRounds";
import { trackEvent } from "@/lib/analytics";
import {
  loadRoundMessages,
  saveRoundMessages,
  type PersistedRoundMessage,
} from "@/lib/roundSession";
import {
  loadPreferredWords,
  saveCueWord,
  extractCueWords,
  detectAndSaveTriggers
} from "@/lib/memoryStorage";
import { loadGolferProfile } from "@/lib/golferProfile";
import { loadRoundHistory } from "@/lib/roundContext";

export type FeedbackType = "helpful" | "neutral" | null;

export interface Message {
  id: string;
  content: string;
  isUser: boolean;
  feedback?: FeedbackType;
}

function buildPersonalizedGreeting(): string {
  try {
    const profile = loadGolferProfile();
    const firstName = profile?.firstName?.trim() || null;

    const hour = new Date().getHours();
    const timeGreeting =
      hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";

    if (firstName) {
      const history = loadRoundHistory();
      const lastRound = history.length > 0 ? history[history.length - 1] : null;
      if (lastRound?.mentalTakeaway) {
        return `${timeGreeting}, ${firstName}. Last round you noted: "${lastRound.mentalTakeaway}" — what's happening today?`;
      }
      return `${timeGreeting}, ${firstName} — what's happening out there? Talk to me.`;
    }
  } catch {
    // fall through to default
  }
  return "Hey — what's happening out there? Talk to me.";
}

const AI_USAGE_STORAGE_PREFIX = "round-ai-usage";

function buildDefaultMessages(): Message[] {
  return [
    {
      id: "greeting",
      content: buildPersonalizedGreeting(),
      isUser: false,
    },
  ];
}

// Frustration detection patterns
const FRUSTRATION_PATTERNS = [
  /\b(angry|furious|pissed|frustrated|hate|terrible|awful|disaster|can't believe|so bad|worst|stupid|idiot)\b/i,
  /\b(blew it|choked|messed up|screwed up|f+u+c+k|damn|hell|sh+i+t)\b/i,
  /!{2,}/, // Multiple exclamation marks
  /\b(three.?putt|lip.?out|shanked?|topped?|chunked?|skulled?)\b/i,
  /\b(again|another|keeps? happening|every time)\b.*\b(bad|miss|wrong)\b/i,
];

export function detectFrustration(text: string): boolean {
  return FRUSTRATION_PATTERNS.some(pattern => pattern.test(text));
}

export interface UseMentalCoachOptions {
  /** Optional prefix to isolate message storage (e.g. "close-strong") */
  sessionPrefix?: string;
  /** When true, instructs the AI to keep responses to 1-2 sentences */
  quickMode?: boolean;
}

export function useMentalCoach(options?: UseMentalCoachOptions) {
  const sessionPrefix = options?.sessionPrefix;
  const quickModeRef = useRef(options?.quickMode ?? false);
  useEffect(() => {
    quickModeRef.current = options?.quickMode ?? false;
  }, [options?.quickMode]);
  const { features, aiMessagesPerRoundLimit } = useFeatureFlags();
  const { getActiveRound, createRoundEvent } = useRounds();
  // Greeting computed once per mount (fresh time-of-day + last-round takeaway).
  const defaultMessagesRef = useRef<Message[]>(buildDefaultMessages());
  const defaultMessages = defaultMessagesRef.current;
  const [messages, setMessages] = useState<Message[]>(defaultMessages);
  const [isTyping, setIsTyping] = useState(false);
  const [preferredWords, setPreferredWords] = useState<string[]>([]);
  const [isFrustrationMode, setIsFrustrationMode] = useState(false);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  // Mirror of `messages` so streaming-sensitive callbacks (sendMessage,
  // buildRecentContext, setFeedback) can read the latest transcript WITHOUT
  // listing `messages` in their deps — otherwise they'd be recreated on every
  // streamed token and cascade fresh props into ChatInput / every ChatMessage.
  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setPreferredWords(loadPreferredWords());
  }, []);

  useEffect(() => {
    let cancelled = false;

    getActiveRound().then((round) => {
      if (!cancelled) {
        setActiveRoundId(round?.id ?? null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeRoundId) {
      setMessages(defaultMessages);
      return;
    }

    const storageKey = sessionPrefix ? `${sessionPrefix}:${activeRoundId}` : activeRoundId;
    const persisted = loadRoundMessages(storageKey);
    if (persisted?.length) {
      setMessages(persisted as Message[]);
      return;
    }

    setMessages(defaultMessages);
  }, [activeRoundId, sessionPrefix, defaultMessages]);

  // Always points at the latest "write the transcript to localStorage" closure,
  // so both the debounced effect and the unmount flush use current values.
  const persistMessagesRef = useRef<() => void>(() => {});
  persistMessagesRef.current = () => {
    if (!activeRoundId) return;
    const storageKey = sessionPrefix ? `${sessionPrefix}:${activeRoundId}` : activeRoundId;
    const payload: PersistedRoundMessage[] = messagesRef.current.map((message) => ({
      id: message.id,
      content: message.content,
      isUser: message.isUser,
      feedback: message.feedback ?? null,
    }));
    saveRoundMessages(storageKey, payload);
  };

  useEffect(() => {
    if (!activeRoundId) return;
    // Debounce: during streaming `messages` changes on every token. Without this
    // we'd JSON.stringify + write the whole transcript to localStorage per token
    // (main-thread jank). Coalesce into one write once the stream settles.
    const timer = setTimeout(() => persistMessagesRef.current(), 400);
    return () => clearTimeout(timer);
  }, [activeRoundId, messages, sessionPrefix]);

  // Flush on unmount so nothing is lost if the user leaves within the debounce
  // window (e.g. sends a message then immediately navigates home).
  useEffect(() => {
    return () => persistMessagesRef.current();
  }, []);

  useEffect(() => {
    return () => {
      activeAbortControllerRef.current?.abort();
    };
  }, []);

  // Clear frustration mode after a delay
  useEffect(() => {
    if (isFrustrationMode) {
      const timer = setTimeout(() => setIsFrustrationMode(false), 30000);
      return () => clearTimeout(timer);
    }
  }, [isFrustrationMode]);

  const getUsageKey = useCallback(
    (roundId: string) => `${AI_USAGE_STORAGE_PREFIX}:${roundId}`,
    []
  );

  const getAiUsageCount = useCallback(() => {
    if (!activeRoundId) return 0;
    try {
      const raw = localStorage.getItem(getUsageKey(activeRoundId));
      return raw ? Number(raw) || 0 : 0;
    } catch {
      return 0;
    }
  }, [activeRoundId, getUsageKey]);

  const incrementAiUsage = useCallback(() => {
    if (!activeRoundId) return;
    try {
      const next = getAiUsageCount() + 1;
      localStorage.setItem(getUsageKey(activeRoundId), String(next));
    } catch {
      // ignore storage failures
    }
  }, [activeRoundId, getAiUsageCount, getUsageKey]);

  const canUseAi = useCallback(() => {
    if (features.unlimited_ai) return true;
    if (aiMessagesPerRoundLimit == null) return true;
    return getAiUsageCount() < aiMessagesPerRoundLimit;
  }, [aiMessagesPerRoundLimit, features.unlimited_ai, getAiUsageCount]);

  const getLimitError = useCallback(() => {
    if (features.unlimited_ai) return "Unable to connect. Try again.";
    return "Free plan limit reached for this round. Upgrade to keep coaching live.";
  }, [features.unlimited_ai]);

  const beginRequest = useCallback(() => {
    activeAbortControllerRef.current?.abort();
    const requestId = `coach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const controller = new AbortController();
    activeRequestIdRef.current = requestId;
    activeAbortControllerRef.current = controller;
    return { requestId, controller };
  }, []);

  const logAiEvent = useCallback(async (payload: {
    label: string;
    notes: Record<string, unknown>;
  }) => {
    if (!activeRoundId) return;
    try {
      await createRoundEvent({
        round_id: activeRoundId,
        event_type: "ai_message_sent",
        label: payload.label,
        notes: JSON.stringify(payload.notes),
      });
    } catch (error) {
      console.error("Failed to log AI message event:", error);
    }
  }, [activeRoundId, createRoundEvent]);

  const appendFallbackMessage = useCallback((assistantId: string, context: CoachContext, error?: string) => {
    const fallback = getLocalCoachFallback(context);
    setMessages((prev) => {
      const exists = prev.some((message) => message.id === assistantId);
      if (exists) {
        return prev.map((message) =>
          message.id === assistantId ? { ...message, content: fallback } : message
        );
      }
      return [...prev, { id: assistantId, content: fallback, isUser: false }];
    });
    if (error) {
      console.error("Coach fallback triggered:", error);
    }
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (isTyping) return;
    if (!canUseAi()) {
      const assistantId = `coach-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, content: getLimitError(), isUser: false },
      ]);
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content,
      isUser: true,
    };

    // Detect frustration in user message
    const frustrated = detectFrustration(content);
    if (frustrated) {
      setIsFrustrationMode(true);
    }

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    incrementAiUsage();
    trackEvent("ai_message_sent", {
      source: "round_chat",
      roundId: activeRoundId,
      limitedPlan: !features.unlimited_ai,
    });
    void logAiEvent({
      label: "round_chat",
      notes: {
        source: "round_chat",
        user_message: content,
        timestamp: new Date().toISOString(),
      },
    });

    // Detect and save any triggers mentioned in the user message
    detectAndSaveTriggers(content);

    // Build API messages from conversation history (read via ref so this
    // callback is stable across streaming — see messagesRef above).
    const apiMessages: ApiMessage[] = messagesRef.current
      .filter((m) => m.id !== "greeting")
      .map((m) => ({
        role: m.isUser ? "user" as const : "assistant" as const,
        content: m.content,
      }));
    apiMessages.push({ role: "user", content });

    let assistantContent = "";
    const assistantId = `coach-${Date.now()}`;
    const { requestId, controller } = beginRequest();

    streamCoachResponse({
      messages: apiMessages,
      context: frustrated ? "round-frustrated" : "round",
      signal: controller.signal,
      quickMode: quickModeRef.current,
      onDelta: (delta) => {
        if (activeRequestIdRef.current !== requestId) return;
        assistantContent += delta;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last?.isUser && last?.id === assistantId) {
            return prev.map((m) =>
              m.id === assistantId ? { ...m, content: assistantContent } : m
            );
          }
          return [...prev, { id: assistantId, content: assistantContent, isUser: false }];
        });
      },
      onDone: () => {
        if (activeRequestIdRef.current !== requestId) return;
        setIsTyping(false);
        activeAbortControllerRef.current = null;
      },
      onError: (error) => {
        if (activeRequestIdRef.current !== requestId) return;
        appendFallbackMessage(assistantId, frustrated ? "round-frustrated" : "round", error);
        setIsTyping(false);
        activeAbortControllerRef.current = null;
      },
    });
  }, [activeRoundId, appendFallbackMessage, beginRequest, canUseAi, features.unlimited_ai, getLimitError, incrementAiUsage, isTyping, logAiEvent]);

  // Build recent conversation context so quick-actions feel personal
  const buildRecentContext = useCallback((): ApiMessage[] => {
    // Grab last ~6 messages (3 exchanges) for context, skip greeting.
    // Read via ref so this stays stable while streaming.
    const recent = messagesRef.current
      .filter((m) => m.id !== "greeting")
      .slice(-6)
      .map((m) => ({
        role: m.isUser ? "user" as const : "assistant" as const,
        content: m.content,
      }));
    return recent;
  }, []);

  const getQuickCue = useCallback((context: CoachContext = "round") => {
    if (isTyping) return;
    if (!canUseAi()) {
      const assistantId = `coach-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, content: getLimitError(), isUser: false },
      ]);
      return;
    }

    setIsTyping(true);
    incrementAiUsage();
    trackEvent("ai_message_sent", {
      source: "quick_cue",
      roundId: activeRoundId,
    });
    void logAiEvent({
      label: "quick_cue",
      notes: { source: "quick_cue", timestamp: new Date().toISOString() },
    });

    // Include recent conversation so the AI can reference what's been happening
    const recentContext = buildRecentContext();
    const apiMessages: ApiMessage[] = [
      ...recentContext,
      { role: "user", content: "Quick one — what should I be thinking about for this next shot?" },
    ];

    let assistantContent = "";
    const assistantId = `coach-${Date.now()}`;
    const { requestId, controller } = beginRequest();

    streamCoachResponse({
      messages: apiMessages,
      context,
      signal: controller.signal,
      quickMode: quickModeRef.current,
      onDelta: (delta) => {
        if (activeRequestIdRef.current !== requestId) return;
        assistantContent += delta;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last?.isUser && last?.id === assistantId) {
            return prev.map((m) =>
              m.id === assistantId ? { ...m, content: assistantContent } : m
            );
          }
          return [...prev, { id: assistantId, content: assistantContent, isUser: false }];
        });
      },
      onDone: () => {
        if (activeRequestIdRef.current !== requestId) return;
        setIsTyping(false);
        activeAbortControllerRef.current = null;
      },
      onError: (error) => {
        if (activeRequestIdRef.current !== requestId) return;
        appendFallbackMessage(assistantId, context, error);
        setIsTyping(false);
        activeAbortControllerRef.current = null;
      },
    });
  }, [activeRoundId, appendFallbackMessage, beginRequest, buildRecentContext, canUseAi, getLimitError, incrementAiUsage, isTyping, logAiEvent]);

  const getResetCue = useCallback((context: CoachContext = "round") => {
    if (isTyping) return;
    if (!canUseAi()) {
      const assistantId = `coach-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, content: getLimitError(), isUser: false },
      ]);
      return;
    }

    setIsTyping(true);
    incrementAiUsage();
    trackEvent("ai_message_sent", {
      source: "reset_cue",
      roundId: activeRoundId,
    });
    void logAiEvent({
      label: "reset_cue",
      notes: { source: "reset_cue", timestamp: new Date().toISOString() },
    });

    // Include recent conversation so the AI knows what happened
    const recentContext = buildRecentContext();
    const apiMessages: ApiMessage[] = [
      ...recentContext,
      { role: "user", content: "I need a reset. Get me back on track." },
    ];

    let assistantContent = "";
    const assistantId = `coach-${Date.now()}`;
    const { requestId, controller } = beginRequest();

    streamCoachResponse({
      messages: apiMessages,
      context,
      signal: controller.signal,
      quickMode: quickModeRef.current,
      onDelta: (delta) => {
        if (activeRequestIdRef.current !== requestId) return;
        assistantContent += delta;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last?.isUser && last?.id === assistantId) {
            return prev.map((m) =>
              m.id === assistantId ? { ...m, content: assistantContent } : m
            );
          }
          return [...prev, { id: assistantId, content: assistantContent, isUser: false }];
        });
      },
      onDone: () => {
        if (activeRequestIdRef.current !== requestId) return;
        setIsTyping(false);
        activeAbortControllerRef.current = null;
      },
      onError: (error) => {
        if (activeRequestIdRef.current !== requestId) return;
        appendFallbackMessage(assistantId, context, error);
        setIsTyping(false);
        activeAbortControllerRef.current = null;
      },
    });
  }, [activeRoundId, appendFallbackMessage, beginRequest, buildRecentContext, canUseAi, getLimitError, incrementAiUsage, isTyping, logAiEvent]);

  const getEmotionCue = useCallback((emotionTag: string, context: CoachContext = "round") => {
    if (isTyping) return;
    if (!canUseAi()) {
      const assistantId = `coach-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, content: getLimitError(), isUser: false },
      ]);
      return;
    }

    setIsTyping(true);
    incrementAiUsage();
    trackEvent("ai_message_sent", {
      source: "emotion_tap",
      roundId: activeRoundId,
      emotionTag,
    });
    void logAiEvent({
      label: "emotion_tap",
      notes: { source: "emotion_tap", emotion_tag: emotionTag, timestamp: new Date().toISOString() },
    });

    // Map emotion tags to natural-sounding messages a golfer would actually say
    const emotionMessages: Record<string, string> = {
      "Confident": "Feeling good out here right now.",
      "Locked In": "I'm dialed in. Feeling locked in.",
      "Nervous": "Feeling a little nervous on this one.",
      "Frustrated": "Pretty frustrated right now.",
      "Rushed": "I feel rushed, can't slow down.",
      "Unfocused": "My head is all over the place.",
      "Tight": "I'm gripping too tight. Everything feels tense.",
      "Relaxed": "Feeling relaxed and loose right now.",
      "Anxious": "Getting anxious over the ball.",
      "Angry": "I'm pissed off right now.",
      "Calm": "Nice and calm. Good headspace.",
      "Overthinking": "I'm overthinking everything out here.",
    };
    const userMsg = emotionMessages[emotionTag] || `Feeling ${emotionTag.toLowerCase()} right now.`;

    // Include recent conversation so the AI can build on what's been happening
    const recentContext = buildRecentContext();
    const apiMessages: ApiMessage[] = [
      ...recentContext,
      { role: "user", content: userMsg },
    ];

    let assistantContent = "";
    const assistantId = `coach-${Date.now()}`;
    const { requestId, controller } = beginRequest();

    streamCoachResponse({
      messages: apiMessages,
      context,
      signal: controller.signal,
      quickMode: quickModeRef.current,
      onDelta: (delta) => {
        if (activeRequestIdRef.current !== requestId) return;
        assistantContent += delta;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last?.isUser && last?.id === assistantId) {
            return prev.map((m) =>
              m.id === assistantId ? { ...m, content: assistantContent } : m
            );
          }
          return [...prev, { id: assistantId, content: assistantContent, isUser: false }];
        });
      },
      onDone: () => {
        if (activeRequestIdRef.current !== requestId) return;
        setIsTyping(false);
        activeAbortControllerRef.current = null;
      },
      onError: (error) => {
        if (activeRequestIdRef.current !== requestId) return;
        appendFallbackMessage(assistantId, context, error);
        setIsTyping(false);
        activeAbortControllerRef.current = null;
      },
    });
  }, [activeRoundId, appendFallbackMessage, beginRequest, buildRecentContext, canUseAi, getLimitError, incrementAiUsage, isTyping, logAiEvent]);

  const setFeedback = useCallback((messageId: string, feedback: FeedbackType) => {
    const message = messagesRef.current.find((m) => m.id === messageId);

    if (feedback === "helpful" && message) {
      // Extract only the emphasized cue words from the response
      const cueWords = extractCueWords(message.content);
      // Store only the first (primary) cue word with frequency tracking
      if (cueWords.length > 0) {
        saveCueWord(cueWords[0]);
        setPreferredWords(loadPreferredWords());
      }
    }

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, feedback } : msg
      )
    );
  }, []);

  return {
    messages,
    isTyping,
    isFrustrationMode,
    sendMessage,
    getQuickCue,
    getResetCue,
    getEmotionCue,
    setFeedback,
    canUseAi,
    aiMessagesRemaining:
      aiMessagesPerRoundLimit == null ? null : Math.max(0, aiMessagesPerRoundLimit - getAiUsageCount()),
  };
}
