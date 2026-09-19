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
│       ├── middleware/            # auth (requireAuth/requireAdmin), csrf
│       ├── lib/                    # prisma + supabase clients
│       ├── utils/                  # course helpers, text extraction, file helpers
│       └── scripts/                # promote-admin.ts, ai-multiprovider-check.ts
├── frontend/
│   └── src/
│       ├── App.tsx                 # route table, guards, header/footer wiring
│       ├── pages/                  # Auth, Dashboard, Generate, Admin, Profile, …
│       ├── components/             # Layout (Header, PageFrame, Footer)
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
| `FRONTEND_ORIGIN` | no | Defaults to `http://localhost:5173`; localhost and 127.0.0.1:5173 are always allowed |
| `SUPABASE_URL` | for uploads | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | for uploads | Backend only — never expose to the client |
| `SUPABASE_BUCKET` | no | Defaults to `recappedu-papers` (code) / `recapp-paper` (example file) |
| `AI_PROVIDER` | no | Primary provider: `anthropic` (default), `openai`, `grok`, `gemini`, `custom` |
| `AI_FALLBACK_PROVIDERS` | no | Comma-separated providers tried in order, e.g. `openai,gemini` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | no | Default model `claude-sonnet-4-5` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_BASE_URL` | no | Default model `gpt-4o` |
| `GROK_API_KEY` / `GROK_MODEL` / `GROK_BASE_URL` | no | Default model `grok-3` |
| `GEMINI_API_KEY` / `GEMINI_MODEL` / `GEMINI_FALLBACK_MODELS` | no | Default model `gemini-2.5-flash` |
| `CUSTOM_OPENAI_PROVIDER_NAME` / `CUSTOM_OPENAI_BASE_URL` / `CUSTOM_OPENAI_API_KEY` / `CUSTOM_OPENAI_MODEL` | no | Any OpenAI-compatible endpoint (DeepSeek, Mistral, OpenRouter, Ollama, …) |

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

The frontend calls `VITE_API_URL` when set and otherwise defaults to
`http://localhost:4000`. `GET /health` returns `{ "status": "ok" }`.

## Scripts

**Backend**

| Script | Purpose |
|---|---|
| `dev` | `tsx watch src/server.ts` — hot-reloading API |
| `build` / `start` | Compile to `dist/`, run `node dist/server.js` |
| `prisma:migrate` | `prisma migrate dev` |
| `prisma:generate` | `prisma generate` |
| `prisma:validate` / `prisma:format` | Schema validation and formatting |
| `admin:promote` | Grant admin by email: `npm run admin:promote -- user@example.com` |

**Frontend**

| Script | Purpose |
|---|---|
| `dev` | Vite dev server with HMR |
| `build` | `tsc -b && vite build` — type-check, then bundle |
| `preview` | Serve the production build locally |
| `lint` | Oxlint |

## Admin access

Two ways into the board:

1. **In-app (recommended)** — an existing admin opens **Admin board → Make an
   admin**, enters the other person's registered email and grants access.
   `POST /api/admin/users/promote` flips `isAdmin` and writes an
   `ADMIN_PROMOTED` audit event; it 404s for emails that never signed up.
2. **CLI bootstrap** — for the very first admin, when nobody has the flag yet:
   `npm run admin:promote -- user@example.com`.

`recappadmin@edu.com` (`RECAPP_ADMIN_EMAIL` in
`backend/src/services/auth.service.ts`) is re-asserted as an admin on every
server start, so a dropped flag or partial migration self-heals.

## API surface

All routes are JSON; uploads are `multipart/form-data`. Unless noted, routes
require a session.

**Auth — `/api/auth`**

| Method | Path | Purpose |
|---|---|---|
| GET | `/csrf` | Issue a CSRF token (also plants the matching cookie) |
| POST | `/signup` | Create an account, writes a `SIGNUP` audit event |
| POST | `/login` / `/logout` | Session lifecycle |
| GET | `/me` | Current profile (`requireAuth`) |

**Profile — `/api/profile`**

| Method | Path | Purpose |
|---|---|---|
| PATCH | `/` | Update display name / username |
| DELETE | `/` | Delete the account (typed confirmation) |
| PUT | `/school` | Save university + faculty (resolve-or-create) |
| GET/POST | `/courses` | List / add saved courses |
| DELETE | `/courses/:courseId` | Remove a saved course |
| GET | `/missions` · POST `/missions/:missionId/claim` | Claim XP missions |
| GET | `/xp` | XP total and tier |
| GET | `/referral` | Referral code, invites, tier |
| POST | `/redeem` | Redeem a promo code |

**Hierarchy — `/api/hierarchy`** (all `requireAuth`)
`universities`, `universities/:universityId/faculties`,
`faculties/:facultyId/departments`, `departments/:departmentId/courses` — each
with GET (list) and POST (create), plus PATCH/DELETE on the `:id` routes.

**Papers — `/api/papers`**
`POST /` upload · `GET /mine` · `GET /repository` · `GET /repository/:paperId` ·
`PATCH /:paperId/submit` · `PATCH /:paperId` · `DELETE /:paperId` ·
`GET /:paperId/download`

**Generation — `/api/generation`**
`POST /` generate flashcards or a quiz · `GET /providers` · `GET /quota` ·
`GET|DELETE /attempts` · `POST /:setId/attempts` · `DELETE /attempts/:attemptId`

**Admin — `/api/admin`** (`requireAuth` + `requireAdmin`)

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

The frontend uses Tailwind's CSS-first configuration. Tokens live in `@theme`
in `src/index.css`; there is no `tailwind.config.js`.

Two conventions matter when adding UI:

* **`--spacing: 1px`, so the number *is* the pixel value** — `gap-14` is 14px,
  `py-30` is 30px, and a sidebar is `w-240` (240px) — *not* `w-60`, which
  would be 60px here.
* **Custom breakpoint variants are desktop-first max-width queries** —
  `max-1160:`, `max-1020:`, `max-860:`, `max-760:`, `max-680:` emit
  `@media (width <= Npx)`. When a variant class and a base class set the same
  property, replace the variant rather than layering it (the media query wins).

Phases 3–5 migrated Auth, Layout and the admin board to utilities with tokens.
`src/App.css` still holds component classes shared by pages that have not been
converted yet (Dashboard, Generate, Study, History, …) and is being retired
file by file.

## Data model

18 Prisma models: `Profile`, `Session`, `University`, `Faculty`, `Department`,
`Course`, `ProfileCourse`, `Paper`, `Question`, `GeneratedSet`,
`GeneratedSetItem`, `QuizAttempt`, `AuditEvent`, `Mission`,
`UserClaimedMission`, `studySet`, `PromoCode`, `CodeRedemption` — plus enums
`PaperVisibility`, `PaperStatus`, `Semester`, `GeneratedSetType`, `AccountTier`,
`ReviewDecision`.

Notable relations: tiers and referral state live on `Profile`
(`tier`, `xp`, `referralCode`, `referredById`, `premiumUntil`); `Paper` carries
discovery metadata (level, session, year, semester) and a review `status`;
`CodeRedemption` enforces one redemption per student per code.

## Docs

| Document | Contents |
|---|---|
| `docs/admin-moderation-roadmap.md` | Planned moderation and admin work |
| `docs/phase-1-css-inventory.md` | Full CSS inventory + ownership map before the Tailwind refactor |
| `docs/phase-3-auth-pilot.md` | Auth page conversion and token decisions |
| `docs/phase-4-layout.md` | Header / PageFrame / Footer conversion |
| `docs/phase-5-admin-board.md` | Standalone admin board, routes, capped activity feed |

## Notes

* Routing is hash-based (`#admin-users`, `#generate`, …) so the SPA needs no
  server rewrite rules.
* The admin activity feed is hard-capped at 15 rows per page server-side; the
  client cannot raise it.
* `npm run build` in `frontend/` type-checks as part of the build, so a green
  build means both `tsc -b` and `vite build` passed.