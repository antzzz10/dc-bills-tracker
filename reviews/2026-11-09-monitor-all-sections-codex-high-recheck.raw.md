**0 BLOCKER, 0 MATERIAL; 1 remaining NOTE in the fixes.** The prior MATERIAL data-loss finding is resolved for bill entries.

- **NOTE — Rider parents lack the fallback used for bills.** [scripts/monitor-bills.js:936](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:936) calculates priority from raw nulls; line 940 also builds history without stored fallbacks. Reproduced unchanged H.R. 5166 activity going **high → low → high** across success, detail-request failure, and recovery. Recovery then produces a false “Priority escalated” email entry. Preserve the last known parent history when those endpoints fail.

Verified the five requested corrections:

- Failed detail requests preserve bill flags, cosponsors, stages, and votes; history and priority retain known values. Genuine `false` and `0` updates still work.
- Both writers preserve a concurrently changed `lastChecked`.
- Rider-parent email titles use “tracked D.C. riders proposed for this bill”; rider statuses remain untouched.
- `newBills` alone sets `hasMeaningfulChanges=true`.
- Routine bills work through single-ID, default-unvalidated, and `--all` validation.

The workflow health contract holds: **113 distinct lookups**, incomplete records counted once, **29/113 failures** sets `checkFailed=true` and leaves `lastChecked` unchanged. Commit/deploy gates consume that flag correctly.

The earlier NOTEs about persisted priority and historical passage wording remain unchanged.

Syntax, data lint, published-claims checks, and in-memory failure/recovery simulations passed. No files edited or live API calls made.