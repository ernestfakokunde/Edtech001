# Phase 3 — Pilot conversion: `pages/Auth.tsx`

Pure refactor. No behaviour, routing, state, or data-flow change. No new
dependencies. Pilot chosen because `AuthPage` is the smallest self-contained
page with its own CSS block: 55 `.auth-*` rules + 2 media-query overrides.

## What changed

| File | Change |
|---|---|
| `frontend/src/pages/Auth.tsx` | markup now styled with Tailwind utilities + theme tokens |
| `frontend/src/App.css` | the `.auth-*` block, `.checkbox-row`, and the `button` reset deleted (−151 lines) |
| `frontend/src/index.css` | layer order declared; `button` reset moved into `@layer base` |

## Two structural changes that were required (not cosmetic)

**1. `App.css` is now wrapped in `@layer components`.**

While unlayered, every App.css rule outranked Tailwind utilities, because
unlayered CSS always beats layered CSS regardless of specificity. That made a
correct conversion impossible: `.auth-card .back-link` (specificity 0,2,0)
would have defeated a plain `mb-46` utility, so the converted markup could not
express its own 46px override.

Layer order is declared first in `index.css`:

```css
@layer theme, base, components, utilities;
```

`components` sits deliberately between `base` and `utilities`:

* **above `base`** — App.css still beats Tailwind's preflight. This matters:
  preflight sets `h1 { font-size: inherit }`, so if `components` ranked below
  `base`, every heading in the app would lose its font size.
* **below `utilities`** — a utility can override a legacy class, which is what
  lets later phases convert one component at a time without deleting anything
  early.

**2. The global `button` reset moved from `App.css` to `@layer base` in `index.css`.**

`button { border: 0; cursor: pointer; color: inherit; background: none }` sat
unlayered, so it would have neutralised `color`/`background`/`border`
utilities on every `<button>` in the converted markup. Same declarations, new
layer. Verified present exactly once in the built stylesheet.

## Cascade checks verified in the built output

* `focus-within:border-outline` → `border-color: var(--color-outline)` =
  `#93c5fd` — identical to the original `.auth-input:focus-within`.
* `focus-within:shadow-focus` → `box-shadow` composes to `0 0 0 3px #dbeafe`
  (the four extra layers are zero-size transparent placeholders) — identical
  rendering to the original.
* All `max-1020:` overrides are emitted *after* their base utilities, so the
  responsive rules win as they did before. The variant compiles to
  `@media (width<=1020px)`, which is inclusive and therefore equivalent to the
  original `@media (max-width: 1020px)`.
* Arbitrary values are emitted verbatim: `width:min(100%,410px)`,
  `padding-inline:clamp(30px,7vw,100px)`,
  `font-size:clamp(44px,5vw,70px)`.

## Fidelity audit

All 78 distinct declarations from the deleted block were checked against the
built stylesheet; **73 matched literally**. The 5 that did not are accounted
for:

| Declaration | Resolution |
|---|---|
| `padding: 36px clamp(30px, 7vw, 100px)` | split into `py-36` + `px-[clamp(...)]` (block vs inline) |
| `font: 13px Inter` | split into `font-inter font-normal text-13` |
| `display: flex !important` | `flex` — `!important` is no longer needed |
| `gap: 8px !important` | `gap-8` — `!important` is no longer needed |
| `font-weight: 400 !important` | `font-normal` — `!important` is no longer needed |

The three `!important`s existed only to beat `.auth-card label`, which no
longer applies to the checkbox row, so the overrides are unnecessary rather
than dropped.

### Two regressions found and fixed during verification

1. **Lost `:focus-within` state.** `.auth-input:focus-within` was deleted
   before its focus ring had been re-expressed, so inputs lost their blue
   border and focus ring. Fixed with
   `focus-within:border-outline focus-within:shadow-focus` on the field box.
2. **Lost inherited label styles.** `.auth-card label` gave *every* label
   `color: var(--muted)` and `font-size: 11px`; `.checkbox-row` only overrode
   display/gap/weight. The converted checkbox label initially carried neither,
   which would have rendered it at the inherited 16px/ink instead of
   11px/muted. Fixed by adding `text-muted text-11`.

No other component references any deleted class (verified across all `.tsx`).

## Design decisions applied (previously open questions)

* **Pilot:** `Auth.tsx` — smallest self-contained CSS block.
* **Spacing:** `--spacing: 1px`, so the utility number is the pixel value
  (`gap-14` = 14px, `py-36` = 36px). Required because the design uses ~1px
  granularity that Tailwind's `0.25rem` step cannot express.
* **`@keyframes spin`:** kept as CSS. Tailwind's `animate-spin` would be
  behaviourally equivalent, but `spin` is consumed by `Generate.tsx`, which is
  not converted yet, so the keyframes stay until that component is.
* **`App.css` L1461 unclosed brace:** *preserved*, not fixed. The 31 rules it
  swallows remain unreachable, exactly as before. "Fixing" it would change the
  UI and is out of scope for a refactor.
* **Structural selectors:** retired by adding explicit classes in the JSX
  where the component was being converted anyway (e.g.
  `.auth-aside > div > p:not(.eyebrow)` is now `max-w-430 text-muted text-15
  leading-170`). No structural selector was converted speculatively.

## Not converted (deliberately left as CSS)

Shared classes that other unconverted components still consume, so their rules
stay in `App.css` until those components are converted:

`.wordmark` (Header + Auth), `.wordmark span`, `.eyebrow` (Home + Auth),
`.back-link` (Study/Dashboard + Auth), `.primary-button`, `.secondary-button`,
`.primary-button:disabled`, `.full`, `.app-shell`, `.auth-loading`.

`.checkbox-row` was deleted outright rather than kept, because its rule was an
`!important` override of `.auth-card label` — a relationship that only existed
for this form. Keeping the class would have been misleading.

## Verification

* `npm run build` (`tsc -b && vite build`) passes.
* Built CSS: 58.42 kB. Exclusive `@layer components` block = 45.4 kB
  (minified App.css).
* Emitted theme variables are exactly those the converted markup uses
  (correct tree-shaking): `--color-brand`, `--color-brand-deep`,
  `--color-outline`, `--color-slate-icon`, `--color-success-*`,
  `--color-danger`, `--text-11..15`, `--leading-*`, `--radius-10/13`,
  `--spacing`.
* No `.auth-*` selector survives in the built stylesheet.
* Every residual shared class (`.eyebrow` L240, `.back-link` L483,
  `.primary-button` L427, `.full`, `.app-shell` L285) is still defined in
  `App.css` and still consumed by at least one `.tsx`.
* `box-shadow: none` was previously used by `.primary-button:disabled` and
  `.answers button:disabled`; both rules remain in App.css untouched, so
  disabled buttons are unaffected by this phase.