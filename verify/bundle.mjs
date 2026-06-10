// src/lib/roundMetrics.ts
var EMOTION_LOG_KEY = "round-emotion-log";
var CHECK_IN_TIMESTAMPS_KEY = "round-checkin-timestamps";
var USED_PRE_SHOT_RESET_KEY = "round-used-pre-shot-reset";
function loadEmotionLog() {
  try {
    const raw = localStorage.getItem(EMOTION_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function appendEmotionTap(tag) {
  try {
    const log = loadEmotionLog();
    log.push({ tag, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    localStorage.setItem(EMOTION_LOG_KEY, JSON.stringify(log));
  } catch {
  }
}
function loadCheckInTimestamps() {
  try {
    const raw = localStorage.getItem(CHECK_IN_TIMESTAMPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function recordCheckInTimestamp(timestamp = Date.now()) {
  try {
    const timestamps = loadCheckInTimestamps();
    timestamps.push(timestamp);
    localStorage.setItem(CHECK_IN_TIMESTAMPS_KEY, JSON.stringify(timestamps));
    return timestamps;
  } catch {
    return loadCheckInTimestamps();
  }
}
function loadUsedPreShotReset() {
  try {
    return localStorage.getItem(USED_PRE_SHOT_RESET_KEY) === "true";
  } catch {
    return false;
  }
}
function markUsedPreShotReset() {
  try {
    localStorage.setItem(USED_PRE_SHOT_RESET_KEY, "true");
  } catch {
  }
}
function clearRoundMetrics() {
  try {
    localStorage.removeItem(EMOTION_LOG_KEY);
    localStorage.removeItem(CHECK_IN_TIMESTAMPS_KEY);
    localStorage.removeItem(USED_PRE_SHOT_RESET_KEY);
  } catch {
  }
}

// src/lib/resilienceScore.ts
var POSITIVE_EMOTIONS = /* @__PURE__ */ new Set([
  "Confident",
  "Calm",
  "Relaxed",
  "Locked In",
  "Focused",
  "Composed"
]);
var NEGATIVE_EMOTIONS = /* @__PURE__ */ new Set([
  "Tight",
  "Rushed",
  "Frustrated",
  "Distracted",
  "Anxious",
  "Discouraged"
]);
function calculateResilienceScore(roundData) {
  let score = 50;
  const { emotionLog, checkInTimestamps, usedPreShotReset, roundDurationMinutes } = roundData;
  if (emotionLog.length === 0) {
    score -= 5;
    return Math.max(0, Math.min(100, score));
  }
  const positiveCount = emotionLog.filter((e) => POSITIVE_EMOTIONS.has(e.tag)).length;
  const negativeCount = emotionLog.filter((e) => NEGATIVE_EMOTIONS.has(e.tag)).length;
  const totalEmotions = emotionLog.length;
  if (totalEmotions > 0) {
    const positiveRatio = positiveCount / totalEmotions;
    score += positiveRatio * 20;
  }
  if (negativeCount > 0) {
    const recoveryBonus = calculateRecoveryBonus(emotionLog);
    score += recoveryBonus;
  }
  if (checkInTimestamps.length > 0) {
    const checkInBonus = Math.min(10, checkInTimestamps.length * 3);
    score += checkInBonus;
  }
  if (usedPreShotReset) {
    score += 5;
  }
  if (roundDurationMinutes > 120) {
    const persistenceBonus = Math.min(10, (roundDurationMinutes - 120) / 36);
    score += persistenceBonus;
  }
  if (emotionLog.length > 0) {
    const lastEmotion = emotionLog[emotionLog.length - 1].tag;
    if (NEGATIVE_EMOTIONS.has(lastEmotion)) {
      score -= 10;
    }
  }
  return Math.max(0, Math.min(100, score));
}
function calculateRecoveryBonus(emotionLog) {
  let recoveryBonus = 0;
  for (let i = 0; i < emotionLog.length - 1; i++) {
    const current = emotionLog[i].tag;
    const next = emotionLog[i + 1].tag;
    if (NEGATIVE_EMOTIONS.has(current) && POSITIVE_EMOTIONS.has(next)) {
      recoveryBonus += 5;
    }
  }
  return Math.min(15, recoveryBonus);
}
function getCurrentRoundScore() {
  try {
    const emotions = loadEmotionLog();
    if (emotions.length === 0) {
      return null;
    }
    const checkIns = loadCheckInTimestamps();
    const usedPreShotReset = loadUsedPreShotReset();
    let roundDuration = 0;
    try {
      const ctxStr = localStorage.getItem("golfer-round-context");
      if (ctxStr) {
        const ctx = JSON.parse(ctxStr);
        if (ctx?.startedAt) {
          roundDuration = Math.floor(
            (Date.now() - new Date(ctx.startedAt).getTime()) / 6e4
          );
        }
      }
    } catch {
    }
    return calculateResilienceScore({
      emotionLog: emotions,
      checkInTimestamps: checkIns,
      usedPreShotReset,
      roundDurationMinutes: roundDuration
    });
  } catch (error) {
    console.error("Failed to get current round score:", error);
    return null;
  }
}

// verify/stub-roundContext.mjs
function loadRoundContext() {
  return {
    roundType: "on-course",
    environment: "casual",
    // 60 minutes ago — far enough in that taps count, short enough to stay
    // on the "front 9" (back-9 threshold is 90 min).
    startedAt: new Date(Date.now() - 60 * 60 * 1e3).toISOString()
  };
}

// src/lib/back9Detection.ts
var BACK9_THRESHOLD_MINUTES = 90;
var NEGATIVE_EMOTIONS2 = [
  "Frustrated",
  "Tight",
  "Angry",
  "Rushed",
  "Anxious"
];
function analyzeCurrentRoundTiming() {
  try {
    const context = loadRoundContext();
    if (!context) return null;
    const taps = loadEmotionLog();
    if (taps.length === 0) {
      return {
        isBack9: false,
        negativeRatio: 0,
        dominantEmotion: null,
        suggestion: null
      };
    }
    const startedAt = new Date(context.startedAt);
    const elapsedMinutes = Math.round((Date.now() - startedAt.getTime()) / 6e4);
    const isBack9 = elapsedMinutes > BACK9_THRESHOLD_MINUTES;
    const splitTimestamp = new Date(startedAt.getTime() + BACK9_THRESHOLD_MINUTES * 6e4);
    const front9Taps = taps.filter(
      (tap) => new Date(tap.timestamp) < splitTimestamp
    );
    const back9Taps = taps.filter(
      (tap) => new Date(tap.timestamp) >= splitTimestamp
    );
    const front9NegativeRatio = front9Taps.length > 0 ? front9Taps.filter((tap) => NEGATIVE_EMOTIONS2.includes(tap.tag)).length / front9Taps.length : 0;
    const back9NegativeRatio = back9Taps.length > 0 ? back9Taps.filter((tap) => NEGATIVE_EMOTIONS2.includes(tap.tag)).length / back9Taps.length : 0;
    const relevantTaps = isBack9 ? back9Taps : taps;
    const dominantEmotion = getDominantEmotion(relevantTaps);
    let suggestion = null;
    if (isBack9 && back9NegativeRatio > 0.5) {
      if (dominantEmotion && NEGATIVE_EMOTIONS2.includes(dominantEmotion)) {
        suggestion = buildBack9Suggestion(dominantEmotion);
      }
    }
    return {
      isBack9,
      negativeRatio: back9NegativeRatio,
      dominantEmotion,
      suggestion
    };
  } catch {
    return null;
  }
}
function getDominantEmotion(taps) {
  if (taps.length === 0) return null;
  const counts = {};
  taps.forEach((tap) => {
    counts[tap.tag] = (counts[tap.tag] || 0) + 1;
  });
  let dominant = null;
  let maxCount = 0;
  for (const [emotion, count] of Object.entries(counts)) {
    if (count > maxCount) {
      dominant = emotion;
      maxCount = count;
    }
  }
  return dominant;
}
function buildBack9Suggestion(emotion) {
  const suggestions = {
    Frustrated: "Take a breath and refocus on one shot at a time. Frustration clouds your next decision.",
    Tight: "Loosen your grip\u2014physically and mentally. One deep breath before each shot.",
    Angry: "Channel that energy into commitment. Step away if you need a moment to reset.",
    Rushed: "Slow down your routine. You've got time. Trust your process.",
    Anxious: "Acknowledge the nerves, then let them go. Focus on what you can control."
  };
  return suggestions[emotion] || "Take a moment to reset your mental state.";
}

// verify/verify.mjs
var store = /* @__PURE__ */ new Map();
globalThis.localStorage = {
  getItem: (k) => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  }
};
var failures = 0;
function assert(name, cond, detail) {
  if (cond) console.log(`  \u2713 ${name}`);
  else {
    console.log(`  \u2717 ${name}${detail ? "  \u2014 " + detail : ""}`);
    failures++;
  }
}
function setRoundStart(minutesAgo) {
  store.set("golfer-round-context", JSON.stringify({
    roundType: "on-course",
    environment: "casual",
    startedAt: new Date(Date.now() - minutesAgo * 6e4).toISOString()
  }));
}
console.log("\n=== ROUND A (the first round of the session) ===");
setRoundStart(60);
["Frustrated", "Tight", "Confident", "Frustrated"].forEach((t) => appendEmotionTap(t));
recordCheckInTimestamp();
recordCheckInTimestamp();
markUsedPreShotReset();
var aLog = loadEmotionLog();
var aScore = getCurrentRoundScore();
var aBack9 = analyzeCurrentRoundTiming();
console.log(`  emotion log:        [${aLog.map((t) => t.tag).join(", ")}]`);
console.log(`  check-ins / reset:  ${loadCheckInTimestamps().length} / ${loadUsedPreShotReset()}`);
console.log(`  resilience score:   ${aScore}`);
console.log(`  back-9 dominant:    ${aBack9?.dominantEmotion}`);
assert("Round A logged its 4 emotions", aLog.length === 4);
assert("Round A resilience score === 61", aScore === 61, `got ${aScore}`);
assert(
  "Round A back-9 detection sees the data (dominant = Frustrated)",
  aBack9?.dominantEmotion === "Frustrated",
  `got ${aBack9?.dominantEmotion}`
);
console.log("\n=== COUNTERFACTUAL: the OLD bug (no clear on new round) ===");
console.log("  Appending Round B's taps on top of Round A's leftover log:");
setRoundStart(0);
["Confident", "Calm"].forEach((t) => appendEmotionTap(t));
var pollutedLog = loadEmotionLog();
var pollutedScore = getCurrentRoundScore();
console.log(`  emotion log:        [${pollutedLog.map((t) => t.tag).join(", ")}]`);
console.log(`  resilience score:   ${pollutedScore}  (inflated by leftover check-ins, reset & recovery)`);
assert("Without the fix, Round B's log is polluted (6 taps incl. Round A's)", pollutedLog.length === 6);
assert("Without the fix, Round B score is WRONG (81, not 70)", pollutedScore === 81, `got ${pollutedScore}`);
console.log("\n=== NEW ROUND STARTS \u2192 createRound() now calls clearRoundMetrics() ===");
clearRoundMetrics();
assert("emotion log cleared", loadEmotionLog().length === 0);
assert("check-in timestamps cleared", loadCheckInTimestamps().length === 0);
assert("pre-shot reset flag cleared", loadUsedPreShotReset() === false);
assert(
  "getCurrentRoundScore() is null on a fresh round (no emotion data)",
  getCurrentRoundScore() === null,
  `got ${getCurrentRoundScore()}`
);
assert(
  "back-9 detection sees no data (dominant = null, no Round A bleed)",
  analyzeCurrentRoundTiming()?.dominantEmotion === null,
  `got ${analyzeCurrentRoundTiming()?.dominantEmotion}`
);
console.log("\n=== ROUND B (second round, same app session) ===");
setRoundStart(0);
["Confident", "Calm"].forEach((t) => appendEmotionTap(t));
var bLog = loadEmotionLog();
var bScore = getCurrentRoundScore();
console.log(`  emotion log:        [${bLog.map((t) => t.tag).join(", ")}]`);
console.log(`  resilience score:   ${bScore}`);
assert("Round B log contains ONLY Round B's tags", JSON.stringify(bLog.map((t) => t.tag)) === JSON.stringify(["Confident", "Calm"]));
assert(
  "Round B has NO Round A bleed (no Frustrated/Tight)",
  !bLog.some((t) => ["Frustrated", "Tight"].includes(t.tag))
);
assert("Round B resilience score === 70 (correct, un-polluted)", bScore === 70, `got ${bScore}`);
console.log(`
${failures === 0 ? "ALL CHECKS PASSED \u2713" : failures + " CHECK(S) FAILED \u2717"}
`);
process.exit(failures === 0 ? 0 : 1);
