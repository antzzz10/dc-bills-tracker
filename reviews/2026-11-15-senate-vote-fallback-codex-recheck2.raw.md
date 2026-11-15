Rechecked `2e658fa`. **No new BLOCKER; two MATERIAL gaps remain.** No files modified.

| Prior finding | Disposition | Evidence |
|---|---|---|
| Successful duplicate hides substantive conflict | **FIXED** | `scripts/lib/senate-votes.js:275` voids the vote on substantive failure; `scripts/monitor-bills.js:410` preserves that category. Reproduced both action orders, online and during refusal. |
| Older passage overwrites newer one | **PARTLY FIXED** | `scripts/monitor-bills.js:422` selects the newest dated **roll**, but does not reliably select the latest **passage**. Cases below. |
| Different sessions’ roll numbers merged | **FIXED** | `scripts/monitor-bills.js:408` includes year and normalized roll number. Matching rolls from 2025 and 2026 remain separate. |
| Overlapping protection flags | **FIXED** | `scripts/monitor-bills.js:823` excludes provisions and verified outcomes before checking locked tallies. |

Newly reproduced defects:

1. **MATERIAL — Latest-passage selection still accepts an earlier tally.**  
   **`scripts/monitor-bills.js:398`, `:422`; same-day ordering at `:323`.**

   **Scenario:** March 14 passage roll 133 is **54–46**; a later April 20 passage is by unanimous consent. April’s passage never enters `senateRolls`, so the detector returns March’s tally and date. The storage path writes that earlier vote as the selected Senate passage.

   A second reproduction uses two passages on April 20: roll 133 at **10:00, 54–46**, and roll 200 at **17:00, 60–40**. With the older action first, sorting ignores `actionTime` and selects **54–46**, although both official records validate.

   **Fix:** determine the latest passage before selecting its roll. Include reliable same-day ordering; a latest passage without a roll must not inherit an earlier tally. Test both scenarios through storage and announcements.

2. **MATERIAL — A successful newest roll hides errors on older rolls.**  
   **`scripts/monitor-bills.js:424`, `:426`.**

   **Scenario:** newest roll 200 validates at **60–40**. For earlier roll 133, senate.gov says **54–46**, while Congress.gov says **55–45**. Reconciliation rejects the earlier vote, but only the newest roll is combined. The detector returns no `voteFetchFailed`; `fetchBillStatus` returns **`missingParts: []`**. An unreadable older record is likewise omitted from error reporting.

   **Fix:** combine every fetched roll’s results and propagate substantive failures into run health, independently of which passage supplies the displayed tally.

Senate tests, Bluesky tests, and bill lint passed. In-memory checks reproduced these gaps and verified totals-only storage, email, and Bluesky formatting without party rows.

**Verdict: ship after fixes.**