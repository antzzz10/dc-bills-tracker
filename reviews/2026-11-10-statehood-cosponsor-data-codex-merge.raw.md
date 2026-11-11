# Codex focused review (high): merge of origin/main timeouts, commit 41fe98e

Run 2026-11-10 with `codex exec -s read-only -c model_reasoning_effort=high` < /dev/null; prompt in reviews/2026-11-10-statehood-cosponsor-data-codex-merge-prompt.md. Final answer verbatim.

Disposition (Claude): both NOTEs left as follow-ups, not fixed here. Both fail safe: cancellation leaves the published data untouched, and a count mismatch keeps the previous list.

---

**Verdict: 0 BLOCKER, 0 MATERIAL, 2 NOTE — both behaviours survive the merge; no publication-safety regression found.**

1. **NOTE — Request deadlines do not guarantee completion within 45 minutes.**  
   [scripts/lib/congress-api.js:37](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/scripts/lib/congress-api.js:37), [scripts/build-member-roster.js:144](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/scripts/build-member-roster.js:144).

   Five timed-out attempts plus backoff take **165 seconds per page**. Including capped `Retry-After` sleeps, the bounds become **285 seconds for eventual success**, **315 seconds for exhaustion**. The current two single-page flagship lists therefore need at most **10.5 minutes for list fetching alone**; the ten-page guard permits approximately **48 minutes for one pathological list**.

   The roster’s 539 details plus three list pages take approximately **47.9 minutes at five seconds per successful request**, including spacing and without retries. It stops at the first exhausted lookup, but repeated eventual successes can exceed the job limit. Cancellation preserves published data; the monitor can still lose its report/email.

   **Fix:** add an overall execution budget before GitHub’s cutoff, reserving time for reporting; consider bounded concurrency or resumable fetching for the roster.

2. **NOTE — The new count comparison can reject a valid refresh during concurrent updates, but fails safely.**  
   [scripts/monitor-bills.js:513](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/scripts/monitor-bills.js:513).

   A cosponsor joining or withdrawing between the bill-record request and list request produces a legitimate mismatch. This is a timing issue: both count fields exclude withdrawals, according to the [official API documentation](https://github.com/LibraryOfCongress/api.congress.gov/blob/main/Documentation/BillEndpoint.md).

   The mismatch correctly retains the previous list, count and `checkedAt`, records `lastFailure`, and counts one failed lookup. **Fix:** optionally reread the bill record once on mismatch before rejecting the refresh; add this scenario to the offline suite.

Verified at `41fe98e`: ordinary bills make no `/cosponsors` request; both flagship entries fetch full lists. Native-fetch body stalls abort and retry. Roster failure after 270 members writes nothing. Both 45-minute limits, store staging, offline tests, roster-only push retries and post-rebase gates remain intact.

All 16 offline tests, data lint and published-claims checks passed; generation and additional fixtures ran in memory. Worktree remains clean; no files modified.
