# RecappEdu

Structured practice, one course at a time.

RecappEdu is a full-stack study platform for university students. Students pick
their university → faculty → department → course, upload or discover past
papers, and turn any paper into AI-generated **flashcards** or a **quiz**. The
same paper can be published to a shared repository, where an admin reviews it
before other students can find it.

A second layer sits on top of the study loop: **XP tiers** (Free / Pro),
**referrals**, claimable **missions**, redeemable **promo codes**, quiz attempt
history, and a standalone **admin board** for moderation, growth and support.

## Features

**Studying**
* Course hierarchy: university → faculty → department → course (admin-managed)
* Personal course list — save the courses you take for one-tap access
* Upload past papers (PDF / DOCX) with level, session, year and semester
* AI generation of flashcards and quizzes from an uploaded paper or typed text
* Quiz attempts are recorded so students can see and clear their history
* Dashboard opens with a **Create your first practice** panel until the first
  quiz is recorded, and the landing page carries a brand carousel
* Per-question timing metadata and provider/model provenance on generated items

**Growth**
* Account tiers: Free and Pro (`premiumUntil`)
* Referral codes — share a code, both sides see progress on the profile
* Missions — admins publish XP challenges, students claim each one once
* Promo codes — admin-issued codes granting Pro days and/or bonus XP
* XP totals with tier-vs-XP breakdown on the profile

**Repository & moderation**
* Students submit a paper to the shared repository for review
* Admin queue with approve/reject decisions plus an optional review note
* Approved papers become discoverable through repository search
* Every moderation, auth and account action writes an `AuditEvent` row

**Admin board** (standalone view, admins only)
* Sidebar shell with one sub-page per concern and a "Back to main app" exit
* Overview metrics, quick links and the latest activity
* People directory — search, role/signup filters, suspend and restore
* Promote by email — grant admin rights to an already-registered account
* Missions and promo code management
* Repository review queue
* Signals — activity feed capped at **15 events per page**, filterable by action
  family and searchable by the actor's name or email

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite 8, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), lucide-react |
| Routing | Hash-based routing in `App.tsx` — no router dependency |
| Backend | Express 5, TypeScript, Node ESM (`tsx` in dev) |
| Database | PostgreSQL (Neon) via Prisma 6 |
| File storage | Supabase Storage (service-role key stays on the backend) |
| Documents | `multer` uploads, `pdf-parse` + `mammoth` text extraction |
| AI | Provider-agnostic: Anthropic, OpenAI, Grok (xAI), Gemini, or any OpenAI-compatible endpoint |
| Auth | Session cookie + double-submit CSRF token |
| Linting | Oxlint (`frontend`), `tsc` type-checking in both builds |

## Repository layout

```
Edtech001/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # 18 models, 6 enums
│   │   └── migrations/            # 11 applied migrations
│   ├── src/
│       ├── server.ts              # Express app, CORS, CSRF, route mounting
│       ├── config/env.ts          # env loading + AI provider registry
│       ├── controllers/           # admin, auth, generatedSet, hierarchy, paper, profile
│       ├── routes/                # one router per domain
│       ├── services/              # auth.service, ai.service, aiProviders
│       ├── middleware/            # auth (requireAuth/requireAdmin), csrf, errorHandler
│       ├── lib/                    # prisma + supabase clients
│       ├── utils/                  # course helpers, text extraction, file helpers, upload limits
│       └── scripts/                # promote-admin.ts, ai-multiprovider-check.ts, upload-error-check.ts
├── frontend/
│   ├── public/
│   │   └── favicon.png             # brand mark — tab icon + apple-touch icon
│   └── src/
│       ├── assets/                 # brand artwork: logo lock-up, mark, carousel images
│       ├── App.tsx                 # route table, guards, per-route <title>
│       ├── pages/                  # Auth, Dashboard, Generate, Admin, Profile, …
│       ├── components/             # Layout (Header, PageFrame, Footer), BrandCarousel
│       ├── lib/api.ts              # typed API client + CSRF handling
│       ├── lib/ui.ts               # shared UI helpers
│       ├── types.ts                # Route union and shared view types
│       ├── index.css               # Tailwind v4 @theme tokens + custom variants
│       └── App.css                 # residual component classes (being retired)
└── docs/                           # phase reports and the moderation roadmap
```

## Getting started

### Prerequisites

* Node.js 20+
* A PostgreSQL database (a Neon connection string works as-is)
* A Supabase project with a storage bucket (for paper uploads)
* At least one AI provider API key (Anthropic, OpenAI, Grok, Gemini, or an
  OpenAI-compatible endpoint)

### 1. Install dependencies

```bash
npm install                 # root (shared lucide-react)
npm install --prefix backend
npm install --prefix frontend
```

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Fill in `backend/.env`:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SESSION_SECRET` | yes | Long random value used to sign session cookies |
| `PORT` | no | Defaults to `4000` |
| `FRONTEND_ORIGIN` | no | Defaults to `http://localhost:5173`; accepts a comma-separated list, and `*` matches one host label (`https://recapp-pi*.vercel.app` covers previews). localhost and 127.0.0.1:5173 are always allowed |
| `COOKIE_SAME_SITE` | no | `lax` (default) or `none` for a frontend hosted on a different site — the deployed service runs with `none` |
| `SUPABASE_URL` | for uploads | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | for uploads | Backend only — never expose to the client |
| `SUPABASE_BUCKET` | no | Defaults to `recappedu-papers` (code) / `recapp-paper` (example file) |
| `AI_PROVIDER` | no | Primary provider: `anthropic` (default), `openai`, `grok`, `groq`, `gemini`, `custom` |
| `AI_FALLBACK_PROVIDERS` | no | Comma-separated providers tried in order, e.g. `openai,groq` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | no | Default model `claude-sonnet-4-5` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_BASE_URL` | no | Default model `gpt-4o` |
| `GROK_API_KEY` / `GROK_MODEL` / `GROK_BASE_URL` | no | Default model `grok-3` — xAI only, never a `gsk_` key |
| `GROQ_API_KEY` / `GROQ_MODEL` / `GROQ_BASE_URL` | no | Default model `llama-3.3-70b-versatile`, default base `https://api.groq.com/openai/v1` — no base URL needed |
| `GEMINI_API_KEY` / `GEMINI_MODEL` / `GEMINI_FALLBACK_MODELS` | no | Default model `gemini-2.5-flash` |
| `CUSTOM_OPENAI_PROVIDER_NAME` / `CUSTOM_OPENAI_BASE_URL` / `CUSTOM_OPENAI_API_KEY` / `CUSTOM_OPENAI_MODEL` | no | Any other OpenAI-compatible endpoint (DeepSeek, Mistral, OpenRouter, Ollama, …) |

Generation is provider-agnostic: configure **any combination** of the keys
above. `AI_PROVIDER` is the primary, `AI_FALLBACK_PROVIDERS` are tried in order
when it fails, and a request may override the choice per call —
`GET /api/generation/providers` lists what is currently configured.

### 3. Prepare the database

```bash
npm run prisma:migrate --prefix backend    # apply the 11 migrations
npm run prisma:generate --prefix backend   # regenerate the Prisma client
```

### 4. Run both servers

```bash
npm run dev --prefix backend     # API on http://localhost:4000
npm run dev --prefix frontend    # app on http://localhost:5173
```

The frontend reads `VITE_API_URL` from the build environment and falls back to
`http://localhost:4000`; the committed `frontend/.env.production` pins production
builds to `https://reacappedu.onrender.com`. `GET /health` returns
`{ "status": "ok" }`.

## Scripts

**Backend**

| Script | Purpose |
|---|---|
| `dev` | `tsx watch src/server.ts` — hot-reloading API |
| `build` / `start` | Compile to `dist/`, run `node dist/server.js` |
| `prisma:migrate` | `prisma migrate dev` |
| `prisma:deploy` | `prisma migrate deploy` — apply pending migrations (production) |
| `prisma:generate` | `prisma generate` |
| `prisma:validate` / `prisma:format` | Schema validation and formatting |

**Frontend**

| Script | Purpose |
|---|---|
| `dev` | Vite dev server with HMR |
| `build` | `tsc -b && vite build` — type-check, then bundle |
| `preview` | Serve the production build locally |
| `lint` | Oxlint |
 

| Method | Path | Purpose |
|---|---|---|
| GET | `/users` | Directory with search, role, recency and hierarchy filters |
| **POST** | **`/users/promote`** | **Grant admin by email (404 if unregistered)** |
| PATCH | `/users/:userId/suspend` · `/unsuspend` | Suspension lifecycle |
| GET/PATCH | `/repository-submissions` · `/:paperId` | Review queue and decisions |
| GET | `/moderation/summary` | Counts for the overview tiles |
| GET | `/activity` | Audit feed — `page`, `type`, `search`; `pageSize` capped at 15 |
| GET | `/hierarchy-activity` | Hierarchy-specific audit events |
| GET/POST | `/missions` · PATCH/DELETE `/missions/:missionId` | XP challenges |
| GET/POST | `/promo-codes` · PATCH/DELETE `/promo-codes/:codeId` | Promo codes |

## Deploying

The backend ships as a Render web service (free plan): Render installs
dependencies, runs `tsc`, boots `dist/server.js` and health-checks `/health`.
Postgres stays on Neon and uploads stay on Supabase, so the instance is
stateless.

```bash
# Blueprint at the repo root — Render Dashboard → New → Blueprint
render.yaml          # rootDir: backend, build + start commands, env vars
```

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Build command | `npm ci --include=dev && npx prisma generate && npm run build` |
| Start command | `npm run prisma:deploy && node dist/server.js` |
| Health check path | `/health` |
| Node version | `24.21.0` (`NODE_VERSION`), `engines` pins `>=20.0.0 <25.0.0` |

**Live now** — <https://reacappedu.onrender.com> (`/health` →
`{"status":"ok","service":"recappedu-backend"}`).

`FRONTEND_ORIGIN` is the app's origin allow-list and `COOKIE_SAME_SITE` its cookie
policy; both are committed in [`render.yaml`](render.yaml) — the deployed frontend
is <https://recapp-pi.vercel.app>, and `https://recapp-pi*.vercel.app` additionally
covers every Vercel preview subdomain. Because app and API sit on different sites,
the service runs with `COOKIE_SAME_SITE=none`; with `lax` the browser would drop
the session and CSRF cookies and sign-in would silently fail. The frontend needs
`VITE_API_URL` pointing at the service — `frontend/.env.production` already sets
it to <https://reacappedu.onrender.com>, so any production build talks to that
API without host configuration.

The full walkthrough — variables, verification, migrations, free-plan behaviour
and troubleshooting — is in [docs/deploy-render.md](docs/deploy-render.md).

## Security model

* **Sessions** — `SESSION_SECRET` signs an HTTP-only cookie; `requireAuth` loads
  the profile and `requireAdmin` gates every `/api/admin` route.
* **CSRF** — double-submit. The client fetches `GET /api/auth/csrf`, caches the
  token and sends it as `x-csrf-token` on every non-GET request; the middleware
  compares it against the `recappedu_csrf` cookie.
* **Suspension** — a profile with a future `suspendedUntil` cannot sign in.
* **Storage** — Supabase service-role credentials live only in the backend;
  downloads are handed out as signed URLs that expire after 10 minutes.
* **Auditing** — auth, profile, hierarchy, admin, mission and promo actions
  write `AuditEvent` rows, which is what the Signals feed reads.

## Styling with Tailwind v4

Tokens are CSS-first in `src/index.css` (`@theme` — there is no
`tailwind.config.js`): `--spacing: 1px` makes `p-9` mean 9px, and the colour,
type-scale and radius tokens mirror the values the original stylesheet used.
`src/App.css` is the older sheet, wrapped in `@layer components` so utilities can
override it; its rules are retired page by page as each page is converted (see
[docs/phase-3-auth-pilot.md](docs/phase-3-auth-pilot.md) and
[docs/phase-4-layout.md](docs/phase-4-layout.md)). Converted components use
utilities; `BrandCarousel` and the dashboard first-practice banner keep their
rules in `App.css` because they sit beside pages that have not been converted.

### Brand assets

| File | Role |
| --- | --- |
| `src/assets/recapplogo.png` | Source artwork as supplied (white background, mark + wordmark) |
| `src/assets/recapp-logo.png` | Background keyed out — the header, sidebar, mobile bar and auth panel render this |
| `src/assets/recapp-mark.png` | Mark alone, square — for tight spots |
| `public/favicon.png` | The mark on a transparent square: browser tab and apple-touch icon |
| `src/assets/brand1.png`, `brand2.png` | Landing-page carousel imagery |

Only `recapplogo.png` is hand-supplied; the three derived files remove the white
background with a flood fill seeded from the image border, so the white bolt
*inside* the navy tile survives. Re-run that derivation when the artwork changes.
`.brand-logo` sizes the lock-up by height (38px in the header and auth panel,
30px on phones) and lets the width follow from the image, so a replacement must
keep the same proportions (~3.05:1).
 