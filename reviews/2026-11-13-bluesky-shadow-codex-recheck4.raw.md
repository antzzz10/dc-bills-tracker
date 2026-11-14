**0 BLOCKER, 0 MATERIAL, 1 NOTE.** Both requested fixes pass their regressions and targeted replays.

- **NOTE — Failed lookup can leave an empty ledger.** [scripts/lib/bluesky-posts.js:181](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:181): a reused ID’s old record is deleted before lookup success is checked. If no other records survive, the returned ledger is empty; the next run throws `Bluesky ledger is empty`, blocking the deferred announcement. Confirmed with a synthetic one-entry ledger. Retry succeeds when another record survives.

Same-Congress correction preserves the ledger stage and allows same-run verified passage. Different-Congress reuse posts as new when postable and looked up. No new false-post path found.

`node scripts/test-bluesky-posts.js` passed all checks, including 1,080 template texts. No files edited; Git status unchanged.