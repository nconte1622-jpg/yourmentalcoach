import { supabase } from "@/integrations/supabase/client";

function handleDeepLinkUrl(urlString: string) {
  try {
    const url = new URL(urlString);

    const code = url.searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) console.error("Deep link code exchange failed:", error.message);
      });
      return;
    }

    const hash = url.hash.startsWith("#") ? url.hash.substring(1) : url.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
        if (error) console.error("Deep link setSession failed:", error.message);
      });
    }
  } catch (e) {
    console.error("Deep link parse error:", e);
  }
}

export async function initCapacitorDeepLinks() {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;

  const { App } = await import("@capacitor/app");

  const launchUrl = await App.getLaunchUrl();
  if (launchUrl?.url) handleDeepLinkUrl(launchUrl.url);

  App.addListener("appUrlOpen", (event) => {
    if (event.url) handleDeepLinkUrl(event.url);
  });
}
