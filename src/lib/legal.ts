/**
 * In-app legal routes (used with react-router navigate).
 * Routing in-app avoids the duplicate Notion page bug and
 * guarantees the correct branded content is shown.
 */
export const PUBLIC_LEGAL_URLS = {
  privacy: "/privacy",
  terms: "/terms",
} as const;

export const LEGAL_LAST_UPDATED = "March 24, 2026";

export function isLegalUrlAvailable(_url: string) {
  // In-app routes are always available.
  return true;
}
