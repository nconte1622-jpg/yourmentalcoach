// Local memory storage for user preferences and learning
// Persists across refreshes using localStorage

import { normalizeToCanonical, isCanonicalCue } from "./canonicalCues";
import { loadRoundHistory, type RoundHistoryEntry } from "./roundContext";
import { toast } from "sonner";

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err.message.toLowerCase().includes("quota")
  );
}

const PREFERRED_WORDS_KEY = "golfer-preferred-words";
const TRIGGERS_KEY = "golfer-triggers";
const HIGHLIGHTS_KEY = "golfer-highlights";

const MAX_PREFERRED_WORDS = 10;
const MAX_TRIGGERS = 5;

// Common trigger patterns to detect
const TRIGGER_PATTERNS: Record<string, string[]> = {
  "first tee nerves": ["first tee", "first hole", "opening shot", "starting out"],
  "comparison": ["compared to", "other players", "playing partner", "they hit", "he hit", "she hit"],
  "score pressure": ["need to", "have to", "must make", "can't miss", "bogey", "double"],
  "swing thoughts": ["thinking about", "swing thought", "mechanics", "position", "technique"],
  "outcome focus": ["what if", "hope it", "please don't", "scared of", "worried about"],
  "recovery pressure": ["after a bad", "come back", "make up for", "need birdie"],
  "closing holes": ["last few", "coming in", "back nine", "finishing", "18th"],
  "tournament pressure": ["tournament", "competition", "match play", "scoring", "leaderboard"],
};

// ============ Preferred Words (LRM) with frequency tracking ============

export interface PreferredWordEntry {
  word: string;
  count: number;
}

export function loadPreferredWords(): string[] {
  try {
    const stored = localStorage.getItem(PREFERRED_WORDS_KEY);
    if (!stored) return [];
    const entries: PreferredWordEntry[] = JSON.parse(stored);
    // Return words sorted by frequency (highest first)
    return entries.sort((a, b) => b.count - a.count).map((e) => e.word);
  } catch {
    return [];
  }
}

export function loadPreferredWordEntries(): PreferredWordEntry[] {
  try {
    const stored = localStorage.getItem(PREFERRED_WORDS_KEY);
    if (!stored) return [];
    const entries: PreferredWordEntry[] = JSON.parse(stored);
    return entries.sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

// Save a single cue word with frequency tracking
// Always normalizes to canonical form before storing
export function saveCueWord(word: string): void {
  try {
    // Normalize to canonical cue before storing
    const canonical = normalizeToCanonical(word);
    if (!canonical) return;
    
    // Only store if it maps to a canonical cue
    if (!isCanonicalCue(canonical)) {
      return;
    }
    
    const entries = loadPreferredWordEntries();
    const existing = entries.find((e) => e.word === canonical);
    
    if (existing) {
      // Increment count for existing word
      existing.count += 1;
    } else {
      // Add new word with count of 1
      entries.push({ word: canonical, count: 1 });
    }
    
    // Sort by count descending and keep top MAX_PREFERRED_WORDS
    const sorted = entries.sort((a, b) => b.count - a.count).slice(0, MAX_PREFERRED_WORDS);
    localStorage.setItem(PREFERRED_WORDS_KEY, JSON.stringify(sorted));
  } catch (err) {
    if (isQuotaError(err)) {
      toast.error("Device storage is full — mental memory may not be saved.", { id: "storage-quota", duration: 6000 });
    }
  }
}

// Legacy function for backwards compatibility
export function savePreferredWord(word: string): void {
  saveCueWord(word);
}

export function savePreferredWords(newWords: string[]): void {
  for (const word of newWords) {
    saveCueWord(word);
  }
}

// ============ Triggers ============

export interface TriggerEntry {
  trigger: string;
  count: number;
  lastSeen: string;
}

export function loadTriggers(): TriggerEntry[] {
  try {
    const stored = localStorage.getItem(TRIGGERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function detectAndSaveTriggers(userMessage: string): string[] {
  const lower = userMessage.toLowerCase();
  const detectedTriggers: string[] = [];

  for (const [triggerName, patterns] of Object.entries(TRIGGER_PATTERNS)) {
    if (patterns.some((pattern) => lower.includes(pattern))) {
      detectedTriggers.push(triggerName);
    }
  }

  if (detectedTriggers.length > 0) {
    try {
      const triggers = loadTriggers();
      
      for (const trigger of detectedTriggers) {
        const existing = triggers.find((t) => t.trigger === trigger);
        if (existing) {
          existing.count += 1;
          existing.lastSeen = new Date().toISOString();
        } else {
          triggers.push({
            trigger,
            count: 1,
            lastSeen: new Date().toISOString(),
          });
        }
      }

      // Sort by count descending and keep top MAX_TRIGGERS
      const sorted = triggers.sort((a, b) => b.count - a.count).slice(0, MAX_TRIGGERS);
      localStorage.setItem(TRIGGERS_KEY, JSON.stringify(sorted));
    } catch {
      // Silent fail
    }
  }

  return detectedTriggers;
}

export function getTopTriggers(): TriggerEntry[] {
  return loadTriggers().slice(0, MAX_TRIGGERS);
}

// ============ Highlights (Normalized Memory Objects) ============

export interface Highlight {
  id: string;
  date: string;
  cueWord: string;        // Single emphasized cue word (max 1 word)
  mentalRule: string;     // Future-facing sentence (what to do next time)
  contextTag: string;     // Short tag inferred from situation
}

export function loadHighlights(): Highlight[] {
  try {
    const stored = localStorage.getItem(HIGHLIGHTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveHighlight(highlight: Omit<Highlight, "id">): void {
  try {
    const highlights = loadHighlights();
    
    // Normalize cue word to canonical form before storing
    const normalizedCueWord = highlight.cueWord 
      ? normalizeToCanonical(highlight.cueWord)
      : "";
    
    const newHighlight: Highlight = {
      ...highlight,
      cueWord: normalizedCueWord,
      id: `hl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    highlights.push(newHighlight);
    localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(highlights));
  } catch (err) {
    if (isQuotaError(err)) {
      toast.error("Device storage is full — highlights may not be saved.", { id: "storage-quota", duration: 6000 });
    }
  }
}

export function deleteHighlight(id: string): void {
  try {
    const highlights = loadHighlights();
    const filtered = highlights.filter((h) => h.id !== id);
    localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(filtered));
  } catch {
    // Silent fail
  }
}

// ============ Extract cue words from content ============

export function extractCueWords(content: string): string[] {
  const matches = content.matchAll(/{{(?:focus|calm):([^}]+)}}/g);
  // Normalize all extracted cues to canonical form
  return Array.from(matches, (m) => normalizeToCanonical(m[1]));
}

// ============ Infer context tag from moment description ============

const CONTEXT_PATTERNS: Record<string, string[]> = {
  "first tee": ["first tee", "first hole", "opening", "starting"],
  "pressure": ["pressure", "nervous", "tense", "tight", "stressed"],
  "recovery": ["recovery", "trouble", "bad lie", "rough", "bunker", "trees"],
  "closing": ["closing", "last hole", "18th", "finish", "coming in"],
  "tight window": ["tight", "narrow", "small target", "threading", "gap"],
  "putting": ["putt", "green", "read", "pace"],
  "approach": ["approach", "iron", "pin", "flag", "green"],
  "tournament": ["tournament", "competition", "match", "qualifier"],
  "comeback": ["comeback", "bounce back", "after bad", "recover"],
};

export function inferContextTag(moment: string): string {
  const lower = moment.toLowerCase();
  for (const [tag, patterns] of Object.entries(CONTEXT_PATTERNS)) {
    if (patterns.some((p) => lower.includes(p))) {
      return tag;
    }
  }
  return "focus";
}

// ============ Memory context for LLM (subtle, pattern-based) ============

export function getMemoryContext(): {
  preferredWords: string[];
  triggers: TriggerEntry[];
} {
  return {
    preferredWords: loadPreferredWords(),
    triggers: getTopTriggers(),
  };
}

// Build a compact memory context string for LLM
// GUIDELINES: Use memory to reduce mental load, not analyze
// - Pattern-based, not event-specific
// - Recognition, not evaluation
// - Reduce decisions under pressure
export function buildMemoryContextString(): string | null {
  const preferredWords = loadPreferredWords();
  const preferredEntries = loadPreferredWordEntries();
  const triggers = getTopTriggers();
  const highlights = loadHighlights();

  const parts: string[] = [];

  // ── Cue words: the golfer's proven mental anchors ──────
  if (preferredWords.length > 0) {
    const topCue = preferredWords[0];
    const topCount = preferredEntries[0]?.count || 1;

    if (topCount >= 3) {
      // Strong anchor — used repeatedly
      parts.push(`Their go-to cue word is "${topCue}" — it has worked for them consistently. Use it.`);
    } else {
      parts.push(`They respond well to the cue "${topCue}".`);
    }

    if (preferredWords.length > 1) {
      const others = preferredWords.slice(1, 3).map(w => `"${w}"`).join(", ");
      parts.push(`Other cues that resonate: ${others}.`);
    }
  }

  // ── Triggers: patterns that tend to derail them ────────
  if (triggers.length > 0) {
    const topTrigger = triggers[0].trigger;
    const triggerCount = triggers[0].count;

    if (triggerCount >= 3) {
      parts.push(`Recurring pattern: "${topTrigger}" tends to unsettle them. They are working on this.`);
    } else {
      parts.push(`Watch for: "${topTrigger}" has come up before.`);
    }
  }

  // ── Highlights: proven moments of mental strength ──────
  if (highlights.length > 0) {
    const recent = highlights[highlights.length - 1];
    if (recent.cueWord && recent.contextTag) {
      parts.push(`Last highlight: In a ${recent.contextTag} moment, they locked in with "${recent.cueWord}" and it worked. Reference this — they've proven they can do it.`);
    }

    // Recovery pattern if multiple highlights exist
    if (highlights.length >= 2) {
      parts.push(`They have ${highlights.length} saved highlights — evidence of real mental growth. They are building something.`);
    }
  }

  // ── Round history: what happened in past rounds ──────
  try {
    const history: RoundHistoryEntry[] = loadRoundHistory();
    if (history.length > 0) {
      parts.push(`They've completed ${history.length} round${history.length > 1 ? "s" : ""} with you.`);

      // Last round's takeaway
      const lastRound = history[history.length - 1];
      if (lastRound.mentalTakeaway) {
        const location = lastRound.location ? ` at ${lastRound.location}` : "";
        parts.push(`Last round${location}: "${lastRound.mentalTakeaway}"`);
      }

      // If they have an intent pattern, note it
      const intents = history
        .filter((r) => r.intent)
        .map((r) => r.intent);
      if (intents.length >= 2) {
        const lastIntent = intents[intents.length - 1];
        parts.push(`They often set intentions like: "${lastIntent}"`);
      }
    }
  } catch {
    // silent fail if round history unavailable
  }

  if (parts.length === 0) return null;

  return parts.join("\n");
}
