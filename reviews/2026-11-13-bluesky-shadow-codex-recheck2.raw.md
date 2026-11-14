**0 BLOCKER, 2 MATERIAL, 0 NOTE.** Keep shadow mode; two gaps remain before relying on the trial as go-live evidence.

1. **MATERIAL — An existing ledger containing JSON `null` still silently reseeds.** [scripts/lib/bluesky-posts.js:150](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:150), [scripts/monitor-bills.js:1419](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:1419)  
   The planner cannot distinguish a missing file from an existing file whose parsed value is `null`. An in-memory report/planner replay with a verified House-passage event produced `seeded=true`, zero posts, `checkFailed=false`, and an advanced `lastChecked`. The next run produced no event: the passage announcement was permanently lost. Validate every existing file before allowing the missing-file seeding path.

2. **MATERIAL — Remembered candidates can still become “new” during a number correction.** [scripts/lib/bluesky-posts.js:164](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:164)  
   A changed measure key routes an already remembered entry into new-entry processing. Constructed replay: seed `hr6578` under `manualOverride` with an erroneous `H.R. 6579` number; then correct it to `H.R. 6578`, lift the override, and supply a successful lookup. The builder announces:
   > New anti-DC bill: H.R. 6578, Charlie Kirk Freedom of Speech Plaza Act…

   The ID and Congress are unchanged; this is an existing entry becoming postable after correction. Remembering excluded candidates does not cover this transition.

Disposition of the five requested fixes:

| Prior finding | Result |
|---|---|
| Ledger validation | **Partial.** `entries:null`, arrays, malformed records, and malformed JSON fail closed. Root `null` remains unsafe. |
| Candidates remembered silently | **Reported H.R. 5242 case fixed.** Lifting restrictions with unchanged measure identity is silent. Number-correction gap remains above. |
| Congress-qualified shared measures | **Fixed.** A prior-Congress duplicate no longer suppresses current-Congress passage. |
| Rename followed by normal cosponsor processing | **Fixed.** Additional replay emitted both passage and cosponsor events during one rename. |
| Planning-failure subject/error | **Fixed by inspection.** Both workflow messages explicitly identify Bluesky planning failure. |

`node scripts/test-bluesky-posts.js` **passed all checks**, including 1,080 template texts. Additional offline replays confirmed artifact-write and ledger-write failures block saving through `checkFailed=true`. GitHub Actions was not executed.

No files edited. Git state remained unchanged; reviewed `main` at `71fcd81`.