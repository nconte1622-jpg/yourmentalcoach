// Canonical Cue Mapping Layer
// Maps synonyms, conjugations, and related words to canonical cue words

// The 8 canonical cues
export const CANONICAL_CUES = [
  "commit",
  "tempo", 
  "breathe",
  "target",
  "trust",
  "accept",
  "patience",
  "simplify",
] as const;

export type CanonicalCue = typeof CANONICAL_CUES[number];

// Comprehensive mapping of synonyms and variations to canonical cues
const CUE_SYNONYMS: Record<string, CanonicalCue> = {
  // === COMMIT ===
  commit: "commit",
  committed: "commit",
  committing: "commit",
  commits: "commit",
  commitment: "commit",
  "fully commit": "commit",
  decisive: "commit",
  decision: "commit",
  decide: "commit",
  decided: "commit",
  determined: "commit",
  determination: "commit",
  dedicated: "commit",
  dedication: "commit",
  resolve: "commit",
  resolved: "commit",
  conviction: "commit",
  confident: "commit",
  confidence: "commit",
  "all in": "commit",
  "go for it": "commit",
  
  // === TEMPO ===
  tempo: "tempo",
  rhythm: "tempo",
  rhythmic: "tempo",
  pace: "tempo",
  pacing: "tempo",
  timing: "tempo",
  smooth: "tempo",
  smoothly: "tempo",
  flow: "tempo",
  flowing: "tempo",
  steady: "tempo",
  steadily: "tempo",
  consistent: "tempo",
  consistency: "tempo",
  even: "tempo",
  balanced: "tempo",
  balance: "tempo",
  
  // === BREATHE ===
  breathe: "breathe",
  breathing: "breathe",
  breathed: "breathe",
  breath: "breathe",
  exhale: "breathe",
  exhaling: "breathe",
  inhale: "breathe",
  relax: "breathe",
  relaxed: "breathe",
  relaxing: "breathe",
  calm: "breathe",
  calming: "breathe",
  settle: "breathe",
  settling: "breathe",
  ground: "breathe",
  grounded: "breathe",
  grounding: "breathe",
  centered: "breathe",
  center: "breathe",
  
  // === TARGET ===
  target: "target",
  targeted: "target",
  targeting: "target",
  targets: "target",
  aim: "target",
  aiming: "target",
  aimed: "target",
  focus: "target",
  focused: "target",
  focusing: "target",
  pick: "target",
  picking: "target",
  picked: "target",
  spot: "target",
  line: "target",
  visualize: "target",
  visualizing: "target",
  see: "target",
  seeing: "target",
  sight: "target",
  
  // === TRUST ===
  trust: "trust",
  trusted: "trust",
  trusting: "trust",
  trusts: "trust",
  believe: "trust",
  believed: "trust",
  believing: "trust",
  belief: "trust",
  faith: "trust",
  faithful: "trust",
  rely: "trust",
  relying: "trust",
  let: "trust",
  "let go": "trust",
  release: "trust",
  releasing: "trust",
  free: "trust",
  freeing: "trust",
  
  // === ACCEPT ===
  accept: "accept",
  accepted: "accept",
  accepting: "accept",
  accepts: "accept",
  acceptance: "accept",
  embrace: "accept",
  embracing: "accept",
  embraced: "accept",
  acknowledge: "accept",
  acknowledging: "accept",
  "let it go": "accept",
  "move on": "accept",
  "next shot": "accept",
  forward: "accept",
  
  // === PATIENCE ===
  patience: "patience",
  patient: "patience",
  patiently: "patience",
  wait: "patience",
  waiting: "patience",
  waited: "patience",
  slow: "patience",
  slower: "patience",
  slowly: "patience",
  deliberate: "patience",
  deliberately: "patience",
  unhurried: "patience",
  measured: "patience",
  
  // === SIMPLIFY ===
  simplify: "simplify",
  simplified: "simplify",
  simplifying: "simplify",
  simple: "simplify",
  simply: "simplify",
  simpler: "simplify",
  basic: "simplify",
  basics: "simplify",
  essential: "simplify",
  essentials: "simplify",
  strip: "simplify",
  stripped: "simplify",
  clear: "simplify",
  clearing: "simplify",
  cleared: "simplify",
  clean: "simplify",
  minimal: "simplify",
  minimize: "simplify",
  reduce: "simplify",
};

/**
 * Normalize any cue word to its canonical form
 * Returns the canonical cue if found, or null if not mappable
 */
export function toCanonicalCue(word: string): CanonicalCue | null {
  const normalized = word.toLowerCase().trim();
  
  // Direct lookup
  if (normalized in CUE_SYNONYMS) {
    return CUE_SYNONYMS[normalized];
  }
  
  // Check for multi-word phrases
  for (const [phrase, canonical] of Object.entries(CUE_SYNONYMS)) {
    if (normalized.includes(phrase) || phrase.includes(normalized)) {
      return canonical;
    }
  }
  
  return null;
}

/**
 * Normalize a cue word, returning canonical form or original if not mappable
 * This is the main function to use for display and storage
 */
export function normalizeToCanonical(word: string): string {
  const canonical = toCanonicalCue(word);
  return canonical ?? word.toLowerCase().trim();
}

/**
 * Check if a word is already a canonical cue
 */
export function isCanonicalCue(word: string): word is CanonicalCue {
  return CANONICAL_CUES.includes(word.toLowerCase().trim() as CanonicalCue);
}

/**
 * Extract and normalize all cue words from {{type:word}} syntax
 */
export function extractAndNormalizeCues(content: string): CanonicalCue[] {
  const matches = content.matchAll(/{{(?:focus|calm):([^}]+)}}/g);
  const cues: CanonicalCue[] = [];
  
  for (const match of matches) {
    const canonical = toCanonicalCue(match[1]);
    if (canonical && !cues.includes(canonical)) {
      cues.push(canonical);
    }
  }
  
  return cues;
}
