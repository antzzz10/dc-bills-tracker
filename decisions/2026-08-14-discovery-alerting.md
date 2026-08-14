# Decision: discovery pipeline — root-cause fix and loud failures

**Date:** 2026-08-14
**Status:** Decided and implemented
**Trigger:** Three introduced anti-DC bills missing from the tracker (S. 5147
patriotic-observances; H.R. 10067/S. 5274 helmet-law preemption; Rep. Mace's announced
death-penalty bill).

## What was found

The weekly discovery scan was **dead for three weeks with zero signal** (failed 07-27,
08-03, 08-10; last success 07-21). Root cause: when the `routineBills` section was added
to bills.json (07-21, `9078330`), `buildTrackedSet` in `discover-bills.js` kept its
hardcoded section list — so every scan "rediscovered" S. 1077, auto-added it as a
duplicate, and the lint gate correctly failed the run *after* discovery but *before*
commit and before any email (the workflow only emailed on success-with-additions). The
08-10 run found both helmet bills, scored them 45, validated them on Congress.gov — and
discarded them as it died.

Secondary findings: the review tier (score 20–39) never produced any signal even on
green runs; the committee channel had been silently dead the whole time (wrong API route
— `/committee/{congress}/{chamber}/{code}/bills` should be
`/committee/{chamber}/{code}/bills`); S. 5147 was absent from a complete Senate title
scan (suspected `sort=updateDate+desc` offset-pagination race); the Mace bill has no
Congress.gov number yet and cannot be tracked until posted.

## Decisions (Andria, 2026-08-14)

1. **Deliver the missed bills through the fixed pipeline**, not by hand-editing: fix,
   then manually dispatch discovery; hand-add S. 5147 only if the fixed scan still
   misses it (treated first as a failed acceptance test with diagnostics preserved).
2. **Loud failures + staleness alert, no self-heal dispatch for discovery**: workflow
   restructured to the monitor pattern (gates block commit/deploy but never the email;
   fail-closed resolver; review tier now emailed), plus a `discovery-check` job in
   `data-freshness-check.yml` alerting at 192h. Auto-dispatch was declined because the
   observed failures were data bugs where a retry fails identically.

## Key mechanism shipped

- `buildTrackedSet` now derives from **every** top-level array, judging each entry by a
  legislative-ID grammar — a future bills.json section cannot recreate this outage.
- Title scan: ascending `updateDate` sort (mid-scan updates move behind the cursor —
  duplicated, never skipped) with a per-type preflight, `pagination.next/count`
  invariants, and fail-closed channel health.
- `.discover-last-run.json` is a full ISO stamp, advanced **only** on fully healthy live
  scans, and committed even on quiet no-addition weeks (a Codex Critical: otherwise
  healthy quiet weeks eventually trip a false staleness alarm).

## Process

Two Codex review rounds (design, then implementation diff), read-only with web search;
1 Critical + 4 High design findings and 2 High implementation findings all fixed before
commit. Same working method as `decisions/2026-08-14-watchdog-self-heal.md`.
