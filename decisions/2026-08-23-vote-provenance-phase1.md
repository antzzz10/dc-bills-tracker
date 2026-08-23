# Vote provenance, phase 1: the 15 passage vote records

**Date:** 2026-08-23
**Status:** Shipped.

## Why

Agreed 2026-08-03 as the highest-value item left in the credibility-guardrails thread
(`decisions/2026-08-03-claims-verification-gates.md`). The lint and claims gates stop the
site from *shipping* a falsehood; nothing on the page lets a reader independently check a
claim once shipped. A bill card shows "passed the House 218-206" and "this is a direct
attack on home rule" at identical visual weight — one a Congress.gov record, the other our
editorial judgment. Provenance is the only remaining piece that converts an internal check
into something a reader can verify themselves.

**Not a blanket per-field rollout.** Two constraints ruled that out (see the 2026-08-03
provenance memory): daily diff churn on `bills.json` if every field got a re-verification
stamp, and bundle size (`bills.json` is already ~8% of the gzipped bundle). Phase 1 is
scoped to the 15 vote records across 14 bills — the exact class of claim that has already
shipped wrong once (H.R. 5103's inverted, session-mismatched tally, fixed 2026-08-03), and
the one a reader can verify with a single click.

## What shipped

- `bill.passage.house` / `.senate` now carry `source` (a resolvable link to the official
  roll call record — the House Clerk or the Senate, not Congress.gov) and `verifiedOn`
  (the date it was last confirmed against that record).
- `scripts/monitor-bills.js`: `fetchRollCallVote` now constructs the source URL from the
  same chamber/year/session/roll-call-number it already resolves to fetch the tally, so
  every future auto-detected passage gets provenance for free — no separate lookup, no
  new API call.
  - House: `https://clerk.house.gov/Votes/{year}{rollCallNumber}` (no zero-padding).
  - Senate: `https://www.senate.gov/legislative/LIS/roll_call_votes/vote{congress}{session}/vote_{congress}_{session}_{rollCallNumber, 5-digit zero-padded}.htm`.
  - Both formats confirmed against live pages before shipping (not guessed from a schema).
- The existing `needsUpdate` check (which already gated writes on a real tally/date change,
  to avoid rewriting all 94 entries daily) now also fires when `source` is missing — so the
   backfill for already-recorded votes rides the very next monitor run, at no ongoing cost.
  Once `source` is set it never re-triggers on its own.
- `scripts/lint-bills.js` check 11: any `passage.house`/`.senate` record without `source` +
  `verifiedOn` is now a hard error, alongside the existing tally-plausibility checks (8).
- `PassedBillsSection.jsx`: an "Official roll call record ↗" link renders under the vote
  tally on every passed-bill card that has a `source`.

## The one bill outside the automated path

`hjres142-sjres102` carries `manualOverride: true` (set to protect a hand-corrected
disputed-status record from the routine monitor rewrite). `manualOverride` short-circuits
*before* the passage-update code runs, so this bill's two vote records (House roll 56,
Senate roll 37) were added by hand instead, after confirming each directly:

- House: govtrack.us's own indexed title matched bill, date, and roll number together
  ("H.J.Res.142 ... House Vote #56 -- Feb. 4, 2026"). Direct fetch of clerk.house.gov and
  govtrack.us both returned 403 (bot-blocked), so this one is corroborated by the search
  index rather than a page fetch — the weakest-verified record in this batch. Worth a
  manual glance at `clerk.house.gov/Votes/2026056` if anyone doubts it.
- Senate: confirmed by direct fetch of two candidate roll numbers — 00036 was the prior
  day's motion to proceed (51-46, Feb 11), 00037 was the actual passage (49-47, Feb 12).
  Exactly the kind of near-miss this whole feature exists to catch.

## What this does not do

Per the 2026-08-03 memory: provenance would **not** have blocked H.R. 5103's wrong vote —
that came from a real Congress.gov endpoint, so provenance would have faithfully recorded a
true source for a false fact. It converts silent errors into discoverable ones. The lint
gates (checks 8-10) remain the thing that prevents; this explains. It should not displace
gate work in priority.

## Not done here (future phases, unscoped)

- Phase 2: surface `reviewMethod`/`reviewedDate` (13/130 entries) — the judgment-vs-fact
  distinction, not the fact-provenance one.
- Phase 3: whether other fetched fields (cosponsor counts, committee assignments) justify
  per-field provenance. Probably not.
