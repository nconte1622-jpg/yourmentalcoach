import { Capacitor, registerPlugin } from "@capacitor/core";
import { toast } from "sonner";

type BrowserPlugin = {
  open(options: { url: string }): Promise<void>;
};

// Registers the Capacitor Browser plugin bridge — requires @capacitor/browser to be synced natively.
const Browser = registerPlugin<BrowserPlugin>("Browser");

export async function openExternal(url?: string) {
  if (!url) {
    toast.info("Link unavailable");
    return;
  }

  // On native iOS/Android, try the Capacitor Browser plugin first.
  // If it's not installed, fall back to a toast so the user isn't left confused.
  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({ url });
      return;
    } catch (nativeError) {
      console.warn("Capacitor Browser plugin unavailable, showing URL as fallback:", nativeError);
      toast.info(`Open in Safari: ${url}`, { duration: 6000 });
      return;
    }
  }

  // Web browser fallback
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    toast.info("Link unavailable");
  }
}
