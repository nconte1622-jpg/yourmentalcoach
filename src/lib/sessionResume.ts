/**
 * Session resume — keeps the user in place when iOS recycles the WebView.
 *
 * On iOS, WKWebView can jettison its web-content process under memory pressure
 * or after the app has been backgrounded. When the user returns, the WebView
 * does a full document reload: main.tsx re-runs, in-memory React Router state is
 * lost, and the app re-derives its route from the document URL ("/") — dumping
 * the user back to Home and replaying the splash.
 *
 * To make that reload non-destructive we persist the last route (with a
 * timestamp) to localStorage. On boot we can tell the difference between:
 *   - a "warm reload" (the WebView reloaded while the user was actively using
 *     the app) → silently restore their route, skip the splash, and
 *   - a genuine "cold launch" (the app was closed and reopened later) → show
 *     the splash and start on Home as normal.
 */

const RESUME_KEY = "ymc_session_resume_v1";

// How recently the app must have been active for a reload to count as "warm".
// Long enough to cover a memory-pressure reload after a short backgrounding,
// short enough that reopening the app later in the day starts fresh on Home.
const RESUME_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

type ResumeRecord = { path: string; ts: number };

function isAuthRoute(path: string): boolean {
  return path === "/login" || path.startsWith("/auth");
}

/** Record the current route as the resume target. Call on every navigation. */
export function recordRouteForResume(path: string): void {
  try {
    if (!path || isAuthRoute(path)) return; // never resume into auth/login flows
    const record: ResumeRecord = { path, ts: Date.now() };
    localStorage.setItem(RESUME_KEY, JSON.stringify(record));
  } catch {
    // localStorage can throw (quota/private mode) — resume is best-effort.
  }
}

function readResumeRecord(): ResumeRecord | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResumeRecord;
    if (!parsed || typeof parsed.path !== "string" || typeof parsed.ts !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * True if the app was active very recently — i.e. this boot is a WebView
 * reload rather than a cold start. Used to skip the splash on reload.
 */
export function isWarmReload(): boolean {
  const record = readResumeRecord();
  if (!record) return false;
  return Date.now() - record.ts <= RESUME_WINDOW_MS;
}

/**
 * The route to restore the user to after a warm reload, or null if this is a
 * cold launch (or the saved route isn't a meaningful resume target).
 */
export function getResumeTarget(): string | null {
  const record = readResumeRecord();
  if (!record) return null;
  if (Date.now() - record.ts > RESUME_WINDOW_MS) return null;
  if (!record.path || record.path === "/" || isAuthRoute(record.path)) return null;
  return record.path;
}
