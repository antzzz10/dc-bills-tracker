Focused high review (one pass) of the merge of origin/main (commit 14164e8, "Stop the daily check from hanging on a slow Congress.gov": 30-second per-request deadline, cosponsor count from the bill record, 45-minute job limit) into branch claude/statehood-cosponsor-data-9b42d8 (draft PR #2: full cosponsor lists for flagship statehood bills, member roster, gates). Review the merge commit (HEAD; `git show HEAD`, `git diff HEAD^1 HEAD` for what main brought, `git diff HEAD^2 HEAD` for what the branch brought) and read the merged scripts/monitor-bills.js, scripts/lib/congress-api.js, scripts/lib/statehood.js, scripts/build-member-roster.js, .github/workflows/monitor-bills.yml and .github/workflows/refresh-member-roster.yml. Earlier reviews: reviews/2026-11-10-monitor-timeouts-codex-high*.raw.md and reviews/2026-11-10-statehood-cosponsor-data-codex-*.raw.md.

Check specifically:
1. Both behaviours survive the merge: every non-flagship bill takes its count from the bill record with no /cosponsors request; flagship (supportBills, flagship: true) entries fetch the full list.
2. No request in the flagship path or the roster can hang: each attempt has a deadline (including reading the body), and a timeout is a failed attempt, retried with backoff, then an incomplete list (previous list and checkedAt kept; lookup counted as failed).
3. The worst-case run time of the flagship retries and of the roster against the 45-minute job limits.
4. The new check that the list count equals the bill record's cosponsors.count: can it misfire, and does a mismatch fail safe?
5. monitor-bills.yml after the auto-merge: 45-minute limit kept, store staged, offline test step present, roster-only push retry intact.
6. Anything else in the merge that breaks run-health accounting, rate limiting or the gates.

Do not modify files. One-line verdict first, then numbered findings labelled BLOCKER / MATERIAL / NOTE with file:line, failure scenario and fix.
