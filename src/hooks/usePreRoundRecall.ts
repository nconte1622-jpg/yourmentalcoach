import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProStatus } from "@/hooks/useProStatus";
import { useAuth } from "@/hooks/useAuth";

interface RecallLine {
  text: string;
  cue: string | null;
}

const RECALL_TEMPLATES = [
  "Last time you felt this way, {cue} helped.",
  "When it mattered before, you chose to {cue}.",
  "You've been here. {cue} worked.",
  "In similar moments, {cue} made the difference.",
];

/**
 * Hook to fetch a subtle pre-round recall line for Pro users.
 * Returns null for Free users or if no relevant memories exist.
 * Never forces interaction — just a gentle reminder.
 */
export function usePreRoundRecall(): { recallLine: string | null; isLoading: boolean } {
  const { isPro, isLoading: proLoading } = useProStatus();
  const { user } = useAuth();
  const [recallLine, setRecallLine] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecall = async () => {
      // Skip for Free users
      if (proLoading) return;
      
      if (!isPro || !user?.id) {
        setRecallLine(null);
        setIsLoading(false);
        return;
      }

      try {
        // Fetch recent high-confidence memories with cue words
        const { data, error } = await supabase
          .from("memories")
          .select("content, category, confidence")
          .eq("user_id", user.id)
          .in("category", ["cue", "success"])
          .gte("confidence", 0.5)
          .order("confidence", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(5);

        if (error || !data || data.length === 0) {
          setRecallLine(null);
          setIsLoading(false);
          return;
        }

        // Extract a cue word from memories
        const cueWords = ["commit", "tempo", "breathe", "target", "trust", "accept", "patience", "simplify", "release"];
        let foundCue: string | null = null;

        for (const memory of data) {
          const content = memory.content.toLowerCase();
          for (const cue of cueWords) {
            if (content.includes(cue)) {
              foundCue = cue;
              break;
            }
          }
          if (foundCue) break;
        }

        if (!foundCue) {
          // No cue word found, use a generic but still personalized line
          const successMemory = data.find(m => m.category === "success");
          if (successMemory) {
            setRecallLine("You've been here before. Trust what worked.");
          } else {
            setRecallLine(null);
          }
          setIsLoading(false);
          return;
        }

        // Build the recall line from template
        const template = RECALL_TEMPLATES[Math.floor(Math.random() * RECALL_TEMPLATES.length)];
        const line = template.replace("{cue}", foundCue);
        setRecallLine(line);
      } catch (err) {
        console.error("Failed to fetch pre-round recall:", err);
        setRecallLine(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecall();
  }, [isPro, proLoading, user?.id]);

  return { recallLine, isLoading };
}
