import { toast } from "sonner";

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err.message.toLowerCase().includes("quota")
  );
}

export type ActiveRoundSnapshot = {
  roundId: string;
  status: "active" | "completed" | "abandoned";
  roundType: string;
  environment: string;
  courseLocation?: string | null;
  goal: string | null;
  todayFocus?: string | null;
  createdAt: string;
  startedAt?: string;
};

export type PersistedRoundMessage = {
  id: string;
  content: string;
  isUser: boolean;
  feedback?: "helpful" | "neutral" | null;
};

const ACTIVE_ROUND_KEY = "active-round-session";
const PENDING_PRE_GAME_KEY = "pending-pre-game-talk";
const ROUND_MESSAGES_PREFIX = "round-messages";
const ENDED_ROUNDS_KEY = "ended-round-ids";

/**
 * Fired (in this document) whenever the active-round state is cleared. The home
 * screen and resume chip listen for it so a round ended on one screen instantly
 * disappears everywhere — no focus/visibility round-trip required.
 */
export const ACTIVE_ROUND_CHANGED_EVENT = "active-round-changed";

function emitActiveRoundChanged() {
  try {
    window.dispatchEvent(new Event(ACTIVE_ROUND_CHANGED_EVENT));
  } catch {
    // Non-browser / SSR — nothing to notify.
  }
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isValidSnapshot(value: unknown): value is ActiveRoundSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.roundId === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.roundType === "string" &&
    typeof candidate.environment === "string" &&
    typeof candidate.createdAt === "string"
  );
}

export function saveActiveRoundSession(snapshot: ActiveRoundSnapshot) {
  try {
    localStorage.setItem(ACTIVE_ROUND_KEY, JSON.stringify(snapshot));
  } catch (err) {
    if (isQuotaError(err)) {
      toast.error("Device storage is full — round progress may not be saved.", { id: "storage-quota", duration: 6000 });
    }
  }
}

export function loadActiveRoundSession(): ActiveRoundSnapshot | null {
  const parsed = safeParseJson<unknown>(localStorage.getItem(ACTIVE_ROUND_KEY));
  return isValidSnapshot(parsed) ? parsed : null;
}

export function updateActiveRoundSession(
  updates: Partial<ActiveRoundSnapshot>
): ActiveRoundSnapshot | null {
  const current = loadActiveRoundSession();
  if (!current) return null;
  const next = { ...current, ...updates };
  saveActiveRoundSession(next);
  return next;
}

export function clearActiveRoundSession() {
  try {
    localStorage.removeItem(ACTIVE_ROUND_KEY);
  } catch {
    // Ignore local storage failures.
  }
  // The round is no longer active — cancel its 24h "still open" reminder.
  // Dynamic + best-effort so this storage module stays free of Capacitor deps.
  void import("./notifications").then((m) => m.cancelStaleRoundReminder()).catch(() => {});
  emitActiveRoundChanged();
}

/**
 * Locally-ended rounds ledger.
 *
 * Ending a round used to depend on a Supabase write landing before the user
 * returned Home; if that write was slow or failed, `getActiveRound()` would
 * re-query the server, still see `ended_at IS NULL`, and resurrect the round —
 * the "still says Resume Round no matter how many times I end it" bug.
 *
 * We now record ended round IDs locally as the source of truth. The home screen
 * and resume chip trust this immediately, and `getActiveRound()` ignores (and
 * best-effort re-closes) any server round that appears here.
 */
function readEndedRoundIds(): string[] {
  const parsed = safeParseJson<unknown>(localStorage.getItem(ENDED_ROUNDS_KEY));
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
}

export function markRoundEnded(roundId: string) {
  if (!roundId) return;
  try {
    const ids = readEndedRoundIds();
    if (!ids.includes(roundId)) {
      ids.push(roundId);
      // Cap the ledger so it can't grow unbounded — recent rounds are all we need.
      const trimmed = ids.slice(-50);
      localStorage.setItem(ENDED_ROUNDS_KEY, JSON.stringify(trimmed));
    }
  } catch {
    // Ignore local storage failures — clearActiveRoundSession still hides it.
  }
}

export function isRoundEnded(roundId: string | null | undefined): boolean {
  if (!roundId) return false;
  return readEndedRoundIds().includes(roundId);
}

export function savePendingPreGameTalk(talk: string) {
  try {
    localStorage.setItem(
      PENDING_PRE_GAME_KEY,
      JSON.stringify({
        talk,
        createdAt: new Date().toISOString(),
      })
    );
  } catch {
    // Ignore local storage failures.
  }
}

export function consumePendingPreGameTalk(): { talk: string; createdAt: string } | null {
  const parsed = safeParseJson<{ talk: string; createdAt: string }>(
    localStorage.getItem(PENDING_PRE_GAME_KEY)
  );
  if (!parsed) return null;
  try {
    localStorage.removeItem(PENDING_PRE_GAME_KEY);
  } catch {
    // Ignore local storage failures.
  }
  return parsed;
}

function getRoundMessagesKey(roundId: string) {
  return `${ROUND_MESSAGES_PREFIX}:${roundId}`;
}

export function saveRoundMessages(roundId: string, messages: PersistedRoundMessage[]) {
  try {
    localStorage.setItem(getRoundMessagesKey(roundId), JSON.stringify(messages));
  } catch (err) {
    if (isQuotaError(err)) {
      toast.error("Device storage is full — chat messages may not be saved.", { id: "storage-quota", duration: 6000 });
    }
  }
}

export function loadRoundMessages(roundId: string): PersistedRoundMessage[] | null {
  const parsed = safeParseJson<unknown>(localStorage.getItem(getRoundMessagesKey(roundId)));
  if (!Array.isArray(parsed)) return null;

  const validMessages = parsed.filter((message): message is PersistedRoundMessage => {
    if (!message || typeof message !== "object") return false;
    const candidate = message as Record<string, unknown>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.content === "string" &&
      typeof candidate.isUser === "boolean"
    );
  });

  return validMessages.length > 0 ? validMessages : null;
}

export function clearRoundMessages(roundId: string) {
  try {
    localStorage.removeItem(getRoundMessagesKey(roundId));
  } catch {
    // Ignore local storage failures.
  }
}
