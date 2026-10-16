/**
 * A small in-memory record of the most recent generation failures.
 *
 * A failed generation used to be diagnosable only from the server logs — the
 * student sees one short, deliberately vague sentence, and the upstream reason
 * (a provider's own words about the model, the key or the reply it produced)
 * must not reach a browser. The owner still needs that reason, so the last few
 * failures are kept here and exposed on the admin-only
 * `GET /api/generation/diagnostics`, together with the live provider summary.
 *
 * Deliberately not persisted: it is a debugging aid for the current instance,
 * it never stores document text, and it is capped so a burst of failures cannot
 * grow it without bound.
 */
export type GenerationFailureRecord = {
  /** ISO timestamp of the failure. */
  at: string
  /** Short code the client received: AI_BAD_KEY · AI_BUSY · AI_FAILED · AI_NOT_CONFIGURED. */
  code: string
  /** Provider the client asked for, or null when the server picked the chain. */
  requested: string | null
  /** Number of items (and kind) that were requested, for context. */
  requestedItems: string
  /** Upstream detail (provider label, model, and what went wrong). Server-side only. */
  detail: string
}

const MAX_RECORDS = 10
const records: GenerationFailureRecord[] = []

export function recordGenerationFailure(record: Omit<GenerationFailureRecord, 'at'>) {
  records.push({ ...record, at: new Date().toISOString() })
  // Keep only the newest MAX_RECORDS entries.
  if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS)
}

/** Most recent failure first. */
export function listGenerationFailures(): GenerationFailureRecord[] {
  return [...records].reverse()
}
