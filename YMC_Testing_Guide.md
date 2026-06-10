# Your Mental Coach — Real-World Testing Guide
### What to test, how to test it, what to watch for, and what can still break
*Generated after session 2 fixes — June 2026*

---

## WHERE THE APP NOW STANDS

After both sessions, 11 code-level changes have been applied:

| # | Fix | File |
|---|-----|------|
| 1 | Daily Focus rotates (30-item library, day-of-year keyed) | `Home.tsx` |
| 2 | Master Quiz CTA on Home when profile empty | `Home.tsx` |
| 3 | Insights free-tier copy honest (no false "free" unlock) | `Insights.tsx` |
| 4 | Locker Room saves real sentence from reflection | `LockerRoom.tsx` |
| 5 | RoundComplete "Go Home" button (cancels auto-redirect) | `RoundComplete.tsx` |
| 6 | Close Strong Pro gate in LRM Modal (consistent with Home) | `LRMModesModal.tsx` |
| 7 | Round.tsx wires upgrade callback to existing modal | `Round.tsx` |
| 8 | Mental Handicap tooltip (tap ℹ to explain 0–100 score) | `MentalHandicapWidget.tsx` |
| 9 | Free message limit raised: 8 → 15 per round | `useFeatureFlags.ts` |
| 10 | Onboarding → Master Quiz → Round Setup (new user flow) | `Onboarding.tsx`, `MasterQuiz.tsx` |
| 11 | Swing Breakdown: honest rename, no video-AI implication | `SwingAnalysis.tsx` |

---

## REAL-WORLD TEST PLAN

### Phase 1: First-Run Flow (Day 1 — new install)

**Goal:** Verify a brand-new user reaches their first round with a populated profile.

**Steps:**
1. Clear app storage (or use a fresh device/browser profile)
2. Sign up with a new email
3. Walk through all 4 onboarding steps — confirm progress bar advances correctly
4. Hit the final "Set Up Your Profile" button — confirm navigation goes to Master Quiz (not Round Setup directly)
5. Complete all 4 Master Quiz steps (Basics / Game / Mind / Goals)
6. Hit "Save Profile" — confirm toast fires and navigation goes to `/round-setup` (not Home)
7. Start the round — confirm the AI's first message feels personalized (should reference your handicap, biggest challenge, or goal)

**What to watch for:**
- If step 6 sends you to Home instead of Round Setup, check that `location.state` is being read correctly in `MasterQuiz.tsx` (router may strip state in certain modes)
- If the AI's first message is still generic, check that `buildSystemPrompt` in the coaching API is reading `golferProfile` from localStorage — the key must match what `saveGolferProfile` writes
- Confirm "Set Up Your Profile" CTA does NOT appear on Home after quiz is completed (requires `hasGolferProfile` state to recompute after navigation)

---

### Phase 2: Free Tier Stress Test (Day 1–3)

**Goal:** Confirm 15-message limit is respected, paywall appears gracefully, and users aren't trapped.

**Steps:**
1. As a free (non-Pro) account, start a round
2. Send 15 AI messages — count carefully
3. Verify the paywall UI appears on message 16 (not 8, not 14)
4. Verify the upgrade prompt is dismissable without ending the round
5. Confirm all non-AI features still work after hitting the wall: hole-by-hole tip buttons, check-in cues, breathing overlay, LRM modal Coach/Reset modes

**What to watch for:**
- The counter is stored in state on `Round.tsx` — if the user backgrounds the app and returns, does the count persist correctly?
- `useFeatureFlags.ts` exports `FREE_AI_MESSAGES_PER_ROUND = 15` but the counter might be compared in multiple places. Grep for `FREE_AI_MESSAGES_PER_ROUND` and `8` to make sure no hardcoded value was missed
- Check that the Pro gate on emotion taps (Quick Tap) still fires correctly — this is separate from the message limit

---

### Phase 3: Round Flow End-to-End

**Goal:** Full round from setup to completion works without navigation dead-ends.

**Steps:**
1. Start a round (any course, any holes)
2. Use Coach Mode (LRM Modal) — confirm navigation to `/round/coach`
3. Use Reset Mode — confirm navigation to `/round/reset`
4. Try Close Strong as free user — confirm upgrade modal fires (not silent fail)
5. Try Close Strong as Pro — confirm navigation to `/round/close-strong`
6. End the round via the End Round dialog
7. Confirm `MentalScoreReveal` animation plays
8. Confirm `RoundComplete` loads with the "Go Home" button visible
9. Tap "Go Home" — confirm navigation fires immediately (no waiting for auto-redirect)
10. Tap nothing — confirm auto-redirect fires after ~4.5s

**What to watch for:**
- The `dismissed` ref and timer cleanup in `RoundComplete.tsx` — if `handleGoHome` is called while the fade timer is also firing, does the user see a double-navigate? Test by tapping "Go Home" at exactly 3 seconds
- If the round has 0 emotion taps, does `MentalScoreReveal` render gracefully (no division-by-zero in mood arc)?
- `RoundComplete` summary bullets — are they populated? Or does it show empty state if post-round was skipped?

---

### Phase 4: Locker Room + Highlight Quality

**Goal:** Saved highlights are now meaningful, not throwaway.

**Steps:**
1. Enter Locker Room after a round
2. Describe a specific mental moment — e.g., "I hit a great recovery shot on 14 after a double, stayed calm and committed to the punch-out"
3. Complete the coaching exchange (2–3 turns)
4. Save the highlight
5. Open Memory Bank — find the saved highlight
6. Read the saved `mentalRule` field — it should contain a real sentence from the coaching reflection, not "Next time: commit."

**What to watch for:**
- The `extractNormalizedMemory` function selects the last sentence from the coaching reflection that starts with an actionable verb (next/for/when/before/keep/stay/use/trust/etc.). If the coach response is very short or doesn't include an actionable sentence, the fallback is `"When it matters, ${cueWord}."` — this is acceptable
- Test with a short reflection (1–2 sentences) and a long one (5+ sentences) — confirm both produce readable highlights
- Check that `cueWord` and `contextTag` are also populated (Memory Bank may display these)

---

### Phase 5: Insights Page — Free vs Pro

**Goal:** No more false promises to free users.

**Steps (free account):**
1. Open Insights
2. Find the "Pattern Intelligence" card
3. Verify it shows "Pattern Intelligence is a Pro feature" with an "Unlock Pro" button
4. Confirm the progress bar (0/3 rounds) is NOT shown to free users
5. Upgrade to Pro (test mode / sandbox)
6. Return to Insights — confirm the 3-round progress bar now appears
7. Complete 3 rounds with Post-Round reflection
8. Confirm Pattern Intelligence unlocks

**What to watch for:**
- `isPro` check in Insights must resolve before rendering — if `useProStatus` is loading, is there a flash of the "Pro upsell" copy before the Pro content appears?
- Make sure the eligibleRoundCount (rounds with post-round reflection) increments correctly — this requires `structured_round: true` to be set on round records in the DB, which only `PostRound.tsx` does

---

### Phase 6: Swing Breakdown Honesty Check

**Goal:** No user can be misled into thinking video is being AI-analyzed.

**Steps:**
1. Navigate to Swing Breakdown (from Account or wherever it's linked)
2. Read the info card — confirm it says "Describe your swing" not "We analyze your video"
3. Upload a video — confirm the video appears as a preview but no "analyzing video" language appears
4. Skip video using "Skip video — describe from memory" — confirm the form loads correctly
5. Submit an empty description — confirm the textarea gets focus and a helpful toast appears (not a generic error)
6. Fill in a description and submit — confirm "Writing your coaching…" spinner (not "Analyzing your swing…")
7. Read the result — confirm the coach references specific things from the description

**What to watch for:**
- The page title in the header should read "Swing Breakdown" — check if there's a nav link anywhere that still says "Swing Analysis" (grep `SwingAnalysis` in nav/routing files)
- The `Capacitor` import was removed in the rewrite. If the native camera path is still needed, it needs to be re-added with proper permission handling
- Test "error" status path: kill network mid-request — confirm the error card appears with "Try Again" and the user's description is preserved (it's in state, so it should be)

---

### Phase 7: Daily Focus Rotation

**Goal:** The daily focus text changes every day and is consistent for all users on the same day.

**Steps:**
1. Note today's focus text on Home
2. Change your device clock to tomorrow's date (or test in code by mocking `Date.now`)
3. Reload the app — confirm the focus text changed
4. Set the clock to 365 days in the future — confirm the text is still different (wraps around the 30-item array)
5. Confirm two different users on the same date see the same focus text (it's deterministic by day-of-year)

**What to watch for:**
- `getDailyFocusText()` calculates `dayOfYear` from `Date.now()` at module load time. If the app has been open across midnight, `TODAY_FOCUS_TEXT` will be stale (computed once). Test by opening the app at 11:59pm and checking at 12:01am — if it doesn't update, wrap `getDailyFocusText()` in a `useMemo(() => getDailyFocusText(), [])` inside the component instead of computing it as a module-level constant

---

### Phase 8: Mental Handicap Tooltip

**Goal:** Tapping ℹ reveals an explanation; tapping outside or "Got it" closes it.

**Steps:**
1. Open Home, find the Mental Handicap widget
2. Tap the ℹ icon — confirm tooltip appears
3. Read it — confirm it explains the 0–100 scale, what "Strong" vs "Building" vs "Early" means
4. Tap "Got it" — confirm tooltip closes
5. Tap the ℹ icon again, then tap outside the tooltip — confirm it closes
6. Confirm the tooltip doesn't obscure any interactive elements when open (especially on small screens)

**What to watch for:**
- The tooltip uses a fixed-position overlay div (`fixed inset-0`) to capture outside taps. On iOS Safari with momentum scrolling, this can interfere with scroll events. Test by tapping ℹ and then trying to scroll the page — the overlay should close, not prevent scrolling
- z-index conflict: the tooltip is `z-[70]`. Confirm it renders above GlassCards and below system modals

---

## WHAT CAN STILL BREAK

### High probability

**1. Stale Daily Focus across midnight**
`TODAY_FOCUS_TEXT` is computed at module load. Long-running PWA sessions won't update at midnight. Low severity (daily inconvenience), easy fix (move to useMemo inside component).

**2. Master Quiz → Round Setup navigation if router strips state**
React Router's `location.state` is cleared on hard refresh or certain native navigation patterns. If the user backgrounds the app mid-quiz and iOS kills it, they'll finish the quiz and land on Home, not Round Setup. Acceptable fallback behavior, but worth noting.

**3. Message count not persisting across app restores**
The 15-message counter lives in `Round.tsx` component state. If iOS suspends and resumes the app, does the counter reset? If yes, users effectively get unlimited messages on iOS by backgrounding and resuming. Check if the count is also stored in `useRoundSession` or localStorage.

**4. Close Strong Pro gate — "upgrade" modal fires but doesn't close the LRM modal cleanly**
`LRMModesModal` calls `onOpenChange(false)` then `onCloseStrongUpgrade?.()`. Both fire synchronously. If the upgrade modal's animation conflicts with the LRM modal's exit animation, you may see a visual flash. Test on device; fix with a small `setTimeout` on the upgrade callback if needed.

### Medium probability

**5. Pattern Intelligence counter stays at 0 for new Pro users**
New users who just upgraded haven't completed any rounds yet. The Insights page might show "Complete 3 more rounds" but the number could miscalculate (3 - 0 = 3 works, but check the pluralization logic for edge cases like "3 more rounds" vs "1 more round").

**6. Swing Breakdown: video preview URL not revoked**
`URL.createObjectURL` creates a blob URL that lives until `URL.revokeObjectURL` is called. The reset function clears `videoPreviewUrl` from state but doesn't call `revokeObjectURL`. On a session with many breakdown attempts, this leaks memory. Add cleanup: `if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)` inside `resetBreakdown`.

**7. Locker Room sentence extraction fails silently on very short coaching responses**
If the AI gives a one-word or very brief response (unlikely but possible), `extractNormalizedMemory` may fall back to `"When it matters, commit."` The highlight saves but is generic. Not a bug, just a quality degradation path.

### Lower probability

**8. MasterQuiz `heightInches` defaults to null but `parseHeight` expects a number**
The code passes `heightInches ?? 0` so this should be safe. But if `heightFeet` is null and the user entered only inches, the final `heightInches` field in the profile is 0. Profile completeness check should handle null height gracefully.

**9. Post-Round eligibility for Pattern Intelligence on the day of upgrade**
If a user completes a round *before* upgrading, the round record won't have `structured_round: true` (Post-Round was gated). When they upgrade later that day and do Post-Round on a second round, the first round still doesn't count. This could make Pattern Intelligence feel slower to unlock than expected.

---

## WHAT TO MONITOR AFTER LAUNCH

**Retention indicators to watch (day 7, day 30):**
- % of new users who complete Master Quiz during onboarding (target: >60%)
- Average AI messages sent per free round (should now be higher, closer to 10–12 with a 15 limit)
- Upgrade conversion rate from the emotion-tap Pro gate vs the message-wall gate (the tap gate is gentler and hits earlier — it likely converts better)
- Locker Room saves per user per month (now that highlights are meaningful, should see increased re-visits to Memory Bank)

**Crashes to instrument:**
- Any `navigate()` call with a stale `location.state` (add Sentry breadcrumbs to onboarding completion)
- `streamCoachResponse` abort errors (these are intentional but shouldn't surface as error toasts)
- `URL.createObjectURL` failures on older iOS Safari versions

---

## TESTING PRIORITY ORDER

1. **First-run flow** (onboarding → quiz → round) — this is the single most impactful path for new user retention
2. **Free message limit** (must be exactly 15, paywall graceful) — revenue-critical
3. **Swing Breakdown honesty** (no misleading copy remaining anywhere in the app) — trust-critical
4. **Round flow end-to-end** (no dead ends, Go Home works, LRM gates work)
5. **Daily Focus rotation** (low risk but high daily visibility)
6. Everything else
