import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { useEntitlements } from "@/hooks/useEntitlements";
import { ProUpgradeModal } from "@/components/ProUpgradeModal";
import { Crown, ArrowLeft, Check, RotateCcw, Leaf, Brain, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Brain, text: "Long-term memory recall across rounds" },
  { icon: Leaf, text: "Personalized coaching insights, round after round" },
  { icon: Star, text: "Pattern recognition & round DNA" },
  { icon: Check, text: "Full Memory Bank access" },
  { icon: Check, text: "Post-Round structured reflection" },
  { icon: Check, text: "Priority support" },
];

const Upgrade = () => {
  const navigate = useNavigate();
  const { isPro, isLoading, restorePurchases } = useEntitlements();
  const [showModal, setShowModal] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"yearly" | "monthly">("yearly");
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async () => {
    setIsRestoring(true);
    const result = await restorePurchases();
    if (result.error) {
      toast.error("Restore failed. Contact support@thecaddie.app if you believe you have an active subscription.");
    } else if (result.restored) {
      toast.success("Purchases restored!");
    } else {
      toast.info("No active subscriptions found on this Apple ID.");
    }
    setIsRestoring(false);
  };

  if (isLoading) return null;

  if (isPro) {
    return (
      <PageShell backgroundVariant="default">
        <div className="flex flex-col h-full items-center justify-center px-6">
          <div className="max-w-sm w-full text-center space-y-6 animate-fade-in">
            <div className="w-20 h-20 mx-auto rounded-full bg-accent/20 flex items-center justify-center shadow-[0_0_40px_rgba(203,184,146,0.18)]">
              <Crown className="h-10 w-10 text-accent" />
            </div>
            <h1 className="text-3xl font-serif tracking-wide text-foreground">You're Pro</h1>
            <p className="text-muted-foreground font-light leading-relaxed">
              You have full access to every feature. Play with presence.
            </p>
            <button
              onClick={() => navigate("/")}
              className="w-full py-5 text-base font-medium rounded-[28px] bg-[rgba(203,184,146,0.22)] border border-[rgba(203,184,146,0.28)] text-[var(--sand-0)] tracking-wide transition-all duration-300 hover:bg-[rgba(203,184,146,0.32)] active:scale-[0.98]"
            >
              Back to Home
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell backgroundVariant="default">
      <div className="flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <header className="flex items-center py-5 px-5 shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground/60 hover:text-foreground transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-start px-5 pb-12">
          <div className="max-w-sm w-full space-y-7 animate-fade-in">

            {/* Hero */}
            <div className="text-center space-y-3 pt-2">
              <div className="w-20 h-20 mx-auto rounded-full bg-[rgba(203,184,146,0.14)] flex items-center justify-center border border-[rgba(203,184,146,0.22)] shadow-[0_0_40px_rgba(203,184,146,0.14)]">
                <Crown className="h-9 w-9 text-accent" />
              </div>
              <h1 className="text-3xl font-serif tracking-wide text-foreground">
                The Caddie Pro
              </h1>
              <p className="text-muted-foreground font-light leading-relaxed text-sm px-4">
                Your caddie learns what works for you — across rounds, over time, under pressure.
              </p>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-1.5 rounded-full border border-foreground/10 bg-card/60 p-1 backdrop-blur-sm">
              <button
                onClick={() => setBillingCycle("yearly")}
                className={cn(
                  "flex-1 py-2.5 rounded-full text-sm font-medium tracking-wide transition-all duration-300",
                  billingCycle === "yearly"
                    ? "bg-[rgba(203,184,146,0.22)] text-[var(--sand-0)] shadow-sm"
                    : "text-muted-foreground/60 hover:text-muted-foreground"
                )}
              >
                Yearly · $99
              </button>
              <button
                onClick={() => setBillingCycle("monthly")}
                className={cn(
                  "flex-1 py-2.5 rounded-full text-sm font-medium tracking-wide transition-all duration-300",
                  billingCycle === "monthly"
                    ? "bg-[rgba(203,184,146,0.22)] text-[var(--sand-0)] shadow-sm"
                    : "text-muted-foreground/60 hover:text-muted-foreground"
                )}
              >
                Monthly · $9.99
              </button>
            </div>

            {billingCycle === "yearly" && (
              <p className="text-center text-xs text-primary/60 -mt-4 tracking-wide">
                Save 17% with yearly — just $8.25/month
              </p>
            )}

            {/* Feature List */}
            <div className="rounded-[24px] border border-foreground/10 bg-card/70 backdrop-blur-sm divide-y divide-foreground/6 overflow-hidden">
              {FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary/80" />
                  </div>
                  <span className="text-sm text-foreground/80 font-light leading-snug">{text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="space-y-3 pt-1">
              <button
                onClick={() => setShowModal(true)}
                className="w-full py-5 rounded-[28px] text-base font-medium tracking-wide transition-all duration-300 active:scale-[0.98] bg-[rgba(203,184,146,0.26)] border border-[rgba(203,184,146,0.36)] text-[var(--sand-0)] hover:bg-[rgba(203,184,146,0.34)] shadow-[0_8px_32px_rgba(203,184,146,0.12)]"
              >
                {billingCycle === "yearly" ? "Start for $99 / year" : "Start for $9.99 / month"}
              </button>

              <button
                onClick={handleRestore}
                disabled={isRestoring}
                className="w-full py-4 rounded-[28px] text-sm text-muted-foreground/55 hover:text-muted-foreground transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isRestoring ? "Restoring…" : "Restore Purchases"}
              </button>
            </div>

            <p className="text-center text-[11px] text-muted-foreground/40 font-light leading-relaxed">
              Subscriptions renew automatically. Cancel anytime in your Apple ID settings.{"\n"}
              By subscribing you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </main>
      </div>

      <ProUpgradeModal open={showModal} onOpenChange={setShowModal} />
    </PageShell>
  );
};

export default Upgrade;
