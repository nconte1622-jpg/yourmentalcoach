// Close Strong auto-detection logic
// Triggers when user is on hole 16+ or mentions finishing keywords

const CLOSE_STRONG_KEYWORDS = [
  "close strong",
  "finish",
  "finishing",
  "closing",
  "last holes",
  "coming in",
  "final stretch",
  "protect the score",
  "don't blow it",
  "dont blow it",
  "home stretch",
  "last few",
];

// Match patterns like "hole 14", "hole 16", "on 14", "14th", "on the 15th"
const HOLE_NUMBER_PATTERNS = [
  /hole\s*(\d{1,2})/i,
  /on\s+(\d{1,2})/i,
  /(\d{1,2})(?:st|nd|rd|th)\s*(?:hole|tee)?/i,
  /playing\s+(\d{1,2})/i,
  /at\s+(\d{1,2})/i,
];

export type CloseStrongTrigger = {
  triggered: boolean;
  reason: string | null;
};

export function detectCloseStrong(message: string): CloseStrongTrigger {
  const lowerMessage = message.toLowerCase();
  
  // Check for keywords first
  for (const keyword of CLOSE_STRONG_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      return {
        triggered: true,
        reason: `Keyword: "${keyword}"`,
      };
    }
  }
  
  // Check for hole numbers >= 14
  for (const pattern of HOLE_NUMBER_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      const holeNumber = parseInt(match[1], 10);
      if (holeNumber >= 16 && holeNumber <= 18) {
        return {
          triggered: true,
          reason: `Auto: Hole ${holeNumber}`,
        };
      }
    }
  }
  
  return {
    triggered: false,
    reason: null,
  };
}
