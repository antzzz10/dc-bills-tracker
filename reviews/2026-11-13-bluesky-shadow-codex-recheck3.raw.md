**0 BLOCKER, 1 MATERIAL, 1 NOTE.** Keep shadow mode; silent re-baselining can still permanently consume a verified passage event.

1. **MATERIAL — A number correction hides passage detected in the same run.** [scripts/lib/bluesky-posts.js:172](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:172)  
   Re-baselining copies the current stage into the ledger. Passage processing then skips it as already recorded at [line 223](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:223). Replay: correct `hr6578` from H.R. 6579 to H.R. 6578 while supplying a verified `passed-house` change. Result: **zero events**, ledger advanced to `passed-house`, `checkFailed=false`, and `lastChecked` advanced. The next run also produced nothing. Suppress the false “new” announcement while preserving verified passage processing; add a combined correction-and-passage regression check.

2. **NOTE — Congress changes also silently suppress legitimate new measures.** [scripts/lib/bluesky-posts.js:169](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:169)  
   The same branch treats every identity change as a correction. Reusing an ID in Congress 120 produced no new-measure event. Distinguish a same-Congress number correction from a different Congress before the switchover.

The requested fixes are verified:

- **Root `null`: fixed.** Only a missing file seeds; existing `null` fails closed. [scripts/monitor-bills.js:1419](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:1419)
- **False “new” after same-ID number correction: fixed**, including the prior manual-override/lift scenario.
- **Empty ledger: guarded** when candidates exist. [scripts/lib/bluesky-posts.js:159](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:159)

Report-path replays confirmed `null`, empty entries, an empty file, and malformed JSON set `checkFailed=true`, preserve `lastChecked`, and leave the ledger unwritten.

`node scripts/test-bluesky-posts.js` **passed all checks**, including 1,080 template texts. Additional replays used in-memory filesystem stubs; no live API calls or workflow execution. No files edited; Git status remained unchanged.