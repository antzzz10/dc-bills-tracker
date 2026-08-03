# Park the support-bill section: the tracker is oppose-only

**Date:** 2026-08-03
**Status:** Decided and applied. Support bills no longer render; the data is retained.

## Decision

The bill tracker publishes **anti-DC bills only**. The "Bills to support" section is
removed from the page. The 36 pro-DC bills stay in `bills.json`, stay linted, and are
not deleted — this is a parking lot, not a teardown.

## Why

The tracker's job is to be a link you can send someone with confidence: *here are the
bills attacking DC*. A list of bills to *support* sitting at the bottom of that same
page works against it. A reader who lands mid-scroll, or who skims to the end, has to
work out that the list reversed polarity partway down. That ambiguity costs more than
the support section adds, and it lands on the one page most likely to be shared cold.

The alternative considered was a genuinely separate page (`/support`) via a multi-page
Vite build, keeping the two lists apart but both published. That is still a reasonable
future move — it was scoped, not rejected on the merits. It was parked because the
support bills are a distraction from the oppose-side work right now, and because
shipping a second page would have committed us to maintaining data that has a known
freshness problem (below).

## What this does NOT change

Verified before and after, because the oppose counts are the thing that must not move:

| | Before | After |
|---|---|---|
| `totalBills` | 94 | **94** |
| `pendingBills` | 79 | **79** |
| `passedBills` | 15 | **15** |
| `breakdown` | bills 75, riders 18, routineBills 1 | **identical** |

`src/data/bills.json` is **byte-for-byte unchanged** — `git diff` on it is empty. The
published `totalBills` was already oppose-only (bills + riders + routineBills), so no
count ever included a support bill and none of them moved.

`lint-bills.js` still validates the `supportBills` section, so the parked data cannot
rot into an invalid state while it sits.

## What changed

- `src/App.jsx` — dropped the `SupportBillsSection` import, render, and the
  `filteredSupportBills` filter plumbing.
- `scripts/generate-stats.js` — removed `breakdown.supportBills` from the published
  `/api/stats.json`. Publishing a count for something no page renders would advertise
  a list that isn't there. Verified unconsumed by `representdc-main` and
  `dc-statehood-pledge` before removing; `useBillStats` reads only `totalBills`,
  `pendingBills`, `passedBills`, and `lastUpdated`.
- `src/components/SupportBillsSection.jsx` and its CSS are **kept, unreferenced**. They
  cost nothing (unreferenced modules never enter the bundle) and are the fastest path
  back if this is revived.

Confirmed in the built bundle: `"id":"hr51"` and `"id":"hr5093"` return zero matches,
`"id":"hr5103"` and `"id":"hr2096"` still return one each. The parked entries are
tree-shaken out entirely — they do not ship to browsers. Bundle went 838.83 kB → 814.54 kB.

## Known debt this parks alongside it

`scripts/monitor-bills.js` **never scanned the support bills.** Its loop covers
`billsData.bills` only, so all 36 entries have been drifting since they were added —
H.R. 51's cosponsor count was already stale (207 stored vs 208 live) when this was
found. Parking the section means that staleness is no longer user-visible, which
lowers the urgency but does not clear the debt.

**Reviving support bills requires fixing the scan first**, or the new page ships stale
data on day one. See `WHATS-NEXT.md` for the tracked item.

## How to revive

1. Extend the monitor loop to `supportBills` and confirm `calculatePriority` behaves
   for `position: "support"` (the partial-attack cap was written for oppose bills).
2. Restore the `SupportBillsSection` render, or build the separate `/support` page via
   a second Vite entry — no router, per the bundle-discipline rule in
   `representdc-main/decisions/2026-07-27-domain-standards-and-rollout.md`.
3. Re-add `breakdown.supportBills` to `generate-stats.js` if any consumer needs it.
