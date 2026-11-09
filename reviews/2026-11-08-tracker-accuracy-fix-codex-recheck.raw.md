**0 BLOCKER, 1 remaining MATERIAL. No NEW issues found.** No nightly gate failure reproduced.

M/H below refer to the prior medium/high reviews.

| Prior finding | Verdict | Evidence |
|---|---|---|
| **M1 / H1:** Automatic clearing can erase real passage | **FIXED** | [monitor-bills.js:572](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:572) only changes stages when detection returns a stage. A voice-vote fixture returning `null` preserved `passed-house`. Replaying the saved monitor results left H.R. 5525 cleared. |
| **M2 / H3:** “Passed both chambers” backdated to House vote | **FIXED** | [RecentActivity.jsx:47](/Users/andriathomas/Projects/dc-bills-tracker/src/components/RecentActivity.jsx:47) requires both chamber dates for that label. With only a House vote recorded, the fixture showed the official Senate action on its own date. |
| **M3 / H2:** Referral becomes false introduction; gate misses wording | **FIXED** | [updateBannerMessage.js:31](/Users/andriathomas/Projects/dc-bills-tracker/src/components/updateBannerMessage.js:31) uses introduction date and excludes advanced bills. [check-published-claims.js:101](/Users/andriathomas/Projects/dc-bills-tracker/scripts/check-published-claims.js:101) matches spaced and companion numbers. Fixtures rejected a false introduction and accepted a genuine recent one. |
| **M4 / H4:** Historical backfill becomes weekly news | **PARTLY — MATERIAL** | [weekly-digest.js:102](/Users/andriathomas/Projects/dc-bills-tracker/scripts/weekly-digest.js:102) filters action-text changes by date, but stage/priority changes bypass that filter. The actual current diff supplies H.R. 5525’s **March 18, 2026 markup** under **“CHANGES THIS WEEK.”** Dates are now included, but corrections remain mixed with congressional activity. |
| **H5:** Provisional activity always says “Introduced” | **FIXED** | [RecentActivity.jsx:75](/Users/andriathomas/Projects/dc-bills-tracker/src/components/RecentActivity.jsx:75) preserves nonempty official action text. A provisional markup fixture displayed the markup wording. |

**NEW issues:** None identified.

Verification: data lint, published-claims gate, script syntax checks, and diff whitespace checks passed. An in-memory replay of all **78 saved monitor results** also passed both data gates. No files edited, live API calls made, or build run.