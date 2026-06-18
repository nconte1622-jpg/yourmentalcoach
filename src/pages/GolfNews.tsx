import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { BottomDock } from "@/components/ui/BottomDock";
import { GolfNewsView } from "@/components/GolfNewsView";

/**
 * GolfNews — standalone route for the Daily Caddie Intel feed. Also embedded as
 * the third Home swipe slide via <GolfNewsView />.
 */
const GolfNews = () => {
  const navigate = useNavigate();
  return (
    <PageShell backgroundVariant="default">
      <AppShell
        header={
          <AppHeader
            left={
              <button
                type="button"
                onClick={() => navigate("/")}
                className="header-hit-button tap-44 text-[#2d4d2d] transition-all duration-300 hover:bg-[#1a5c2e]/5 hover:text-[#0f1f0f]"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Home
              </button>
            }
            center={<h1 className="truncate font-serif text-base tracking-wide text-[#0f1f0f] md:text-lg">Daily Intel</h1>}
            right={<div className="tap-44" />}
          />
        }
      >
        <GolfNewsView embedded={false} />
      </AppShell>
      <BottomDock />
    </PageShell>
  );
};

export default GolfNews;
