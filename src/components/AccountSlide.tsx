import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Crown, Settings, ChevronRight, Pencil, Brain } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProStatus } from "@/hooks/useProStatus";
import { loadGolferProfile, type GolferProfile } from "@/lib/golferProfile";
import { MentalHandicapWidget } from "@/components/MentalHandicapWidget";
import { triggerHaptic } from "@/lib/haptics";

/**
 * AccountSlide — compact account view shown when swiping RIGHT once from Home.
 * Leads with the Mental Handicap, then profile + subscription, then a link to
 * full settings (the standalone /account page keeps the heavier controls).
 */
export function AccountSlide({ refreshKey }: { refreshKey?: number }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPro } = useProStatus();
  const [profile, setProfile] = useState<GolferProfile | null>(null);

  useEffect(() => {
    setProfile(loadGolferProfile());
  }, [refreshKey]);

  const go = (to: string) => {
    triggerHaptic("soft");
    navigate(to);
  };

  const rating = profile?.mentalCoachRating;

  const stats: { label: string; value: string }[] = [];
  if (profile?.handicap != null) stats.push({ label: "Handicap", value: String(profile.handicap) });
  if (profile?.averageScore != null) stats.push({ label: "Avg Score", value: String(profile.averageScore) });
  if (rating != null) stats.push({ label: "Mental Rating", value: `${rating}/100` });
  if (profile?.playingStyle) stats.push({ label: "Style", value: profile.playingStyle });

  return (
    <div className="with-bottom-dock mx-auto h-full w-full max-w-3xl space-y-4 overflow-y-auto px-5 pb-8 pt-[calc(var(--header-h)+8px)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[28px] font-semibold leading-tight text-[#0f1f0f]">
            {profile?.firstName ? `${profile.firstName}'s Profile` : "Your Profile"}
          </h1>
          <p className="mt-0.5 truncate text-[13px] text-[#2d4d2d]">{user?.email ?? ""}</p>
        </div>
        <button
          type="button"
          onClick={() => go("/account")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#c8ddc8] bg-white text-[#1a5c2e] shadow-sm transition-all hover:bg-[#f0f7f1]"
          aria-label="Account settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {/* Mental Handicap — the headline metric */}
      <MentalHandicapWidget refreshKey={refreshKey} />

      {/* Subscription status */}
      <button
        type="button"
        onClick={() => go(isPro ? "/account" : "/upgrade")}
        className="flex w-full items-center gap-3.5 rounded-2xl border border-[#c8ddc8] bg-white p-5 text-left shadow-[0_1px_6px_rgba(15,31,15,0.05)] transition-all hover:bg-[#f0f7f1]"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1a5c2e]/10 text-[#1a5c2e]">
          {isPro ? <Crown className="h-5 w-5" /> : <User className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1a5c2e]">Plan</p>
          <p className="font-serif text-xl text-[#0f1f0f]">{isPro ? "Pro" : "Free"}</p>
        </div>
        <span className="text-sm font-medium text-[#1a5c2e]">
          {isPro ? "Manage" : "Upgrade"}
        </span>
        <ChevronRight className="h-5 w-5 text-[#1a5c2e]/70" />
      </button>

      {/* Quick stats */}
      {stats.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-[#c8ddc8] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5a7a5a]">
                {s.label}
              </p>
              <p className="mt-0.5 font-serif text-2xl capitalize text-[#0f1f0f]">{s.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => go("/master-quiz")}
          className="flex w-full items-center gap-3.5 rounded-2xl border border-[#c8ddc8] bg-white p-5 text-left shadow-[0_1px_6px_rgba(15,31,15,0.05)] transition-all hover:bg-[#f0f7f1]"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1a5c2e]/10 text-[#1a5c2e]">
            <Brain className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg text-[#0f1f0f]">Set up your golfer profile</p>
            <p className="text-sm text-[#2d4d2d]">Take the Master Quiz to personalize coaching.</p>
          </div>
          <ChevronRight className="h-5 w-5 text-[#1a5c2e]/70" />
        </button>
      )}

      {/* Edit profile + full settings */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => go("/master-quiz")}
          className="flex items-center justify-center gap-2 rounded-2xl border border-[#1a5c2e]/30 bg-[#f0f7f1] py-3.5 text-sm font-medium text-[#1a5c2e] transition-all hover:bg-[#e3f0e6]"
        >
          <Pencil className="h-4 w-4" />
          Edit Profile
        </button>
        <button
          type="button"
          onClick={() => go("/account")}
          className="flex items-center justify-center gap-2 rounded-2xl border border-[#1a5c2e]/30 bg-[#f0f7f1] py-3.5 text-sm font-medium text-[#1a5c2e] transition-all hover:bg-[#e3f0e6]"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
      </div>
    </div>
  );
}
