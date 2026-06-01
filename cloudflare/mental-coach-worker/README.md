# Mental Coach Worker

Cloudflare Worker endpoint for the app coach API.

## Route

- `POST /v1/mental-coach`
- Streams OpenAI chat completions (`text/event-stream`) to the client.

## Required environment variables

- `OPENAI_API_KEY` (secret)
- `SUPABASE_URL` (e.g. `https://YOUR_PROJECT.supabase.co`)
- `REQUIRE_AUTH=true`
- `SUPABASE_JWT_AUD=authenticated`
- `ALLOWED_ORIGINS` (comma-separated, include capacitor origins)
- `OPENAI_MODEL=gpt-4.1-mini`
- `LOG_REQUESTS` (`true` for staging diagnostics)

## Example `ALLOWED_ORIGINS`

`capacitor://localhost,http://localhost,https://yourmentalcoach.app`

## Deploy

```sh
cd cloudflare/mental-coach-worker
npm install
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

Staging:

```sh
npx wrangler secret put OPENAI_API_KEY --env staging
npx wrangler deploy --env staging
```

Production:

```sh
npx wrangler secret put OPENAI_API_KEY --env production
npx wrangler deploy --env production
```

After deploy, Worker URL is:

`https://<worker-name>.<account-subdomain>.workers.dev/v1/mental-coach`

## Tail logs

```sh
npx wrangler tail
```

Look for:

- `request_id=<id>`
- `model=gpt-4.1-mini`

## Staging connectivity flow

1. Start insecure for connectivity:
- `ALLOWED_ORIGINS="*"`
- `REQUIRE_AUTH="false"`
- `LOG_REQUESTS="true"`

2. Tail logs and capture the iOS origin (`origin="..."`).

3. Tighten staging:
- Set `ALLOWED_ORIGINS` to the observed origin, for example `capacitor://localhost` or `ionic://localhost`.
- Set `REQUIRE_AUTH="true"`.
