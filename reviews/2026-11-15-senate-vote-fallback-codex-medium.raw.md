Found **2 BLOCKERs, 3 MATERIAL issues, and 1 NOTE**. Reproductions used mocked network responses and in-memory data; no files were modified.

1. **BLOCKER — A rejected tally still reaches the email and Bluesky post builder.**  
   **`scripts/monitor-bills.js:1137–1145`**  
   When the stage changes, `passedBills` receives the original `status.passageInfo.senateVote`, even when `mergeSenateVote` rejected it as conflicting.

   **Reproduced:** stored tally **54–46**, fresh totals-only tally **55–45**, and a new `passed-senate` stage. Storage correctly retained 54–46 and recorded an error, but the email announced **55–45**, and the Bluesky builder produced “Passed the Senate … (55-45).” One error does not necessarily fail the run’s 25% health threshold.

   **Fix:** return an explicitly accepted vote from the update/merge operation. On conflict, omit the tally from passage announcements. Add an integration test covering merge rejection → email → Bluesky output.

2. **BLOCKER — The memo bypasses later actions’ cross-checks and fallback evidence.**  
   **`scripts/monitor-bills.js:145–153`**  
   The cache stores `resolveSenateVote`’s final decision, which depends on the first action’s tally and date. Later actions sharing the key never have their evidence checked.

   **Reproduced:** two same-day passage actions for roll 133 report **55–45** and **54–46**. With senate.gov returning 403, the detector accepts the first tally, returns **55–45**, and reports no fetch failure. A new stored record would become a “known gap” despite contradictory evidence. With successful XML retrieval, a first action without totals also prevents a later conflicting action tally from being checked.

   The reverse causes unnecessary omissions: a first action without usable totals caches failure even when a later action provides valid fallback evidence.

   **Fix:** memoize the Senate fetch separately. Validate every relevant action against it, and reconcile duplicate actions before allowing fallback. Conflicting totals, dates, or roll identities must fail closed.

3. **MATERIAL — The tie-break guard misses ties with absent senators.**  
   **`scripts/lib/senate-votes.js:225`**  
   Equality or a total above 100 does not cover every Vice Presidential tie-break. A **49–49** Senate split plus the VP can appear as **50–49**, which this fallback accepts.

   This representation exists: Congress.gov reports roll 226 as [50–49](https://www.congress.gov/bill/119th-congress/senate-joint-resolution/49/all-actions), and the [Senate press gallery identifies the VP’s tie-break](https://www.dailypress.senate.gov/wednesday-april-30-2025/). That example is procedural; it demonstrates the numeric representation the guard overlooks.

   **Failing scenario:** a passage action has the same representation during an outage. Fallback publishes it although the full XML parser would deliberately skip the tie-break.

   **Fix:** require explicit tie-break evidence or conservatively reject one-vote margins for totals-only fallback. Add 50–49 and lower-turnout cases to the tests.

4. **MATERIAL — Fallback accepts impossible dates that downstream checks do not reject.**  
   **`scripts/lib/senate-votes.js:228–235`**  
   The date check validates formatting only.

   **Reproduced through `detectPassage`:** action date **`2025-02-31`**, matching roll number, valid totals, and HTTP 403 returns a successful totals-only vote dated `2025-02-31`. The monitor derives a valid session because JavaScript normalizes that date. Data lint checks whether the vote predates introduction, but does not reject this impossible date; UI date construction normalizes it again.

   **Fix:** validate calendar components by round-trip comparison, plus session compatibility. Add impossible-date fallback tests; existing impossible-date tests cover XML only.

5. **MATERIAL — Matching totals silently suppress conflicting stored dates.**  
   **`scripts/lib/senate-votes.js:260`; `scripts/test-senate-votes.js:246–247`**  
   `sameTotals` is enough to return no update and no note when party rows exist, regardless of the dates.

   **Reproduced:** stored full record dated **March 13**, fresh Congress.gov fallback dated **March 14**, both 54–46 → `{ record: null, note: null }`. The potentially wrong published date remains, and the disagreement disappears from reporting. The new test explicitly requires this silent behavior.

   **Fix:** preserve the stored full record, but report a conflict when dates differ. Also compare roll identity where available; equal totals do not establish that two records describe the same vote.

6. **NOTE — Guard failures discard the outage flag and repeat the full retry budget.**  
   **`scripts/lib/senate-votes.js:226–229`; `scripts/monitor-bills.js:154`**  
   After exhausted retries, rejecting fallback for a tie or unusable date returns a new failure without `unreachable`. Consequently, `senateGovUnreachable` stays false, and subsequent distinct votes can each consume another **53 seconds**: three 15-second attempts plus eight seconds of delays.

   **Fix:** preserve transport status independently of the fallback decision. Test repeated guard failures and retry-budget behavior.

   Also, this checkout’s workflow specifies **45 minutes**, not 20 (`.github/workflows/monitor-bills.yml:46`). I found no demonstrated timeout breach for the current tracked vote volume.

The Senate tests, Bluesky tests, and data lint pass. The published-claims check fails because two generated API files are missing from this checkout. I found no totals-only `byParty` crash in the requested consumers. The tests currently miss the memo and rejected-publication integration paths above.

**Verdict: ship after fixes.**