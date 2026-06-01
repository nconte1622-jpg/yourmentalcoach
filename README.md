# Your Mental Coach

## Production AI Path

- iOS/Web client calls: `VITE_COACH_API_URL` (Cloudflare Worker `/v1/mental-coach`)
- Worker calls: OpenAI Chat Completions (streaming)
- Auth: Supabase session Bearer token sent by client, verified in Worker

## Client environment variables

Create `.env.production`:

```sh
VITE_SUPABASE_PROJECT_ID="..."
VITE_SUPABASE_PUBLISHABLE_KEY="..."
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_COACH_API_URL="https://YOUR_WORKER_SUBDOMAIN.workers.dev/v1/mental-coach"
```

Do not place `OPENAI_API_KEY` in Vite env files or Capacitor config.

## Cloudflare Worker

Worker project: [`cloudflare/mental-coach-worker`](/Users/nicoconte/Desktop/yourmentalcoach-main/cloudflare/mental-coach-worker)

Required worker vars/secrets:

- `OPENAI_API_KEY` (secret)
- `SUPABASE_URL`
- `REQUIRE_AUTH=true`
- `SUPABASE_JWT_AUD=authenticated`
- `ALLOWED_ORIGINS` (must include `capacitor://localhost` and `http://localhost`)
- `OPENAI_MODEL=gpt-4.1-mini`

## iOS build

```sh
npm run build
npx cap sync ios
```

Then open Xcode (`ios/App/App.xcworkspace`) and use Product -> Archive -> Distribute App -> App Store Connect -> Upload.

