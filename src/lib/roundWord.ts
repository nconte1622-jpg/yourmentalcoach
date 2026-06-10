/**
 * roundWord.ts
 *
 * Generates and stores a single AI-chosen descriptor word after each round.
 * Designed to be used on the RoundComplete screen.
 *
 * The word is a one-word description of the player's mental performance:
 *   FOCUSED · PRESENT · RESILIENT · STEADY · COMPOSED · COMMITTED · PATIENT
 *   GRINDING · LOCKED IN · BOUNCED BACK · SEARCHING · BUILDING
 *
 * Flow:
 *   1. extractRoundSummaryContext() builds a short context string from localStorage
 *   2. generateRoundWord(context) calls the AI backend (or picks locally if offline)
 *   3. saveRoundWord(word) persists to localStorage
 *   4. loadRoundWord() retrieves the most recent word
 */

import { loadResilienceScores } from "@/lib/resilienceScore";
import { loadHighlights, loadPreferredWords } from "@/lib/memoryStorage";
import { getStreakData } from "@/lib/streakStorage";

const STORAGE_KEY = "caddie-round-word";

// ── Fallback words (used when offline or AI unavailable) ─────
const WORD_POOL = [
  "FOCUSED",
  "PRESENT",
  "RESILIENT",
  "STEADY",
  "COMPOSED",
  "COMMITTED",
  "PATIENT",
  "LOCKED IN",
  "DETERMINED",
  "BUILDING",
  "GRINDING",
  "BOUNCED BACK",
  "CLEAR",
  "SHARP",
];

// ── Storage ──────────────────────────────────────────────────

export interface StoredRoundWord {
  word: string;
  generatedAt: string;
  source: "ai" | "local";
}

export function saveRoundWord(word: string, source: "ai" | "local" = "local"): void {
  try {
    const entry: StoredRoundWord = {
      word: word.toUpperCase(),
      generatedAt: new Date().toISOString(),
      source,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // storage full — ignore
  }
}

export function loadRoundWord(): StoredRoundWord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredRoundWord;
  } catch {
    return null;
  }
}

export function clearRoundWord(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── Context builder ──────────────────────────────────────────

/**
 * Builds a short text summary of this round's mental performance
 * from available localStorage data — used as prompt context.
 */
export function extractRoundSummaryContext(): string {
  const scores = loadResilienceScores();
  const latest = scores.length > 0 ? scores[scores.length - 1] : null;
  const highlights = loadHighlights();
  const cueWord = loadPreferredWords()[0] ?? null;
  const streak = getStreakData().currentStreak;

  const parts: string[] = [];

  if (latest) {
    parts.push(`Mental Handicap: ${latest.score}/100 (${getScoreBand(latest.score)})`);
  }

  if (highlights.length > 0) {
    const lastHighlight = highlights[highlights.length - 1];
    if (lastHighlight.cueWord) {
      parts.push(`Cue word this round: ${lastHighlight.cueWord}`);
    }
    if (lastHighlight.reflection) {
      // Truncate long reflections
      parts.push(`Post-round note: ${lastHighlight.reflection.slice(0, 120)}`);
    }
  }

  if (cueWord) {
    parts.push(`Player's preferred mental cue: ${cueWord}`);
  }

  if (streak >= 3) {
    parts.push(`Active streak: ${streak} rounds`);
  }

  return parts.join(". ") || "Round just completed.";
}

function getScoreBand(score: number): string {
  if (score >= 75) return "Strong";
  if (score >= 50) return "Building";
  return "Early stage";
}

// ── AI generation ────────────────────────────────────────────

/**
 * Generates a round word via the AI backend.
 * Falls back to local selection if the backend is unavailable.
 *
 * Returns the word in UPPERCASE (e.g. "FOCUSED").
 */
export async function generateRoundWord(): Promise<string> {
  const context = extractRoundSummaryContext();

  const backendUrl = import.meta.env.VITE_COACH_API_URL as string | undefined;
  if (!backendUrl) {
    return pickLocalWord(context);
  }

  try {
    const systemPrompt = `You are a golf mental performance coach. Based on a player's round data, choose ONE SINGLE WORD (uppercase) that best describes their mental performance this round.

Choose from this vocabulary: FOCUSED, PRESENT, RESILIENT, STEADY, COMPOSED, COMMITTED, PATIENT, LOCKED IN, DETERMINED, BUILDING, GRINDING, BOUNCED BACK, CLEAR, SHARP, RELENTLESS, GROUNDED, CENTERED.

ONLY respond with the word. Nothing else. No punctuation. No explanation. Just the word.`;

    const response = await fetch(`${backendUrl}/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Round data: ${context}\n\nOne word to describe this round:`,
          },
        ],
        stream: false,
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return pickLocalWord(context);
    }

    const data = await response.json() as { content?: string; message?: string };
    const raw = (data.content ?? data.message ?? "").trim().toUpperCase();

    // Validate: must be 1–3 words, all letters/spaces
    if (raw && /^[A-Z ]{2,20}$/.test(raw)) {
      const word = raw.replace(/\s+/g, " ").trim();
      saveRoundWord(word, "ai");
      return word;
    }

    return pickLocalWord(context);
  } catch {
    return pickLocalWord(context);
  }
}

/** Pick a contextually appropriate word without calling the AI */
function pickLocalWord(context: string): string {
  const ctxLower = context.toLowerCase();

  let word: string;

  if (ctxLower.includes("strong") || ctxLower.includes("75") || ctxLower.includes("80")) {
    word = WORD_POOL[Math.floor(Math.random() * 3)]; // FOCUSED, PRESENT, RESILIENT
  } else if (ctxLower.includes("building") || ctxLower.includes("50")) {
    word = WORD_POOL[3 + Math.floor(Math.random() * 4)]; // STEADY, COMPOSED, COMMITTED, PATIENT
  } else if (ctxLower.includes("bounced") || ctxLower.includes("streak")) {
    word = "BOUNCED BACK";
  } else {
    word = WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)];
  }

  saveRoundWord(word, "local");
  return word;
}
