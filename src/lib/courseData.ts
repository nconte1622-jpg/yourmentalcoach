/**
 * Course data — fetches hole-by-hole data from golfcourseapi.com and caches it.
 * Works in two modes:
 *   1. API mode:  set VITE_GOLF_API_KEY → fetches par, yardage, stroke-index per hole
 *   2. AI mode:   no key needed → course name + hole number alone let GPT-4 draw
 *                 on its training knowledge of thousands of famous courses
 *
 * Either way, the AI context is enriched and the coach gives hole-specific tips.
 */

import type { Scorecard } from "./scorecardStorage";

const GOLF_API_KEY = (import.meta.env.VITE_GOLF_API_KEY as string | undefined) ?? "";
const GOLF_API_BASE = "https://api.golfcourseapi.com/v1";
const CACHE_PREFIX = "course-data-v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CourseHole {
  number: number;
  par: number;
  yardage?: number;   // back / championship tees
  handicap?: number;  // stroke index — lower = harder
}

export interface CourseInfo {
  id: string;
  name: string;
  city?: string;
  state?: string;
  holes: CourseHole[];
  courseRating?: number;
  slopeRating?: number;
  cachedAt: string;
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

function cacheKey(courseName: string) {
  return `${CACHE_PREFIX}:${courseName.toLowerCase().trim().replace(/\s+/g, "-")}`;
}

export function loadCachedCourse(courseName: string): CourseInfo | null {
  try {
    const raw = localStorage.getItem(cacheKey(courseName));
    if (!raw) return null;
    const data = JSON.parse(raw) as CourseInfo;
    const age = Date.now() - new Date(data.cachedAt).getTime();
    return age < CACHE_TTL_MS ? data : null;
  } catch {
    return null;
  }
}

function saveCourseCache(courseName: string, data: CourseInfo): void {
  try {
    localStorage.setItem(cacheKey(courseName), JSON.stringify(data));
  } catch {
    // localStorage full — best-effort cache
  }
}

// ─── API fetch ────────────────────────────────────────────────────────────────

async function fetchCourseFromAPI(courseName: string): Promise<CourseInfo | null> {
  if (!GOLF_API_KEY) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    // Step 1: search
    const searchResp = await fetch(
      `${GOLF_API_BASE}/search?search_query=${encodeURIComponent(courseName)}&key=${GOLF_API_KEY}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!searchResp.ok) return null;

    const searchData = await searchResp.json() as { courses?: unknown[] } | unknown[];
    const courses = Array.isArray(searchData)
      ? searchData
      : (searchData as { courses?: unknown[] }).courses ?? [];
    if (!Array.isArray(courses) || courses.length === 0) return null;

    const first = courses[0] as Record<string, unknown>;
    const courseId = first.id ?? first.course_id;
    if (!courseId) return null;

    // Step 2: detail
    const detailResp = await fetch(
      `${GOLF_API_BASE}/courses/${String(courseId)}?key=${GOLF_API_KEY}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!detailResp.ok) return null;

    const detail = await detailResp.json() as Record<string, unknown>;

    // Parse holes — different APIs shape data differently, so be flexible
    const rawHoles = (detail.holes ??
      ((detail.tee_data as { holes?: unknown[] }[])?.[0]?.holes) ??
      []) as Record<string, unknown>[];

    const holes: CourseHole[] = rawHoles
      .map((h) => ({
        number: Number(h.number ?? h.hole_number ?? 0),
        par: Number(h.par ?? 4),
        yardage: h.yardage !== undefined ? Number(h.yardage) : h.yards !== undefined ? Number(h.yards) : undefined,
        handicap: h.handicap !== undefined ? Number(h.handicap) : h.stroke_index !== undefined ? Number(h.stroke_index) : undefined,
      }))
      .filter((h) => h.number >= 1 && h.number <= 18)
      .sort((a, b) => a.number - b.number);

    return {
      id: String(courseId),
      name: String(detail.club_name ?? detail.name ?? courseName),
      city: detail.city ? String(detail.city) : undefined,
      state: detail.state ? String(detail.state) : undefined,
      holes,
      courseRating: detail.course_rating ? Number(detail.course_rating) : undefined,
      slopeRating: detail.slope_rating ? Number(detail.slope_rating) : undefined,
      cachedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch course data, using cache when available.
 * Safe to call from RoundSetup — fails silently if API is unavailable.
 */
export async function fetchAndCacheCourse(courseName: string): Promise<CourseInfo | null> {
  if (!courseName.trim()) return null;
  const cached = loadCachedCourse(courseName);
  if (cached) return cached;
  const fresh = await fetchCourseFromAPI(courseName);
  if (fresh) saveCourseCache(courseName, fresh);
  return fresh;
}

// ─── Hole utilities ───────────────────────────────────────────────────────────

/**
 * Current hole = first hole with no score.
 * If all 18 are filled, returns 18 (final hole).
 * If no scorecard yet, returns 1.
 */
export function getCurrentHole(scorecard: Scorecard | null): number {
  if (!scorecard) return 1;
  const first = scorecard.holes.find((h) => h.score === null);
  return first?.hole ?? 18;
}

/**
 * Get hole detail from cached course data or scorecard par.
 */
export function getHoleDetail(
  courseInfo: CourseInfo | null,
  scorecard: Scorecard | null,
  holeNumber: number
): CourseHole | null {
  // Prefer API data
  if (courseInfo?.holes.length) {
    const found = courseInfo.holes.find((h) => h.number === holeNumber);
    if (found) return found;
  }
  // Fall back to scorecard par
  if (scorecard) {
    const h = scorecard.holes.find((sc) => sc.hole === holeNumber);
    if (h) return { number: holeNumber, par: h.par };
  }
  return null;
}

// ─── AI context builder ───────────────────────────────────────────────────────

/**
 * Build the course + hole context string that gets injected into every AI message.
 * When the API key is configured and the course is found, the AI gets par + yardage + stroke index.
 * Without API data, it still gets course name + hole → GPT-4 draws on its training knowledge.
 */
export function buildCourseContextForAI(params: {
  courseName: string | null | undefined;
  holeNumber: number;
  holeDetail: CourseHole | null;
  handicap: number | null;
}): string | null {
  const { courseName, holeNumber, holeDetail, handicap } = params;
  if (!courseName?.trim()) return null;

  const parts: string[] = [];

  parts.push(`Course: ${courseName}.`);
  parts.push(`Current hole: ${holeNumber}.`);

  if (holeDetail) {
    const yards = holeDetail.yardage ? ` · ${holeDetail.yardage} yards` : "";
    const si = holeDetail.handicap != null ? ` · stroke index ${holeDetail.handicap}` : "";
    parts.push(`Hole ${holeNumber} data: par ${holeDetail.par}${yards}${si}.`);

    if (holeDetail.handicap != null) {
      if (holeDetail.handicap <= 3) {
        parts.push(
          `Hole ${holeNumber} is among the hardest on the course (stroke index ${holeDetail.handicap}). Acknowledge the challenge; help the golfer commit to a conservative, process-focused strategy.`
        );
      } else if (holeDetail.handicap >= 16) {
        parts.push(
          `Hole ${holeNumber} is one of the easier holes (stroke index ${holeDetail.handicap}). Encourage calm confidence — this is a chance to score.`
        );
      }
    }
  }

  if (handicap != null) {
    const levelLabel =
      handicap <= 5
        ? "low-handicap player"
        : handicap <= 15
        ? "mid-handicap player"
        : "higher-handicap player";
    parts.push(`Golfer is a ${levelLabel} (handicap ${handicap}).`);
  }

  parts.push(
    `Draw on your knowledge of ${courseName} to give specific, relevant mental coaching for hole ${holeNumber}: its known challenges, the right mental approach, what experienced players focus on here, and where to stay away from.`
  );

  return parts.join(" ");
}
