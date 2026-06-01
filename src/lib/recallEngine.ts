// LRM Recall Engine - Monitors input context and surfaces relevant recalls
import { loadHighlights, loadPreferredWords, Highlight } from "./memoryStorage";
import { normalizeToCanonical, CANONICAL_CUES, type CanonicalCue } from "./canonicalCues";

// Re-export for backwards compatibility
export function normalizeCueWord(word: string): string {
  return normalizeToCanonical(word);
}

// Approved Recall templates - strict format
const RECALL_TEMPLATES = [
  (cue: string) => `Recall: When it mattered, you ${cue}.`,
  (cue: string) => `Recall: ${capitalize(cue)} over outcome.`,
  (cue: string) => `Recall: Simplify. ${capitalize(cue)}.`,
  (cue: string) => `Recall: ${capitalize(cue)} before you step in.`,
];

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Select appropriate template based on context
function selectTemplate(cue: string, contextTag?: string): string {
  const normalizedCue = normalizeCueWord(cue);
  
  // Context-aware template selection
  if (contextTag === "pressure" || contextTag === "tournament") {
    return RECALL_TEMPLATES[0](normalizedCue); // "When it mattered, you {cue}."
  }
  
  if (contextTag === "anger" || contextTag === "recovery") {
    return RECALL_TEMPLATES[2](normalizedCue); // "Simplify. {cue}."
  }
  
  if (contextTag === "first tee" || contextTag === "putting") {
    return RECALL_TEMPLATES[3](normalizedCue); // "{cue} before you step in."
  }
  
  // Default: "{cue} over outcome."
  return RECALL_TEMPLATES[1](normalizedCue);
}

// Context tags to detect in user input
const CONTEXT_PATTERNS: Record<string, string[]> = {
  anger: ["angry", "pissed", "furious", "stupid", "hate", "frustrated", "damn", "crap", "awful", "terrible"],
  pressure: ["pressure", "nervous", "tense", "tight", "stressed", "anxious", "worried", "scared", "choke"],
  "first tee": ["first tee", "first hole", "opening shot", "starting", "1st hole", "tee box"],
  recovery: ["recovery", "trouble", "bad lie", "rough", "bunker", "trees", "water", "penalty", "mishit"],
  putting: ["putt", "putting", "green", "read", "pace", "roll", "stroke", "hole out", "lip out"],
  closing: ["closing", "last hole", "18th", "17th", "finish", "coming in", "back nine"],
  tournament: ["tournament", "competition", "match", "qualifier", "scorecard", "leaderboard"],
};

export type ContextTag = keyof typeof CONTEXT_PATTERNS;

// Detect context tags from user input
export function detectContextTags(input: string): ContextTag[] {
  const lower = input.toLowerCase();
  const detected: ContextTag[] = [];

  for (const [tag, patterns] of Object.entries(CONTEXT_PATTERNS)) {
    if (patterns.some((pattern) => lower.includes(pattern))) {
      detected.push(tag as ContextTag);
    }
  }

  return detected;
}

// Find a relevant recall based on detected context
export interface RecallMatch {
  type: "highlight" | "cue";
  text: string;
  source: string; // For debugging/analytics
}

export function findContextualRecall(contextTags: ContextTag[]): RecallMatch | null {
  if (contextTags.length === 0) return null;

  const highlights = loadHighlights();
  const preferredWords = loadPreferredWords();
  const primaryContext = contextTags[0];

  // First, try to find a highlight that matches the context
  for (const tag of contextTags) {
    const matchingHighlight = highlights.find((h) => 
      h.contextTag.toLowerCase().includes(tag) || 
      tag.includes(h.contextTag.toLowerCase())
    );

    if (matchingHighlight && matchingHighlight.cueWord) {
      return formatHighlightRecall(matchingHighlight, tag);
    }
  }

  // If no highlight matches, check if we have any highlight with a cue word
  if (highlights.length > 0) {
    const recent = highlights[highlights.length - 1];
    if (recent.cueWord) {
      return formatHighlightRecall(recent, primaryContext);
    }
  }

  // Fallback to preferred words if available
  if (preferredWords.length > 0) {
    const topCue = normalizeCueWord(preferredWords[0]);
    return {
      type: "cue",
      text: selectTemplate(topCue, primaryContext),
      source: "preferred-word",
    };
  }

  return null;
}

function formatHighlightRecall(highlight: Highlight, contextTag?: ContextTag): RecallMatch {
  const cue = highlight.cueWord ? normalizeCueWord(highlight.cueWord) : "commit";
  
  return {
    type: "highlight",
    text: selectTemplate(cue, contextTag),
    source: `highlight-${highlight.id}`,
  };
}

// Rate limiting for recall cards
const RECALL_COOLDOWN_MS = 60000; // 1 minute

export function canShowRecall(lastRecallTime: number | null): boolean {
  if (lastRecallTime === null) return true;
  return Date.now() - lastRecallTime >= RECALL_COOLDOWN_MS;
}
