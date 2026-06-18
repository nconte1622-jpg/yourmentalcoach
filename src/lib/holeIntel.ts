/**
 * holeIntel.ts — per-course hole layout + per-hole mental notes + AI aim cues.
 *
 * Hole geometry comes from the OpenStreetMap Overpass API (free, global). Any
 * course a user searches up is fetched on demand and cached, so over time the
 * app builds a local library of every course its players actually visit.
 *
 * Mental notes (miss tendency, aim cue, free notes) are stored per hole in
 * localStorage. NOTE: a Supabase table would let these sync across devices —
 * create it when ready, then swap the storage layer:
 *
 *   -- hole_notes: { id, user_id, course_id, hole_number,
 *   --   miss_tendency (left|right|long|short|none), aim_cue text, notes text, updated_at }
 *
 * Until that table exists we persist locally and degrade gracefully.
 */

import { getCoachResponse } from "./mentalCoachApi";

export type MissTendency = "left" | "right" | "long" | "short" | "none";

export interface HoleGeometry {
  ref: number; // hole number from OSM `ref` tag
  par?: number;
  points: [number, number][]; // [lat, lng] polyline tee → green
  tee: [number, number];
  green: [number, number];
}

export interface HoleNote {
  courseId: string;
  holeNumber: number;
  missTendency: MissTendency;
  aimCue: string;
  notes: string;
  updatedAt: string;
}

const GEO_PREFIX = "hole-geo-v1";
const NOTE_PREFIX = "hole-notes-v1";
const ACTIVE_HOLE_KEY = "gps-active-hole-v1";
const ROUND_COURSE_KEY = "round-course-v1";
const GEO_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ACTIVE_HOLE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — so a stale hole never leaks into a new round
const ROUND_COURSE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — covers a full round, then expires

export function courseIdFromName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Hole geometry (Overpass) ───────────────────────────────────────────────

export async function fetchCourseHoles(
  courseName: string,
  lat: number,
  lng: number
): Promise<HoleGeometry[]> {
  const key = `${GEO_PREFIX}:${courseIdFromName(courseName)}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const cached = JSON.parse(raw) as { at: string; holes: HoleGeometry[] };
      if (Date.now() - new Date(cached.at).getTime() < GEO_TTL_MS) return cached.holes;
    }
  } catch {
    /* ignore */
  }

  try {
    const query =
      `[out:json][timeout:25];(way["golf"="hole"](around:2000,${lat},${lng}););out geom;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      elements?: {
        tags?: Record<string, string>;
        geometry?: { lat: number; lon: number }[];
      }[];
    };

    const holes: HoleGeometry[] = (data.elements ?? [])
      .map((el) => {
        const geom = el.geometry ?? [];
        if (geom.length < 2) return null;
        const ref = Number(el.tags?.ref ?? el.tags?.["golf:hole"] ?? NaN);
        const points = geom.map((g) => [g.lat, g.lon] as [number, number]);
        return {
          ref: Number.isFinite(ref) ? ref : 0,
          par: el.tags?.par ? Number(el.tags.par) : undefined,
          points,
          tee: points[0],
          green: points[points.length - 1],
        } as HoleGeometry;
      })
      .filter((h): h is HoleGeometry => h !== null && h.ref >= 1 && h.ref <= 18)
      .sort((a, b) => a.ref - b.ref);

    try {
      localStorage.setItem(key, JSON.stringify({ at: new Date().toISOString(), holes }));
    } catch {
      /* best-effort */
    }
    return holes;
  } catch {
    return [];
  }
}

// ─── Per-hole mental notes ──────────────────────────────────────────────────

function noteKey(courseId: string) {
  return `${NOTE_PREFIX}:${courseId}`;
}

export function loadHoleNotes(courseId: string): Record<number, HoleNote> {
  try {
    const raw = localStorage.getItem(noteKey(courseId));
    return raw ? (JSON.parse(raw) as Record<number, HoleNote>) : {};
  } catch {
    return {};
  }
}

export function getHoleNote(courseId: string, holeNumber: number): HoleNote | null {
  return loadHoleNotes(courseId)[holeNumber] ?? null;
}

export function saveHoleNote(note: HoleNote): void {
  try {
    const all = loadHoleNotes(note.courseId);
    all[note.holeNumber] = { ...note, updatedAt: new Date().toISOString() };
    localStorage.setItem(noteKey(note.courseId), JSON.stringify(all));
  } catch {
    /* best-effort */
  }
}

// ─── Active hole pointer ────────────────────────────────────────────────────
// The GPS tab records the hole the player is currently looking at so the
// mid-round coach can reference that exact hole's saved notes.

export interface ActiveHole {
  courseId: string;
  courseName: string;
  holeNumber: number;
  at: string;
}

export function setActiveHole(courseId: string, courseName: string, holeNumber: number): void {
  try {
    const payload: ActiveHole = { courseId, courseName, holeNumber, at: new Date().toISOString() };
    localStorage.setItem(ACTIVE_HOLE_KEY, JSON.stringify(payload));
  } catch {
    /* best-effort */
  }
}

export function getActiveHole(): ActiveHole | null {
  try {
    const raw = localStorage.getItem(ACTIVE_HOLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveHole;
    if (Date.now() - new Date(parsed.at).getTime() > ACTIVE_HOLE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveHole(): void {
  try {
    localStorage.removeItem(ACTIVE_HOLE_KEY);
  } catch {
    /* best-effort */
  }
}

// ─── Round course pointer ───────────────────────────────────────────────────
// Set at round setup (the searched + selected course) so the GPS tab on the
// round page auto-loads that exact course — no second search needed.

export interface RoundCourse {
  name: string;
  lat: number;
  lng: number;
  at: string;
}

export function setRoundCourse(c: { name: string; lat: number; lng: number }): void {
  try {
    const payload: RoundCourse = { ...c, at: new Date().toISOString() };
    localStorage.setItem(ROUND_COURSE_KEY, JSON.stringify(payload));
  } catch {
    /* best-effort */
  }
}

export function getRoundCourse(): RoundCourse | null {
  try {
    const raw = localStorage.getItem(ROUND_COURSE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoundCourse;
    if (Date.now() - new Date(parsed.at).getTime() > ROUND_COURSE_TTL_MS) return null;
    if (typeof parsed.lat !== "number" || typeof parsed.lng !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearRoundCourse(): void {
  try {
    localStorage.removeItem(ROUND_COURSE_KEY);
  } catch {
    /* best-effort */
  }
}

/**
 * Format a saved hole note as an AI context string. Returns null when the note
 * has no meaningful content (no miss, no cue, no notes) — so we never inject noise.
 */
export function buildHoleNoteContextString(note: HoleNote, courseName?: string): string | null {
  const hasMiss = note.missTendency && note.missTendency !== "none";
  const hasCue = Boolean(note.aimCue?.trim());
  const hasNotes = Boolean(note.notes?.trim());
  if (!hasMiss && !hasCue && !hasNotes) return null;

  const where = courseName ? ` at ${courseName}` : "";
  const parts: string[] = [
    `The player has saved personal notes for hole ${note.holeNumber}${where}:`,
  ];
  if (hasMiss) parts.push(`their typical miss here is ${note.missTendency}.`);
  if (hasCue) parts.push(`Their aim/mental plan: "${note.aimCue.trim()}".`);
  if (hasNotes) parts.push(`Their own note: "${note.notes.trim()}".`);
  parts.push(
    `Weave this in naturally when coaching this hole — reinforce the aim plan and guard against the known miss.`
  );
  return parts.join(" ");
}

// ─── AI aim + mental cue ────────────────────────────────────────────────────

/**
 * Ask the coach worker for a 1-sentence aim cue + 1-sentence mental cue for a
 * hole, factoring in the player's known miss tendency. Returns plain text.
 */
export async function fetchHoleAimCue(params: {
  courseName: string;
  holeNumber: number;
  par?: number;
  missTendency: MissTendency;
}): Promise<string> {
  const { courseName, holeNumber, par, missTendency } = params;
  const missLine =
    missTendency === "none"
      ? "The player has no consistent miss recorded here yet."
      : `The player tends to miss ${missTendency} on this hole.`;
  const prompt =
    `You are a tour caddie. Hole ${holeNumber}${par ? ` (par ${par})` : ""} at ${courseName}. ` +
    `${missLine} In exactly two short sentences, give: (1) a concrete pre-shot AIM cue ` +
    `(where to aim and what to avoid), then (2) a calming mental cue. No preamble, no labels.`;

  try {
    const text = await getCoachResponse({
      messages: [{ role: "user", content: prompt }],
      context: "round",
    });
    return text.trim();
  } catch {
    return missTendency === "none"
      ? "Pick the fattest part of the green and commit fully. One breath, one target, free swing."
      : `Favor the side away from your ${missTendency} miss and aim conservatively. Trust your tempo and let it go.`;
  }
}
