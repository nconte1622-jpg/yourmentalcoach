/**
 * InAppAlertBanner
 *
 * Reads unread in-app alerts from notifications.ts and surfaces them
 * as dismissible banners at the top of the screen. Shows one at a time
 * with a swipe-to-dismiss feel. Auto-clears after user taps.
 */

import { useEffect, useState, useCallback } from "react";
import { X, Bell, Flame, ArrowLeft } from "lucide-react";
import {
  getUnreadAlerts,
  markAlertRead,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

interface Alert {
  id: string;
  title: string;
  body: string;
  type: "streak" | "pattern" | "post-round" | "weekly" | "welcome-back";
  createdAt: string;
  read: boolean;
}

function alertIcon(type: Alert["type"]) {
  switch (type) {
    case "streak":
      return <Flame className="h-4 w-4 text-[#f97316]" />;
    case "post-round":
      return <ArrowLeft className="h-4 w-4 rotate-[135deg] text-[var(--sand-0)]" />;
    default:
      return <Bell className="h-4 w-4 text-[var(--sand-0)]" />;
  }
}

function alertAccent(type: Alert["type"]): string {
  switch (type) {
    case "streak":
      return "border-[rgba(249,115,22,0.3)] bg-[rgba(249,115,22,0.08)]";
    case "post-round":
      return "border-[rgba(203,184,146,0.25)] bg-[rgba(203,184,146,0.07)]";
    default:
      return "border-[rgba(203,184,146,0.2)] bg-[rgba(203,184,146,0.06)]";
  }
}

export function InAppAlertBanner() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const loadAlerts = useCallback(() => {
    const unread = getUnreadAlerts() as Alert[];
    setAlerts(unread);
    if (unread.length > 0) {
      setVisible(true);
      setDismissing(false);
    }
  }, []);

  useEffect(() => {
    // Small delay so it doesn't fire before splash finishes
    const t = setTimeout(loadAlerts, 1200);
    return () => clearTimeout(t);
  }, [loadAlerts]);

  const current = alerts[0];

  const handleDismiss = useCallback(() => {
    if (!current) return;
    triggerHaptic("light");
    setDismissing(true);
    markAlertRead(current.id);

    setTimeout(() => {
      const remaining = alerts.slice(1);
      setAlerts(remaining);
      if (remaining.length === 0) {
        setVisible(false);
      } else {
        setDismissing(false);
      }
    }, 300);
  }, [current, alerts]);

  if (!visible || !current) return null;

  return (
    <div
      className={cn(
        "mx-4 mb-3 transition-all duration-300 ease-out",
        dismissing ? "translate-y-[-8px] opacity-0" : "translate-y-0 opacity-100"
      )}
    >
      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl border px-4 py-3",
          alertAccent(current.type)
        )}
      >
        {/* Icon */}
        <div className="mt-0.5 shrink-0">{alertIcon(current.type)}</div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-[var(--text-0)]">
            {current.title}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-1)]">
            {current.body}
          </p>
          {alerts.length > 1 && (
            <p className="mt-1 text-[10px] text-[var(--text-1)] opacity-50">
              {alerts.length - 1} more alert{alerts.length > 2 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss alert"
          className="tap-44 -mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-[var(--text-1)] transition-opacity hover:opacity-70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
