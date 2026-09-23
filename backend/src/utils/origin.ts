/**
 * Origin matching for the CORS allow-list that `server.ts` builds from
 * FRONTEND_ORIGIN.
 *
 * Most entries are plain origins (`https://app.example.com`). Some hosts mint a
 * new subdomain on every deploy instead — Vercel previews look like
 * `recapp-pi-git-main-ernest.vercel.app` — which would need a new allow-list
 * entry per deploy, so an entry may also use `*` to stand in for one host label:
 * `https://recapp-pi*.vercel.app`.
 *
 * `*` compiles to `[^.]*`, so it never matches across a dot: a wildcard can only
 * widen to sibling subdomains of the host that follows it, never to a different
 * registrable domain. `https://*.vercel.app` therefore allows any single-label
 * `*.vercel.app` host, but nothing on `vercel.app.evil.test`.
 */
const REGEXP_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g

export type OriginMatcher = (origin: string) => boolean

export function compileOriginMatchers(entries: readonly string[]): OriginMatcher[] {
  return entries.map((entry) => {
    // The common case is an exact string comparison, with no regex involved.
    if (!entry.includes('*')) return (origin: string) => origin === entry
    const pattern = entry
      .split('*')
      .map((part) => part.replace(REGEXP_SPECIAL_CHARACTERS, '\\$&'))
      .join('[^.]*')
    const wildcard = new RegExp(`^${pattern}$`)
    return (origin: string) => wildcard.test(origin)
  })
}
