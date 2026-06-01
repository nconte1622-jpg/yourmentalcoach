# Shipping to TestFlight from Windows (Codemagic)

You can't build/sign an iOS app on Windows, but **Codemagic** builds it on a cloud Mac
and uploads to TestFlight for you. You trigger everything from your PC / a browser.

This repo already contains `codemagic.yaml` (the build pipeline). Follow the steps below
once; after that, every `git push` (or a button click) produces a TestFlight build.

---

## 0. What you need
- An **Apple Developer Program** account (you already have one — you shipped 1.0(4)).
- A **GitHub** account (free).
- ~20 minutes for first-time setup.

---

## 1. Put the code on GitHub
From the project folder (`...\yourmentalcoach-main copy\yourmentalcoach-main copy`):

1. Create a **new, PRIVATE** repo at https://github.com/new — name it e.g. `your-mental-coach`.
   Do **not** add a README/.gitignore (we already have them).
2. In a terminal in the project folder, run (replace `YOURNAME`):
   ```
   git remote add origin https://github.com/YOURNAME/your-mental-coach.git
   git branch -M main
   git push -u origin main
   ```
   (Git will prompt you to sign in to GitHub the first time.)

> Keep the repo **private** — `.env.production` contains your public Supabase keys.

---

## 2. Connect Codemagic
1. Sign up at https://codemagic.io using **"Sign up with GitHub"**.
2. Authorize Codemagic to access your repo (you can limit it to just this one).
3. On the Codemagic dashboard, find **your-mental-coach** → **Set up build**.
4. Choose **"Use codemagic.yaml"** (it auto-detects the file in the repo). 

---

## 3. Add your App Store Connect API key (this is what signs + uploads)
1. Go to https://appstoreconnect.apple.com → **Users and Access** → **Integrations** tab →
   **App Store Connect API** → **(+)** to generate a key.
   - Access role: **App Manager** (or Admin).
   - **Download the `.p8` file** (you can only download it once).
   - Note the **Issuer ID** (top of the page) and the **Key ID**.
2. In Codemagic: **Teams / your app → Settings → Integrations → App Store Connect → Manage keys → Add key**.
   - **Name:** `YMC_ASC_KEY`  ← must exactly match `integrations.app_store_connect` in `codemagic.yaml`.
   - Paste the Issuer ID, Key ID, and upload the `.p8`.

---

## 4. Fill in the two placeholders in `codemagic.yaml`
- `APP_STORE_APP_ID` → your app's **numeric Apple ID**. Find it in App Store Connect →
  your app → **App Information** → "Apple ID" (a ~10-digit number).
- `integrations.app_store_connect: YMC_ASC_KEY` → only change if you named the key differently in step 3.

Commit + push the edit:
```
git add codemagic.yaml
git commit -m "Configure Codemagic app id"
git push
```

---

## 5. Build
- In Codemagic, open the **ios-testflight** workflow → **Start new build** →
  pick branch `main` → **Start build**.
- First build ~10–15 min. Codemagic will: `npm ci` → `npm run build` → `npx cap sync ios`
  → sign → build IPA → upload to **TestFlight**.
- When it finishes, the build shows up in App Store Connect → TestFlight in a few minutes
  (after Apple processing).

### Automatic builds (optional)
To build on every push to `main`, add a trigger: in the workflow settings turn on
**"Trigger on push"** for branch `main` (or add a `triggering:` block to `codemagic.yaml`).

---

## Notes / gotchas
- **Signing is automatic** here (`distribution_type: app_store` + the API key). Codemagic
  creates/manages the distribution certificate and provisioning profile for you — no Mac,
  no Keychain.
- **Build numbers** auto-increment (the pipeline asks App Store Connect for the latest
  TestFlight build number and adds 1). Your **version** ("1.0") still comes from the Xcode
  project / `Info.plist` — bump it there when you want a new version.
- **SPM, not CocoaPods:** this project uses Swift Package Manager (`CapApp-SPM`), so there's
  no `pod install` step — `npx cap sync ios` handles native deps.
- **Coach Worker URL:** `.env.production` currently points at the **staging** Worker. Change
  it if TestFlight builds should use production.
