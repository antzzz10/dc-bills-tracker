# Roll the RepresentDC design system out to the bill tracker

**Date:** 2026-07-26
**Status:** Decided, implemented on branch `design-system-parity` (not yet deployed)

## The decision this resolves

`representdc-main/DESIGN-GUARDRAILS.md` (§ Repo/package structure) said:

> This design pass currently covers **representdc-main only**. Rolling it out to
> dc-bills-tracker / dc-statehood-pledge is a separate future decision — don't
> assume parity until that decision is made and documented.

This note **is** that decision, for dc-bills-tracker only. `dc-statehood-pledge`
remains un-migrated and still needs its own call.

## Scope

Visual parity plus shared chrome. Page structure, section order and information
architecture are **unchanged** — representdc-main's IA was being reworked in a
parallel thread on the same day, so restructuring here would likely have needed
redoing. IA remains a separate, later decision.

Adopted:

- **Fonts** — Public Sans / Source Serif 4 / IBM Plex Mono now load. This
  supersedes the 2026-07-10 "color/token remap only" scope note that was
  recorded in this repo's `tokens.css` header. IBM Plex Mono is applied to bill
  numbers, vote counts and dates, which is the most legible signal that this is
  the same product family as the main site.
- **Icons** — added `lucide-react`; replaced ~30 emoji and unicode glyphs
  (📋 🚨 📰 ⚠ ✓ → ✕ ● etc.) that were doing icon duty across 12 files.
- **Tokens** — the 8 remaining raw-hex stylesheets converted to `var(--token)`.
  `App.css` alone held 38 raw hex values and zero tokens.
- **Chrome** — real `Nav` and `Footer` components matching main's design.
- **Voice** — sentence case on headings and labels; "D.C." with periods in body
  copy; `Represent DC` → `RepresentDC` in the footer.

## Notable choices and trade-offs

**Nav uses plain anchors, not `react-router`.** Main's `Nav.jsx` imports `Link`
from `react-router-dom`. This repo is a single-page app with no router, and
adding React Router for one component is not worth the dependency. Every nav
destination here is a cross-site absolute URL anyway. "Bill tracker" renders as
a non-link current-page marker rather than a link to itself.

**`Icon.jsx` diverges from main deliberately.** Main resolves icon names against
`import * as icons from 'lucide-react'`. That namespace import defeats
tree-shaking: measured here, it added **934 kB raw / 173 kB gzip** to the
bundle. This repo registers icons explicitly in a lookup map instead, which
costs 14.9 kB raw / 3.7 kB gzip for the 22 icons actually used. **This means
representdc-main is very likely carrying the same ~173 kB gzip of dead icon
code** — worth checking there.

**Google Fonts loads from `index.html`, not `@import` in `tokens.css`.** Main
uses `@import`, which cannot be preceded by a `preconnect` and serialises the
DNS/TLS cost behind the CSS parse. The `<link>` form here is paired with
preconnect hints. This is the one knowing divergence between the two copies of
`tokens.css`; all token *values* remain byte-identical.

**Category display names were sentence-cased in `bills.json`.** Only the `name`
field changed; `id` keys are untouched, so `scripts/lint-bills.js` (which
validates against ids) and the monitor scripts (which pass the array through)
are unaffected. Data lint and the golden-label eval pass.

## Verification

- `npm run build` — passes. JS 853.68 kB (from 838.83 kB baseline); CSS 34.29 kB
  (from 30.48 kB).
- `npm run lint` — 59 errors, **exactly** the pre-existing baseline. No new ones.
  (The baseline is not zero; see repo memory.)
- `node scripts/lint-bills.js` — passes, 132 entries against 23 golden labels.
- Playwright at 1440×900 and 390×844: zero emoji/glyphs in the rendered DOM,
  81 SVG icons drawing, nav and footer present, Public Sans resolving, no
  console errors beyond Cloudflare analytics rejecting `localhost`.

## Follow-ups

1. **`representdc-main/DESIGN-GUARDRAILS.md` § Repo/package structure needs
   updating** to record that dc-bills-tracker is now migrated. Not done here on
   purpose — that file was being actively edited by a parallel thread and a
   cross-repo write would have raced it.
2. **Check main's bundle for the same `import * as icons` problem.**
3. `dc-statehood-pledge` is still un-migrated.
4. `SupportBillsSection` uses `--support-green` as a large flooded surface. The
   token's own comment reserves it for "candidate/pledge supports-statehood
   only — never a general success state". Pre-existing, not touched in this pass,
   but it needs a ruling.
5. `bills.json` categories carry an unused `color: "#DC143C"` field — dead data.
