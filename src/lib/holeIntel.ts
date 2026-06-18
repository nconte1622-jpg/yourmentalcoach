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
const GEO_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
