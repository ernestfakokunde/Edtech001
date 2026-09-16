# Phase 1 — `App.css` inventory (no code changes)

Status: **report only**. No file in the app was touched by this phase.

## 0. Preconditions

| Check | Result |
| --- | --- |
| Branch | `main` |
| HEAD | `485827b` (in sync with `origin/main`) |
| Working tree | **clean** (`git status --short` empty) |
| Build at HEAD | **passes** — `tsc -b && vite build`, 1856 modules, 1.39 s, `index.css` + `App.css` bundle = 53.97 kB |
| Tailwind | already installed (`tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3`), plugin wired in `vite.config.ts`, imported by `src/index.css` — **v4, so theme config is CSS-first (`@theme`), not `tailwind.config.js`** |
| WIP safety net | the abandoned refactor + unrelated backend work is preserved on branch `wip/pre-refactor-backup` (`d3d9a9e`) |

Scope of this document: `frontend/src/App.css` @ `485827b`.
Measured: **1658 lines, 530 leaf rules, 61 selectors declared more than once, 8 `@media` queries, 1 `@keyframes`, 6 custom properties on `:root`, 8 element-only selectors.**

## 1. ⚠️ Critical finding — one missing `}` makes 31 rules dead

`App.css` L1450–1461 opens a rule and never closes it:

```css
.ghost-button,
.outline-button {
  min-height: 36px;
  ...
  font-weight: 600;
/* ── Quiz player ─── */     <-- no closing brace
```

Everything from L1464 to L1515 — the whole first "Quiz player" / "Quiz results" / "Material actions" block, **31 rules** — is therefore *nested inside* `.ghost-button, .outline-button`. The brace that finally closes it is at L1521.

This is not theoretical: I inspected the built stylesheet (`dist/assets/index-*.css`) and Lightning CSS emitted those 31 rules with an `:is(.ghost-button, .outline-button) ` descendant prefix, e.g.

```
:is(.ghost-button,.outline-button) .quiz-footer{justify-content:space-between;...}
:is(.ghost-button,.outline-button) .result-actions{flex-wrap:wrap;gap:10px;margin-top:26px;display:flex}
:is(.ghost-button,.outline-button) .result-actions .primary-button{flex:1}
:is(.ghost-button,.outline-button) .material-actions{flex-wrap:wrap;gap:9px;display:flex}
```

No quiz/results/material DOM node has a `ghost-button`/`outline-button` **ancestor** (those classes only ever appear on `<button>`s inside `.my-paper-actions`, `.paper-actions`, `.upload-form-actions`, `.repository-paper-meta`), so **these 31 rules match nothing and render nothing**.

The block is duplicated later at L1560–1611 (at top level, correctly closed). The later copy is the one that actually renders.

### Consequence for a "no visual change" refactor

* The L1464–1515 block can be deleted safely — it is shadowed **and** unreachable.
* Eight of its declarations are **not** duplicated at top level, so they are *currently unrendered* and must stay unrendered:
  `.quiz-footer`, `.quiz-footer .skip`, `.quiz-footer .skip:hover`, `.result-actions`, `.result-actions .secondary-button/.primary-button`, `.material-actions`, and the `@media (max-width:760px)` overrides for `.choice-grid` / `.result-actions`.
* `.quiz-footer` still receives `display:flex; align-items:center` from the unrelated combined rule at L472, and `.result-actions` still receives `display:flex; align-items:center; gap:16px; margin-top:32px` from L410. **Reproducing only what renders is the requirement — "fixing" the missing brace would change the UI and is out of scope for a refactor.**

### Same-lookalike duplication (base rules, both matching)

22 selectors are declared twice as non-media rules; the later copy wins:

| Selector | first copy | second copy (renders) |
| --- | --- | --- |
| `.question-tag` | L1465 `10px`, `margin 26px 0 8px` | L1561 `11px`, inline-flex, `margin 20px 0 4px` |
| `.results-hero` | L1498 `border-radius:18px`, `padding:30px 20px`, shadow `0 18px 34px #0f172a0d` | L1601 `border-radius:20px`, `padding:38px 26px`, shadow `0 22px 40px #0f172a12` |
| `.score-ring` | L1499 **128px** / border 9px | L1602 **148px** / border 10px |
| `.score-ring strong` | L1500 `28px` | L1603 `34px` |
| `.result-stats` | L1503 `repeat(3,1fr)`, `margin:18px 0 24px` | L1606 `repeat(auto-fit,minmax(150px,1fr))`, `margin-top:18px` |
| `.result-stats > div` | L1504 `justify-items:center`, `padding:16px 10px`, radius 13px | L1607 `place-items:center`, `padding:16px`, radius 14px |
| `.result-stats strong` | L1505 `19px` | L1608 `24px` |
| `.result-stats strong.red` | L1506 `#ef4444` | L1609 `#b91c1c` |
| `.result-stats span` | L1507 `10px`, uppercase, 600 | L1610 `11px` only |

Any conversion must take the **second copy's** values.

## 2. Ownership map — which file consumes how much

Measured by matching each selector's class words against every `.tsx/.ts/.html` file under `frontend/`.

| Consumer | Selectors |
| --- | --- |
| `src/pages/Study.tsx` | 205 |
| `src/pages/Generate.tsx` | 128 |
| `src/pages/Admin.tsx` | 105 |
| `src/pages/Profile.tsx` | 75 |
| `src/pages/Home.tsx` | 72 |
| `src/pages/Dashboard.tsx` | 70 |
| `src/pages/Auth.tsx` | 55 |
| `src/components/Layout.tsx` | 38 |
| `src/App.tsx` | 23 |
| **dead (nothing consumes)** | **52** |
| element-only selectors | 8 |

By selector prefix: `admin-*` 69, misc/utility 65, `dashboard-*` 48, `repository-*` 34, `profile-*` 32, `course-*` 28, `auth-*` 27, `my-*` 16, `result*` 14, `generate*` 13, `metric-*` 12, `path-*` 10, `hero-*` 10.

### Genuinely shared primitives (must be treated as global, not per-page)

| Selector | Files |
| --- | --- |
| `.primary-button` (+`:hover`, `:disabled`) | App, Admin, Auth, Generate, Home, Profile, Study (**7**) |
| `.eyebrow` | Layout + all 7 pages (**8**) |
| `.secondary-button` | Admin, Generate, Home, Profile, Study (**5**) |
| `.field label`, `.length-control label`, `.screen-wrap > label` | Layout, Admin, Generate, Profile, Study |
| `.field` | Admin, Profile, Study |
| `.option-list`, `.course-list`, `.paper-list`, `.review-list` | Generate, Profile, Study |
| `.ghost-button`, `.outline-button` (+`:hover`, `:disabled`) | Profile, Study |
| `.screen-wrap`, `.screen-wrap h1` | Layout, Generate |
| `.back-link`, `.wordmark`, `.wordmark span` | Layout, Auth |
| `.topbar nav button` (+`.active`) | Layout + others |
| `.badge` + `.active`/`.empty`/`.rejected` | Study, Admin |
| `.avatar`, `.app-shell`, `.auth-loading`, `.topbar`, `.menu-button`, `footer` | Layout / App |

### Element-only (global) selectors

`:root` (L1), `button` (L279), `main` (L358), `h1,h2,h3` (L387), `footer` (L589), `select` (L668), `footer` (L1656, in `@media 680px`).
`body`, `a`, `*` are already reset in `index.css`, not `App.css`.

## 3. Dead rules

### 3a. Wholly dead — the class word appears nowhere outside `App.css` (52 rules)

Confirmed with an independent grep. These are leftovers from earlier layouts (the Dashboard and Profile were evidently redesigned without deleting their CSS):

* **Old "personal practice" UI** — `.personal-drop` (+`strong`, `span`, `input`), `.personal-next` (+`strong`, `span`) — L74–129
* **Old dashboard study-set rail** — `.study-set-scroll`, `.study-set`, `.study-set.navy`, `.study-set small`, `.study-set strong`, `.study-set em`, `.set-track`, `.set-track i` — L929–981
* **Old dashboard course card internals** — `.course-card-head`, `.course-card-head small`, `.dashboard-course-icon` — L1003–1017
* **Old repository feed** — `.repository-feed`, `.repository-item`, `.repository-item > span`, `> div`, `strong`, `small`, `button` — L1057–1092
* **Old profile courses panel** — `.profile-select-grid`, `.select-wrap` (+`select`, `svg`), `.profile-add-row` (+`input`), `.course-add-box` (+`h3`), `.profile-course-list` (+`span`), `.profile-manage-row` — L1129–1155, L1277
* **Admin "scaling" strip** — `.admin-scaling`, `.admin-signal-grid`, `.admin-signal`, `.admin-signal > span`, `.admin-signal strong`, `.admin-signal p` — L1220–1225
* **Misc** — `.text-link` (L444), `.confirmed` (+`svg`) (L658/665), `.course-option` (+`span`, `svg`) (L699–712), `.muted` (L1215)

`@media (max-width:760px) .profile-add-row` (L1308) is dead for the same reason.

### 3b. Effectively dead — reachable by no DOM (31 rules)

The unclosed-rule block described in §1: L1464–1515. Delete-with-care, see §1.

### 3c. Dead *declarations* inside live rules (66 of 530 rules contain ≥1 dead class)

e.g. `.panel-top, .panel-stat, .panel-footer, .quiz-meta, .quiz-footer, .paper-row, .source-paper, .course-row, .confirmed` (L472) — only the `.confirmed` member is dead, so the rule cannot be dropped wholesale; it must be split.

**Total removable: 83 rule blocks (52 + 31)**, plus member-splitting on ~14 combined rules.

## 4. Mapping to Tailwind

### 4a. Maps cleanly (≈ 80% of the file)

| CSS | Tailwind |
| --- | --- |
| `display:flex` + `align-items`/`justify-content`/`gap` | `flex items-center justify-between gap-*` |
| `display:grid` + `grid-template-columns` | `grid grid-cols-*` |
| `place-items`, `justify-items`, `align-content` | `place-items-*`, `justify-items-*`, `content-*` |
| `min-height`, `max-width`, `width` | `min-h-*`, `max-w-*`, `w-*` |
| `padding` / `margin` / `margin-inline:auto` | `p-*`, `m-*`, `mx-auto` |
| `border`, `border-radius`, `border-color` | `border`, `rounded-*`, `border-*` |
| `font-size` / `font-weight` / `line-height` | `text-*`, `font-*`, `leading-*` |
| `text-transform`, `letter-spacing`, `font-smoothing` | `uppercase`, `tracking-*`, `antialiased` |
| `transition: .18s` | `transition` |
| `overflow`, `text-overflow:ellipsis`, `white-space:nowrap` | `overflow-*`, `truncate` |
| `position:sticky; top:0; z-index` | `sticky top-0 z-*` |
| the simple `:hover` rules | `hover:*` |
| the `:disabled` rules | `disabled:*` |
| `box-shadow` (26 uses) | `shadow-*` only where the value is on Tailwind's scale; else tokens (§6) |
| 8 `@media` queries | **not** directly — see §4c |

### 4b. Does **not** map cleanly — leave as CSS (exceptions)

1. **`@keyframes spin`** (L1419) + `.spin { animation: spin 1s linear infinite }` (L1418). Tailwind's `animate-spin` is byte-compatible (1s, linear, infinite, `rotate(360deg)`) — the only safe swap candidate, but it changes the animation name, so it is an exception unless you approve.
2. **`.status-dot:before`** (L491) — generated content + a 6px dot. Pseudo-element → stays.
3. **`:focus-within`** on `.auth-input` (L221) — Tailwind v4 has the variant, but the rule is coupled to a child input; treat as structural.
4. **Off-scale `@media` breakpoints** — the file uses **680 / 760 / 860 / 1020 / 1160 px**; Tailwind's are 640/768/1024/1280/1536. Snapping to the nearest Tailwind breakpoint **would change rendering**, so they must become `--breakpoint-*` tokens or stay raw `@media`.
5. **`clamp()`** — 5 font-size clamps (`clamp(48px,6vw,78px)`, `clamp(44px,5vw,70px)`, `clamp(28px,3.2vw,38px)`, `clamp(36px,5.4vw,58px)`, …) and ~10 spacing clamps (`clamp(28px,6vw,70px)`, `clamp(16px,4vw,44px)`, …). Not stock utilities → tokens or arbitrary values.
6. **Structural / descendant selectors** that style untagged children — `.auth-aside > div > p:not(.eyebrow)`, `.auth-aside h1`, `.auth-card .back-link`, `.dashboard-course footer em:last-child`, `.repository-item > span`, `.my-paper-row .paper-info span`. Converting these needs a `className` added in JSX — a code change, not a pure style move.
7. **Attribute selectors** — `.repository-paper-card[role="button"]` / `:focus` (L1252–1253). `[role="button"]` has no Tailwind variant.
8. **Element/global rules** — `button` (L279), `main` (L358), `h1,h2,h3` (L387), `select` (L668), `footer` (L589 + L1656), `:root` custom properties (L1–8). This is the global base layer → residual stylesheet.
9. **Gradients & transforms** — `.app-shell` `radial-gradient(...)`, `.hero-panel` `linear-gradient(145deg,#173c9e,#1d4ed8 62%,#477ce0)` + `transform: rotate(2deg)`, `.progress-ring` `transform: rotate(-22deg)` with counter-rotated children (L515), `.hero-panel` partial `border-*-color` ring. Expressing these as arbitrary values is possible but unreadable and risky.
10. **Odd-but-load-bearing properties** — `scrollbar-color` (L934), `accent-color` (L239), `appearance`, and the `font:` shorthand (47 uses) which mixes family + weight + size + line-height (`font: 700 18px "Space Grotesk", sans-serif`). Only convertible if the identical computed result is preserved.
11. **Combined multi-class selectors** — e.g. the 9-member flex rule at L472, `.primary-button, .secondary-button` (L417), `.option-list, .course-list, .paper-list, .review-list` (L695). Cannot be deleted until **every** member is converted.

### 4c. Breakpoint inventory (all off-scale)

| Query | Location | What it does |
| --- | --- | --- |
| `max-width:760px` | L1289–1304, 1305–1310, 1311–1318 (+ dead L1515) | repository / admin / profile / dashboard → 1 column |
| `max-width:860px` | L1630–1637 | page padding, topbar height, `.repository-filters`, `.choice-grid` |
| `max-width:1020px` | L1618–1628 | `.hero-grid`, `.auth-shell`, `.auth-aside`, `.steps` → 1 column |
| `max-width:1160px` | L1613–1616 | topbar padding + nav gap |
| `max-width:680px` | L1639–1657 | phones: topbar 58px, headings, flashcard, answers, footer |

## 5. Repeated values → theme tokens

### 5a. Colour

`:root` already defines 6 tokens (`--blue #1d4ed8`, `--ink #0f172a`, `--muted #64748b`, `--line #e7edf6`, `--wash #f8faff`, `--pale #eff6ff`). Frequencies below are *literal* uses; the variables are used a further 100+ times.

**Free — already exactly a Tailwind default colour:**

| Value | Uses | Tailwind |
| --- | --- | --- |
| `#fff` | 60 | `white` |
| `#94a3b8` | 22 | `slate-400` |
| `#93c5fd` | 21 | `blue-300` |
| `#dbeafe` | 20 | `blue-100` |
| `#bfdbfe` | 11 | `blue-200` |
| `#b91c1c` | 9 | `red-700` |
| `#eff6ff` | 7 | `blue-50` |
| `#047857` | 6 | `emerald-700` |
| `#1d4ed8` | 5 | `blue-700` |
| `#1e3a8a` | 5 | `blue-900` |
| `#f0fdf4` | 4 | `green-50` |
| `#bbf7d0` | 3 | `green-200` |
| `#f1f5f9` | 3 | `slate-100` |
| `#334155` | 3 | `slate-700` |
| `#f8fafc` | 3 | `slate-50` |
| `#b45309` | 3 | `amber-700` |
| `#fef2f2` | 3 | `red-50` |
| `#ef4444` | 3 | `red-500` |
| `#0f172a` | 2 | `slate-900` |
| `#64748b` | 2 | `slate-500` |
| `#166534` | 2 | `green-800` |
| `#ecfdf5` | 2 | `emerald-50` |
| `#fecaca` | 2 | `red-200` |
| `#22c55e` | 2 | `green-500` |
| 1-use: `#1e40af` `#4ade80` `#cbd5e1` `#d97706` `#fef3c7` `#059669` `#0f766e` `#ccfbf1` `#2563eb` `#475569` `#fee2e2` `#16a34a` `#dc2626` `#991b1b` | 1 each | `blue-800` `green-400` `slate-300` `amber-600` `amber-100` `emerald-600` `teal-700` `teal-100` `blue-600` `slate-600` `red-100` `green-600` `red-600` `red-800` |

**Needs custom tokens (no Tailwind default):**

| Token | Value | Uses | Notes |
| --- | --- | --- | --- |
| `--line` | `#e7edf6` | 2 literal + ~40 via var | every border/divider |
| `--wash` | `#f8faff` | 1 literal + var | topbar/app background |
| — | `#f8fbff` | 12 | dashed "empty/drop" surfaces |
| — | `#f1f5fb` | 2 | `.path-section` background |
| — | `#f1f5f9` vs `#dbe5f3` | 3 / 1 | `#dbe5f3` = dashed dividers |
| — | `#eaf2ff`, `#eef2f7` | 1 each | gradients |
| — | `#173c9e`, `#477ce0` | 1 each | `.hero-panel` gradient stops |
| — | `#4b7b5a` | 1 | `.auth-success span` text |
| alpha-hex shadows/overlays | `#1d4ed8{0a,0b,12,26,2b,33,3b,3d}`, `#0f172a{0d,10,12,16,33,66}`, `#ffffff{2b,33,35}`, `#e2e8f0bf` | 18 distinct | Tailwind alpha syntax cannot express these exactly |

### 5b. Border radius

| Value | Uses | Status |
| --- | --- | --- |
| `8px` | 5 | `rounded-lg` |
| `12px` | 8 | `rounded-xl` |
| `16px` | 4 | `rounded-2xl` |
| `999px` / `99px` / `50%` | 5 / 4 / 8 | `rounded-full` |
| **`9px`** | 13 | token (most-used radius) |
| **`10px`** | 12 | token |
| **`13px`** | 7 | token |
| **`14px`** | 7 | token |
| **`11px`, `17px`** | 5 / 5 | tokens |
| **`15px`, `18px`, `20px`, `25px`** | 4 / 3 / 3 / 1 | tokens |

### 5c. Font size

On-scale: `12px`→`text-xs` (39), `14px`→`text-sm` (4), `16px`→`text-base` (3), `18px`→`text-lg` (3), `36px`→`text-4xl`, `48px`→`text-5xl`.

**Tokens needed (off-scale):** `11px` (47), `10px` (30), `13px` (19), `15px` (6), `19px` (5), `17px` (4), `21px` (4), `23px` (3), `22/24/25/27/28/31/34/35/37/38/44/58/70/78px` (1–2 each) — i.e. **the design's type scale barely overlaps Tailwind's.**
Plus 5 `clamp()` sizes that cannot be tokens and must stay arbitrary or raw.

### 5d. Spacing

Tailwind's 2px-step scale covers `4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 38, 40, 44, 56, 60, 64, 72, 76` (≈ 90% of uses). **Off-scale odd values:** `3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 35, 47, 53px` — together ~120 uses, centred on `5/7/9/11/13/15/17px`. Plus ~10 `clamp()` paddings.

### 5e. Shadow

`0 0 0 3px #dbeafe` (×7) is the app's focus ring — Tailwind's `ring-4` is 4px, so `ring-3`-equivalent needs a token. The other **15 distinct coloured shadows** (e.g. `0 22px 40px #0f172a12`, `0 18px 34px #0f172a0d`) have no Tailwind equivalent.

## 6. Decisions I need before Phase 2

1. **Breakpoints** — tokenise as `--breakpoint-*` in `@theme` (680/760/860/1020/1160) keeping exact px, or leave those 8 `@media` blocks raw in the residual stylesheet?
2. **Type/spacing/radius scale** — the design uses ~1px granularity. Do you want a full token set (`--text-10 … --text-78`, `--radius-9 … --radius-25`, `--spacing-*`) even though dozens of tokens will have 1–2 uses, or should I restrict tokens to values used ≥3× and use arbitrary values (`text-[11px]`) for the rest?
3. **`animate-spin`** — approve swapping `.spin` + `@keyframes spin` for Tailwind's built-in, or keep the custom keyframes?
4. **The unclosed brace at L1461** — confirmed intent is *preserve current rendering*, i.e. delete the 31 unreachable rules and leave `.quiz-footer` / `.result-actions` / `.material-actions` as partially-styled as they are today. Confirm you don't want me to "fix" it (that would be a visual change).
5. **Structural selectors** (§4b item 6) — may I add `className`s in the JSX to kill `.auth-aside > div > p:not(.eyebrow)` etc., or should they stay as CSS exceptions? Adding classes is a JSX edit, so I want explicit approval.
6. **Pilot choice for Phase 3** — my recommendation is `Auth.tsx` (55 selectors, self-contained `.auth-*` namespace, only shares `.primary-button`, `.wordmark`, `.back-link`, `.eyebrow`). Say the word if you'd prefer `Dashboard.tsx` (70) or `Admin.tsx` (105).