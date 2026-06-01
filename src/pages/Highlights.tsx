import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/PageShell";
import { loadHighlights, deleteHighlight, Highlight } from "@/lib/memoryStorage";
import { ArrowLeft, Trash2 } from "lucide-react";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { FrostedSandCard } from "@/components/ui/frosted-sand-card";
import { BottomDock } from "@/components/ui/BottomDock";
import { ActiveRoundResumeChip } from "@/components/ui/ActiveRoundResumeChip";

const Highlights = () => {
  const navigate = useNavigate();
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  useEffect(() => {
    setHighlights(loadHighlights());
  }, []);

  const handleDelete = (id: string) => {
    deleteHighlight(id);
    setHighlights(loadHighlights());
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

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
            center={<h1 className="truncate text-base md:text-lg font-serif tracking-wide text-foreground">Saved Highlights</h1>}
            right={<div className="tap-44" />}
          />
        }
      >
        <div className="with-bottom-dock flex-1 py-8 fluid-glow-backdrop">
          {highlights.length === 0 ? (
            <FrostedSandCard className="max-w-md mx-auto flex flex-col items-center justify-center text-center py-12 animate-fade-in">
              <p className="mb-3 text-base font-medium" style={{ color: "#0e1a15" }}>No highlights saved yet.</p>
              <p className="text-sm max-w-xs" style={{ color: "rgba(14,26,21,0.75)" }}>
                Complete a post-round reflection to save your first highlight.
              </p>
            </FrostedSandCard>
          ) : (
            <div className="space-y-5 max-w-lg mx-auto">
              {highlights
                .slice()
                .reverse()
                .map((highlight, index) => (
                  <FrostedSandCard
                    key={highlight.id}
                    className="rounded-2xl p-5 animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-xs" style={{ color: "var(--muted-text)" }}>
                          {formatDate(highlight.date)}
                        </span>
                        {highlight.contextTag && (
                          <span
                            className="text-xs px-2.5 py-1 rounded-full"
                            style={{ background: "var(--muted-bg)", color: "var(--muted-text)" }}
                          >
                            {highlight.contextTag}
                          </span>
                        )}
                        {highlight.cueWord && (
                          <span className="text-xs px-2.5 py-1 bg-primary/8 text-primary/80 rounded-full font-medium">
                            {highlight.cueWord}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(highlight.id)}
                        className="h-8 w-8 text-muted-foreground/30 hover:text-destructive/70 transition-colors duration-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <p className="text-sm leading-relaxed font-light" style={{ color: "var(--text-secondary)" }}>
                      {highlight.mentalRule}
                    </p>
                  </FrostedSandCard>
                ))}
            </div>
          )}
        </div>
      </AppShell>
      <ActiveRoundResumeChip />
      <BottomDock highlightDot={highlights.length > 0} />
    </PageShell>
  );
};

export default Highlights;
