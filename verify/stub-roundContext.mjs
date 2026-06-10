// Test-only stub for @/lib/roundContext, used by the verification harness so
// we can exercise the REAL back9Detection logic without pulling in the
// roundSession → sonner → React/DOM import graph (which can't init under Node).
// back9Detection only consumes loadRoundContext() from this module.
export function loadRoundContext() {
  return {
    roundType: "on-course",
    environment: "casual",
    // 60 minutes ago — far enough in that taps count, short enough to stay
    // on the "front 9" (back-9 threshold is 90 min).
    startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  };
}
