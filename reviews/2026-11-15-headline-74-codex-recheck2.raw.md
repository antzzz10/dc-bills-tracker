Both findings are **FIXED**. Reviewed `ae9e098` and re-read the full `origin/main...HEAD` diff. **No new BLOCKER or MATERIAL defects found.**

1. **FIXED — incomplete action data erased `bothChambersPassed`.**  
   `scripts/monitor-bills.js:869–875` sets the flag only when both passage booleans are explicitly `true`; it clears it only outside the two first-chamber stages. Nine in-memory cases passed: empty, partial, one-chamber-only and HTTP 503 responses preserve the flag; positive evidence sets it; enactment and matching-text passage clear it.

2. **FIXED — the gate checked a reconstructed heading.**  
   `src/lib/progressSplit.js:117` now builds the heading strings; `src/App.jsx:204,316–318` consumes and prints them directly. `scripts/check-published-claims.js:321–333` compares that function’s output with independently written expectations. In-memory mutations to the headline, breakdown numeral, chamber and “Also listed” text each failed the gate. React rendering inside this gate remains outside the agreed scope.

Verification: **30 tracker checks**, bill-data lint for **136 entries**, and **six main-site tests** passed. Regenerating stats entirely in memory made all **28 published claims** pass, with **74 = 4 + 10 + 60**.

The direct gate still fails against checked-in stats because they lack `progress`; normal generation supplies it. Production builds were not run because they write files. No files were modified; the worktree remains clean.

**Verdict: ship.**