Rechecked `8dfa171`. No files modified.

| Previous finding | Disposition |
|---|---|
| Latest-passage selection accepts an earlier tally | **PARTLY FIXED.** `scripts/lib/senate-votes.js:306–313` correctly selects no tally for later consent or ambiguous same-day passages. However, `scripts/monitor-bills.js:917` preserves an earlier stored tally when selection returns null; see below. |
| Successful newest roll hides older-roll errors | **FIXED.** `scripts/lib/senate-votes.js:299–303` combines every roll’s failures; `scripts/monitor-bills.js:428` propagates them. Reproduced both conflicting totals and unreadable older records alongside a successful newest roll. |

**MATERIAL — A null selection leaves a superseded tally published.**  
**`scripts/monitor-bills.js:917`**

Scenario: one run stores March’s **54–46** passage. The Senate subsequently vitiates that passage and passes the amended measure by unanimous consent. The selector correctly returns null, but storage only changes inside `if (passageInfo.senateVote)`. The earlier tally and date therefore remain published through `src/components/PassedBillsSection.jsx:18`.

Reproduced through the actual detector and update functions with filesystem writes mocked: `selected: null`, no failure or conflict note, and the old **54–46 / March 14** record retained. This legislative sequence is real: H.J.Res.122 passed **60–37** on November 16, 1995, then its passage was vitiated and it passed by unanimous consent on November 19. ([Congress.gov actions](https://www.congress.gov/bill/104th-congress/house-joint-resolution/122/all-actions), [Senate roll 581](https://www.senate.gov/legislative/LIS/roll_call_votes/vote1041/vote_104_1_00581.htm))

**Fix:** carry the selection reason and latest-passage identity into storage. When a confirmed later passage supersedes the stored roll, remove or suppress the old automatic tally; distinguish that case from a temporary lookup failure.

NOTE — Withholding a tally for ambiguous same-day passages is conservative and acceptable.

Senate tests, Bluesky tests, and bill lint passed. No other new BLOCKER or MATERIAL defects found.

**Verdict: ship after fixes.**