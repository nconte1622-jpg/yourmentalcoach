import { buildMemoryContextString } from "./memoryStorage";
import { buildRoundContextString } from "./roundContext";
import { loadGolferProfile, buildProfileContextString } from "./golferProfile";
import { buildInsightJournalContext } from "./insightJournal";
import { buildBack9ContextForAI } from "./back9Detection";
import { buildMemoryContext as buildPlayerMemoryContext } from "./playerMemory";
import { supabase } from "@/integrations/supabase/client";

export type CoachContext = "pre-game" | "round" | "round-frustrated" | "locker-room" | "coach" | "reset" | "close-strong";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const CHAT_URL = String(import.meta.env.VITE_COACH_API_URL || "").trim();

export function getLocalCoachFallback(context: CoachContext): string {
  switch (context) {
    case "reset":
    case "round-frustrated":
      return "Reset with one slow breath. Pick a tiny target, soften your grip, and commit to the next swing only.";
    case "pre-game":
      return "Keep the start simple. Breathe once, choose the target, and trust your tempo on the first swing.";
    case "close-strong":
      return "Shrink the moment. One shot, one target, one committed tempo.";
    default:
      return "Settle the next moment. Exhale, choose the target, and make one clear swing.";
  }
}

export async function streamCoachResponse({
  messages,
  context,
  onDelta,
  onDone,
  onError,
  signal,
  quickMode,
}: {
  messages: ChatMessage[];
  context: CoachContext;
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
  quickMode?: boolean;
}) {
  try {
    if (signal?.aborted) {
      return;
    }

    if (!CHAT_URL) {
      onError("Coach API is not configured.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
      onError("Please sign in.");
      return;
    }

    // Build memory context from local storage
    const memoryContext = buildMemoryContextString();
    // Build round context for current session
    const roundContext = buildRoundContextString();
    // Build golfer profile context from Master Quiz
    const golferProfile = loadGolferProfile();
    const baseGolferContext = golferProfile ? buildProfileContextString(golferProfile) : "";
    // Quick Mode: tell the AI to keep replies short and direct
    const golferContext = quickMode
      ? baseGolferContext + " RESPONSE STYLE: The golfer is in Quick Mode — they want minimal text. Reply in 1-2 short sentences only. Be direct. No lists, no long explanations."
      : baseGolferContext;
    // Build insight journal context (cross-round personal insights)
    const insightJournalContext = buildInsightJournalContext() || "";
    // Build back-9 tendency context
    const back9Context = buildBack9ContextForAI() || "";
    // Build player round-history memory (last 5 rounds + derived patterns)
    const playerHistoryContext = buildPlayerMemoryContext() || "";
    // Combine cue-word memory + player history into one memoryContext block
    const combinedMemoryContext = [memoryContext, playerHistoryContext].filter(Boolean).join("\n\n");
    const requestId = `coach_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Request-Id": requestId,
      },
      body: JSON.stringify({ messages, context, memoryContext: combinedMemoryContext, roundContext, golferContext, insightJournalContext, back9Context }),
      signal,
    });

    if (!resp.ok) {
      const requestId = resp.headers.get("x-request-id") || "(none)";
      console.error("Coach request failed", { status: resp.status, requestId });
      
      if (resp.status === 401) {
        onError("Session expired, please sign in again.");
        return;
      }
      if (resp.status === 403) {
        onError("Blocked by origin/CORS.");
        return;
      }
      if (resp.status === 500) {
        onError(getLocalCoachFallback(context));
        return;
      }
      if (resp.status === 429) {
        onError(getLocalCoachFallback(context));
        return;
      }
      if (resp.status === 402) {
        onError(getLocalCoachFallback(context));
        return;
      }
      onError(getLocalCoachFallback(context));
      return;
    }

    if (!resp.body) {
      onError(getLocalCoachFallback(context));
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          /* ignore partial leftovers */
        }
      }
    }

    onDone();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return;
    }
    console.error("Coach API error:", e);
    onError(getLocalCoachFallback(context));
  }
}

// Non-streaming version for simple requests
export async function getCoachResponse({
  messages,
  context,
  signal,
}: {
  messages: ChatMessage[];
  context: CoachContext;
  signal?: AbortSignal;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    let fullResponse = "";
    
    streamCoachResponse({
      messages,
      context,
      signal,
      onDelta: (delta) => {
        fullResponse += delta;
      },
      onDone: () => {
        resolve(fullResponse);
      },
      onError: (error) => {
        reject(new Error(error));
      },
    });
  });
}
