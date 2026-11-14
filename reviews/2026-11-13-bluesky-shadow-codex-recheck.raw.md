**0 BLOCKER, 3 MATERIAL, 2 NOTE.** Keep shadow mode; resolve the MATERIAL findings before public posting.

`node scripts/test-bluesky-posts.js` passed all checks, including 1,080 generated template texts. Additional offline replays found cases the suite misses. No files were edited.

Current findings:

1. **MATERIAL — Structurally invalid ledgers bypass fail-closed handling.** [scripts/lib/bluesky-posts.js:130](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:130)  
   Valid JSON is not necessarily a valid ledger:
   - `{"entries":null}` silently reseeds. A simulated House-passage event disappeared, and `checkFailed` remained **false**.
   - `{"entries":[]}` passes the object check and generated **108 false new-entry events**, summarized as “71 new anti-DC measures added; 36 new pro-DC measures added; 1 new barrier to statehood added.”

   Validate the ledger’s structure and reject invalid existing files rather than treating them as an absent baseline.

2. **MATERIAL — Correcting amendment numbers falsely announces an existing parent as new.** [scripts/lib/bluesky-posts.js:95](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:95), [scripts/lib/bluesky-posts.js:153](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:153)  
   Excluded entries have no ledger record. In memory, I seeded today’s data, then changed H.R. 5242’s two amendment entries to illustrative amendment numbers. The existing parent became eligible and produced:

   > New anti-DC bill: H.R. 5242, Second Chance and Incarceration Reduction Repeal, introduced Sep 10, 2025.

   This is a data correction, not a newly added measure. The plan explicitly anticipates this correction at [docs/2026-11-10-bluesky-auto-posting-plan.md:27](/Users/andriathomas/Projects/dc-bills-tracker/docs/2026-11-10-bluesky-auto-posting-plan.md:27). Eligibility history needs to distinguish newly added measures from existing entries becoming postable.

3. **MATERIAL — Shared-number filtering mixes Congresses and can permanently lose passage events.** [scripts/lib/bluesky-posts.js:77](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:77)  
   `sharedNumbers()` keys by number alone. Adding an archived prior-Congress H.R. 6578 suppressed the current H.R. 6578, including a verified House-passage event. Once that stage is committed, removing the old entry does not recover the announcement: the monitor no longer reports a stage change. Shared identity must include Congress, as `measureKey()` already does.

4. **NOTE — Rename carry-over skips that run’s cosponsor change.** [scripts/lib/bluesky-posts.js:149](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:149)  
   Renaming H.R. 6578 while its verified, persisted count rose 2→3 produced no cosponsor event because carry-over immediately `continue`s. A steady count of 3 posts one run late; a return to 2 loses both observations. Stage processing still works after a rename. Carry the record over, then process the current count normally.

5. **NOTE — Planning failures are mislabeled as lookup failures.** [.github/workflows/monitor-bills.yml:233](/Users/andriathomas/Projects/dc-bills-tracker/.github/workflows/monitor-bills.yml:233), [.github/workflows/monitor-bills.yml:249](/Users/andriathomas/Projects/dc-bills-tracker/.github/workflows/monitor-bills.yml:249)  
   Expanding `checkFailed` correctly blocks commits and deployment, but a planner failure with successful API calls now reports “CHECK FAILED — 0/N lookups errored.” The email body identifies planning failure correctly; the subject and final workflow error should carry that reason too.

Disposition of **every prior finding** follows. Numbered references mean the MATERIAL lists in the named raw reviews.

| Prior finding | Status | Evidence in current code |
|---|---|---|
| Medium #1 / High #1: duplicate amendment/provision posts | **Fixed for the reported entries** | Shared-primary-number exclusion at [scripts/lib/bluesky-posts.js:73](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:73) excludes all six reported H.R. 5242/H.R. 1968 entries. The parent exclusion is documented. New consequences are findings 2–3 above. |
| Medium #2 / High #2: unverified count baselines turn corrections into news | **Fixed** | [scripts/lib/bluesky-posts.js:101](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:101) accepts only fresh counts matching persisted data. Missing observations initialize as `null`; recovery establishes the baseline silently at line 161. |
| Medium #2 / High #3: protected counts advance ledger without updating data | **Fixed** | Protected entries are excluded at [scripts/lib/bluesky-posts.js:91](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:91); the persisted-count agreement check additionally protects ordinary entries. |
| Medium #3: ID corrections become new announcements; failed lookups still announce | **Partly fixed** | Same-measure renames carry over at [scripts/lib/bluesky-posts.js:145](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:145). `looked` blocks unresolved new entries at line 153, and the monitor populates it only after receiving a status at [scripts/monitor-bills.js:1096](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:1096). Other data corrections still create false announcements—finding 2. |
| Medium #4 / High #4: planning/output failures consume events | **Partly fixed** | Artifact precedes ledger at [scripts/monitor-bills.js:1430](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:1430). Malformed JSON, artifact-write failures, and ledger-write failures all set `checkFailed=true` through line 1559. Structurally invalid ledgers remain unsafe—finding 1. |
| Medium #5 / High #5: false “now goes to the President” | **Fixed** | [scripts/lib/bluesky-posts.js:213](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:213) reports completed passage only. The plan removes the next-step claim at line 44. |
| Medium summary-length NOTE / High summary-length NOTE | **Fixed** | [scripts/lib/bluesky-posts.js:273](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:273) checks graphemes and supplies a short fallback. Additional mixed-category replay exercised that fallback successfully. |
| Medium summary-specificity NOTE | **Fixed** | [docs/2026-11-10-bluesky-auto-posting-plan.md:42](/Users/andriathomas/Projects/dc-bills-tracker/docs/2026-11-10-bluesky-auto-posting-plan.md:42) explicitly limits measure-kind/side specificity to individual posts and describes summaries as counts only. |
| High “anti-statehood” NOTE | **Fixed** | [scripts/lib/bluesky-posts.js:192](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:192) uses “a barrier to statehood”; the plan agrees. |
| High ledger identity NOTE | **Partly fixed** | [scripts/lib/bluesky-posts.js:51](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/bluesky-posts.js:51) includes Congress and primary number. Reusing an ID for a different Congress correctly produces a new event in isolation, but the shared-number filter still suppresses it when the old measure remains—finding 3. |

The first-number rule correctly preserves distinct companion lookups: S. 900/H.R. 1421 and S. 3710/H.R. 954 remain individually eligible. The normal dry-run, unhealthy-run, and paired-commit gates remain intact.

Verification used the requested suite plus in-memory builder and report/planner replays with filesystem stubs; no live API calls or workflow execution. Git state was rechecked and unchanged. Reviewed `main` at `71fcd81`.