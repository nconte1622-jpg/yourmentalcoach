/**
 * Timed Check-In Hook
 *
 * Proactive coaching: the app initiates instead of waiting for the user.
 * Every ~20 minutes during a round, surfaces a gentle check-in prompt
 * with emotion quick-taps. This is the #1 competitive differentiator —
 * no other golf mental coaching app does mid-round proactive check-ins.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { loadRoundContext } from "@/lib/roundContext";

const CHECK_IN_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes
const MIN_ROUND_AGE_MS = 10 * 60 * 1000; // Don't check in before 10 min
const CHECK_IN_STORAGE_KEY = "round-checkin-timestamps";

export interface CheckInState {
  /** Whether a check-in card should be shown */
  isActive: boolean;
  /** How many check-ins have been shown this round */
  checkInCount: number;
  /** Contextual message for the check-in */
  message: string;
  /** Dismiss the current check-in */
  dismiss: () => void;
  /** Respond to check-in with an emotion */
  respondWithEmotion: (emotion: string) => void;
}

const CHECK_IN_MESSAGES = [
  "Quick check — how are you feeling right now?",
  "Between holes — where's your head at?",
  "Mental pulse check. What's the vibe?",
  "Checking in. How's the energy?",
  "Pause for a sec — how are you doing out there?",
  "Quick read on yourself. What's the feeling?",
];

const LATE_ROUND_MESSAGES = [
  "Coming down the stretch — how's the focus?",
  "Back nine energy check. Where are you at?",
  "Getting into the business end. How's the mental game?",
  "Late in the round — how's the tank?",
];

export function useCheckIn(
  onEmotionResponse?: (emotion: string) => void,
): CheckInState {
  const [isActive, setIsActive] = useState(false);
  const [checkInCount, setCheckInCount] = useState(0);
  const [message, setMessage] = useState("");
  const respondedRef = useRef(false);

  // Refs to avoid stale closures in the interval callback
  const isActiveRef = useRef(false);
  const onEmotionResponseRef = useRef(onEmotionResponse);

  // Keep refs in sync with latest values
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    onEmotionResponseRef.current = onEmotionResponse;
  }, [onEmotionResponse]);

  // Load previous check-in count for this round
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(CHECK_IN_STORAGE_KEY);
      if (stored) {
        const timestamps: number[] = JSON.parse(stored);
        setCheckInCount(timestamps.length);
      }
    } catch { /* ignore */ }
  }, []);

  // Stable interval that reads from refs — never recreated
  useEffect(() => {
    const timer = setInterval(() => {
      // Check round age
      const ctx = loadRoundContext();
      if (!ctx?.startedAt) return;
      const roundAge = Date.now() - new Date(ctx.startedAt).getTime();
      if (roundAge < MIN_ROUND_AGE_MS) return;

      // Don't interrupt if one is already showing
      if (isActiveRef.current) return;

      // Pick message based on round age
      const isLateRound = roundAge > 2.5 * 60 * 60 * 1000;
      const pool = isLateRound ? LATE_ROUND_MESSAGES : CHECK_IN_MESSAGES;
      const msg = pool[Math.floor(Math.random() * pool.length)];

      respondedRef.current = false;
      setMessage(msg);
      setIsActive(true);

      // Record timestamp
      try {
        const stored = sessionStorage.getItem(CHECK_IN_STORAGE_KEY);
        const timestamps: number[] = stored ? JSON.parse(stored) : [];
        timestamps.push(Date.now());
        sessionStorage.setItem(CHECK_IN_STORAGE_KEY, JSON.stringify(timestamps));
        setCheckInCount(timestamps.length);
      } catch { /* ignore */ }
    }, CHECK_IN_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []); // Empty deps — interval is stable for the lifetime of the hook

  // Auto-dismiss after 60 seconds if no response
  useEffect(() => {
    if (!isActive) return;
    const timeout = setTimeout(() => {
      if (!respondedRef.current) {
        setIsActive(false);
      }
    }, 60_000);
    return () => clearTimeout(timeout);
  }, [isActive]);

  const dismiss = useCallback(() => {
    respondedRef.current = true;
    setIsActive(false);
  }, []);

  const respondWithEmotion = useCallback((emotion: string) => {
    respondedRef.current = true;
    setIsActive(false);
    onEmotionResponseRef.current?.(emotion);
  }, []);

  return {
    isActive,
    checkInCount,
    message,
    dismiss,
    respondWithEmotion,
  };
}
