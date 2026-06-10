// Runtime simulation of two consecutive rounds, exercising the REAL
// roundMetrics + resilienceScore + back9Detection modules (roundContext is
// stubbed). Proves the second round starts with an empty emotion log and a
// correct, un-polluted resilience score.
//
// localStorage polyfill — set before any helper call. (Imported modules don't
// touch localStorage at init time, so module hoisting is not a problem.)
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

import {
  appendEmotionTap,
  recordCheckInTimestamp,
  markUsedPreShotReset,
  clearRoundMetrics,
  loadEmotionLog,
  loadCheckInTimestamps,
  loadUsedPreShotReset,
} from "@/lib/roundMetrics";
import { getCurrentRoundScore } from "@/lib/resilienceScore";
import { analyzeCurrentRoundTiming } from "@/lib/back9Detection";

let failures = 0;
function assert(name, cond, detail) {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.log(`  ✗ ${name}${detail ? "  — " + detail : ""}`); failures++; }
}
// getCurrentRoundScore derives round duration from this localStorage key.
function setRoundStart(minutesAgo) {
  store.set("golfer-round-context", JSON.stringify({
    roundType: "on-course",
    environment: "casual",
    startedAt: new Date(Date.now() - minutesAgo * 60000).toISOString(),
  }));
}

// ─────────────────────────────────────────────────────────────
console.log("\n=== ROUND A (the first round of the session) ===");
setRoundStart(60);
["Frustrated", "Tight", "Confident", "Frustrated"].forEach((t) => appendEmotionTap(t));
recordCheckInTimestamp();
recordCheckInTimestamp();
markUsedPreShotReset();

const aLog = loadEmotionLog();
const aScore = getCurrentRoundScore();
const aBack9 = analyzeCurrentRoundTiming();
console.log(`  emotion log:        [${aLog.map((t) => t.tag).join(", ")}]`);
console.log(`  check-ins / reset:  ${loadCheckInTimestamps().length} / ${loadUsedPreShotReset()}`);
console.log(`  resilience score:   ${aScore}`);
console.log(`  back-9 dominant:    ${aBack9?.dominantEmotion}`);
assert("Round A logged its 4 emotions", aLog.length === 4);
assert("Round A resilience score === 61", aScore === 61, `got ${aScore}`);
assert("Round A back-9 detection sees the data (dominant = Frustrated)",
  aBack9?.dominantEmotion === "Frustrated", `got ${aBack9?.dominantEmotion}`);

// ─────────────────────────────────────────────────────────────
console.log("\n=== COUNTERFACTUAL: the OLD bug (no clear on new round) ===");
console.log("  Appending Round B's taps on top of Round A's leftover log:");
setRoundStart(0);
["Confident", "Calm"].forEach((t) => appendEmotionTap(t)); // bleeds onto A's 4 taps
const pollutedLog = loadEmotionLog();
const pollutedScore = getCurrentRoundScore();
console.log(`  emotion log:        [${pollutedLog.map((t) => t.tag).join(", ")}]`);
console.log(`  resilience score:   ${pollutedScore}  (inflated by leftover check-ins, reset & recovery)`);
assert("Without the fix, Round B's log is polluted (6 taps incl. Round A's)", pollutedLog.length === 6);
assert("Without the fix, Round B score is WRONG (81, not 70)", pollutedScore === 81, `got ${pollutedScore}`);

// ─────────────────────────────────────────────────────────────
console.log("\n=== NEW ROUND STARTS → createRound() now calls clearRoundMetrics() ===");
clearRoundMetrics();
assert("emotion log cleared", loadEmotionLog().length === 0);
assert("check-in timestamps cleared", loadCheckInTimestamps().length === 0);
assert("pre-shot reset flag cleared", loadUsedPreShotReset() === false);
assert("getCurrentRoundScore() is null on a fresh round (no emotion data)",
  getCurrentRoundScore() === null, `got ${getCurrentRoundScore()}`);
assert("back-9 detection sees no data (dominant = null, no Round A bleed)",
  analyzeCurrentRoundTiming()?.dominantEmotion === null,
  `got ${analyzeCurrentRoundTiming()?.dominantEmotion}`);

// ─────────────────────────────────────────────────────────────
console.log("\n=== ROUND B (second round, same app session) ===");
setRoundStart(0);
["Confident", "Calm"].forEach((t) => appendEmotionTap(t));
const bLog = loadEmotionLog();
const bScore = getCurrentRoundScore();
console.log(`  emotion log:        [${bLog.map((t) => t.tag).join(", ")}]`);
console.log(`  resilience score:   ${bScore}`);
assert("Round B log contains ONLY Round B's tags", JSON.stringify(bLog.map((t) => t.tag)) === JSON.stringify(["Confident", "Calm"]));
assert("Round B has NO Round A bleed (no Frustrated/Tight)",
  !bLog.some((t) => ["Frustrated", "Tight"].includes(t.tag)));
assert("Round B resilience score === 70 (correct, un-polluted)", bScore === 70, `got ${bScore}`);

// ─────────────────────────────────────────────────────────────
console.log(`\n${failures === 0 ? "ALL CHECKS PASSED ✓" : failures + " CHECK(S) FAILED ✗"}\n`);
process.exit(failures === 0 ? 0 : 1);
