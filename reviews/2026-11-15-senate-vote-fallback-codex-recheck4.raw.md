**FIXED** — `scripts/lib/senate-votes.js:383`, `scripts/monitor-bills.js:829`, `:923`, `:1170`. A superseded stored tally now produces an error for human correction in both ordinary and locked entries, reaches the email report, and remains unchanged as requested.

**No new BLOCKER or MATERIAL defects found.**

Senate tests, Bluesky tests, and bill lint passed. In-memory checks verified detector → storage → error reporting, with writes mocked. Current stored Senate entries produced no false errors with official XML fixtures or simulated refusal.

Reviewed `f4630b1`. No files modified; worktree clean.

**Verdict: ship.**