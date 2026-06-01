import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { useEntitlements } from "@/hooks/useEntitlements";
import { toast } from "sonner";
import { Crown, ArrowLeft, RotateCcw, Sparkles, Check } from "lucide-react";

/**
 * Upgrade to PRO screen.
 * On iOS (Capacitor), this will integrate with RevenueCat/StoreKit.
 * For now it shows the offerings and a Restore Purchases button.
 */
const Upgrade = () => {
  const navigate = useNavigate();
  const { isPro, isLoading, recordApplePurchase } = useEntitlements();

  const handlePurchase = async (_productId: string) => {
    toast.info("In-App Purchase will be available in the native build. Use TestFlight test override on Account page for now.");
  };

  const handleRestore = async () => {
    toast.info("Restore will be available in the native build. Use TestFlight test override on Account page for now.");
  };

  if (isLoading) return null;

  if (isPro) {
    return (
      <PageShell backgroundVariant="default">
        <div className="flex flex-col h-full items-center justify-center px-6">
          <div className="max-w-sm w-full text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-full bg-accent/20 flex items-center justify-center">
              <Crown className="h-8 w-8 text-accent" />
            </div>
            <h1 className="text-3xl font-serif tracking-wide text-foreground">You're Pro</h1>
            <p className="text-muted-foreground font-light">
              You have full access to all features.
            </p>
            <Button
              onClick={() => navigate("/")}
              className="w-full py-6 text-base font-medium rounded-2xl"
              size="lg"
            >
              Go Home
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell backgroundVariant="default">
      <div className="flex flex-col h-full">
        <header className="flex items-center py-6 px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-muted-foreground/60 hover:text-foreground hover:bg-transparent"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
          <div className="max-w-sm w-full space-y-8 animate-fade-in">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-accent/20 flex items-center justify-center">
                <Crown className="h-8 w-8 text-accent" />
              </div>
              <h1 className="text-3xl font-serif tracking-wide text-foreground">
                Upgrade to Pro
              </h1>
              <p className="text-muted-foreground font-light leading-relaxed">
                Your coach remembers what works for you — across rounds, over time.
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-3">
              {[
                "Long-term memory recall across rounds",
                "Personalized coaching insights",
                "Pattern recognition over time",
                "Full Memory Bank access",
              ].map((benefit) => (
                <div key={benefit} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-sm text-muted-foreground font-light">{benefit}</span>
                </div>
              ))}
            </div>

            {/* TestFlight Notice */}
            <div className="p-5 rounded-2xl border border-primary/20 bg-card/80 backdrop-blur-sm space-y-3">
              <p className="text-sm font-medium text-foreground">
                TestFlight Build
              </p>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">
                In-App Purchases are disabled in this build. To test PRO features, go to{" "}
                <span className="text-primary font-medium">Account → Admin Tools</span>{" "}
                and use the test toggle.
              </p>
              <Button
                onClick={() => navigate("/account")}
                className="w-full py-5 text-base font-medium rounded-2xl"
                size="lg"
              >
                Go to Account
              </Button>
            </div>

            <p className="text-center text-[11px] text-muted-foreground/50 font-light">
              Subscriptions will be available via the App Store at launch.
            </p>
          </div>
        </main>
      </div>
    </PageShell>
  );
};

export default Upgrade;
