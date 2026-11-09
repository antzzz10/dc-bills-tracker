**No new BLOCKER or MATERIAL issues found. One prior finding remains PARTIAL.** Numbers below refer to bullet order in each prior review.

| Prior finding | Status | Evidence |
|---|---|---|
| Medium 1: advanced/pending totals and routine measures | **FIXED** | Anti-DC totals reconcile: **92 tracked, 80 pending, 12 advanced, 2 enacted**. Routine measure counted separately. S. 1077 matches the [official Senate-passage record](https://www.congress.gov/bill/119th-congress/senate-bill/1077/all-actions). |
| Medium 2 / High 1: public entry counts | **FIXED** | Results, section, category and PDF numbers use measure units; PDF no longer describes everything as pending. |
| Medium 3 / High 2: main-site wording | **FIXED** | Mixed totals name bills, resolutions and riders; unsupported activity wording replaced with pending status. |
| Medium 4 / High 3: stale fallback counts | **FIXED** | Hardcoded counts removed; affected claims suppress numbers during loading/failure. |
| Medium 5 / High 5: API units and breakdown checks | **FIXED** | Breakdown totals 92; passed list has 12 rows. Claims gate rejects the former `999 bills / 0 resolutions` mutation. |
| High 4: banner recurrence and gate coverage | **PARTIAL** | Three advancing H.R. 5242 provisions now produce one passage. Results, section, PDF and main-site wording remain outside gate coverage; [check-published-claims.js:158](/Users/andriathomas/Projects/dc-bills-tracker/scripts/check-published-claims.js:158) proceeds from banner checks directly to summary/API checks. |
| High 6: companion ordering | **FIXED** | Reversed pairs and transitive shared-number groups deduplicate correctly. |

**NEW issues introduced:** none found.

Both gates pass. In-memory stats regeneration exactly matches `stats.json`; scoped bundles succeed. Main-site ESLint passes; tracker retains two pre-existing `__BUILD_DATE__` errors. No files changed.