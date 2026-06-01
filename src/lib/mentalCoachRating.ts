/**
 * Mental Coach Rating (MCR) Calculator
 *
 * Composite 0-100 score measuring a golfer's overall mental game strength.
 * Built from 5 components: Consistency, Self-Awareness, Resilience, Tool Usage, and Growth.
 */

import {
  loadResilienceScores,
  type ResilienceEntry,
} from "./resilienceScore";
import {
  loadPreferredWords,
  loadHighlights,
  loadTriggers,
} from "./memoryStorage";
import { loadGolferProfile } from "./golferProfile";
import { loadJournal } from "./insightJournal";
import { loadRoundHistory } from "./roundContext";

export interface MCRComponentDetail {
  score: number;
  max: number;
  /** What the user has done so far */
  current: string;
  /** What they need to do to earn more points (null if maxed out) */
  nextStep: string | null;
}

export interface MCRResult {
  total: number;
  consistency: MCRComponentDetail;
  selfAwareness: MCRComponentDetail;
  resilience: MCRComponentDetail;
  toolUsage: MCRComponentDetail;
  growth: MCRComponentDetail;
  label: string;
}

/**
 * Get the label for an MCR score
 */
function getLabelForScore(total: number): string {
  if (total >= 81) return "Elite";
  if (total >= 61) return "Strong";
  if (total >= 41) return "Progressing";
  if (total >= 21) return "Developing";
  return "Beginner";
}

/**
 * CONSISTENCY (25 points max)
 * Based on number of rounds played from round history
 */
function calculateConsistency(): MCRComponentDetail {
  const roundHistory = loadRoundHistory();
  const roundCount = roundHistory.length;

  let score: number;
  if (roundCount >= 10) score = 25;
  else if (roundCount >= 5) score = 15;
  else if (roundCount >= 3) score = 10;
  else if (roundCount >= 1) score = 5;
  else score = 0;

  const current = roundCount === 0 ? "No rounds yet" : `${roundCount} round${roundCount !== 1 ? "s" : ""} completed`;

  let nextStep: string | null = null;
  if (roundCount < 1) nextStep = "Complete your first round";
  else if (roundCount < 3) nextStep = `${3 - roundCount} more round${3 - roundCount !== 1 ? "s" : ""} to next level`;
  else if (roundCount < 5) nextStep = `${5 - roundCount} more round${5 - roundCount !== 1 ? "s" : ""} to next level`;
  else if (roundCount < 10) nextStep = `${10 - roundCount} more rounds to max`;

  return { score, max: 25, current, nextStep };
}

/**
 * SELF-AWARENESS (20 points max)
 * Based on count of insights in the journal
 */
function calculateSelfAwareness(): MCRComponentDetail {
  const journal = loadJournal();
  const insightCount = journal.length;

  let score: number;
  if (insightCount >= 20) score = 20;
  else if (insightCount >= 10) score = 15;
  else if (insightCount >= 3) score = 10;
  else score = 0;

  const current = insightCount === 0 ? "No insights yet" : `${insightCount} insight${insightCount !== 1 ? "s" : ""} logged`;

  let nextStep: string | null = null;
  if (insightCount < 3) nextStep = "Chat with your coach during rounds to build insights";
  else if (insightCount < 10) nextStep = `${10 - insightCount} more insights to next level`;
  else if (insightCount < 20) nextStep = `${20 - insightCount} more insights to max`;

  return { score, max: 20, current, nextStep };
}

/**
 * RESILIENCE (20 points max)
 * Based on average resilience score across all rounds
 */
function calculateResilience(): MCRComponentDetail {
  const scores = loadResilienceScores();

  if (scores.length === 0) {
    return {
      score: 0,
      max: 20,
      current: "No resilience data yet",
      nextStep: "Complete a round with emotion tracking to start",
    };
  }

  const avgScore =
    scores.reduce((sum, entry) => sum + entry.score, 0) / scores.length;

  let score: number;
  if (avgScore >= 80) score = 20;
  else if (avgScore >= 60) score = 15;
  else if (avgScore >= 40) score = 10;
  else if (avgScore >= 20) score = 5;
  else score = 0;

  const current = `Avg score: ${Math.round(avgScore)} across ${scores.length} round${scores.length !== 1 ? "s" : ""}`;

  let nextStep: string | null = null;
  if (avgScore < 20) nextStep = "Log emotions and use check-ins to improve";
  else if (avgScore < 40) nextStep = "Use the breathing tool and bounce back from bad holes";
  else if (avgScore < 60) nextStep = "Keep engaging with tools to push past 60 avg";
  else if (avgScore < 80) nextStep = "Great progress — aim for 80+ avg to max this out";

  return { score, max: 20, current, nextStep };
}

/**
 * TOOL USAGE (15 points max)
 * - Has cue words saved (5pts)
 * - Has highlights saved (5pts)
 * - Has completed golfer profile (5pts)
 */
function calculateToolUsage(): MCRComponentDetail {
  let score = 0;
  const missing: string[] = [];

  const preferredWords = loadPreferredWords();
  if (preferredWords.length > 0) {
    score += 5;
  } else {
    missing.push("Save cue words");
  }

  const highlights = loadHighlights();
  if (highlights.length > 0) {
    score += 5;
  } else {
    missing.push("Save round highlights");
  }

  const profile = loadGolferProfile();
  if (profile && profile.quizCompletedAt) {
    score += 5;
  } else {
    missing.push("Complete the golfer quiz");
  }

  score = Math.min(15, score);

  const done = 3 - missing.length;
  const current = done === 0 ? "No tools used yet" : `${done}/3 tools engaged`;

  return {
    score,
    max: 15,
    current,
    nextStep: missing.length > 0 ? missing[0] : null,
  };
}

/**
 * GROWTH (20 points max)
 * Based on trend of resilience scores (first half vs second half)
 */
function calculateGrowth(): MCRComponentDetail {
  const scores = loadResilienceScores();

  if (scores.length < 4) {
    return {
      score: 0,
      max: 20,
      current: scores.length === 0 ? "No data yet" : `${scores.length} round${scores.length !== 1 ? "s" : ""} tracked`,
      nextStep: `Complete ${4 - scores.length} more round${4 - scores.length !== 1 ? "s" : ""} with emotion tracking to unlock growth trend`,
    };
  }

  const sorted = [...scores].reverse();
  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const firstHalfAvg =
    firstHalf.reduce((sum, entry) => sum + entry.score, 0) / firstHalf.length;
  const secondHalfAvg =
    secondHalf.reduce((sum, entry) => sum + entry.score, 0) / secondHalf.length;

  const difference = secondHalfAvg - firstHalfAvg;

  let score: number;
  let current: string;

  if (difference > 5) {
    score = 20;
    current = `Trending up (+${Math.round(difference)} pts)`;
  } else if (difference >= -5) {
    score = 10;
    current = "Holding steady";
  } else {
    score = 5;
    current = `Trending down (${Math.round(difference)} pts)`;
  }

  const nextStep = score < 20 ? "Keep using tools consistently to improve your trend" : null;

  return { score, max: 20, current, nextStep };
}

/**
 * Calculate the complete MCR score
 */
export function calculateMCR(): MCRResult {
  const consistency = calculateConsistency();
  const selfAwareness = calculateSelfAwareness();
  const resilience = calculateResilience();
  const toolUsage = calculateToolUsage();
  const growth = calculateGrowth();

  const total = consistency.score + selfAwareness.score + resilience.score + toolUsage.score + growth.score;

  return {
    total: Math.round(total),
    consistency,
    selfAwareness,
    resilience,
    toolUsage,
    growth,
    label: getLabelForScore(total),
  };
}
