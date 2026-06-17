# TestFlight Readiness — The Caddie
*Last updated: June 17, 2026*

---

## ✅ What's Done and Working (this session)

### Bug Fixes
- **`.env.production`** — `VITE_COACH_API_URL` restored and pointing to `mental-coach-worker.yourmentalcoach.workers.dev`. Was truncated mid-comment; now complete.
- **`wrangler.toml`** — All `SUPABASE_URL` placeholders replaced with `https://unjrvkvsrktiwuzclbnh.supabase.co` across default, staging, and production envs.
- **In-app alert system** — `InAppAlertBanner.tsx` built, wired into `Home.tsx` line 326. Reads `getUnreadAlerts()` from `notifications.ts`, shows streak-at-risk / welcome-back / post-round nudges, auto-dismisses with animation.
- **17 truncated source files restored** — `Round.tsx`, `Home.tsx`, `App.tsx`, `useAuth.ts`, `mentalCoachApi.ts`, `quickEndRound.ts`, `resilienceScore.ts`, `Login.tsx`, `SwingAnalysis.tsx`, `Scorecard.tsx`, `RoundSummary.tsx`, `ProUpgradeModal.tsx`, `analytics.ts`, `Info.plist`, `index.ts` (worker), `wrangler.toml`, `RoundComplete.tsx` were all truncated at end-of-file and have been restored from git.
- **Claude Opus worker** — `cloudflare/mental-coach-worker/src/index.ts` uses Anthropic API (`claude-opus-4-6`), transforms Anthropic SSE → OpenAI SSE format for client compatibility. System prompts follow Rotella/VISION54 golf psychology. Already deployed in previous session.
- **GPS hole emotion check-in** — `GpsHoleCheckIn` component was imported and state-wired in `Round.tsx` but never rendered. Restored from git HEAD which has the correct `<GpsHoleCheckIn holeNumber={gpsHoleNumber} visible={gpsCheckInVisible} onDismiss={handleGpsDismiss} />` JSX.

### New Features Built
| Feature | File(s) | Description |
|---|---|---|
| **Round History** | `src/pages/RoundHistory.tsx` | Browse last 30 rounds: type, course, date, status, goal, mental highlights. Grouped completed vs other. Retry on error. |
| **Round History Route** | `src/App.tsx` | `/round-history` route added, protected. |
| **Round History Link** | `src/pages/Account.tsx` | "Round History" button added between Restore Purchases and legal links, with `History` icon. |
| **App Review Prompt** | `src/lib/appReview.ts` | Fires `SKStoreReviewController.requestReview()` via `@capacitor-community/rate-app` at round 3, 10, 25. Falls back to App Store deep link URL. |
| **App Review Trigger** | `src/pages/RoundComplete.tsx` | Calls `incrementCompletedRounds()` + `maybeRequestReview()` on every `RoundComplete` mount. |
| **Notification Onboarding** | `src/pages/Onboarding.tsx` | Added 5th onboarding step. "Allow Notifications" button calls `requestNotificationPermission()`. "Skip for now" bypasses permission without blocking onboarding completion. |
| **Rate-App Package** | `package.json` | `@capacitor-community/rate-app: "^6.0.0"` added to dependencies. |

---

## 📱 Needs a Real Device to Test

| Item | Notes |
|---|---|
| AI coaching calls | Verify `capacitor://localhost` CORS against production worker. Test from Round page. |
| `@capacitor/local-notifications` | Verify permission dialog fires on fresh install (onboarding step 5). |
| App Store review prompt | `SKStoreReviewController` requires real device + App Store-signed build. iOS may throttle frequency. |
| GPS hole check-in haptic | `triggerHaptic("medium")` — silent on Simulator, verify on device. |
| GPS `watchPosition` accuracy | Real GPS hardware only. Target ~1-3 yard accuracy on-course. |
| RevenueCat IAP | Full StoreKit flow requires sandbox account. Test Pro unlock and restore. |
| Camera roll access | `<input type="file" accept="video/*">` on iOS. Verify `NSPhotoLibraryUsageDescription` prompt appears. |
| Canvas overlay on video | Mobile Safari touch coordinate mapping — verify taps land correctly on 375px viewport. |
| Status bar + safe area | `setOverlaysWebView` + safe area insets — verify no layout clipping on notched iPhones. |

---

## 🖥 Commands to Run Before TestFlight

### 1. Set Anthropic API key as Wrangler secret (required for AI)
```bash
cd cloudflare/mental-coach-worker
npx wrangler secret put ANTHROPIC_API_KEY --env production
# Paste your Anthropic API key when prompted. Never stored in wrangler.toml.
```

### 2. Deploy the Cloudflare Worker
```bash
cd cloudflare/mental-coach-worker
npm install
npx wrangler deploy --env production
```
> Worker runs `claude-opus-4-6`. Endpoint: `https://mental-coach-worker.yourmentalcoach.workers.dev/v1/mental-coach`

### 3. Sync iOS (picks up @capacitor-community/rate-app pod)
```bash
npm install
npx cap sync ios
```
> Must run after adding the new `@capacitor-community/rate-app` package so Capacitor updates `Podfile` and runs `pod install`.

### 4. Build + push to trigger Codemagic
```bash
npm run build
git add -A
git commit -m "feat: round history, app review, notification onboarding, GPS check-in fix, Claude worker, truncation fixes"
git push origin main
```
> Codemagic `ios-testflight` workflow builds on M2 Mac, signs, and uploads to TestFlight automatically.

---

## 🔑 API Keys & Secrets

| Secret | Location | Status |
|---|---|---|
| `ANTHROPIC_API_KEY` | Wrangler secret (not in git) | ⚠️ Must set via `wrangler secret put` before Worker deploy |
| `CERTIFICATE_PRIVATE_KEY` | Codemagic variable group `ios-signing` | Verify in Codemagic dashboard |
| `YMC_ASC_KEY` | Codemagic → App Store Connect API key | Verify in Codemagic → Teams → Integrations |
| RevenueCat key | `revenueCat.ts` (compiled binary) | ✅ Present — matches App ID 6759075246 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env.production` | ✅ Present |
| `VITE_SUPABASE_URL` | `.env.production` | ✅ Present |
| `VITE_COACH_API_URL` | `.env.production` | ✅ Present → production Worker URL |

---

## 🐛 Known Remaining Rough Edges

### High Priority (fix before TestFlight)
1. **`npx cap sync ios` must be run locally** — `@capacitor-community/rate-app` won't be in the iOS Pod until this runs. Codemagic runs `pod install` from the committed `Podfile`; if you commit without syncing first, the rate-app plugin is missing from the build.
2. **Cloudflare Worker `ANTHROPIC_API_KEY` must be set** — Worker will return 500 for every AI call until the secret is set via `wrangler secret put`. The AI fallback in `mentalCoachApi.ts` activates but gives generic responses.
3. **`updatePlayerGoalsFromQuiz` not wired in MasterQuiz** — `playerMemory.ts` has the API; it just needs a call in `MasterQuiz.tsx` after save. Low-risk to add post-TestFlight.

### Medium Priority (polish)
4. **`InAppAlertBanner` only on Home** — Streak and post-round alerts don't appear if user navigates directly to a round via deep link. Consider adding to Round page as a lower-z overlay.
5. **Round History count includes abandoned rounds** — The summary card shows total rounds including abandoned. Consider showing only completed, or labeling more clearly.
6. **App review fires on RoundComplete regardless of round status** — If user ends an abandoned round, `RoundComplete` still increments the counter. Consider only counting rounds with `status === "completed"` from Supabase.
7. **Onboarding progress bar shows 5 steps** — The notification step is visible in the progress bar. Some users may feel surprised by a 5-step onboarding. If needed, the notification step can be moved to a post-onboarding modal.

### Low Priority (post-TestFlight)
8. **Info.plist URL scheme is `com.nconte.yourmentalcoach`** (old name) — Deep links still work since Capacitor registers both, but updating to `com.nconte.thecaddie` would be cleaner.
9. **`emotionalStart`/`emotionalFinish` default to "neutral"** in player memory snapshots — Should be populated from PreGame and PostRound flows.
10. **SwingAnalysis `roundRect` polyfill** — `CanvasRenderingContext2D.roundRect()` not available on Safari < 15.4. Add fallback.
11. **GPS pattern orphaned rounds** — Opening MentalGPS without an active round starts a pattern round with a generated ID. These accumulate in storage. Add a cleanup pass in `completePatternRound`.

---

## ✅ Preflight Checklist

- [ ] `wrangler secret put ANTHROPIC_API_KEY --env production` — set AI key
- [ ] `npx wrangler deploy --env production` — push Claude worker live
- [ ] `npm install && npx cap sync ios` — sync rate-app pod into Xcode project
- [ ] Open Xcode → clean build folder → verify no compile errors
- [ ] `npm run build && git push origin main` — trigger Codemagic
- [ ] Verify Codemagic build passes (check Dashboard)
- [ ] Install TestFlight build on device
- [ ] Test AI coaching call from Round page (verify Claude responds)
- [ ] Complete a round → verify RoundComplete shows correctly
- [ ] Check Round History in Account → verify rounds appear
- [ ] Fresh install on second device → verify notification step in onboarding fires
- [ ] Sandbox IAP test: upgrade to Pro → verify entitlement unlocks
