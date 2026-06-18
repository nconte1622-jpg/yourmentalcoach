import { useCallback, useEffect, useState } from "react";
import { Newspaper, RefreshCw, Flag, TrendingUp, Target } from "lucide-react";
import { getDailyGolfNews, type DailyGolfNews } from "@/lib/golfNews";
import { triggerHaptic } from "@/lib/haptics";

/**
 * GolfNewsView — "Daily Caddie Intel" feed, rendered as the third Home swipe slide.
 * Generates once per day via the coach worker and caches locally.
 */
export function GolfNewsView({ embedded = true }: { embedded?: boolean }) {
  const [news, setNews] = useState<DailyGolfNews | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getDailyGolfNews(force);
      setNews(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const prettyDate = news
    ? new Date(news.date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div
      className={`with-bottom-dock mx-auto h-full w-full max-w-3xl space-y-4 overflow-y-auto px-5 pb-8 ${
        embedded ? "pt-[calc(var(--header-h)+8px)]" : "pt-4"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-[#1a5c2e]" />
            <h1 className="font-serif text-[28px] font-semibold leading-tight text-[#0f1f0f]">
              Daily Caddie Intel
            </h1>
          </div>
          {prettyDate && (
            <p className="mt-0.5 text-[12px] font-medium uppercase tracking-[0.16em] text-[#2d4d2d]">
              {prettyDate}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic("soft");
            void load(true);
          }}
          disabled={refreshing || loading}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#c8ddc8] bg-white text-[#1a5c2e] shadow-sm transition-all hover:bg-[#f0f7f1] disabled:opacity-50"
          aria-label="Regenerate today's intel"
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !news ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl border border-[#c8ddc8] bg-white caddie-shimmer" />
          ))}
        </div>
      ) : (
        <>
          {/* PGA TOUR PULSE */}
          <div className="flex items-center gap-2 pt-1">
            <Newspaper className="h-3.5 w-3.5 text-[#1a5c2e]" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1a5c2e]">
              PGA Tour Pulse
            </p>
          </div>
          {news?.items.map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#c8ddc8] bg-white p-5 shadow-[0_1px_6px_rgba(15,31,15,0.05)]"
            >
              <p className="font-serif text-lg leading-snug text-[#0f1f0f]">{item.title}</p>
              <p className="mt-1.5 text-sm leading-6 text-[#2d4d2d]">{item.summary}</p>
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#f0f7f1] p-3">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-[#1a5c2e]" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1a5c2e]">
                    Apply to your game
                  </p>
                  <p className="mt-0.5 text-sm leading-6 text-[#0f1f0f]">{item.application}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Today's Tour Stat */}
          {news?.tourStat && (
            <div className="rounded-2xl border border-[#1a5c2e]/30 bg-[#1a5c2e] p-5 text-white shadow-[0_8px_24px_rgba(26,92,46,0.25)]">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-[#e8a84c]" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e8a84c]">
                  Today&apos;s Tour Stat
                </p>
              </div>
              <p className="mt-2 text-base leading-7 text-white">{news.tourStat.stat}</p>
              <p className="mt-2 text-sm leading-6 text-white/80">{news.tourStat.application}</p>
            </div>
          )}

          <p className="pt-1 text-center text-[11px] text-[#5a7a5a]">
            Fresh intel generated daily by your AI caddie.
          </p>
        </>
      )}
    </div>
  );
}
