import { useState, useCallback, useRef } from "react";
import {
  detectContextTags,
  findContextualRecall,
  canShowRecall,
  RecallMatch,
} from "@/lib/recallEngine";

interface UseRecallEngineResult {
  currentRecall: RecallMatch | null;
  checkForRecall: (userInput: string) => void;
  dismissRecall: () => void;
}

export function useRecallEngine(): UseRecallEngineResult {
  const [currentRecall, setCurrentRecall] = useState<RecallMatch | null>(null);
  const lastRecallTimeRef = useRef<number | null>(null);
  const dismissedRef = useRef<boolean>(false);

  const checkForRecall = useCallback((userInput: string) => {
    // If user dismissed, don't show again until next message
    if (dismissedRef.current) {
      dismissedRef.current = false;
      return;
    }

    // Rate limit check
    if (!canShowRecall(lastRecallTimeRef.current)) {
      return;
    }

    // Detect context from user input
    const contextTags = detectContextTags(userInput);

    // Only show recall if we detected meaningful context
    if (contextTags.length === 0) {
      return;
    }

    // Find matching recall
    const recall = findContextualRecall(contextTags);

    if (recall) {
      setCurrentRecall(recall);
      lastRecallTimeRef.current = Date.now();
    }
  }, []);

  const dismissRecall = useCallback(() => {
    setCurrentRecall(null);
    dismissedRef.current = true;
  }, []);

  return {
    currentRecall,
    checkForRecall,
    dismissRecall,
  };
}
