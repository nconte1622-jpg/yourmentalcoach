import { extractCueWords, inferContextTag } from "@/lib/memoryStorage";
import type { CreateMemoryInput } from "@/hooks/useMemories";

/**
 * Extract meaningful memories from a post-round reflection session.
 * Returns 2-4 memory entries based on the conversation content.
 */
export function extractMemoriesFromReflection(
  momentDescription: string,
  feelingResponse: string,
  coachReflection: string
): CreateMemoryInput[] {
  const memories: CreateMemoryInput[] = [];
  const contextTag = inferContextTag(momentDescription);
  const cueWords = extractCueWords(coachReflection);
  
  // 1. Always extract a cue memory if we found emphasized words
  if (cueWords.length > 0) {
    const primaryCue = cueWords[0];
    memories.push({
      category: "cue",
      content: `Cue word "${primaryCue}" resonated during ${contextTag || "round reflection"}.`,
      confidence: 0.7,
    });
  }

  // 2. Analyze for success patterns (positive mental states)
  const successIndicators = detectSuccessIndicators(feelingResponse, coachReflection);
  if (successIndicators.found) {
    memories.push({
      category: "success",
      content: successIndicators.summary,
      confidence: successIndicators.confidence,
    });
  }

  // 3. Analyze for recurring patterns (tendencies, triggers)
  const patternIndicators = detectPatternIndicators(momentDescription, feelingResponse);
  if (patternIndicators.found) {
    memories.push({
      category: "pattern",
      content: patternIndicators.summary,
      confidence: patternIndicators.confidence,
    });
  }

  // 4. If we have less than 2 memories, add a general reflection memory
  if (memories.length < 2) {
    const generalMemory = createGeneralReflectionMemory(
      momentDescription,
      feelingResponse,
      contextTag
    );
    if (generalMemory) {
      memories.push(generalMemory);
    }
  }

  // Ensure we have at least 2 but no more than 4 memories
  return memories.slice(0, 4);
}

interface DetectionResult {
  found: boolean;
  summary: string;
  confidence: number;
}

const SUCCESS_KEYWORDS = [
  "committed", "free", "calm", "clear", "confident", "trusted", 
  "focused", "smooth", "easy", "pure", "effortless", "present",
  "let go", "relaxed", "flowed", "natural", "automatic"
];

const TENSION_KEYWORDS = [
  "doubt", "tight", "scared", "nervous", "hesitant", "tense", 
  "rushed", "forced", "steered", "anxious", "worried", "overthink",
  "grip", "freeze", "choke", "pressure"
];

const PATTERN_TRIGGERS = [
  { pattern: /first tee|opening|start/i, label: "first tee nerves" },
  { pattern: /pressure|big moment|important/i, label: "pressure situations" },
  { pattern: /lead|ahead|winning/i, label: "playing with a lead" },
  { pattern: /behind|catch up|comeback/i, label: "playing from behind" },
  { pattern: /water|hazard|trouble/i, label: "hazard situations" },
  { pattern: /short putt|makeable|inside/i, label: "short putts" },
  { pattern: /drive|tee shot|driver/i, label: "tee shots" },
  { pattern: /approach|iron|into the green/i, label: "approach shots" },
];

function detectSuccessIndicators(feeling: string, reflection: string): DetectionResult {
  const combined = `${feeling} ${reflection}`.toLowerCase();
  const successMatches = SUCCESS_KEYWORDS.filter(keyword => combined.includes(keyword));
  const tensionMatches = TENSION_KEYWORDS.filter(keyword => combined.includes(keyword));
  
  // Success is when we have positive indicators and few/no tension indicators
  if (successMatches.length >= 1 && successMatches.length > tensionMatches.length) {
    const primarySuccess = successMatches[0];
    const confidence = Math.min(0.5 + (successMatches.length * 0.1), 0.9);
    
    return {
      found: true,
      summary: `Experienced ${primarySuccess} state during round. Mental approach was effective.`,
      confidence,
    };
  }
  
  return { found: false, summary: "", confidence: 0 };
}

function detectPatternIndicators(moment: string, feeling: string): DetectionResult {
  const combined = `${moment} ${feeling}`.toLowerCase();
  const tensionMatches = TENSION_KEYWORDS.filter(keyword => combined.includes(keyword));
  
  // Look for situational triggers
  for (const { pattern, label } of PATTERN_TRIGGERS) {
    if (pattern.test(combined)) {
      // If tension keywords present, this is a pattern worth noting
      if (tensionMatches.length > 0) {
        return {
          found: true,
          summary: `Tension tends to appear during ${label}. Awareness is the first step.`,
          confidence: 0.6,
        };
      } else {
        // Even without tension, situational awareness is valuable
        return {
          found: true,
          summary: `${label.charAt(0).toUpperCase() + label.slice(1)} was a focus area this round.`,
          confidence: 0.5,
        };
      }
    }
  }
  
  // General tension pattern
  if (tensionMatches.length >= 2) {
    return {
      found: true,
      summary: `Noticed ${tensionMatches[0]} tendency. Building awareness of mental patterns.`,
      confidence: 0.55,
    };
  }
  
  return { found: false, summary: "", confidence: 0 };
}

function createGeneralReflectionMemory(
  moment: string,
  feeling: string,
  contextTag: string
): CreateMemoryInput | null {
  // Create a brief, non-specific memory about engaging in reflection
  if (moment.length > 10 && feeling.length > 10) {
    return {
      category: "success",
      content: `Completed honest reflection${contextTag ? ` about ${contextTag}` : ""}. Self-awareness practiced.`,
      confidence: 0.4,
    };
  }
  
  return null;
}
