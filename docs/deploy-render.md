# Deploying the backend to Render

The API is a stateless Node/Express service: Render installs dependencies, runs
`tsc`, boots `dist/server.js` and health-checks `/health`. Postgres stays on
Neon and uploads stay on Supabase, so nothing has to live on the instance's
ephemeral disk — the free plan is enough to run it.

| Setting | Value |
|---|---|
| Repository | `ernestfakokunde/Edtech001` |
| Language / runtime | `node` |
| Branch | `main` |
| Root directory | `backend` |
| Build command | `npm ci --include=dev && npx prisma generate && npm run build` |
| Start command | `npm run prisma:deploy && node dist/server.js` |
| Health check path | `/health` |
| Instance type | Free |
| Node version | `24.21.0` (`NODE_VERSION`); `package.json` also pins `>=20.0.0 <25.0.0` |

The same values live in the committed [`render.yaml`](../render.yaml) blueprint,
so the dashboard and the file never drift.

## 1. Prerequisites

Have these ready before you create the service — the deploy will not boot
without the first three:

| Need | Where to get it |
|---|---|
| `DATABASE_URL` | Neon dashboard → your project → **Connection string** (keep `sslmode=require`) |
| `SESSION_SECRET` | Nothing to fetch: the blueprint generates one. Manually, use any long random string |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project settings → API (service role key is backend-only) |
| At least one AI key | Anthropic / OpenAI / Grok / Gemini / any OpenAI-compatible endpoint |

The repo must be pushed: Render builds from GitHub, not from your machine.

## 2. Deploy

### Option A — Blueprint (uses `render.yaml`)

1. Render Dashboard → **New → Blueprint**.
2. Select the `Edtech001` repository (keep the Blueprint file path `render.yaml`).
3. Render shows the service `recappedu-api` and prompts for every `sync: false`
   variable — paste `DATABASE_URL`, the Supabase pair and the Anthropic key.
   `SESSION_SECRET` is generated automatically, and `FRONTEND_ORIGIN` +
   `COOKIE_SAME_SITE` already carry the right values in `render.yaml`.
4. **Apply** → Render builds and deploys.

### Option B — Manual web service

**New → Web Service** → same repository, then set the fields from the table at
the top of this page, add the variables from §3 under the **Environment** tab,
and hit **Create Web Service**.

## 3. Environment variables

Set in Render → service → **Environment**. `NODE_ENV=production` matters: the
session cookie is only marked `Secure` when it is set.

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` |
| `NODE_VERSION` | recommended | `24.21.0`. Render's default for new services is Node 24, which matches |
| `DATABASE_URL` | yes | Neon connection string |
| `SESSION_SECRET` | yes | `generateValue: true` in the blueprint; changing it later signs everyone out |
| `FRONTEND_ORIGIN` | yes | Exact browser origin(s) of the app, comma-separated, no trailing slash. Committed as `https://recapp-pi.vercel.app,https://recapp-pi*.vercel.app`. `*` matches a single host label, so one entry covers production plus every Vercel preview subdomain (`backend/src/utils/origin.ts`). CORS reflects only origins that match; anything else gets no `Access-Control-Allow-Origin`. Changing it needs a redeploy |
| `COOKIE_SAME_SITE` | no | `lax` (default) when the app shares this API's registrable domain, `none` when it does not. Committed as `none` because the app is on `*.vercel.app` and the API on `*.onrender.com` — see §4 |
| `SUPABASE_URL` | for uploads | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | for uploads | Never expose to the client |
| `SUPABASE_BUCKET` | no | Defaults to `recapp-paper` (the bucket the app already uses) |
| `AI_PROVIDER` / `AI_FALLBACK_PROVIDERS` | no | Defaults to `anthropic` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` / `GROK_API_KEY` / `CUSTOM_OPENAI_*` | for generation | Configure any combination; `GET /api/generation/providers` reports what is live |

`PORT` is injected by Render and read by `src/config/env.ts` — do not set it.

## 4. Point the frontend at the API

The deployed service is <https://reacappedu.onrender.com>. `frontend/.env.production`
is committed and pins `VITE_API_URL` to it, so `npm run build` output — and any
host that does not define its own value — already calls production. To target a
different deployment instead:

1. In the frontend host (Vercel/Netlify/…), set `VITE_API_URL=https://<service>.onrender.com`
   and rebuild. A real env var wins over `.env.production`, and
   `frontend/src/lib/api.ts` uses it for every call.
2. `FRONTEND_ORIGIN` already lists the deployed app in `render.yaml`
   (`https://recapp-pi.vercel.app` plus `https://recapp-pi*.vercel.app` for
   previews). Hosting somewhere else? Add that origin to the same comma-separated
   value and redeploy — CORS reflects an origin only when it is listed, and
   anything else gets no `Access-Control-Allow-Origin`, so the browser blocks it.
   A manually-created service (Option B in §2) has no blueprint to read from, so
   set the value in **Environment** there instead.

To develop locally against the deployed API rather than the local one:

```bash
VITE_PROXY_TARGET=https://reacappedu.onrender.com npm run dev --prefix frontend
# PowerShell: $env:VITE_PROXY_TARGET='https://reacappedu.onrender.com'; npm run dev --prefix frontend
```

The dev server proxies `/api` through itself, so the browser still sees
same-origin requests and the host header is rewritten for the remote target.

Then pick the cookie topology that matches where the app is hosted, because the
session and CSRF cookies are `SameSite`-scoped:

| Topology | `COOKIE_SAME_SITE` | Why |
|---|---|---|
| App and API on the same registrable domain (`app.example.com` → `api.example.com`) | `lax` (default) | Browser treats both as the same site |
| App proxies `/api` to Render (same-origin requests, like the Vite dev proxy) | `lax` (default) | No CORS, no third-party cookies — the most robust option |
| App on a different site (`*.vercel.app` → `*.onrender.com`) | `none` | `lax` cookies are stripped from cross-site fetches, so login would silently fail |

> **Current setting** — `render.yaml` sets `COOKIE_SAME_SITE=none`, because the
> app (`https://recapp-pi.vercel.app`) and this API are on different sites. A
> deployed service that still answers `Secure; SameSite=Lax` has not picked up
> the blueprint: check the **Environment** tab, then redeploy.

`none` requires HTTPS (Render always serves it) and is still subject to
browsers' third-party-cookie policies — Safari blocks third-party cookies
outright — which is why a subdomain pair or an `/api` rewrite on the frontend
host stays the safer long-term choice.

## 5. Verify the deploy

```bash
curl -i https://reacappedu.onrender.com/health      # 200 {"status":"ok","service":"recappedu-backend"}

# CSRF token + cookie must both come back, otherwise no POST can succeed
curl -i https://reacappedu.onrender.com/api/auth/csrf

# CORS + cookies: the API reflects the app's origin and the cookie is cross-site.
# Both headers must appear. If Access-Control-Allow-Origin is missing, the
# service has not picked up FRONTEND_ORIGIN (see §4) and the browser blocks every
# call; if Set-Cookie still says SameSite=Lax, COOKIE_SAME_SITE has not applied.
curl -i -H "Origin: https://recapp-pi.vercel.app" \
  https://reacappedu.onrender.com/api/auth/csrf | grep -Ei 'access-control-allow-origin|set-cookie'
# Access-Control-Allow-Origin: https://recapp-pi.vercel.app
# Set-Cookie: recappedu_csrf=…; Secure; SameSite=None
```

Then in the browser: load the frontend, sign in, and check the Network tab —
`OPTIONS`/`POST /api/auth/login` should be `200`/`201` with a
`recappedu_session` cookie set on the API host. Watch **Logs** in the dashboard
for `[request-error]`, `[auth/login]` and `[config]` lines.

## 6. Migrations and one-off tasks

* The start command runs `npm run prisma:deploy` (`prisma migrate deploy`) on
  every boot. It is idempotent: it applies only pending migrations and is a
  no-op when Neon is already current.
* If a boot fails because the database is unreachable, Render keeps the previous
  deploy serving. Fix the cause (see §8) and redeploy, or run the migrations
  yourself and switch the start command to `node dist/server.js`.
* One-off scripts run from your machine against the production database:

  ```powershell
  # from the repo root, with $env:DATABASE_URL set to the Neon URL
  npm run prisma:deploy --prefix backend          # apply migrations manually
  npm run admin:promote --prefix backend          # grant admin by email
  ```

  Render's free plan has no dashboard shell, so anything ad hoc (promoting an
  admin, backfilling a row) is done locally this way.

## 7. Free-plan behaviour

* The instance **spins down after 15 minutes without traffic**; the next request
  cold-starts it (roughly 30–60 s, plus Neon's own wake-up). Fine for staging,
  worth an `$7` instance before real users arrive.
* No dashboard shell and no `preDeployCommand` (paid only) — hence migrations in
  the start command.
* Ephemeral disk: anything written to the filesystem is lost on redeploy. The
  app already keeps files in Supabase and state in Postgres, so this is safe.

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Cannot find module './config/env.js'` at build time | `backend/src/config/env.ts` is missing from the pushed commit — it used to be git-ignored. `git log --oneline -- backend/src/config/env.ts` must show a commit on the deployed branch |
| `tsc: not found` / `prisma: command not found` during build | devDependencies were skipped. Keep `--include=dev` in the build command (setting `NODE_ENV=production` makes npm omit them by default) |
| Build succeeds, instance exits immediately | Read the logs: usually a missing `DATABASE_URL`/`SESSION_SECRET` or a failed `prisma migrate deploy` |
| `P1001` / "Can't reach database server" | Wrong connection string, Neon compute suspended (retries in `src/lib/prisma.ts` cover the wake-up), or Neon's IP allow-list blocking Render's outbound IP |
| `403 "This request could not be verified"` on every POST | The CSRF cookie is not reaching the API: `FRONTEND_ORIGIN` does not match the browser origin, or `COOKIE_SAME_SITE=lax` with a cross-site frontend |
| `No 'Access-Control-Allow-Origin' header is present on the requested resource` | The browser origin is not in `FRONTEND_ORIGIN`. It must match exactly — scheme + host + port, no trailing slash — or use a `*` wildcard for the host label (`https://recapp-pi*.vercel.app`). Check what the API really sends: `curl -i -H "Origin: https://your-app" https://reacappedu.onrender.com/api/auth/csrf`; a missing `Access-Control-Allow-Origin` in the reply means no match. Changing the value needs a redeploy |
| Everyone is signed out after a deploy | `SESSION_SECRET` changed; set it to a fixed value instead of regenerating |
| `502` on the very first request after idle | Cold start — retry once |

## 9. Security checklist

* Secrets only ever live in the Render dashboard (and your local `backend/.env`,
  which is git-ignored) — never in `render.yaml` or any committed file.
* `SESSION_SECRET` comes from `generateValue`, so it is never typed by hand or
  pasted anywhere.
* Cookies are `HttpOnly` + `Secure` in production, and CSRF is double-submit
  (`x-csrf-token` vs the `recappedu_csrf` cookie).
* `FRONTEND_ORIGIN` is an allow-list: it is the only browser origin that can
  make credentialed requests.

