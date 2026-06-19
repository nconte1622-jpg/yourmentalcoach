/**
 * Notification Service — The Caddie
 *
 * Hybrid strategy:
 *  - On native iOS/Android via Capacitor: uses @capacitor/local-notifications
 *    for true scheduled background notifications.
 *    Install with: npm install @capacitor/local-notifications
 *                  npx cap sync
 *  - On web PWA: uses Web Notifications API (Chrome, Safari 16.4+, Firefox).
 *    Can only show when the app is open or via a Service Worker push.
 *
 * Call `initNotifications()` once on app boot (from App.tsx useEffect).
 * Call individual schedule functions after relevant events.
 */

import { Capacitor } from "@capacitor/core";
import { getStreakData } from "@/lib/streakStorage";
import { loadGolferProfile } from "@/lib/golferProfile";

/* ─── Types ─────────────────────────────────────────────── */

interface LocalNotification {
  id: number;
  title: string;
  body: string;
  scheduleAt?: Date;
  extra?: Record<string, unknown>;
}

/* ─── In-app alert store (shown as banners when app opens) ─ */

const IN_APP_ALERTS_KEY = "caddie-in-app-alerts";

interface InAppAlert {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  type: "streak" | "pattern" | "post-round" | "weekly" | "welcome-back";
}

export function getInAppAlerts(): InAppAlert[] {
  try {
    const raw = localStorage.getItem(IN_APP_ALERTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as InAppAlert[];
  } catch {
    return [];
  }
}

export function getUnreadAlerts(): InAppAlert[] {
  return getInAppAlerts().filter((a) => !a.read);
}

function addInAppAlert(alert: Omit<InAppAlert, "createdAt" | "read">): void {
  try {
    const alerts = getInAppAlerts();
    // Deduplicate by id
    const exists = alerts.some((a) => a.id === alert.id);
    if (exists) return;
    alerts.push({ ...alert, createdAt: new Date().toISOString(), read: false });
    // Keep last 20 alerts max
    const trimmed = alerts.slice(-20);
    localStorage.setItem(IN_APP_ALERTS_KEY, JSON.stringify(trimmed));
  } catch { /* silent */ }
}

export function markAlertRead(id: string): void {
  try {
    const alerts = getInAppAlerts().map((a) =>
      a.id === id ? { ...a, read: true } : a
    );
    localStorage.setItem(IN_APP_ALERTS_KEY, JSON.stringify(alerts));
  } catch { /* silent */ }
}

export function markAllAlertsRead(): void {
  try {
    const alerts = getInAppAlerts().map((a) => ({ ...a, read: true }));
    localStorage.setItem(IN_APP_ALERTS_KEY, JSON.stringify(alerts));
  } catch { /* silent */ }
}

/* ─── Web Notifications API ─────────────────────────────── */

async function requestWebPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function showWebNotification(n: LocalNotification): void {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(n.title, {
      body: n.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72.png",
      tag: String(n.id),
    });
  } catch { /* silent — some browsers block notifications in certain contexts */ }
}

/* ─── Capacitor Local Notifications ─────────────────────── */

async function scheduleNativeNotification(n: LocalNotification): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    // Dynamic import — won't error if plugin isn't installed
    const { LocalNotifications } = await import("@capacitor/local-notifications" as string) as {
      LocalNotifications: {
        requestPermissions: () => Promise<{ display: string }>;
        schedule: (opts: {
          notifications: Array<{
            id: number;
            title: string;
            body: string;
            schedule?: { at: Date };
          }>;
        }) => Promise<void>;
      };
    };
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: n.id,
          title: n.title,
          body: n.body,
          schedule: n.scheduleAt ? { at: n.scheduleAt } : undefined,
        },
      ],
    });
  } catch {
    // Plugin not installed or permission denied — fall through silently
  }
}

async function cancelNativeNotification(id: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = (await import("@capacitor/local-notifications" as string)) as {
      LocalNotifications: {
        cancel: (opts: { notifications: Array<{ id: number }> }) => Promise<void>;
      };
    };
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {
    // Plugin not installed — nothing to cancel
  }
}

/* ─── Stale round reminder ───────────────────────────────── */
// Fires 24h after a round starts if it was never ended, drawing the golfer
// back to finish / reflect / end. Auto-cancelled when the round closes.

const STALE_ROUND_NOTIF_ID = 3001;

export async function scheduleStaleRoundReminder(startedAt?: Date): Promise<void> {
  const base = startedAt ?? new Date();
  const at = new Date(base.getTime() + 24 * 60 * 60 * 1000);
  if (at.getTime() <= Date.now()) return; // already past — nothing to schedule
  await scheduleNativeNotification({
    id: STALE_ROUND_NOTIF_ID,
    title: "You left a round open ⛳",
    body: "Your round has been running 24h. Tap to finish it, reflect, or end it.",
    scheduleAt: at,
  });
}

export async function cancelStaleRoundReminder(): Promise<void> {
  await cancelNativeNotification(STALE_ROUND_NOTIF_ID);
}

/* ─── Permission request (call from settings or onboarding) */

export async function requestNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications" as string) as {
        LocalNotifications: { requestPermissions: () => Promise<{ display: string }> };
      };
      const perm = await LocalNotifications.requestPermissions();
      return perm.display === "granted";
    } catch {
      return false;
    }
  }
  return requestWebPermission();
}

export function hasNotificationPermission(): boolean {
  if (Capacitor.isNativePlatform()) return true; // assume OK on native (Capacitor handles it)
  if (!("Notification" in window)) return false;
  return Notification.permission === "granted";
}

/* ─── Smart notification checks ─────────────────────────── */

/**
 * Check if the streak is at risk (11+ days since last round, within 14-day window).
 * Adds an in-app alert if so, and schedules a native notification.
 */
export async function checkStreakAtRisk(): Promise<void> {
  const streak = getStreakData();
  if (!streak.lastRoundDate || streak.currentStreak === 0) return;

  const lastDate = new Date(streak.lastRoundDate + "T12:00:00Z");
  const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000);

  if (daysSince >= 11 && daysSince < 14) {
    const daysLeft = 14 - daysSince;
    const alertId = `streak-risk-${streak.lastRoundDate}`;
    addInAppAlert({
      id: alertId,
      title: `🔥 Streak at risk`,
      body: `Your ${streak.currentStreak}-round streak breaks in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Get a round in to keep it alive.`,
      type: "streak",
    });
    await scheduleNativeNotification({
      id: 1001,
      title: `Your streak is in danger 🔥`,
      body: `${streak.currentStreak} rounds in a row. Play in the next ${daysLeft} days to keep it alive.`,
    });
  }
}

/**
 * Check for long absence (10+ days with no rounds at all).
 */
export async function checkWelcomeBack(): Promise<void> {
  const streak = getStreakData();
  if (!streak.lastRoundDate) return;

  const lastDate = new Date(streak.lastRoundDate + "T12:00:00Z");
  const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
  const profile = loadGolferProfile();
  const firstName = profile?.firstName?.trim() || "Golfer";

  if (daysSince >= 10) {
    const alertId = `welcome-back-${streak.lastRoundDate}`;
    addInAppAlert({
      id: alertId,
      title: `Welcome back, ${firstName}`,
      body: `It's been ${daysSince} days since your last round. Your caddie is ready when you are.`,
      type: "welcome-back",
    });
  }
}

/**
 * Schedule a post-round reflection nudge (shows next time user opens app).
 * Call this immediately after ending a round.
 */
export function schedulePostRoundPrompt(): void {
  const today = new Date().toISOString().split("T")[0];
  const alertId = `post-round-${today}`;
  addInAppAlert({
    id: alertId,
    title: "Reflection hits different while it's fresh",
    body: "Spend 2 minutes in Locker Room — what was your standout mental moment from today?",
    type: "post-round",
  });
}

/**
 * Weekly cue word / Monday mental focus.
 * Schedule a native notification for next Monday at 8am.
 */
export async function scheduleWeeklyFocusNotification(): Promise<void> {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon
  const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(8, 0, 0, 0);

  await scheduleNativeNotification({
    id: 2001,
    title: "New week. New cue word.",
    body: "Open The Caddie and lock in your mental focus for this week's round.",
    scheduleAt: nextMonday,
  });
}

/**
 * Master init — run on every app boot from App.tsx.
 * Checks all notification conditions and surfaces what's relevant.
 */
export async function initNotifications(): Promise<void> {
  try {
    await Promise.all([
      checkStreakAtRisk(),
      checkWelcomeBack(),
    ]);
  } catch { /* never throw from init */ }
}

/* ─── Permission prompt state ─────────────────────────────── */

const NOTIF_PROMPT_SHOWN_KEY = "caddie-notif-prompt-shown";

export function hasShownNotificationPrompt(): boolean {
  try {
    return localStorage.getItem(NOTIF_PROMPT_SHOWN_KEY) === "true";
  } catch {
    return false;
  }
}

export function markNotificationPromptShown(): void {
  try {
    localStorage.setItem(NOTIF_PROMPT_SHOWN_KEY, "true");
  } catch { /* silent */ }
}
