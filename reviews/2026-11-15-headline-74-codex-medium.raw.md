**Verdict: ship after fixes.** I found **7 MATERIAL issues, no BLOCKERs**. The current data correctly computes **74 = 4 law + 10 House-passed + 60 neither chamber**, but the future-data handling and claim gate do not yet support the promised guarantees.

Paths below use `tracker/` and `main/` for the two supplied worktrees.

1. **MATERIAL — One measure can appear in multiple groups.**  
   `tracker/src/lib/progressSplit.js:35–46`; `tracker/src/App.jsx:171–180`

   Entries are partitioned by stage **before** being deduplicated into measures. Three entries for the same H.R. number, respectively enacted, House-passed, and introduced, produce:

   > “1 is law. 1 passed the House and awaits the Senate. 1 has not passed either chamber.”

   The headline is **1**, but the groups sum to **3**. The filtered results total can also double-count across its pending/advanced partitions. This affects the summary, list and generated progress block; the main site rejects the inconsistent split and hides it.

   **Fix:** Group entries into measures first, resolve one authoritative stage per measure, then partition those units. Reject unresolved stage conflicts. The gate catches the three-group sum mismatch, but the counting function itself does not prevent publication through an unchecked build.

2. **MATERIAL — Chamber stage does not prove another chamber is awaited.**  
   `tracker/src/lib/progressSplit.js:19–26,53–56`; `main/src/lib/billProgress.js:28–31`; `tracker/scripts/check-published-claims.js:235–245`

   A simple resolution, H.Res. 1 at `agreed-house`, renders:

   > “1 passed the House and awaits the Senate.”

   A simple resolution finishes in its originating chamber. The gate repeats the same stage-only assumption, so it would approve this false next step. [Congress’s explanation of measure types](https://www.house.gov/the-house-explained/the-legislative-process/bills-resolutions) distinguishes these routes.

   **Fix:** Require both measure type and stage to justify “awaits.” Use neutral chamber-progress wording when the entire group does not share the same next step.

3. **MATERIAL — Several surfaces still violate the single-headline requirement.**  
   `tracker/src/App.jsx:303–317`; `main/src/Home.jsx:204–214`; `main/src/HowCongressControlsDC.jsx:167–169`

   Searching **5166** currently produces **“18 items found”**, with only **“2 law”** in the three-group context and **16 archived** under “Also found.” The groups therefore do not add up to that headline, and “items found” remains the headline during filtering.

   On Home, the lower section presents **4 / 10 / 60** as large numbers without the 74 headline above them. The explainer uses “74 anti-DC bills, resolutions and riders” and only the law count; it supplies neither the required headline label nor the complete split.

   **Fix:** Keep the overall threats headline and full split on each required surface. Present filtered matches and separately counted categories as subordinate results information.

4. **MATERIAL — The claim gate can approve false printed numbers.**  
   `tracker/scripts/check-published-claims.js:171–177,220–245`

   In a read-only, in-memory mutation, I changed the summary output to:

   > “888 are law … 999 passed the House and await the Senate. 60 have not passed either chamber.”

   The gate returned **zero failures** because the underlying split fields remained correct. It checks those fields, but never compares the sentence numerals with independently expected text. It also does not check the actual list heading or main-site output.

   With zero tracked measures, the summary block is skipped; a bogus nonzero `progress` block also passed my fixture.

   **Fix:** Check complete rendered claims against independently derived expectations, including zero totals. Cover each actual rendering surface rather than reconstructing only the summary.

5. **MATERIAL — Malformed headline totals are accepted inconsistently.**  
   `main/src/hooks/useBillStats.js:57–73`; `main/src/Home.jsx:15`; `main/src/HowCongressControlsDC.jsx:11`

   A successful JSON response is marked valid without validating `totalBills`:

   - `{}` yields **“undefined anti-DC bills, resolutions and riders”** on the explainer.
   - A string `"74"` appears on the explainer while Home suppresses it.
   - `-1` passes Home’s integer check and appears as a negative threat count.

   **Fix:** Validate a nonnegative safe integer in the hook and expose one shared validity state to both pages. Treat malformed data as unavailable.

6. **MATERIAL — Home makes unconditional claims about the split and activity.**  
   `main/src/Home.jsx:200–202`

   > “Some are already law and others have cleared a chamber; most have not passed either chamber yet…”

   With exactly one introduced measure, the first two assertions are false. With every measure enacted, “most have not passed either chamber” contradicts the displayed split. These assertions also remain when progress is absent or fetching fails.

   The heading:

   > “Not stalled—actively moving through Congress”

   is not established by stage counts: past passage does not establish current movement.

   **Fix:** Derive quantitative statements from validated progress and activity claims from dated movement evidence, or use neutral copy.

7. **MATERIAL — The explainer’s mechanism claim is false for current data.**  
   `main/src/HowCongressControlsDC.jsx:167–169`

   > “74 anti-DC bills, resolutions and riders in this Congress use these exact mechanisms—review, riders, and budget authority…”

   The 74 includes H.J.Res. 31, a constitutional amendment; H.R. 3877, retrocession; and H.R. 4788, concealed-carry legislation. The listed mechanisms do not describe every counted measure.

   **Fix:** Refer broadly to congressional authority, or describe those mechanisms as examples rather than an exhaustive account of all 74.

**Additional notes**

- **NOTE — Misleading completion wording:** `tracker/src/lib/progressSplit.js:56` and `main/src/lib/billProgress.js:31` call an `agreed-both` concurrent resolution or `sent-to-states` constitutional amendment **“not yet law.”** These do not follow the ordinary enactment route. Use “not law,” or type-specific completion wording. [House Legislative Counsel explains the distinction.](https://legcounsel.house.gov/holc-guide-legislative-drafting)
- **NOTE — Checked-in stats are behind:** `tracker/public/api/stats.json:2–8` lacks `progress` and carries an older checked timestamp. The unmodified gate consequently fails today. The normal build regenerates this file; evaluating generation in memory produced the correct 74/4/10/60 payload.
- Before progress is published, the main site safely shows the total alone. Failed fetches suppress numeric counts; malformed splits are discarded. Successful responses have no freshness cutoff, so older valid totals remain displayable, although Home shows their checked date when supplied.
- No remaining group is visibly labelled “pending” or “60 pending.” A pre-existing sentence in `main/src/data/talkingPoints.js:115` says Georgia has “pending legislation”; that is unrelated to these groups. “Items found” remains as described above.

All **21 existing split tests passed**. Wrong numeric and chamber fields in `stats.progress` were rejected in my fixtures; false rendered numerals were not. Both worktrees remained clean, and no files were modified.