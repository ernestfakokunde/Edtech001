# Phase 5 — standalone admin board

## Goal

Admins get their own view instead of one long page bolted under the student
header: a sidebar shell with **one sub-page per concern**, "Back to main app"
at the top, a promote-by-email tab, and an activity feed capped at 15 rows per
page with a type filter and an actor search.

## Routes → sections

`App.tsx` gained six `Route` values and maps each to the `section` prop that
`AdminPage` renders:

| Hash | `section` | Screen |
|---|---|---|
| `#admin` | `overview` | Metrics, quick-link cards, latest 15 signals |
| `#admin-users` | `users` | People directory (filters, suspend/restore, paging) |
| `#admin-admins` | `admins` | Make an admin (promote by email) + current admins |
| `#admin-missions` | `missions` | XP challenges (create / pause / delete) |
| `#admin-promo` | `promo` | Promo codes (create / copy / pause / delete) |
| `#admin-submissions` | `submissions` | Repository review queue |
| `#admin-activity` | `activity` | Signals — 15/page, type filter, actor search |

### Why distinct route values instead of `#admin/users`

`App` derives `route` from `hashRoute()` and only re-renders when that value
changes (`setRoute` bails out on `Object.is`). Sniffing a sub-part inside a
single `"admin"` route would therefore never re-render the sub-page. Distinct
route values reuse the existing hash mechanism untouched, and every admin route
is in `protectedRoutes` plus the non-admin redirect guard.

The main app header is hidden for all admin routes (`showHeader` excludes
`adminRoutes`), because the board has its own topbar. Non-admins are redirected
to the dashboard as before.

## Data loading

Each section fetches only its own data, on entry, via one `useEffect([section])`
plus filter-scoped effects:

* `overview` / `activity` → activity feed (+ summary on overview)
* `users` → directory + universities (departments lazy-load per university)
* `admins` → admin list (`role: "admin"`)
* `missions` / `promo` / `submissions` → their own endpoints

Search is **committed** (Enter or the Search button) rather than fired per
keystroke, so typing no longer issues a request per character.

## Activity feed

`GET /api/admin/activity` (Part 1, backend commit `f44ddb0`) hard-caps
`pageSize` at 15 — the client passes `{ page, type, search }` only. `type`
matches the audit-action prefix (`SIGNUP` / `REFERRAL` / `USER` / `MISSION` /
`PROMO` / `ADMIN`); `search` matches the actor's email or display name. A
`SIGNUP` audit event is now written during signup so new accounts show up.

## Promote by email

`POST /api/admin/users/promote` takes `{ email }`, flips `isAdmin`, writes an
`ADMIN_PROMOTED` audit event and 404s for unregistered emails. The new tab is a
single email field + "Grant admin" button, with the current admin list below it
(`getAdminUsers({ role: "admin" })`) refreshed after each promotion.

## Tailwind shell

The shell, overview, and make-admin screens are pure utilities. Two details
worth remembering:

* The sidebar is `w-240` / content `pl-240`. Under this config
  **`--spacing: 1px`, so the number *is* pixels** — `w-60` would be a 60px
  sliver, not Tailwind's usual 240px.
* Responsive collapse is desktop-first via the custom variants: the drawer is
  `max-1020:-translate-x-full` when closed and `translate-x-0` when open (the
  conditional must replace the variant class, otherwise the media-query rule
  wins over `translate-x-0` in the cascade). The hamburger is
  `hidden max-1020:grid`; content padding drops with `max-1020:pl-0`.

The People / Missions / Promo / Submissions panels keep their existing
`.admin-panel*` component classes from `App.css` (shared, already responsive,
and not admin-shell-specific) — no new rules were added to `App.css`.

## Verification

* `npm run build` (tsc -b + vite build) — clean, 1858 modules.
* Emitted CSS spot-checks: `.w-240{width:calc(var(--spacing) * 240)}`,
  `.max-1020\:-translate-x-full` inside `@media (width<=1020px)`,
  `.hover\:shadow-brand-xl:hover{--tw-shadow:0 16px 28px …#1d4ed812}`.

## Follow-ups

* The old single-page board's `Clock3`/`Sparkles` metric strip is replaced by
  Tailwind tiles; `.admin-metrics` / `.admin-board` / `.metric-icon` rules are
  now unused by `Admin.tsx` (still used by `Dashboard.tsx`) — prune them when
  Dashboard is converted.
* `ActivityEntry` filters cover the six documented action prefixes; add more
  `<option>`s if new audit families are introduced.
