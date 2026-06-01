/**
 * Persistent Insight Journal
 *
 * Extracts key personal insights from chat conversations and stores them
 * across rounds. These feed into the AI context so the coach remembers
 * things the golfer said weeks ago — "Last week you mentioned your putting
 * stroke falls apart when you start thinking about score."
 *
 * Rolling window of last 10 rounds × ~3 insights each = ~30 insights max.
 */

const JOURNAL_KEY = "golfer-insight-journal";
const MAX_INSIGHTS = 30;
const MAX_INSIGHTS_PER_ROUND = 3;

export interface JournalInsight {
  id: string;
  date: string;
  roundId: string;
  /** The golfer's own words — what they said that revealed something */
  userSaid: string;
  /** What the insight is about (auto-categorized) */
  category: "tendency" | "trigger" | "strength" | "goal" | "technique" | "general";
  /** One-line summary of the insight */
  summary: string;
}

// ── Storage ───────────────────────────────────────────────

export function loadJournal(): JournalInsight[] {
  try {
    const stored = localStorage.getItem(JOURNAL_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveJournal(insights: JournalInsight[]): void {
  try {
    // Keep only the most recent MAX_INSIGHTS
    const trimmed = insights.slice(-MAX_INSIGHTS);
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(trimmed));
  } catch { /* silent */ }
}

export function addInsight(insight: Omit<JournalInsight, "id">): void {
  const journal = loadJournal();
  journal.push({
    ...insight,
    id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  saveJournal(journal);
}

// ── Extraction from chat messages ─────────────────────────

interface ChatMsg {
  content: string;
  isUser: boolean;
}

/**
 * Insight-worthy patterns in user messages.
 * Each pattern has a regex, a category, and a summary template.
 */
const INSIGHT_PATTERNS: {
  pattern: RegExp;
  category: JournalInsight["category"];
  /** Which capture group index contains the meaningful text */
  groupIndex: number;
  summaryTemplate: (match: string) => string;
}[] = [
  // Tendencies / self-awareness
  { pattern: /i always (.*?)(?:\.|$)/i, groupIndex: 1, category: "tendency", summaryTemplate: (m) => `Tends to: ${m}` },
  { pattern: /i tend to (.*?)(?:\.|$)/i, groupIndex: 1, category: "tendency", summaryTemplate: (m) => `Tendency: ${m}` },
  { pattern: /every time i (.*?)(?:\.|$)/i, groupIndex: 1, category: "tendency", summaryTemplate: (m) => `Recurring pattern: ${m}` },
  { pattern: /i keep (.*?)(?:\.|$)/i, groupIndex: 1, category: "tendency", summaryTemplate: (m) => `Keeps: ${m}` },
  { pattern: /my problem is (.*?)(?:\.|$)/i, groupIndex: 1, category: "tendency", summaryTemplate: (m) => `Self-identified problem: ${m}` },

  // Triggers — match[1] is the action verb, which is correct for these
  { pattern: /when i ((?:miss|bogey|double|shank|chunk|skull|top|slice|hook).*?)(?:\.|,|$)/i, groupIndex: 1, category: "trigger", summaryTemplate: (m) => `Trigger: after ${m}` },
  { pattern: /after a ((?:bad|terrible|awful|rough).*?)(?:\.|,|$)/i, groupIndex: 1, category: "trigger", summaryTemplate: (m) => `Trigger: after a ${m}` },
  { pattern: /i get ((?:nervous|anxious|tight|frustrated|angry|pissed) (?:when|on|before|after).*?)(?:\.|$)/i, groupIndex: 1, category: "trigger", summaryTemplate: (m) => `Gets ${m}` },

  // Strengths — use non-capturing groups for prefixes, single capture for meaningful part
  { pattern: /i(?:'m| am) (?:really )?good (?:at|with) (.*?)(?:\.|$)/i, groupIndex: 1, category: "strength", summaryTemplate: (m) => `Strength: good at ${m}` },
  { pattern: /my (?:best|strongest|favorite) (?:part|thing|aspect) (.*?)(?:\.|$)/i, groupIndex: 1, category: "strength", summaryTemplate: (m) => `Best part: ${m}` },

  // Goals — use non-capturing group for verb, capture the goal
  { pattern: /i (?:want|need|wish) to (.*?)(?:\.|$)/i, groupIndex: 1, category: "goal", summaryTemplate: (m) => `Wants to: ${m}` },
  { pattern: /my goal is (.*?)(?:\.|$)/i, groupIndex: 1, category: "goal", summaryTemplate: (m) => `Goal: ${m}` },
  { pattern: /i(?:'m| am) (?:trying|working on) (.*?)(?:\.|$)/i, groupIndex: 1, category: "goal", summaryTemplate: (m) => `Working on: ${m}` },

  // Technique/game specifics — capture club/area + description together
  { pattern: /my ((?:driver|irons?|wedges?|putter|putting|chipping|short game|long game).*?)(?:\.|$)/i, groupIndex: 1, category: "technique", summaryTemplate: (m) => `About their ${m}` },
  { pattern: /on the ((?:back nine|front nine|first tee|closing holes?|par [345]s).*?)(?:\.|$)/i, groupIndex: 1, category: "technique", summaryTemplate: (m) => `On the ${m}` },
];

/**
 * Minimum message length to consider for insight extraction.
 * Short messages like "yes" or "thanks" aren't insightful.
 */
const MIN_MESSAGE_LENGTH = 30;

/**
 * Extract insights from a round's chat messages.
 * Called when a round ends (quick end or full reflection).
 */
export function extractInsightsFromChat(
  messages: ChatMsg[],
  roundId: string,
): JournalInsight[] {
  const userMessages = messages.filter(
    (m) => m.isUser && m.content.length >= MIN_MESSAGE_LENGTH,
  );

  const insights: JournalInsight[] = [];
  const date = new Date().toISOString();

  for (const msg of userMessages) {
    if (insights.length >= MAX_INSIGHTS_PER_ROUND) break;

    for (const { pattern, category, groupIndex, summaryTemplate } of INSIGHT_PATTERNS) {
      const match = msg.content.match(pattern);
      if (match) {
        // Use the specified capture group, falling back to full match
        const captured = (match[groupIndex] || match[0]).trim().slice(0, 100);
        if (!captured) continue; // Skip empty captures
        const summary = summaryTemplate(captured);

        // Deduplicate — don't add same-category insight twice per round
        if (!insights.some((i) => i.category === category)) {
          insights.push({
            id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            date,
            roundId,
            userSaid: msg.content.slice(0, 200),
            category,
            summary,
          });
        }
        break; // One insight per message
      }
    }
  }

  return insights;
}

/**
 * Extract and save insights from a round's chat.
 * Call this during round end before storage is cleared.
 */
export function extractAndSaveInsights(
  messages: ChatMsg[],
  roundId: string,
): void {
  const insights = extractInsightsFromChat(messages, roundId);
  if (insights.length === 0) return;

  const journal = loadJournal();
  journal.push(...insights);
  saveJournal(journal);
}

// ── Context for AI ────────────────────────────────────────

/**
 * Build a context string from the insight journal for the AI.
 * Returns null if no insights exist.
 */
export function buildInsightJournalContext(): string | null {
  const journal = loadJournal();
  if (journal.length === 0) return null;

  const parts: string[] = [];

  // Group by category for the AI
  const tendencies = journal.filter((i) => i.category === "tendency");
  const triggers = journal.filter((i) => i.category === "trigger");
  const strengths = journal.filter((i) => i.category === "strength");
  const goals = journal.filter((i) => i.category === "goal");
  const techniques = journal.filter((i) => i.category === "technique");

  if (tendencies.length > 0) {
    const recent = tendencies.slice(-2);
    parts.push(
      `Things they've told you about themselves: ${recent.map((t) => `"${t.summary}"`).join(", ")}.`,
    );
  }

  if (triggers.length > 0) {
    const recent = triggers.slice(-2);
    parts.push(
      `Triggers they've shared: ${recent.map((t) => `"${t.summary}"`).join(", ")}.`,
    );
  }

  if (strengths.length > 0) {
    const latest = strengths[strengths.length - 1];
    parts.push(`They've said: "${latest.summary}".`);
  }

  if (goals.length > 0) {
    const latest = goals[goals.length - 1];
    parts.push(`Their stated goal: "${latest.summary}".`);
  }

  if (techniques.length > 0) {
    const recent = techniques.slice(-2);
    parts.push(
      `Game notes: ${recent.map((t) => `"${t.summary}"`).join(", ")}.`,
    );
  }

  if (parts.length === 0) return null;

  return parts.join("\n");
}
