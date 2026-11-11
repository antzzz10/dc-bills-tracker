**0 BLOCKER / 0 MATERIAL / 1 NOTE (carried forward).** The prior MATERIAL is resolved. No regressions found in this focused recheck.

- **Health accounting:** HTTP errors, timeouts and JSON exceptions produce the sentinel and reach `missingParts` as `roll-call vote`. Deliberate skips remain `null`. Multiple failed votes count once per lookup.
- **Passage preservation:** House, Senate, both-chamber and enacted stages remain detectable after vote failure. Offline tests also confirmed stage advancement is persisted while existing stored vote records remain unchanged.
- **Health threshold:** Independent synthetic sweeps produced **15/113 → `checkFailed: false`** and **29/113 → `true`**. `lastChecked` advanced only for the healthy run.
- **Signals:** Native signal composition passed on local **Node 22.16.0**, covering caller cancellation, deadlines, undefined/null signals and preserved options. `AbortSignal.any` is supported throughout Node 22. [Node documentation](https://nodejs.org/download/release/v22.17.0/docs/api/globals.html#static-method-abortsignalanysignals)
- **Comment:** The cosponsor comment now matches the implemented behavior.

**NOTE — Existing reporting limitation remains:** the [45-minute workflow limit](/Users/andriathomas/Projects/dc-bills-tracker/.github/workflows/monitor-bills.yml:46) can still expire during widespread stalls: 113 sequential bill-detail deadlines alone take 56.5 minutes, potentially preventing the report/email.

Syntax, diff-whitespace, bill-data lint and published-claims checks passed. All monitor fixtures used intercepted in-memory writes and stubbed requests. **No files edited; no live monitor run.**