type AnalyticsEventName =
  | "round_started"
  | "ai_message_sent"
  | "post_round_completed"
  | "paywall_viewed"
  | "subscription_started"
  | "restore_purchases_tapped";

type AnalyticsEvent = {
  name: AnalyticsEventName;
  timestamp: string;
  payload?: Record<string, unknown>;
};

const ANALYTICS_QUEUE_KEY = "analytics-event-queue";

export function trackEvent(name: AnalyticsEventName, payload?: Record<string, unknown>) {
  const event: AnalyticsEvent = {
    name,
    timestamp: new Date().toISOString(),
    payload,
  };

  try {
    const raw = localStorage.getItem(ANALYTICS_QUEUE_KEY);
    const existing = raw ? (JSON.parse(raw) as AnalyticsEvent[]) : [];
    existing.push(event);
    localStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(existing.slice(-200)));
  } catch {
    // Ignore analytics storage failures.
  }

  console.info("[analytics]", event);
}
