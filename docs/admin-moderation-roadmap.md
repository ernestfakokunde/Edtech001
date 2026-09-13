# Admin & Moderation System — Roadmap

> Scope for the RecappEdu admin/moderation surface. The generate flow feeds this
> pipeline: a student uploads a paper → **Generate for me** produces an AI study
> set (personal Paper) → the student can submit it to the repository
> (status `PENDING`) → moderators review via the queue below.

The moderation queue, review, and audit-logging foundations already exist
(`POST /api/papers/submission` → `PENDING`; `PATCH /api/admin/repository-submissions/:paperId`
approve/reject with `reviewNote`; `AuditEvent` rows for every action). This
document lists what's still deferred, prioritised.

## Tier 1 — High value, near-term

1. **Soft deletion** instead of permanent delete on Papers / GeneratedSets / Profiles
   (`deletedAt` + `deletedBy`, partial unique indexes on `deletedAt IS NULL`).
   Required before any bulk-moderation tooling so content can be restored.
2. **Role separation**: extend `Profile.role` enum `USER | MODERATOR | REVIEWER | ADMIN`
   (currently `isAdmin: Boolean`). Gate routes per capability: moderators can
   review papers; reviewers can edit metadata; admins do hierarchy + role admin.
   `requireAdmin` becomes `requireRole(...roles)`. Keep backward-compat until RBAC UI lands.
3. **Rate limits** (spec deferred item): per-user `/api/generation` and upload limits,
   backed by a Redis/Upstash sliding-window counter. Start with env flags
   `RATE_LIMIT_GENERATION_PER_USER` and `RATE_LIMIT_UPLOADS_PER_USER` + HTTP 429.
4. **AI usage & cost monitoring**: log provider/`model`/token estimates per generation
   (reuse `Question.metadata.provider`/`model`) into a new `UsageEvent` table, plus an
   admin endpoint `GET /api/admin/moderation/summary` (in progress) extended with
   monthly cost rollup and per-provider breakdowns.
5. **Failed-job visibility**: add `failedAt`/`failureReason` to `Paper` (and a
   `generationError` field where extraction/AI failed), expose a
   `/api/admin/jobs/failed` list so moderators can retry or contact users.

## Tier 2 — Medium value, scales the team

6. **Duplicate paper detection**: hash normalized extracted text (e.g. token n-grams)
   and store `contentHash`; flag near-dups in the review UI. Keep one, link others.
7. **Hierarchy cleanup / merge duplicates**: when merging two Departments/Courses,
   reparent children in a transaction, log to `AuditEvent`, and soft-delete the
   duplicate. UI affordance on the hierarchy admin page. Typed-course flows
   (typed uploads, AI generation, and the profile quick-add) file courses under
   an auto-created **"General"** department per faculty — include those in the
   dedupe/merge tooling. Student-saved courses live in `ProfileCourse` links and
   must be repointed (not dropped) when their course is merged.
8. **User reports & abuse history**: `/report` endpoint on papers/comments (MVP: paper),
   `Report` table (`status` REVIEWED/DISMISSED/ACTIONED), surfaced as an
   "Abuse" tab on the admin board with a per-user history view.
9. **Server-side pagination + filtering everywhere**: the repository-submissions
   queue now paginates (page/pageSize/status/search); extend the same pattern to
   `/admin/users` and `/admin/activity` (add cursor + global search).
10. **Exportable moderation reports**: CSV/JSON export of the review queue and audit
    log for a date range (reuse the paginated query + `format` query param).

## Tier 3 — Polish & observability

11. **System health metrics**: `/api/admin/moderation/summary` is the seed — grow it
    into `/health` plus a `/metrics`-style endpoint (DB latency, worker queue depth,
    provider error rates) for external monitoring.
12. **Retry-able failed-generation state** instead of immediate rollback for AI errors:
    store `Paper.status = 'ACTION_FAILED'` + `failureReason`, let the user retry the
    same paper (keep the uploaded file). Upload-extraction errors still roll back to
    avoid orphaned private papers.
13. **Sync vs queued generation**: once real AI latencies are known, move the
    extract→AI→save pipeline into a background job queue (BullMQ / Temporal) and
    return a `jobId` the client polls; keep the synchronous path as a fallback for
    fast providers.
14. **Audit-log viewer**: a dedicated admin page listing `AuditEvent`s with actor,
    entity, action, and metadata, filterable by date range and entity type.

## Notes

- `ai-multiprovider-check.ts` is **kept** (not deleted): it's a fast regression guard
  for the failover/aggregate-error logic and does not run in the production build.
  Re-run with `npx tsx src/scripts/ai-multiprovider-check.ts` after any provider change.
- The moderation queue already surfaces AI-generated sets once a student submits a
  personal paper to the repository, so the **Generate for me** flow is reviewable
  end-to-end out of the box.
