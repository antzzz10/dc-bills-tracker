# Verify published claims, not just data shape

**Date:** 2026-08-03
**Status:** Decided and applied. Both gates run in CI before commit and deploy.

## The problem

Six separate instances of the site publishing something untrue surfaced in one week:

| What was published | Root shape |
|---|---|
| "H.R. 5103 passed the House 211-215" — another bill's *failed* vote | derived, unvalidated |
| "3 bills scheduled for floor vote" — two had passed, one was law | hand-set, never expired |
| Count said 93 while representdc-main published 96 | two derivations drifted |
| Header showed *build* date labelled "last checked" | wrong source for a claim |
| Frozen UrgentAlert under a "NEW" badge | hand-set, never expired |
| H.R. 51 cosponsors 207 vs 208 (support bills never scanned) | silent staleness |

**Every one of them was well-formed data.** `highlight: "floor-vote"` is a valid string on a
real bill. `211` and `215` are valid integers. Schema validation cannot see any of it —
which is why `lint-bills.js` passed clean through all six.

The unifying defect: **a claim gets published without either a derivation or an expiry.**

## Decision

Two gates, both offline, both blocking commit and deploy in `monitor-bills.yml` and
`discover-bills.yml`.

### 1. Hand-set urgency claims must expire and must not contradict derived state

`lint-bills.js` checks 9 and 10:

- `highlight: "floor-vote"` is an error when `status.stage` is set. A bill that has already
  advanced cannot be awaiting a vote.
- Any `highlight` requires a `highlightSetOn` date and fails past a **30-day TTL**.

Two rules because either alone leaves a hole. The stage check catches a flag the data has
outrun; the date check catches one on a bill that never moved, where no derived field would
ever contradict it.

This is the same fix already applied to `UrgentAlert` (`PUBLISHED_AT` + 7-day life,
2026-07-25). The rule is now general: **an urgency claim without an expiry is a bug.**

The three stale flags were cleared from `bills.json`. They were driving both the top banner
and a pulsing "FLOOR VOTE" badge with red card styling on H.R. 5107, H.R. 5214, and
H.J.Res.142 — the last of which has been law since 2026-02-22. Reconstructing the banner's
precedence against historical dates, that false claim had been the first sentence on the
page **continuously for 53 days**, and intermittently since May.

### 2. A published-claims check

`scripts/check-published-claims.js` renders the sentences the page will actually show and
asserts each against `bills.json`. It imports the same pure modules the components render
from — `updateBannerMessage.js` and `pageSummaryFacts.js` — so there is no duplicated logic
to drift. `PageSummary`'s figures were extracted into `pageSummaryFacts.js` specifically so
this could read them without a DOM.

It asserts that:
- a "scheduled for floor vote" claim names no bill that has a stage
- a "passed the House (Y-Z)" claim matches the recorded tally, and that `Y > Z`
- a "just introduced" claim names a bill that is not past introduction
- the summary's counts equal the counts derived from `bills.json`
- the summary agrees with `stats.json` (these diverged once: 93 vs 96)
- "latest movement" is genuinely the newest action, and is not future-dated

**Verified against the real bug.** With the runtime guard removed and the historical flags
restored, it reproduced the falsehood word for word and failed the build:

```
❌ 3 bills scheduled for floor vote: H.R. 5107, H.R. 5214, H.J.Res.142
     → H.R. 5107 has stage "passed-house" — it cannot be awaiting a floor vote
     → H.J.Res.142 has stage "enacted" — it cannot be awaiting a floor vote
```

## Also fixed: a warning that cried wolf

`congressValidated` was reported by every run as "102 bills have not been validated against
Congress.gov" while the monitor was successfully fetching all 75 scanned bills nightly.
`validate-bills.js` confirms a bill with the *same* `GET /bill/{congress}/{type}/{number}`
the monitor already performs, so the monitor now records that validation itself — stamped
once, not re-dated daily, since `bills.json` is committed every run and re-dating 75 bills a
day would bury real changes in churn. The CI warning now counts only the section the monitor
actually scans.

A warning that is wrong 97% of the time trains everyone to ignore warnings, which is worse
than no warning at all.

## Deliberately not done

- **Provenance per fact** (`_source`, `_verifiedAt`) — the highest-value remaining item,
  because it is the only one that turns internal rigour into something a reader can check
  ("vote verified against Congress.gov roll call 101"). Still open; see `WHATS-NEXT.md`.
- **Monitor reporting disagreements instead of silently overwriting.** A `manualOverride`
  flag already exists and is respected; the H.R. 5103 correction simply did not set it.
- **Pre-deploy Playwright walkthrough.** Worth doing, but the two offline gates cover the
  failure modes seen so far at a fraction of the cost.
