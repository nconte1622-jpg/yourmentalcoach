import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { LRMIndicator } from "@/components/LRMIndicator";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const UpgradeSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Verify subscription status and update profile
    const verifySubscription = async () => {
      try {
        await supabase.functions.invoke("check-subscription");
      } catch (error) {
        console.error("Failed to verify subscription:", error);
      }
    };

    verifySubscription();

    // Auto-redirect to home after a delay
    const timer = setTimeout(() => {
      navigate("/");
    }, 4000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <PageShell backgroundVariant="default">
      <div className="flex flex-col h-full items-center justify-center px-8">
        <div className="max-w-sm w-full text-center space-y-8 animate-fade-in">
          {/* Success checkmark with LRM glow */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
                <Check className="w-10 h-10 text-primary/80" />
              </div>
              <div className="absolute -top-1 -right-1">
                <LRMIndicator memoryActive />
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-3">
            <h1 className="text-2xl font-serif text-foreground/90 tracking-wide">
              Welcome to Pro
            </h1>
            <p className="text-base text-muted-foreground/70 leading-relaxed font-light">
              Your coach now remembers what works for you.
            </p>
          </div>

          {/* Subtle redirect indicator */}
          <div className="pt-4">
            <p className="text-xs text-muted-foreground/40 tracking-wide">
              Taking you home...
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default UpgradeSuccess;
