# About page — draft copy and spec

**Status:** draft for review. **Destination: `representdc-main`, not this repo.**

Decided 2026-07-27: the About page belongs at `representdc.org/about`, the org's
front door, rather than on a tool subdomain. `representdc-main` currently has no
`/about` route. This file is a **handoff artifact** — it lives here because that's
where the session ran, but the page should be built by whoever is working
`representdc-main`. Nothing in this repo needs to change.

Drafted from copy already live, so the voice matches: the "About this site" footer
block (duplicated in both repos' `Footer.jsx`) and the self-description in
`StatehoodPartnerMap.jsx`. **No new factual claims are introduced** — every number
below is wired to live data rather than written into the page.

---

## Spec

**Route:** `/about`, added to `representdc-main/src/App.jsx`.

**Nav:** the nav is already at six items plus a CTA. Recommend **footer-only**
linking rather than adding a seventh nav item — About is a destination people seek
out, not one to spend nav budget on. It's already the natural target for the
existing "About this site" footer heading, which currently links nowhere.

**Hero:** sub-page pattern per `DESIGN-GUARDRAILS.md` — eyebrow + h1 + one-line
subtitle, max 3 blocks, no CTA or stats inside the hero.

**Live numbers:** the "what we track" section should pull from the existing
`useBillStats()` hook (`stats.json` from the bill tracker API), *not* hardcode a
count. That number moved 96 → 93 → 94 in two days; hardcoding it is how the site
ends up publishing a stale figure. `useBillStats.js` also still carries a stale
hardcoded fallback of **74** — worth fixing while you're in there.

**Sources:** none needed — this page makes no external factual claims. If any are
added, use the aggregated `.sources-block` at the page bottom, not per-fact.

---

## Draft copy

> **Eyebrow:** About

> # An independent project for D.C. democracy

> RepresentDC is a volunteer-run advocacy platform built by a D.C. resident.

## Why this exists

More than 700,000 people live in Washington, D.C. — more than in Wyoming or
Vermont. They pay federal taxes, serve in the military, and sit on federal juries.
They have no voting representation in Congress, and the laws their elected Council
passes can be overturned by legislators no D.C. resident voted for.

That last part isn't theoretical. It happens continuously, in bills most people
never hear about, on subjects from criminal justice to tax policy to who gets to
name a street. RepresentDC exists to make that visible.

## What we do

RepresentDC runs three tools:

- **Bill tracker** (`billtracker.representdc.org`) — every bill and budget rider in
  Congress that interferes with D.C.'s local governance, updated daily from the
  Congress.gov API, plus the pro-D.C. bills worth supporting.
- **Candidate tracker** (`candidates.representdc.org`) — where 2026 D.C. candidates
  stand on statehood, from a direct questionnaire.
- **This site** — the case for statehood, how congressional control actually works,
  and what you can do about it.

<!-- Live from useBillStats(): -->
> We're currently tracking **{totalBills}** bills, of which **{passedBills}** have
> already cleared at least one chamber.

## How we work

**Independent and unaffiliated.** Not connected to any organization, campaign, or
party. Nobody funds this.

**Non-partisan about the principle.** Bills are classified by what they do to D.C.'s
self-governance, not by who sponsored them. Sponsors are named because that's
ordinary legislative tracking; party appears only as a neutral badge.

**Sourced, and corrected in public.** Every bill links to its record on
Congress.gov. Classification follows a published methodology, and when we get
something wrong we fix it and say so.

**Built in the open.** The tracker's methodology, classification decisions, and
their reasoning are all in the repository.

## Get in touch

Corrections and suggestions are genuinely welcome — several tracked bills came from
readers, and at least one classification changed because someone pushed back.

> [Send feedback →] (existing Google Form)

---

## Notes for whoever builds this

- Guardrails: sentence case throughout, "D.C." with periods in body copy, Lucide
  icons only, no emoji, navy workhorse / red rationed.
- The 700,000 population figure and the Wyoming/Vermont comparison already appear
  on the main site — reuse the existing sourcing rather than re-citing.
- The "at least one classification changed because someone pushed back" line refers
  to the D.C. Statehood Scorecard author correspondence. It's true; keep it only if
  you're comfortable referencing it publicly, otherwise cut the clause.
- Consider whether "Why this exists" duplicates `/the-case`. If it does, cut it
  down to two sentences and link across rather than restating the argument.
