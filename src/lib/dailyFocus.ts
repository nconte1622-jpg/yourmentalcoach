export type DailyFocus = {
  text: string;
  saved_at: string;
  round_id?: string;
};

const DAILY_FOCUS_KEY = "daily-focus";

export function getDailyFocus(): DailyFocus | null {
  try {
    const raw = localStorage.getItem(DAILY_FOCUS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DailyFocus;
  } catch {
    return null;
  }
}

export function setDailyFocus(focus: DailyFocus) {
  try {
    localStorage.setItem(DAILY_FOCUS_KEY, JSON.stringify(focus));
  } catch {
    // Ignore storage failures.
  }
}

export function clearDailyFocus() {
  try {
    localStorage.removeItem(DAILY_FOCUS_KEY);
  } catch {
    // Ignore storage failures.
  }
}
