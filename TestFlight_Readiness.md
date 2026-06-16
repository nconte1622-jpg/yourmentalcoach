# TestFlight Readiness — The Caddie
*Last updated: June 16, 2026*

---

## ✅ What's Fully Done and Working

### Bug Fixes (this session)
- **`.env.production`** — `VITE_COACH_API_URL` is present and quoted correctly, pointing to the production Cloudflare Worker (`mental-coach-worker.yourmentalcoach.workers.dev`)
- **`wrangler.toml`** — All three `SUPABASE_URL` placeholders replaced with the real URL (`https://unjrvkvsrktiwuzclbnh.supabase.co`) across default, staging, and production environments
- **In-app notification alerts** — `InAppAlertBanner` component built and wired into Home screen. Reads from `getUnreadAlerts()`, shows streak-at-risk, welcome-back, and post-round nudges. Dismisses on tap with smooth animation

### Feature 1 — Swing Analysis (enhanced)
- Canvas overlay renders on top of video element using ResizeObserver sync
- User marks 4 positions (Address → Top → Impact → Follow-Through) by tapping/clicking paused video frame
- Linear regression best-fit line drawn through all marked points with dashed glow trail
- Plane angle computed and displayed (0°–90° from horizontal), with plain-English interpretation (steep/on-plane/flat)
- Undo last point supported; redo clears all marks
- Play/pause control shown when not in drawing mode
- AI prompt includes raw coordinate data + angle for targeted coaching — not fake computer vision
- Coaching response routed through the same Cloudflare Worker (which injects full player memory + profile)
- Text-only fallback path (no video) still works

### Feature 2 — Adaptive AI (playerMemory.ts)
- `playerMemory.ts` created with `updateRoundMemory()`, `buildMemoryContext()`, `buildSnapshotFromRoundData()`
- Stores up to 20 rounds; last 5 injected into every AI prompt via the `memoryContext` field
- Cross-round pattern derivation runs automatically on each `updateRoundMemory()` call — surfaces tee shot miss direction, 3-putt frequency, first-tee nerves, late-round fade, OB recovery patterns
- Snapshot saved automatically in `RoundComplete` from live round data (location, intent, cue word, highlights, Mental Handicap score)
- `mentalCoachApi.ts` combines old cue-word memory + new player history into a single `memoryContext` block — no worker changes needed
- Worker already handles `memoryContext` as a free-text section injected into system prompt
- Goal/weak-spot update API (`updatePlayerGoalsFromQuiz`) available for Master Quiz integration

### Feature 3 — Mental GPS System
- **`gpsPatternStorage.ts`** — full storage layer: per-hole `HoleShot` records (tee result, miss direction, lie, putt result, emotional tag, yardage, GPS coords), per-round `RoundPatternData`, active round tracking, completion & archiving (keeps last 30 rounds)
- **`MentalGPS.tsx`** — full GPS page at `/mental-gps`
  - Rangefinder tab: manual yardage input + device GPS (Web Geolocation `watchPosition`) + saved pin coordinates per hole + wind direction (calm/into/with/cross) + wind speed slider + club suggestion
  - Shot Logger tab: tap-to-log tee shot (5 options), putt result (5 options), emotional tag (5 options) per hole — all auto-saved to `gpsPatternStorage`
  - Hole nav (1–18) with chevron buttons
  - "Finish & Save Patterns" completes the round and archives it
- **`PatternAnalysis.tsx`** — component that derives and displays 3–5 cross-round insights (tee direction, 3-putt rate, emotional spiral, OB recovery, early-hole fairway pattern)
- **PatternAnalysis wired into RoundSummary** — shows after round save when GPS data is available
- **GPS button in Round page header** — Navigation icon opens Mental GPS mid-round
- **Updated Mental Handicap (resilienceScore.ts)** — score now factors in shot pattern data when GPS was used: focused hole bonus (+8 max), recovery bounce-back bonus (+9 max), 3-putt penalty (-8 max), OB penalty (-9 max), frustration spiral penalty (-5)
- **quickEndRound.ts updated** — pulls GPS pattern data into the resilience score calculation at round end

---

## 📱 Needs a Real Device to Test

| Item | Why it needs a device | Notes |
|---|---|---|
| GPS `watchPosition` | Web Geolocation on Capacitor iOS requires real GPS hardware | Works in Chrome mobile too, but accuracy matters on-course |
| Pin coordinate persistence | Distance-to-pin calc needs real GPS coords to verify accuracy | ~1-3 yard accuracy expected with iPhone GPS |
| `@capacitor/local-notifications` | Push/local notifications require iOS permission dialog + background delivery | Verify permission prompt fires on first launch |
| Camera roll video access | `<input type="file" accept="video/*">` on iOS needs NSPhotoLibraryUsageDescription in Info.plist | Check Info.plist has photo library permission string |
| Canvas overlay on video | Mobile Safari renders `<video>` + `<canvas>` overlay differently from desktop Chrome | Verify tap coordinates map correctly to canvas on 375px viewport |
| Haptics | `@capacitor/haptics` (or Capacitor Plugins.Haptics) — silent on web | Should fire on device |
| RevenueCat paywalls | `revenueCat.ts` is a binary file — needs real StoreKit/sandbox testing | Test Pro unlock flow |
| Splash screen timing | 1800ms duration — may feel wrong on older devices | Adjust in `SplashScreen` if needed |
| `capacitor://localhost` CORS | Worker's `ALLOWED_ORIGINS` includes `capacitor://localhost` — verify AI calls succeed on device | Test from Round page |
| Status bar overlay | `setOverlaysWebView({ overlay: false })` called on iOS boot — verify layout isn't clipped | Safe area insets also wired |

---

## 🖥 Three Terminal Commands to Run

### 1. Deploy the Cloudflare Worker (required for AI to work in production)
```bash
cd cloudflare/mental-coach-worker
npm install
npx wrangler deploy --env production
```
> **Before running:** Make sure `OPENAI_API_KEY` is set as a Wrangler secret:
> ```bash
> npx wrangler secret put OPENAI_API_KEY --env production
> ```
> Paste your OpenAI key when prompted. This is never stored in `wrangler.toml`.

### 2. Build and sync the iOS app
```bash
npm run build
npx cap sync ios
```
> This compiles the Vite bundle into `dist/`, then syncs it into the iOS Xcode project. Run this every time before building for TestFlight.

### 3. Trigger a Codemagic TestFlight build
```bash
git add -A && git commit -m "feat: swing plane overlay, player memory, mental GPS, bug fixes" && git push origin main
```
> Codemagic is configured to trigger on `main` branch pushes (see `codemagic.yaml`). The workflow `ios-testflight` will build on a cloud Mac M2, sign with your ASC key, and upload to TestFlight automatically.

---

## 🔑 API Keys / Secrets Still Missing or Needing Verification

| Secret | Where it lives | Status |
|---|---|---|
| `OPENAI_API_KEY` | Wrangler secret (not in git) | ⚠️ Must be set via `wrangler secret put` before Worker deploy |
| `CERTIFICATE_PRIVATE_KEY` | Codemagic variable group `ios-signing` | Assumed set from prior session — verify in Codemagic dashboard |
| `YMC_ASC_KEY` | Codemagic App Store Connect API key | Assumed set — verify in Codemagic → Teams → Integrations |
| RevenueCat API Key | Hardcoded in `revenueCat.ts` (binary) | ✅ Present (binary) — verify sandbox entitlement key matches App Store Connect |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env.production` | ✅ Present |
| `VITE_SUPABASE_URL` | `.env.production` | ✅ Present |
| `VITE_COACH_API_URL` | `.env.production` | ✅ Present — points to production Worker |

---

## 🐛 Remaining Known Rough Edges

### High priority (fix before TestFlight)
1. **`ios/App/App.xcworkspace` missing** — Run `npx cap sync ios` to generate it. Codemagic needs it to build.
2. **Info.plist missing `NSPhotoLibraryUsageDescription`** — Required for the swing video upload on iOS 14+. Add: `"Photo library access is needed to upload swing videos for analysis."` Check `ios/App/App/Info.plist`.
3. **Mental GPS link not in Home or BottomDock** — Currently only reachable from the Round page header. Consider adding a GPS icon to the BottomDock or a card on Home for discoverability outside of active rounds.
4. **`updatePlayerGoalsFromQuiz` not yet called from MasterQuiz** — The playerMemory module has the API; it just needs to be called in `MasterQuiz.tsx` after quiz completion to persist stated goals and weak spots into player memory.

### Medium priority (polish)
5. **SwingAnalysis canvas: `roundRect` polyfill** — `CanvasRenderingContext2D.roundRect()` is available in Safari 15.4+. Add a fallback (draw rect without rounded corners) for older devices.
6. **Mental GPS club suggestions are generic** — The club distance table uses baseline yardages. Consider adding a user-customizable carry distance profile in Account settings.
7. **PatternAnalysis shows "Log shots on 2+ rounds" even with 1 completed round** — The minimum is 2 rounds before patterns appear; add a softer message: "One more round to unlock pattern analysis."
8. **`InAppAlertBanner` not visible on non-Home pages** — Alerts only show on Home. If user opens the app directly into a Round (via deep link or resume), they'll never see the alert. Consider showing on the round pre-game screen too.
9. **Player memory `emotionalStart`/`emotionalFinish` defaults to "neutral"** — These fields should be populated from the PreGame and PostRound flows respectively. Wire `RoundContext.environment` and emotion log first/last entries.

### Low priority (post-TestFlight)
10. **Swing canvas touch coordinates on zoomed iOS viewports** — If user has text zoom enabled in Accessibility, canvas tap coordinates may offset. Test with `viewport-fit=cover`.
11. **Mental GPS GPS accuracy badge** — Show accuracy radius (from `GeolocationCoordinates.accuracy`) so user knows if GPS signal is weak.
12. **`gpsPatternStorage` doesn't auto-start a pattern round** — If the user opens MentalGPS without an active round session, a pattern round is started with a generated ID. These orphaned rounds accumulate. Add a cleanup pass in `completePatternRound`.
