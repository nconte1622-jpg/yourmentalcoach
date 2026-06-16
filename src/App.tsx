import { useState, useCallback, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SplashScreen } from "@/components/SplashScreen";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { initSafeAreaInsets } from "@/lib/safeArea";
import { Capacitor } from "@capacitor/core";
import { configureRevenueCat } from "@/lib/revenueCat";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { EntitlementsProvider, useEntitlements } from "@/hooks/useEntitlements";
import Home from "./pages/Home";
import Onboarding from "./pages/Onboarding";
import Login from "./pages/Login";
import PreGame from "./pages/PreGame";
import RoundSetup from "./pages/RoundSetup";
import Round from "./pages/Round";
import RoundCoach from "./pages/RoundCoach";
import RoundReset from "./pages/RoundReset";
import RoundCloseStrong from "./pages/RoundCloseStrong";
import LockerRoomPage from "./pages/LockerRoom";
import PostRound from "./pages/PostRound";
import RoundSummary from "./pages/RoundSummary";
import RoundComplete from "./pages/RoundComplete";
import Highlights from "./pages/Highlights";
import MemoryBank from "./pages/MemoryBank";
import Account from "./pages/Account";
import Insights from "./pages/Insights";
import Upgrade from "./pages/Upgrade";
import UpgradeSuccess from "./pages/UpgradeSuccess";
import AuthCallback from "./pages/AuthCallback";
import MasterQuiz from "./pages/MasterQuiz";
import SwingAnalysis from "./pages/SwingAnalysis";
import MentalGPS from "./pages/MentalGPS";
import Scorecard from "./pages/Scorecard";
import Terms from "./pages/TermsOfService";
import Privacy from "./pages/PrivacyPolicy";
import { ScrollToTop } from "./components/ScrollToTop";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppLoadingScreen() {
  return (
    <div className="h-[100dvh] bg-[linear-gradient(180deg,rgba(5,8,7,1)_0%,rgba(8,17,14,1)_100%)] text-[var(--text-0)]">
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[rgba(203,184,146,0.2)] border-t-[var(--sand-0)]" />
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--sand-0)]">Loading</p>
          <p className="text-sm text-[var(--text-1)]">Loading your round…</p>
        </div>
      </div>
    </div>
  );
}

function AppRoutes({ showSplash, onSplashComplete }: { showSplash: boolean; onSplashComplete: () => void }) {
  const { isLoading: authLoading } = useAuth();
  // Entitlements load in the background — don't block the router on them.
  // The app shows as soon as auth resolves; isPro/features update reactively.
  const isBootstrapReady = !authLoading;

  if (!isBootstrapReady) {
    return (
      <>
        {showSplash && <SplashScreen onComplete={onSplashComplete} duration={1800} />}
        {!showSplash && <AppLoadingScreen />}
      </>
    );
  }

  return (
    <>
      {showSplash && <SplashScreen onComplete={onSplashComplete} duration={1800} />}
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth-callback" element={<AuthCallback />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/pre-game" element={<ProtectedRoute><PreGame /></ProtectedRoute>} />
          <Route path="/round-setup" element={<ProtectedRoute><RoundSetup /></ProtectedRoute>} />
          <Route path="/round" element={<ProtectedRoute><Round /></ProtectedRoute>} />
          <Route path="/round/coach" element={<ProtectedRoute><RoundCoach /></ProtectedRoute>} />
          <Route path="/round/reset" element={<ProtectedRoute><RoundReset /></ProtectedRoute>} />
          <Route path="/round/close-strong" element={<ProtectedRoute><RoundCloseStrong /></ProtectedRoute>} />
          <Route path="/round/scorecard" element={<ProtectedRoute><Scorecard /></ProtectedRoute>} />
          <Route path="/locker-room" element={<ProtectedRoute><LockerRoomPage /></ProtectedRoute>} />
          <Route path="/post-round" element={<ProtectedRoute><PostRound /></ProtectedRoute>} />
          <Route path="/round-summary" element={<ProtectedRoute><RoundSummary /></ProtectedRoute>} />
          <Route path="/round-complete" element={<ProtectedRoute><RoundComplete /></ProtectedRoute>} />
          <Route path="/highlights" element={<ProtectedRoute><Highlights /></ProtectedRoute>} />
          <Route path="/memory-bank" element={<ProtectedRoute><MemoryBank /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
          <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
          <Route path="/master-quiz" element={<ProtectedRoute><MasterQuiz /></ProtectedRoute>} />
          <Route path="/swing-analysis" element={<ProtectedRoute><SwingAnalysis /></ProtectedRoute>} />
          <Route path="/mental-gps" element={<ProtectedRoute><MentalGPS /></ProtectedRoute>} />
          <Route path="/upgrade" element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
          <Route path="/upgrade-success" element={<ProtectedRoute><UpgradeSuccess /></ProtectedRoute>} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  useEffect(() => {
    const configureStatusBar = async () => {
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
      const plugins = (Capacitor as unknown as { Plugins?: Record<string, unknown> }).Plugins;
      const statusBar = plugins?.StatusBar as
        | { setOverlaysWebView?: (options: { overlay: boolean }) => Promise<void> }
        | undefined;
      if (!statusBar?.setOverlaysWebView) return;
      try {
        await statusBar.setOverlaysWebView({ overlay: false });
      } catch (error) {
        console.warn("Unable to disable status bar overlay:", error);
      }
    };

    void configureStatusBar();
    // Initialize RevenueCat (no-op on web; user ID will be set after login via useAuth)
    void configureRevenueCat();
    import("./lib/capacitorDeepLink").then((m) => m.initCapacitorDeepLinks());
    // Check streak / welcome-back / other notification conditions on every boot
    import("./lib/notifications").then((m) => m.initNotifications());
    const cleanupSafeArea = initSafeAreaInsets();
    return cleanupSafeArea;
  }, []);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <EntitlementsProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <AppRoutes showSplash={showSplash} onSplashComplete={handleSplashComplete} />
            </TooltipProvider>
          </EntitlementsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
};

export default App;
