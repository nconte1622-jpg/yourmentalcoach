/**
 * Quick End Round — Lightweight data extraction when user ends a round
 * without going through the full post-round reflection flow.
 *
 * Extracts what we can from the chat messages and emotion log,
 * saves to highlights, round history, and memory storage.
 */

import { loadRoundMessages, type PersistedRoundMessage } from "./roundSession";
import { saveHighlight, inferContextTag, saveCueWord } from "./memoryStorage";
import { loadRoundContext, saveRoundToHistory } from "./roundContext";
import { extractAndSaveInsights } from "./insightJournal";
import { saveBack9Pattern } from "./back9Detection";
import { calculateResilienceScore, saveResilienceScore } from "./resilienceScore";
import {
  loadCheckInTimestamps,
  loadEmotionLog,
  loadUsedPreShotReset,
} from "./roundMetrics";
import { getMoodSummary, getMoodInsight } from "./holeMoods";
import { loadActivePatternRound } from "./gpsPatternStorage";

/**
 * Extract and save round data from chat messages when the user does a quick end.
 * Call this BEFORE updateRound() clears local storage.
 */
export function extractAndSaveQuickEndData(roundId: string): void {
  try {
    const messages = loadRoundMessages(roundId);
    if (!messages || messages.length <= 1) return; // Only greeting, nothing to extract

    const roundContext = loadRoundContext();

    // 1. Save round to history (includes hole mood data)
    saveRoundHistory(roundId, messages, roundContext);

    // 2. Extract a highlight from the conversation
    extractAutoHighlight(messages);

    // 3. Extract any cue words from AI responses the user engaged with
    extractCueWordsFromChat(messages);

    // 4. Extract and save personal insights to the journal
    extractAndSaveInsights(messages, roundId);

    // 5. Save back-9 pattern data for this round
    saveBack9Pattern(roundId);

    // 6. Calculate and save resilience score
    try {
      const emotionLog = loadEmotionLog();
      const checkInTimestamps = loadCheckInTimestamps();
      const usedPreShotReset = loadUsedPreShotReset();
      const ctx = loadRoundContext();
      const roundDurationMinutes = ctx?.startedAt
        ? Math.round((Date.now() - new Date(ctx.startedAt).getTime()) / 60000)
        : 0;

      // Pull shot pattern data from Mental GPS if available
      const gpsRound = loadActivePatternRound();
      const shotPatternData = gpsRound && gpsRound.holes.length >= 3
        ? {
            holesLogged: gpsRound.holes.length,
            threePutts: gpsRound.holes.filter((h) => h.puttResult === "3-putt" || h.puttResult === "4-putt").length,
            obShots: gpsRound.holes.filter((h) => h.teeResult === "ob").length,
            recoveryHoles: (() => {
              let count = 0;
              for (let i = 1; i < gpsRound.holes.length; i++) {
                const prev = gpsRound.holes[i - 1];
                const curr = gpsRound.holes[i];
                if (
                  (prev.teeResult === "ob" || prev.emotionalTag === "frustrated") &&
                  (curr.emotionalTag === "focused" || curr.emotionalTag === "confident" || curr.teeResult === "fairway" || curr.teeResult === "great")
                ) count++;
              }
              return count;
            })(),
            focusedHoles: gpsRound.holes.filter((h) => h.emotionalTag === "focused" || h.emotionalTag === "confident").length,
            frustratedHoles: gpsRound.holes.filter((h) => h.emotionalTag === "frustrated").length,
          }
        : undefined;

      const score = calculateResilienceScore({
        emotionLog,
        checkInTimestamps,
        usedPreShotReset,
        roundDurationMinutes,
        shotPatternData,
      });
      saveResilienceScore(roundId, score, new Date().toISOString());
    } catch { /* silent */ }
  } catch (error) {
    console.error("quickEndRound extraction failed:", error);
    // Never block round ending — silent fail
  }
}

/**
 * Save this round to local history with a simple takeaway.
 */
function saveRoundHistory(
  roundId: string,
  messages: PersistedRoundMessage[],
  roundContext: ReturnType<typeof loadRoundContext>,
): void {
  // Build a simple mental takeaway from the last AI message
  const lastAiMessage = [...messages].reverse().find((m) => !m.isUser);
  const takeaway = lastAiMessage
    ? truncate(lastAiMessage.content, 120)
    : "Round completed.";

  // Get emotional arc from this round's emotion log
  let emotionalSummary = "";
  const taps = loadEmotionLog();
  if (taps.length > 0) {
    const counts: Record<string, number> = {};
    taps.forEach((t) => { counts[t.tag] = (counts[t.tag] || 0) + 1; });
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    emotionalSummary = ` Dominant feeling: ${dominant[0]}.`;
  }

  // Append hole-by-hole mood log if any holes were tracked
  let moodSummaryText = "";
  try {
    const summary = getMoodSummary(roundId);
    if (summary) {
      const insight = getMoodInsight(roundId);
      moodSummaryText = ` Hole-by-hole mood log: ${summary}.${insight ? ` ${insight}` : ""}`;
    }
  } catch { /* silent */ }

  saveRoundToHistory({
    date: new Date().toISOString(),
    roundType: roundContext?.roundType || "on-course",
    environment: roundContext?.environment || "casual",
    location: roundContext?.location,
    intent: roundContext?.intent,
    mentalTakeaway: takeaway + emotionalSummary + moodSummaryText,
    highlightIds: [],
  });
}

/**
 * Try to extract one meaningful highlight from the conversation.
 * Looks for moments where the user described something specific
 * and the AI gave a focused response.
 */
function extractAutoHighlight(messages: PersistedRoundMessage[]): void {
  // Find the longest user message (most descriptive moment)
  const userMessages = messages.filter((m) => m.isUser && m.content.length > 20);
  if (userMessages.length === 0) return;

  // Sort by length descending — longer messages = more detail = better highlights
  const sorted = [...userMessages].sort((a, b) => b.content.length - a.content.length);
  const bestMoment = sorted[0];

  // Find the AI response that followed this user message
  const momentIndex = messages.findIndex((m) => m.id === bestMoment.id);
  const aiResponse = messages[momentIndex + 1];
  if (!aiResponse || aiResponse.isUser) return;

  // Build a concise mental rule from the AI's response
  const mentalRule = extractFirstSentence(aiResponse.content);
  const contextTag = inferContextTag(bestMoment.content);

  // Try to extract a cue word from the AI response
  const cueWord = extractKeyWord(aiResponse.content);

  saveHighlight({
    date: new Date().toISOString(),
    cueWord: cueWord || "commit",
    mentalRule: mentalRule || "Stay in the process.",
    contextTag,
  });
}

/**
 * Scan AI messages for emphasized cue words and save them.
 */
function extractCueWordsFromChat(messages: PersistedRoundMessage[]): void {
  const aiMessages = messages.filter((m) => !m.isUser);
  for (const msg of aiMessages) {
    // Look for {{focus:word}} or {{calm:word}} patterns
    const matches = msg.content.matchAll(/{{(?:focus|calm):([^}]+)}}/g);
    for (const match of matches) {
      saveCueWord(match[1]);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

function extractFirstSentence(text: string): string {
  // Split on sentence-ending punctuation
  const match = text.match(/^[^.!?]+[.!?]/);
  if (match) return match[0].trim();
  // Fallback: first 80 chars
  return truncate(text, 80);
}

/**
 * Extract a key action word from the AI response.
 * Looks for common coaching cue words.
 */
function extractKeyWord(text: string): string {
  const lower = text.toLowerCase();
  const cueWords = [
    "commit", "trust", "breathe", "tempo", "target", "smooth",
    "present", "steady", "patient", "confident", "loose", "free",
    "calm", "focus", "flow", "rhythm", "release", "accept",
  ];
  for (const word of cueWords) {
    if (lower.includes(word)) return word;
  }
  return "";
}
