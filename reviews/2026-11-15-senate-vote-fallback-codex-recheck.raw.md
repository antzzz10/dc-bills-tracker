Rechecked `d8d9d10`. **One BLOCKER, two MATERIAL findings, and one NOTE remain.** No files modified.

| Earlier finding | Disposition | Evidence |
|---|---|---|
| Rejected tally reaches email/Bluesky | **FIXED** | `scripts/monitor-bills.js:1167` suppresses a merge-conflicted tally. Reproduced through both builders. |
| Memo bypasses later action checks | **PARTLY FIXED** | `scripts/monitor-bills.js:157` checks each action, but `scripts/lib/senate-votes.js:276` subsequently erases substantive failures when another line succeeds. |
| Manual overrides bypass conflict reporting | **FIXED** | `scripts/monitor-bills.js:815` checks locked tallies; line **825** returns `senateNote`, which the caller reports at line **1150**. See the overlapping-protection NOTE below. |
| Impossible fallback dates | **FIXED** | `scripts/lib/senate-votes.js:59` validates calendar components and session compatibility; line **253** applies it to fallback dates. |
| Matching totals hide stored-date conflict | **FIXED** | `scripts/lib/senate-votes.js:299` reports the date disagreement while preserving storage. |
| Tie-break guard misses 50–49 | **FIXED** | `scripts/lib/senate-votes.js:250` rejects one-vote margins, including 50–49 and lower-turnout equivalents. |
| Guard failures drop unreachable flag | **FIXED** | `scripts/lib/senate-votes.js:246` preserves it; `scripts/monitor-bills.js:156` also records transport failure before reconciliation. |

The new and remaining defects, most serious first:

1. **BLOCKER — A successful duplicate still hides a substantive conflict.**  
   **`scripts/lib/senate-votes.js:276`; `scripts/monitor-bills.js:405`**

   **Reproduced:** senate.gov returns **54–46**. Two Congress.gov action lines for that roll report **54–46** and **55–45**. Reconciliation correctly rejects the second line, but combining its failure with the successful first line returns **54–46 without `voteFetchFailed`**. Reversing the lines produces the same result. A conflicting date is swallowed too.

   During an outage, a good **54–46** fallback similarly hides another line rejected for **50–49**. The conflict survives only in console output; the run can store and announce a tally without reporting the real error.

   **Fix:** preserve failure categories. Forgive only missing fallback evidence on a bare duplicate; explicit totals/date conflicts and guard rejections must invalidate the roll and reach error reporting. Test the complete detector path.

2. **MATERIAL — The per-roll loop selects an older passage over the newer one.**  
   **`scripts/monitor-bills.js:415–420`**

   **Reproduced:** one bill has passage roll **200, April 20, 60–40**, and earlier passage roll **133, March 14, 54–46**. The returned Senate vote is **March 14, 54–46**: descending action order inserts the newer roll first, then line 420 overwrites it with the older roll.

   If the newer roll fails, the detector still supplies the older tally alongside `voteFetchFailed`; downstream processing does not suppress that tally merely because this flag is set.

   This ordering defect predates the amendment and remains in the replacement loop.

   **Fix:** select the relevant latest passage explicitly before choosing its vote. An older roll must not substitute for an unresolved newer passage.

3. **MATERIAL — Roll numbers from different sessions are merged as one vote.**  
   **`scripts/monitor-bills.js:404–407`**

   **Reproduced:** the same bill has session-one roll **20, January 30, 2025, 60–40**, and session-two roll **20, January 30, 2026, 71–29**. Both official answers agree with their respective action lines. Nevertheless, `senateRolls` groups both under `"20"`, reports disagreement, and returns no vote.

   **Fix:** key aggregation by Congress, session, and normalized roll number. Then select the relevant passage separately. The fetch memo already distinguishes sessions; aggregation must do so too.

4. **NOTE — Overlapping protection flags compare a provision’s vote with its parent’s.**  
   **`scripts/monitor-bills.js:815`**

   **Reproduced:** an entry with `manualOverride: true`, `type: "rider"`, and its own stored Senate tally receives the parent bill’s fresh tally. The branch calls `checkLockedSenateVote` and returns a false conflict, despite the comment saying provisions are excluded. The same issue applies when `manualOverride` overlaps `outcome`.

   There is no such overlap in the current stored entries.

   **Fix:** exclude provisions and verified outcomes before calling the locked-vote checker, and establish that the compared vote belongs to the fetched measure.

I found **no demonstrated false rejection from the direct date cross-check itself**. The after-midnight fixture for roll 191 is dated April 5 in both XML and [Congress.gov’s action record](https://www.congress.gov/bill/119th-congress/house-concurrent-resolution/14/all-actions). Finding 3 does wrongly reject real, individually matching votes during aggregation.

Senate tests, Bluesky tests, and bill lint passed. Additional in-memory checks reproduced the failures above and verified that accepted totals-only votes render without party rows, rejected merge tallies disappear from announcements, and protected-entry conflict notes reach the caller.

**Verdict: ship after fixes.**