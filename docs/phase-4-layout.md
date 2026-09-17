# Phase 4 — Layout.tsx conversion (Header / PageFrame / Footer)

Pure refactor: **no visual, behavioural, routing, state or data-flow change.**
One commit, no amend/squash. Branch `main`.

| | |
|---|---|
| Predecessor | `c7f1209` (Phase 3, Auth pilot) |
| Scope | `frontend/src/components/Layout.tsx` + the App.css rules only it consumed |
| App.css | 1533 → 1494 lines (−39) |
| Build | `tsc -b && vite build` ✓ — CSS 60.30 → 59.21 kB |

## 1. Ownership audit (done before any edit)

Determined by grepping every class/element the component renders across
`pages/*.tsx`, `components/*.tsx`, `App.tsx`.

### Layout.tsx-exclusive → converted and deleted from App.css

| Selector | Consumers | Now |
|---|---|---|
| `.topbar` | Layout.tsx:13 only | utilities on `<header>` |
| `.topbar nav` | Layout.tsx:20 only | utilities on `<nav>` |
| `.topbar nav button` | Layout.tsx only | `navButton` const |
| `.topbar nav button:hover`, `.topbar nav button.active` | Layout.tsx only | `hover:` variants + conditional const |
| `.menu-button` | Layout.tsx:34 only | `hidden` |
| `.page-heading` | Layout.tsx:61 only | `mb-29` |
| `.page-subtitle` | Layout.tsx:64 only | utilities on `<p>` |
| `.screen-wrap h1` | Layout `PageFrame` only | utilities on `<h1>` |
| `footer` (element) | `Layout.Footer` only | utilities on `<footer>` |
| `@media 1160 { .topbar, .topbar nav }` | — | `max-1160:` variants |
| `@media 860 { .topbar, .topbar nav button }` | — | `max-860:` variants |
| `@media 680 { .topbar, .topbar nav, .screen-wrap h1, .page-heading, footer }` | — | `max-680:` variants |

`.screen-wrap h1` needed proof, since it is a descendant selector: the only
`<h1>` rendered inside a `.screen-wrap` anywhere in the app is `PageFrame`'s
(grep: `<h1` exists in Auth:35, Dashboard:25, Home:12, Layout:63 — none of the
first three is inside `.screen-wrap`; `Generate`'s loading
`<main class="screen-wrap generate-loading">` contains no `<h1>`).

### Shared → deliberately NOT deleted

| Selector | Also consumed by |
|---|---|
| `.wordmark`, `.wordmark span` | `Auth.tsx:27` |
| `.avatar` | `Admin.tsx:81`, `Dashboard.tsx:20` |
| `.back-link` | `Auth.tsx:55` |
| `.eyebrow` | Admin, Auth, Dashboard, Generate, Home, Profile, Study |
| `.screen-wrap` | `Generate.tsx:169` |
| `main { width: 100% }` | every page (`<main>` element rule) |

The `@media 680` block keeps `.wordmark` and `.back-link` overrides for the
same reason. A file-level comment in App.css records all of this.

### Why the whole `@media 1160` block was removed

It contained exactly the two `.topbar` rules, so deleting them left an empty
block.

## 2. Decisions (the open questions from Phases 1–3)

| Question | Decision | Basis |
|---|---|---|
| Pilot / order | `Layout.tsx` (38 rules) — smallest self-contained set after Auth | Phase 1 ownership counts |
| Spacing model | `--spacing: 1px` (`py-30` = 30px) | Phase 2 decision, already in `@theme` |
| `animate-spin` | untouched | `Generate.tsx` still unconverted — don't delete a rule before its consumer is converted |
| L1461 nesting bug | preserved | Still unreachable via `:is(.ghost-button,.outline-button) .quiz-footer`; "fixing" it changes the UI |
| Structural selectors | retired **only** for the component being converted | No speculative JSX edits |
| `27px` font size | literal `max-680:text-[27px]` | Phase 2 documented it as a one-off; not tokenised |
| `#94a3b8` (footer colour) | `text-slate-icon` **token** | 20 occurrences → already a token |
| `#e2e8f0bf` (topbar border) | literal `border-[#e2e8f0bf]` | 1 occurrence → one-off, per Phase 2 policy |

### Two ordering traps that class-attribute order does NOT solve

Tailwind resolves conflicting utilities by **stylesheet order**, never by the
order they appear in `className`. Both cases below were verified in the built
CSS rather than assumed.

1. **Variant order.** The header switches height 76 → 64 → 58px at 1160/860/680.
   All three apply simultaneously below 680px, so `max-680:h-58` must be
   emitted *after* `max-860:h-64`. Verified in the output: the utilities-layer
   media blocks are emitted `1160 @57041 → 1020 @57192 → 860 @57432 → 680 @57559`
   (i.e. ascending restrictiveness, matching their `@custom-variant` declaration
   order), and all sit in `@layer utilities` — which is emitted *after*
   `@layer components`, so they beat the legacy rules they replace.
2. **`m-0 mb-8`.** The original was `margin: 0 0 8px`. Emitted positions:
   `.m-0 @51686`, `.mb-8 @51918` → `margin-bottom: 8px` wins.

### The `active` class

`.topbar nav button.active` no longer exists. The active state is applied as a
second class string (`navButtonActive`) rather than by keeping a legacy class,
so the two states are mutually exclusive instead of both being present with
stylesheet order deciding.

## 3. Declaration-by-declaration fidelity

Every declaration of every deleted rule, mapped to its replacement and confirmed
in the compiled CSS:

| Original | Replacement | Emitted |
|---|---|---|
| `position: sticky` / `top: 0` / `z-index: 30` | `sticky top-0 z-30` | `position:sticky` / `top:0` / `z-index:30` ✓ |
| `width: 100%` | `w-full` | `width:100%` ✓ |
| `height: 76px` | `h-76` | `calc(var(--spacing) * 76)` ✓ |
| `padding: 0 clamp(16px,4vw,44px)` | `px-[clamp(16px,4vw,44px)]` | `padding-inline:clamp(16px,4vw,44px)` ✓ |
| `display: flex` / `align-items: center` / `justify-content: space-between` | `flex items-center justify-between` | ✓ |
| `border-bottom: 1px solid #e2e8f0bf` | `border-b border-[#e2e8f0bf]` | `border-bottom-width:1px` + `border-color:#e2e8f0bf` ✓ |
| `background: var(--wash)` | `bg-wash` | `var(--color-wash)` = `#f8faff` = `var(--wash)` ✓ |
| `.topbar nav` gap 30 / ml auto / mr 34 | `gap-30 ml-auto mr-34` | ✓ |
| `.topbar nav button` `padding: 30px 0` | `py-30 px-0` | `padding-block` + `padding-inline:0` ✓ |
| `color: var(--muted)` / `font-size: 13px` | `text-muted text-13` | ✓ |
| `border-bottom: 2px solid transparent` | `border-b-2 border-transparent` | `border-bottom-width:2px` + `#0000` ✓ |
| `:hover`/`.active` `color: var(--ink)`, `border-color: var(--blue)` | `hover:text-ink hover:border-brand` + active const | ✓ |
| `.menu-button { display: none }` | `hidden` | `display:none` ✓ |
| `.page-heading { margin-bottom: 29px }` | `mb-29` | ✓ |
| `.page-subtitle` muted / 13px / 1.6 | `text-muted text-13 leading-160` | ✓ |
| `.screen-wrap h1 { margin: 0 0 8px; font-size: clamp(28px,3.2vw,38px) }` | `m-0 mb-8 text-[clamp(28px,3.2vw,38px)]` | `font-size:clamp(28px,3.2vw,38px)` ✓ |
| `footer` width/padding/display/justify/colour/size/border-top | `w-full pt-26 pb-35 px-[…] flex justify-between text-slate-icon text-11 border-t border-line` | ✓ |
| `@680 footer { flex-direction:column; align-items:flex-start; gap:9px }` | `max-680:flex-col max-680:items-start max-680:gap-9` | ✓ |

### Output verification

* `.topbar`, `.menu-button`, `.page-heading`, `.page-subtitle` → **0 occurrences**
  in the compiled CSS.
* `footer{` → 3 hits, all pre-existing and unrelated: `.panel-footer`,
  `.dashboard-course footer`, `.quiz-footer` (the last is inside the known
  unreachable L1461 block).
* All new utilities present, including `max-860:h-64`, `max-680:h-58`,
  `max-1160:gap-18`, `max-680:overflow-x-auto`, `max-680:text-[27px]`,
  `max-1160:px-[clamp(14px,3vw,28px)]`.
* `.badge.active` and `.generate-loader-steps span.active` are the **only**
  remaining `.active` rules — neither can match a topbar button, so dropping the
  class is safe.
* App.css braces balance: 495 open / 495 close. Shared classes still defined:
  `.wordmark` (183,191), `.avatar` (201), `.back-link` (302,456), `.eyebrow`
  (226), `.screen-wrap` (441,470).

## 4. Known, deliberate differences

1. **Touch hover.** Tailwind's `hover:` compiles inside `@media (hover:hover)`,
   so on a touch-only device a tapped nav button no longer keeps the `:hover`
   colour/underline until the next tap. This is a UA hover artifact, not a
   designed state, and it is inherent to using Tailwind's `hover:` variant.
2. **Compiled CSS size** dropped 1.09 kB purely because the legacy rules were
   replaced by utilities that were already needed elsewhere. No rule was lost.

## 5. Findings for later phases (not addressed here)

* **`.menu-button` is dead UI.** It is the component's hamburger control and was
  `display: none` at every breakpoint, with no mobile menu implementation — no
  rule anywhere reveals it. Preserved exactly as `hidden`. This is the natural
  place to hang the sidebar / mobile-nav work, and it is why the topbar degrades
  to an `overflow-x: auto` row of links below 680px.
* App.css still holds `main { width: 100% }` (element rule) plus the global
  `h1,h2,h3` and the `:root` custom properties — Phase 5 global-stylesheet
  candidates.
* `--blue/--ink/--muted/--line/--wash/--pale` still have consumers; remove them
  in Phase 5 once the last one goes.

## 6. Remaining ownership after this commit

**Converted so far: Auth.tsx (Phase 3), Layout.tsx (Phase 4).**

Remaining, by Phase 1 rule count: Study 205 · Generate 128 · Admin 105 ·
Profile 75 · Home 72 · Dashboard 70 · App.tsx 23 · 52 dead rules.

Shared / leftover classes still to retire once their **last** consumer is
converted: `.wordmark`, `.wordmark span`, `.eyebrow`, `.back-link`, `.avatar`,
`.screen-wrap`, `.primary-button` (+`:disabled`, `.full`), `.secondary-button`,
`.app-shell`, `.auth-loading`, `main`.

Next recommended target: **`Dashboard.tsx`** (70 rules, self-contained
`.dashboard-*` set, and it already shares `.avatar` with Layout so that class
can be retired once Admin is also converted).
