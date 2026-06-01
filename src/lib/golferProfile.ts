/**
 * Golfer Profile — Master Quiz data model & local storage
 *
 * Stored in localStorage and optionally synced to Supabase.
 * The AI uses this profile to deeply personalize every coaching interaction.
 */

export interface GolferProfile {
  // Identity
  firstName: string;
  age: number | null;
  heightInches: number | null; // total inches
  weightLbs: number | null;

  // Golf basics
  handicap: number | null;
  averageScore: number | null; // 18-hole avg
  yearsPlaying: number | null;
  roundsPerMonth: number | null;

  // Playing style
  playingStyle: "aggressive" | "conservative" | "situational" | null;
  bestPart: "driving" | "irons" | "short-game" | "putting" | null;
  weakestPart: "driving" | "irons" | "short-game" | "putting" | null;

  // Mental game
  biggestChallenge:
    | "first-tee-nerves"
    | "bouncing-back"
    | "closing-out"
    | "staying-patient"
    | "focus"
    | "anger-management"
    | null;
  afterBadShot: "dwell" | "quick-reset" | "gets-angry" | "overthink" | null;
  underPressure: "thrive" | "tighten-up" | "collapse" | "inconsistent" | null;
  practiceHabit: "range-grinder" | "course-only" | "casual" | "competitive" | null;

  // Goals
  primaryGoal: "break-80" | "break-90" | "break-100" | "enjoy-more" | "compete" | "consistency" | null;
  mentalGoal: string | null; // free-text: "I want to stop getting angry after a bad hole"

  // Meta
  mentalCoachRating: number | null; // 0-100, null until 3 rounds
  quizCompletedAt: string | null; // ISO timestamp
  quizVersion: number; // for future quiz updates
  updatedAt: string;
}

export const DEFAULT_PROFILE: GolferProfile = {
  firstName: "",
  age: null,
  heightInches: null,
  weightLbs: null,
  handicap: null,
  averageScore: null,
  yearsPlaying: null,
  roundsPerMonth: null,
  playingStyle: null,
  bestPart: null,
  weakestPart: null,
  biggestChallenge: null,
  afterBadShot: null,
  underPressure: null,
  practiceHabit: null,
  primaryGoal: null,
  mentalGoal: null,
  mentalCoachRating: null,
  quizCompletedAt: null,
  quizVersion: 1,
  updatedAt: new Date().toISOString(),
};

const STORAGE_KEY = "golfer-profile";

export function saveGolferProfile(profile: GolferProfile): void {
  try {
    profile.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage failures
  }
}

export function loadGolferProfile(): GolferProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GolferProfile;
  } catch {
    return null;
  }
}

export function hasCompletedQuiz(): boolean {
  const profile = loadGolferProfile();
  return Boolean(profile?.quizCompletedAt);
}

/**
 * Detect if a golfer is a beginner based on their profile.
 * Used to adapt coaching tone to be more nurturing and jargon-free.
 */
export function isBeginnerProfile(profile: GolferProfile): boolean {
  if (profile.primaryGoal === "break-100") return true;
  if (profile.yearsPlaying != null && profile.yearsPlaying <= 1) return true;
  if (profile.handicap != null && profile.handicap > 28) return true;
  return false;
}

export function getHeightDisplay(inches: number | null): string {
  if (!inches) return "";
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;
  return `${feet}'${remainingInches}"`;
}

export function parseHeight(feet: number, inches: number): number {
  return feet * 12 + inches;
}

/**
 * Build a context string for the AI from the golfer profile.
 * This gets injected into the system prompt so the AI knows who it's coaching.
 */
export function buildProfileContextString(profile: GolferProfile): string {
  const parts: string[] = [];

  if (profile.firstName) {
    parts.push(`Golfer's name: ${profile.firstName}.`);
  }

  if (profile.handicap != null) {
    parts.push(`Handicap: ${profile.handicap}.`);
  } else if (profile.averageScore != null) {
    parts.push(`Average 18-hole score: ${profile.averageScore}.`);
  }

  if (profile.yearsPlaying != null) {
    parts.push(`Playing for ${profile.yearsPlaying} years.`);
  }

  if (profile.playingStyle) {
    parts.push(`Playing style: ${profile.playingStyle}.`);
  }

  if (profile.bestPart) {
    parts.push(`Strongest area: ${profile.bestPart.replace("-", " ")}.`);
  }

  if (profile.weakestPart) {
    parts.push(`Weakest area: ${profile.weakestPart.replace("-", " ")}.`);
  }

  if (profile.biggestChallenge) {
    const challengeLabels: Record<string, string> = {
      "first-tee-nerves": "first-tee nerves",
      "bouncing-back": "bouncing back from bad shots",
      "closing-out": "closing out rounds",
      "staying-patient": "staying patient",
      "focus": "maintaining focus",
      "anger-management": "managing anger/frustration",
    };
    parts.push(`Biggest mental challenge: ${challengeLabels[profile.biggestChallenge] || profile.biggestChallenge}.`);
  }

  if (profile.afterBadShot) {
    const shotLabels: Record<string, string> = {
      "dwell": "tends to dwell on bad shots",
      "quick-reset": "resets quickly after bad shots",
      "gets-angry": "gets angry after bad shots",
      "overthink": "overthinks after bad shots",
    };
    parts.push(shotLabels[profile.afterBadShot] || "");
  }

  if (profile.underPressure) {
    const pressureLabels: Record<string, string> = {
      "thrive": "thrives under pressure",
      "tighten-up": "tightens up under pressure",
      "collapse": "tends to collapse under pressure",
      "inconsistent": "inconsistent under pressure",
    };
    parts.push(pressureLabels[profile.underPressure] || "");
  }

  if (profile.primaryGoal) {
    const goalLabels: Record<string, string> = {
      "break-80": "Goal: break 80",
      "break-90": "Goal: break 90",
      "break-100": "Goal: break 100",
      "enjoy-more": "Goal: enjoy golf more",
      "compete": "Goal: compete at a higher level",
      "consistency": "Goal: play more consistently",
    };
    parts.push(goalLabels[profile.primaryGoal] || "");
  }

  if (profile.mentalGoal) {
    parts.push(`Personal mental goal: "${profile.mentalGoal}"`);
  }

  if (profile.mentalCoachRating != null) {
    parts.push(`Current Mental Coach Rating: ${profile.mentalCoachRating}/100.`);
  }

  // Inject coaching style guidance for beginners so the AI adapts its tone
  if (isBeginnerProfile(profile)) {
    parts.push(
      "COACHING APPROACH: This golfer is new to the game or early in their journey. " +
      "ALWAYS lead with warm emotional validation before anything else — ask how they're feeling, " +
      "acknowledge their experience, and celebrate small wins. " +
      "Avoid all technical swing jargon. Use simple, encouraging language. " +
      "Focus on fun, feelings, and building confidence rather than scores. " +
      "Ask 'how does that feel?' more than offering instruction."
    );
  }

  return parts.filter(Boolean).join(" ");
}
