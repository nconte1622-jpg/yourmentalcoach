/**
 * GPS Smart Round Mode — gpsRoundTracker.ts
 *
 * Watches the player's GPS position during a round. When they move more than
 * HOLE_TRANSITION_YARDS (~120 yards) from the last check-in point and at least
 * MIN_GAP_MS (5 min) has passed since the last prompt, we fire a hole-transition
 * callback so the UI can show a "How'd that hole go?" check-in.
 *
 * Architecture:
 *  - Pure module (no React) — safe to import from Round.tsx
 *  - Stores state in a plain object so the hook layer is thin
 *  - Uses the native Geolocation watchPosition API
 *
 * Usage:
 *   import { startGpsTracking, stopGpsTracking, getGpsState } from "@/lib/gpsRoundTracker";
 *   startGpsTracking({ onHoleTransition: (n) => ... });
 *   stopGpsTracking();
 */

/** One recorded position */
export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

/** Check-in rating options */
export type HoleMentalRating = "solid" | "shaky" | "bounced_back";

/** Stored check-in for a completed hole */
export interface HoleCheckIn {
  holeNumber: number;
  rating: HoleMentalRating;
  timestamp: number;
  position: GpsPoint;
}

/** Internal tracker state */
interface GpsTrackerState {
  watchId: number | null;
  /** Where the player was when the last check-in was offered */
  lastCheckInPoint: GpsPoint | null;
  /** When we last offered a check-in */
  lastCheckInMs: number;
  /** Estimated current hole number */
  currentHole: number;
  /** All check-ins recorded this round */
  checkIns: HoleCheckIn[];
  /** Callback fires when a hole transition is detected */
  onHoleTransition: ((estimatedHole: number) => void) | null;
  isRunning: boolean;
}

const state: GpsTrackerState = {
  watchId: null,
  lastCheckInPoint: null,
  lastCheckInMs: 0,
  currentHole: 1,
  checkIns: [],
  onHoleTransition: null,
  isRunning: false,
};

// ── Constants ────────────────────────────────────────────────
/** Distance in yards to qualify as a hole transition */
const HOLE_TRANSITION_YARDS = 120;

/** Minimum milliseconds between check-in prompts (5 min) */
const MIN_GAP_MS = 5 * 60 * 1000;

/** localStorage key for persisting state within a round */
const STORAGE_KEY = "caddie-gps-checkins";

// ── Haversine distance ────────────────────────────────────────
/** Returns distance in yards between two lat/lng points */
export function haversineYards(a: GpsPoint, b: GpsPoint): number {
  const R = 6371000; // Earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const a2 =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
  const metres = R * c;
  return metres * 1.09361; // metres → yards
}

// ── Public API ────────────────────────────────────────────────

export interface StartGpsOptions {
  /** Called when a hole transition is detected with the estimated new hole # */
  onHoleTransition: (estimatedHole: number) => void;
}

/**
 * Start GPS tracking.
 * Requests location permission if not already granted.
 * Safe to call multiple times — idempotent.
 */
export function startGpsTracking(options: StartGpsOptions): void {
  if (state.isRunning) return;
  if (!("geolocation" in navigator)) {
    console.warn("[GPS] Geolocation not supported");
    return;
  }

  state.onHoleTransition = options.onHoleTransition;
  state.isRunning = true;

  // Load any persisted check-ins from a previous resume
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<GpsTrackerState>;
      if (parsed.checkIns) state.checkIns = parsed.checkIns;
      if (parsed.currentHole) state.currentHole = parsed.currentHole;
      if (parsed.lastCheckInMs) state.lastCheckInMs = parsed.lastCheckInMs;
      if (parsed.lastCheckInPoint) state.lastCheckInPoint = parsed.lastCheckInPoint;
    }
  } catch {
    // ignore
  }

  state.watchId = navigator.geolocation.watchPosition(
    handlePosition,
    handleError,
    {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 20000,
    }
  );
}

/** Stop tracking and release the GPS watch. */
export function stopGpsTracking(): void {
  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }
  state.isRunning = false;
  state.onHoleTransition = null;
}

/** Reset state at the start of a fresh round. */
export function resetGpsTracking(): void {
  stopGpsTracking();
  state.lastCheckInPoint = null;
  state.lastCheckInMs = 0;
  state.currentHole = 1;
  state.checkIns = [];
  localStorage.removeItem(STORAGE_KEY);
}

/** Record a player's response to a hole check-in. */
export function recordHoleCheckIn(rating: HoleMentalRating, position?: GpsPoint): void {
  const checkIn: HoleCheckIn = {
    holeNumber: state.currentHole,
    rating,
    timestamp: Date.now(),
    position: position ?? state.lastCheckInPoint ?? { lat: 0, lng: 0, timestamp: Date.now() },
  };

  state.checkIns.push(checkIn);
  state.currentHole += 1;
  persistState();
}

/** Read-only snapshot of current GPS state */
export function getGpsState(): Readonly<{
  currentHole: number;
  checkIns: HoleCheckIn[];
  isRunning: boolean;
}> {
  return {
    currentHole: state.currentHole,
    checkIns: state.checkIns,
    isRunning: state.isRunning,
  };
}

/** Load all hole check-ins recorded during this round */
export function loadHoleCheckIns(): HoleCheckIn[] {
  return [...state.checkIns];
}

// ── Internal handlers ─────────────────────────────────────────

function handlePosition(pos: GeolocationPosition): void {
  const point: GpsPoint = {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    timestamp: pos.timestamp,
  };

  if (!state.lastCheckInPoint) {
    // First fix — set baseline, no check-in yet
    state.lastCheckInPoint = point;
    return;
  }

  const distYards = haversineYards(state.lastCheckInPoint, point);
  const timeSinceLast = Date.now() - state.lastCheckInMs;

  if (distYards >= HOLE_TRANSITION_YARDS && timeSinceLast >= MIN_GAP_MS) {
    // Hole transition detected
    state.lastCheckInPoint = point;
    state.lastCheckInMs = Date.now();
    state.onHoleTransition?.(state.currentHole);
  }
}

function handleError(err: GeolocationPositionError): void {
  // PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3
  if (err.code === 1) {
    console.warn("[GPS] Location permission denied — GPS mode disabled");
    stopGpsTracking();
  }
  // Timeout / unavailable — silently retry (watchPosition handles this)
}

function persistState(): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        checkIns: state.checkIns,
        currentHole: state.currentHole,
        lastCheckInMs: state.lastCheckInMs,
        lastCheckInPoint: state.lastCheckInPoint,
      })
    );
  } catch {
    // storage full — ignore
  }
}
