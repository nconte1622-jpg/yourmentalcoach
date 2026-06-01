import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Sparkles, Check, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";
import { openExternal } from "@/lib/openExternal";

interface ProUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PlanType = "monthly" | "annual";

export function ProUpgradeModal({ open, onOpenChange }: ProUpgradeModalProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("annual");
  const [isLoading, setIsLoading] = useState(false);

  const needsAccount = !isAuthenticated;

  useEffect(() => {
    if (!open) return;
    trackEvent("paywall_viewed", { entry: "pro_upgrade_modal" });
  }, [open]);

  const handleUpgrade = async () => {
    if (needsAccount) {
      // Redirect to login for account creation
      onOpenChange(false);
      navigate("/login");
      toast({
        title: "Create an account first",
        description: "Sign up with email or Google to unlock Pro features.",
      });
      return;
    }

    setIsLoading(true);
    try {
      trackEvent("subscription_started", { source: "paywall_modal", plan: selectedPlan });
      const { data, error } = await supabase.functions.invoke("create-pro-checkout", {
        body: { priceType: selectedPlan },
      });

      if (error) throw error;
      if (data?.url) {
        onOpenChange(false);
        await openExternal(data.url);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Unable to start checkout",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md overflow-hidden p-0 border-0"
        style={{
          backgroundColor: "transparent",
          boxShadow: "none",
          maxHeight: "calc(100vh - var(--sat) - 24px)",
        }}
      >
        <div
          className="max-h-[calc(100vh-var(--sat)-24px)] overflow-y-auto rounded-[28px] border"
          style={{
            background: "linear-gradient(180deg, var(--sand-surface) 0%, rgba(240,229,203,0.96) 100%)",
            borderColor: "var(--sand-border)",
            backdropFilter: "blur(14px)",
            boxShadow: "var(--card-shadow)",
          }}
        >
        <div
          className="sticky top-0 z-0 h-0"
          aria-hidden="true"
          style={{
            boxShadow: "0 0 0 9999px var(--overlay)",
            backdropFilter: "blur(6px)",
          }}
        />
        <div className="relative z-10 px-6 pb-6 pt-6 sm:px-7">
        <DialogHeader className="text-center space-y-4 pb-2">
          {/* Icon */}
          <div className="flex justify-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center border"
              style={{
                background: "linear-gradient(180deg, var(--sand-surface-2) 0%, rgba(221,205,170,0.96) 100%)",
                borderColor: "var(--sand-border)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), var(--elev-2)",
              }}
            >
              <Brain className="w-7 h-7" style={{ color: "var(--ink)" }} />
            </div>
          </div>
          
          <DialogTitle 
            className="text-2xl font-serif tracking-wide"
            style={{ color: "var(--ink)", textShadow: "none" }}
          >
            Calm Pro
          </DialogTitle>
          
          <p 
            className="text-base font-medium leading-7 max-w-[28ch] mx-auto"
            style={{ color: "var(--ink-1)" }}
          >
            Unlock your mental edge with smarter round memory, live emotional support, and personalized insights.
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Benefits */}
          <div className="space-y-3">
            {[
              "Round DNA after every reflection",
              "Pattern intelligence across rounds",
              "Personalized pre-game briefs",
              "Quick Tap emotional dock",
              "Unlimited AI during the round",
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 rounded-2xl px-1 py-1.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: "var(--sand-surface-2)",
                    border: "1px solid var(--sand-border)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22)",
                  }}
                >
                  <Check className="w-3 h-3" style={{ color: "var(--ink)" }} />
                </div>
                <span 
                  className="text-base font-medium"
                  style={{ color: "var(--ink)" }}
                >
                  {benefit}
                </span>
              </div>
            ))}
          </div>

          {/* Plan Selection */}
          <div className="space-y-3">
            {/* Annual */}
            <button
              onClick={() => setSelectedPlan("annual")}
              className={cn(
                "w-full p-4 rounded-xl text-left transition-all duration-300",
                "border",
                selectedPlan === "annual"
                  ? "ring-1"
                  : ""
              )}
              style={
                selectedPlan === "annual"
                  ? {
                      background: "linear-gradient(180deg, rgba(220,203,168,0.88) 0%, rgba(208,190,152,0.94) 100%)",
                      borderColor: "rgba(132, 111, 72, 0.32)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 0 0 1px rgba(132,111,72,0.08), var(--elev-2)",
                    }
                  : {
                      background: "linear-gradient(180deg, rgba(236,228,206,0.76) 0%, rgba(224,213,187,0.72) 100%)",
                      borderColor: "rgba(60, 90, 78, 0.18)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
                    }
              }
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span 
                      className="font-medium"
                      style={{ color: "var(--ink)" }}
                    >
                      Annual
                    </span>
                    <span 
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ 
                      backgroundColor: selectedPlan === "annual" ? 'rgba(17, 33, 25, 0.08)' : 'rgba(17, 33, 25, 0.08)',
                        color: 'var(--ink)' 
                      }}
                    >
                      2 months free
                    </span>
                  </div>
                  <p 
                    className="text-sm mt-0.5"
                    style={{ color: "var(--ink)" }}
                  >
                    $99/year
                  </p>
                </div>
                <div 
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                  style={{
                    borderColor: selectedPlan === "annual" ? 'rgba(17, 33, 25, 0.78)' : 'rgba(17, 33, 25, 0.32)',
                    backgroundColor: selectedPlan === "annual" ? 'rgba(17, 33, 25, 0.9)' : 'rgba(245,236,216,0.8)',
                    boxShadow: selectedPlan === "annual" ? "0 4px 10px rgba(17,33,25,0.15)" : "none",
                  }}
                >
                  {selectedPlan === "annual" && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                  {selectedPlan !== "annual" && (
                    <span className="block w-1.5 h-1.5 rounded-full" style={{ background: "rgba(17,33,25,0.38)" }} />
                  )}
                </div>
              </div>
            </button>

            {/* Monthly */}
            <button
              onClick={() => setSelectedPlan("monthly")}
              className={cn(
                "w-full p-4 rounded-xl text-left transition-all duration-300",
                "border",
                selectedPlan === "monthly"
                  ? "ring-1"
                  : ""
              )}
              style={
                selectedPlan === "monthly"
                  ? {
                      background: "linear-gradient(180deg, rgba(220,203,168,0.88) 0%, rgba(208,190,152,0.94) 100%)",
                      borderColor: "rgba(132, 111, 72, 0.32)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 0 0 1px rgba(132,111,72,0.08), var(--elev-2)",
                    }
                  : {
                      background: "linear-gradient(180deg, rgba(236,228,206,0.76) 0%, rgba(224,213,187,0.72) 100%)",
                      borderColor: "rgba(60, 90, 78, 0.18)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
                    }
              }
            >
              <div className="flex items-center justify-between">
                <div>
                  <span 
                    className="font-medium"
                    style={{ color: "var(--ink)" }}
                  >
                    Monthly
                  </span>
                  <p 
                    className="text-sm mt-0.5"
                    style={{ color: "var(--ink)" }}
                  >
                    $9.99/month
                  </p>
                </div>
                <div 
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                  style={{
                    borderColor: selectedPlan === "monthly" ? 'rgba(17, 33, 25, 0.78)' : 'rgba(17, 33, 25, 0.32)',
                    backgroundColor: selectedPlan === "monthly" ? 'rgba(17, 33, 25, 0.9)' : 'rgba(245,236,216,0.8)',
                    boxShadow: selectedPlan === "monthly" ? "0 4px 10px rgba(17,33,25,0.15)" : "none",
                  }}
                >
                  {selectedPlan === "monthly" && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                  {selectedPlan !== "monthly" && (
                    <span className="block w-1.5 h-1.5 rounded-full" style={{ background: "rgba(17,33,25,0.38)" }} />
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* CTA */}
          <Button
            onClick={handleUpgrade}
            disabled={isLoading}
            className="w-full py-6 text-base font-medium rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 sticky bottom-0"
            style={{
              background: "linear-gradient(180deg, rgba(18,64,47,0.96) 0%, rgba(13,46,34,1) 100%)",
              boxShadow: "0 14px 30px rgba(18,64,47,0.24), inset 0 1px 0 rgba(255,255,255,0.12)",
            }}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                <span>Loading...</span>
              </div>
            ) : needsAccount ? (
              <div className="flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                <span>Create Account to Continue</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Unlock Your Mental Edge</span>
              </div>
            )}
          </Button>

          {/* Subtle note */}
          <p 
            className="text-center text-[11px] font-light"
            style={{ color: "var(--muted-ink)" }}
          >
            Cancel anytime. Your memories stay with you.
          </p>
        </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
