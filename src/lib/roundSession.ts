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
