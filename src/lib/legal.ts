export const PUBLIC_LEGAL_URLS = {
  privacy: "https://deluxe-trout-7b4.notion.site/Privacy-Policy-Your-Mental-Coach-32df8241c4a880aca049d0095f4ae5eb",
  terms: "https://deluxe-trout-7b4.notion.site/Terms-of-Service-Your-Mental-Coach-32df8241c4a880aca049d0095f4ae5eb",
} as const;

export const LEGAL_LAST_UPDATED = "March 24, 2026";

export function isLegalUrlAvailable(url: string) {
  return Boolean(url && /^https?:\/\//.test(url));
}
