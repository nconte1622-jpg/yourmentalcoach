import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/PageShell";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlements } from "@/hooks/useEntitlements";
import { toast } from "sonner";
import { User, Crown, LogOut, Mail, ArrowLeft, Shield, FlaskConical, RotateCcw, Bug, FileText, ShieldAlert, Trash2, Brain, ChevronRight, Pencil, History } from "lucide-react";
import { loadGolferProfile, type GolferProfile, getHeightDisplay } from "@/lib/golferProfile";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { FrostedSandCard } from "@/components/ui/frosted-sand-card";
import { PUBLIC_LEGAL_URLS } from "@/lib/legal";
import { openExternal } from "@/lib/openExternal";
import { supabase } from "@/integrations/supabase/client";
import { BottomDock } from "@/components/ui/BottomDock";
import { ActiveRoundResumeChip } from "@/components/ui/ActiveRoundResumeChip";

const Account = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { entitlements, isPro, isLoading: entLoading, isAdmin, setTestOverride, refresh, restorePurchases } = useEntitlements();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [golferProfile, setGolferProfile] = useState<GolferProfile | null>(null);

  useEffect(() => {
    setGolferProfile(loadGolferProfile());
    return () => {
      setIsConfirmingDelete(false);
    };
  }, []);

  const accountReady = Boolean(user?.email) && !entLoading;
  const accountSummary = useMemo(
    () => ({
      email: user?.email ?? "",
      planLabel: isPro ? "Pro" : "Free",
      planBackground: isPro ? "rgba(220,203,168,0.38)" : "rgba(214,197,163,0.22)",
    }),
    [isPro, user?.email]
  );

  const handleManageSubscription = useCallback(async () => {
    if (!isPro) {
      navigate("/upgrade");
      return;
    }
    // Deep-link to iOS subscription management via Capacitor Browser plugin
    await openExternal("https://apps.apple.com/account/subscriptions");
  }, [isPro, navigate]);

  const handleRestorePurchases = useCallback(async () => {
    setIsRestoring(true);
    const result = await restorePurchases();
    if (result.error) {
      toast.error("Restore failed");
    } else if (result.restored) {
      toast.success("Purchases restored");
    } else {
      toast.info("No active App Store purchases were found in this build.");
    }
    setIsRestoring(false);
  }, [restorePurchases]);

  const handleDeleteAccount = useCallback(async () => {
    // window.confirm() is disabled in iOS WKWebView — use state-based confirmation instead
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }
    setIsConfirmingDelete(false);
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        method: "POST",
      });
      if (error) throw error;
      toast.success("Account deleted. Sorry to see you go.");
      await signOut();
    } catch (err) {
      console.error("Delete account error:", err);
      toast.error("Unable to delete account. Contact support@thecaddie.app.");
    }
  }, [isConfirmingDelete, signOut]);

  const handleOpenPrivacy = useCallback(() => {
    navigate(PUBLIC_LEGAL_URLS.privacy);
  }, [navigate]);

  const handleOpenTerms = useCallback(() => {
    navigate(PUBLIC_LEGAL_URLS.terms);
  }, [navigate]);

  const handleTestOverride = useCallback(async (plan: "pro" | "free") => {
    setIsOverriding(true);
    const { error } = await setTestOverride(plan);
    if (error) {
      toast.error("Failed to set test override");
    } else {
      toast.success(`Plan set to ${plan.toUpperCase()}`);
    }
    setIsOverriding(false);
  }, [setTestOverride]);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    const { error } = await signOut();
    if (error) {
      toast.error("Failed to sign out");
      setIsSigningOut(false);
    } else {
      navigate("/login");
    }
  }, [signOut, navigate]);

  return (
    <PageShell backgroundVariant="default">
      <AppShell
        contentClassName="flex flex-col"
        header={
          <AppHeader
            left={
              <button
                type="button"
                onClick={() => navigate("/")}
                className="header-hit-button tap-44 text-muted-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all duration-300"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Home
              </button>
            }
            center={<h1 className="truncate text-base md:text-lg font-serif tracking-wide text-foreground">Account</h1>}
            right={<div className="tap-44" />}
          />
        }
      >
        <main className="with-bottom-dock flex-1 flex flex-col items-center justify-center pb-12">
          <div className="w-full max-w-md space-y-8 animate-fade-in fluid-glow-backdrop">
            {/* Title */}
            <div className="text-center space-y-3 content-vignette">
              <h1 className="text-3xl md:text-4xl font-serif tracking-wide text-foreground">
                Account
              </h1>
              <p className="text-sm font-light tracking-wide text-muted-foreground">
                Manage your profile and subscription
              </p>
            </div>

            {/* Profile Card */}
            <FrostedSandCard className="space-y-6 rounded-2xl">
              {/* Email */}
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(214,197,163,0.28)" }}>
                  <Mail className="h-5 w-5" style={{ color: "var(--ink-0)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted-ink)" }}>
                    Email
                  </p>
                  {accountReady ? (
                    <p className="text-base font-medium truncate readable-on-sand">
                      {accountSummary.email}
                    </p>
                  ) : (
                    <div className="mt-1 h-5 w-40 animate-pulse rounded-full bg-[rgba(14,42,31,0.18)]" />
                  )}
                </div>
              </div>

              {/* Subscription Status */}
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: isPro ? "rgba(220,203,168,0.38)" : "rgba(214,197,163,0.22)" }}
                >
                  {isPro ? (
                    <Crown className="h-5 w-5" style={{ color: "var(--ink-0)" }} />
                  ) : (
                    <User className="h-5 w-5" style={{ color: "var(--ink-0)" }} />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted-ink)" }}>
                    Plan
                  </p>
                  {accountReady ? (
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                        style={{
                          background: accountSummary.planBackground,
                          color: "var(--ink-0)",
                        }}
                      >
                        {accountSummary.planLabel}
                      </span>
                      {entitlements.entitlement_source === "test_override" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">
                          Test Override
                        </span>
                      )}
                      {entitlements.entitlement_source === "apple" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                          Apple
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 h-7 w-24 animate-pulse rounded-full bg-[rgba(14,42,31,0.18)]" />
                  )}
                </div>
              </div>
            </FrostedSandCard>

            {/* Golfer Profile */}
            <FrostedSandCard className="space-y-4 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(214,197,163,0.28)" }}>
                    <Brain className="h-5 w-5" style={{ color: "var(--ink-0)" }} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider" style={{ color: "var(--muted-ink)" }}>
                      Golfer Profile
                    </p>
                    <p className="text-sm font-medium readable-on-sand">
                      {golferProfile?.quizCompletedAt ? golferProfile.firstName || "Completed" : "Not set up yet"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/master-quiz")}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5"
                  style={{ color: "var(--ink-0)" }}
                >
                  {golferProfile?.quizCompletedAt ? (
                    <>
                      <Pencil className="h-3 w-3" />
                      Edit
                    </>
                  ) : (
                    <>
                      Take Quiz
                      <ChevronRight className="h-3 w-3" />
                    </>
                  )}
                </button>
              </div>

              {golferProfile?.quizCompletedAt ? (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "var(--muted-ink)" }}>
                    {golferProfile.handicap != null && (
                      <div className="rounded-xl px-3 py-2" style={{ background: "rgba(214,197,163,0.12)" }}>
                        <p className="opacity-60">Handicap</p>
                        <p className="font-medium readable-on-sand">{golferProfile.handicap}</p>
                      </div>
                    )}
                    {golferProfile.averageScore != null && (
                      <div className="rounded-xl px-3 py-2" style={{ background: "rgba(214,197,163,0.12)" }}>
                        <p className="opacity-60">Avg Score</p>
                        <p className="font-medium readable-on-sand">{golferProfile.averageScore}</p>
                      </div>
                    )}
                    {golferProfile.playingStyle && (
                      <div className="rounded-xl px-3 py-2" style={{ background: "rgba(214,197,163,0.12)" }}>
                        <p className="opacity-60">Style</p>
                        <p className="font-medium readable-on-sand capitalize">{golferProfile.playingStyle}</p>
                      </div>
                    )}
                    {golferProfile.biggestChallenge && (
                      <div className="rounded-xl px-3 py-2" style={{ background: "rgba(214,197,163,0.12)" }}>
                        <p className="opacity-60">Challenge</p>
                        <p className="font-medium readable-on-sand capitalize">{golferProfile.biggestChallenge.replace(/-/g, " ")}</p>
                      </div>
                    )}
                  </div>
                  {/* Mental Coach Rating */}
                  <div className="flex items-center gap-3 pt-2">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center font-serif font-bold"
                      style={{
                        background: golferProfile.mentalCoachRating != null
                          ? "rgba(31,180,100,0.18)"
                          : "rgba(214,197,163,0.15)",
                        color: golferProfile.mentalCoachRating != null
                          ? "rgba(31,180,100,0.9)"
                          : "var(--muted-ink)",
                        fontSize: golferProfile.mentalCoachRating != null ? "14px" : "11px",
                      }}
                    >
                      {golferProfile.mentalCoachRating != null ? golferProfile.mentalCoachRating : "N/A"}
                    </div>
                    <div>
                      <p className="text-xs font-medium readable-on-sand">Mental Coach Rating</p>
                      <p className="text-[10px]" style={{ color: "var(--muted-ink)" }}>
                        {golferProfile.mentalCoachRating != null
                          ? "Based on your last 3 rounds"
                          : "Complete 3 rounds to unlock"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--muted-ink)" }}>
                  Take the Master Quiz to personalize your coaching experience. The AI will know your game inside and out.
                </p>
              )}
            </FrostedSandCard>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleManageSubscription}
                className="w-full py-6 text-base font-medium rounded-2xl bg-primary/90 hover:bg-primary transition-all duration-300"
                size="lg"
              >
                {isPro ? "Manage Subscription" : "Upgrade to Pro"}
              </Button>

              <Button
                onClick={handleRestorePurchases}
                disabled={isRestoring}
                variant="outline"
                className="w-full py-6 text-base font-medium rounded-2xl border-primary/20 bg-card/50 hover:bg-card/70"
                size="lg"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {isRestoring ? "Restoring..." : "Restore Purchases"}
              </Button>

              <Button
                onClick={() => navigate("/round-history")}
                variant="outline"
                className="w-full py-6 text-base font-medium rounded-2xl border-primary/20 bg-card/50 hover:bg-card/70"
                size="lg"
              >
                <History className="h-4 w-4 mr-2" />
                Round History
              </Button>

              <FrostedSandCard className="rounded-2xl p-3">
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => void handleOpenPrivacy()}
                    className="flex min-h-11 w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition-colors hover:bg-black/5"
                  >
                    <span className="flex items-center gap-3" style={{ color: "var(--ink-0)" }}>
                      <ShieldAlert className="h-4 w-4" />
                      Privacy Policy
                    </span>
                    <span className="flex items-center gap-2" style={{ color: "var(--muted-ink)" }}>
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">↗</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleOpenTerms()}
                    className="flex min-h-11 w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition-colors hover:bg-black/5"
                  >
                    <span className="flex items-center gap-3" style={{ color: "var(--ink-0)" }}>
                      <FileText className="h-4 w-4" />
                      Terms of Service
                    </span>
                    <span className="flex items-center gap-2" style={{ color: "var(--muted-ink)" }}>
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">↗</span>
                    </span>
                  </button>
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="flex-1 text-xs text-destructive/80">Are you sure?</span>
                      <button
                        type="button"
                        onClick={() => setIsConfirmingDelete(false)}
                        className="min-h-10 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-black/5"
                        style={{ color: "var(--ink-0)" }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        className="min-h-10 rounded-xl px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                      >
                        Confirm
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      className="flex min-h-11 w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition-colors hover:bg-destructive/5"
                    >
                      <span className="flex items-center gap-3 text-destructive">
                        <Trash2 className="h-4 w-4" />
                        Delete Account
                      </span>
                      <FileText className="h-4 w-4 text-destructive/70" />
                    </button>
                  )}
                </div>
              </FrostedSandCard>

              <Button
                onClick={handleSignOut}
                disabled={isSigningOut}
                variant="ghost"
                className="w-full py-6 text-base font-medium rounded-2xl text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-300"
                size="lg"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>

            {/* Admin Test Override (TestFlight) */}
            {isAdmin && (
              <FrostedSandCard className="rounded-2xl p-5 space-y-4" style={{ borderColor: "rgba(220, 38, 38, 0.18)" }}>
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-destructive" />
                  <p className="text-xs uppercase tracking-wider text-destructive font-medium">
                    TestFlight Override
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleTestOverride("pro")}
                    disabled={isOverriding}
                    variant="outline"
                    size="sm"
                    className="flex-1 border-accent/30 text-accent hover:bg-accent/10"
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    Set me PRO (TestFlight)
                  </Button>
                  <Button
                    onClick={() => handleTestOverride("free")}
                    disabled={isOverriding}
                    variant="outline"
                    size="sm"
                    className="flex-1 border-foreground/20"
                  >
                    Set me FREE
                  </Button>
                </div>
                <Button
                  onClick={() => { refresh(); toast.success("Entitlements refreshed"); }}
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground/70 hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Refresh Entitlements
                </Button>
                <p className="text-[10px] text-muted-foreground/50">
                  Admin-only. Source: test_override. Hidden from non-admin users.
                </p>
              </FrostedSandCard>
            )}

            {/* Debug Auth Block (development only) */}
            {import.meta.env.DEV && (
              <FrostedSandCard className="rounded-2xl p-5 space-y-3" style={{ borderColor: "rgba(60, 90, 78, 0.16)" }}>
                <div className="flex items-center gap-2">
                  <Bug className="h-4 w-4" style={{ color: "var(--ink-0)" }} />
                  <p className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--muted-ink)" }}>
                    Debug Auth
                  </p>
                </div>
                <div className="space-y-1 text-xs font-mono" style={{ color: "var(--muted-ink)" }}>
                  <p>email: <span className="readable-on-sand">{user?.email || "(none)"}</span></p>
                  <p>auth: <span className="readable-on-sand">{user ? "signed in" : "signed out"}</span></p>
                  <p>isAdmin: <span className="readable-on-sand">{String(isAdmin)}</span></p>
                  <p>plan: <span className="readable-on-sand">{entitlements.plan}</span></p>
                  <p>source: <span className="readable-on-sand">{entitlements.entitlement_source}</span></p>
                </div>
                <Button
                  onClick={() => { refresh(); toast.success("Entitlements refreshed"); }}
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground/70 hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Refresh Entitlements
                </Button>
              </FrostedSandCard>
            )}

            <div className="text-center pt-4">
              <p className="text-xs text-muted-foreground/50">
                Need help? Contact support@thecaddie.app
              </p>
            </div>
          </div>
        </main>
      </AppShell>
      <ActiveRoundResumeChip />
      <BottomDock />
    </PageShell>
  );
};

export default Account;
