/**
 * golfNews.ts — "Daily Caddie Intel" feed.
 *
 * Once per day, the coach worker (Claude) generates a short golf news digest and
 * connects each item to the player's mental game. Cached per date in localStorage
 * so it only generates once a day per device.
 *
 * NOTE: a Supabase table would let one generation be shared across all of a
 * user's devices and reduce model calls. Create when ready, then read-through:
 *
 *   -- daily_golf_news: { id, date text (YYYY-MM-DD), content jsonb, created_at }
 */

import { getCoachResponse } from "./mentalCoachApi";

export interface NewsItem {
  title: string;
  summary: string;
  application: string; // "what this means for YOUR game"
}

export interface TourStat {
  stat: string;
  application: string;
}

export interface DailyGolfNews {
  date: string; // YYYY-MM-DD
  items: NewsItem[];
  tourStat: TourStat;
  generatedAt: string;
}

const CACHE_PREFIX = "daily-golf-news-v1";

export function todayKey(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function loadCachedNews(date = todayKey()): DailyGolfNews | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}:${date}`);
    return raw ? (JSON.parse(raw) as DailyGolfNews) : null;
  } catch {
    return null;
  }
}

function cacheNews(news: DailyGolfNews): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}:${news.date}`, JSON.stringify(news));
  } catch {
    /* best-effort */
  }
}

function extractJson(text: string): unknown | null {
  // The model may wrap JSON in prose or fences — pull the first {...} block.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Get today's digest, generating it via the worker if not already cached.
 * Pass force=true to regenerate (pull-to-refresh).
 */
export async function getDailyGolfNews(force = false): Promise<DailyGolfNews> {
  const date = todayKey();
  if (!force) {
    const cached = loadCachedNews(date);
    if (cached) return cached;
  }

  const prompt =
    `Today is ${date}. You are a PGA Tour-savvy golf caddie writing a brief daily intel digest. ` +
    `Return ONLY valid JSON (no prose, no code fences) with this exact shape:\n` +
    `{"items":[{"title":"...","summary":"one sentence","application":"how this applies to an amateur's mental game, one sentence"}],` +
    `"tourStat":{"stat":"a notable tour stat or leaderboard fact","application":"a one-sentence mental takeaway"}}\n` +
    `Provide 3-4 items drawn from your knowledge of the pro game, majors, and tour storylines. ` +
    `Keep every field under 30 words. Make the "application" lines genuinely useful mental-game advice.`;

  let news: DailyGolfNews;
  try {
    const text = await getCoachResponse({
      messages: [{ role: "user", content: prompt }],
      context: "coach",
    });
    const parsed = extractJson(text) as
      | { items?: NewsItem[]; tourStat?: TourStat }
      | null;
    if (!parsed?.items?.length) throw new Error("no items");
    news = {
      date,
      items: parsed.items.slice(0, 4),
      tourStat: parsed.tourStat ?? {
        stat: "Driving accuracy separates good rounds from great ones.",
        application: "Commit to the fairway, not the flag.",
      },
      generatedAt: new Date().toISOString(),
    };
  } catch {
    news = fallbackNews(date);
  }

  cacheNews(news);
  return news;
}

function fallbackNews(date: string): DailyGolfNews {
  return {
    date,
    items: [
      {
        title: "Tour pros commit before they swing",
        summary: "The best players decide on a target and shot shape, then trust it fully.",
        application: "Pick one target, take one breath, and swing without second-guessing.",
      },
      {
        title: "Majors are won with the short game",
        summary: "Scrambling and putting under pressure decide most big tournaments.",
        application: "Spend your warm-up on 50-yard-and-in — that's where strokes hide.",
      },
      {
        title: "Course management beats hero shots",
        summary: "Elite players take their medicine and avoid compounding mistakes.",
        application: "After a bad shot, play the smart recovery, not the miracle.",
      },
    ],
    tourStat: {
      stat: "Scrambling from the rough is a top differentiator on tour.",
      application: "Accept the miss, then get up-and-down — resilience is a skill.",
    },
    generatedAt: new Date().toISOString(),
  };
}
