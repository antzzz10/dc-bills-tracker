**0 BLOCKER / 1 MATERIAL / 0 additional NOTE.** Four findings are fixed; the daily-check finding is partially fixed. No new false or misleading claim found in the rewrite.

**MATERIAL — Daily status checking is still guaranteed.** [HowWeTrack.jsx:21](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.jsx:21) says an automated check reads a tracked measure’s status “every day.” The workflow is **scheduled** daily ([monitor-bills.yml:26](/Users/andriathomas/Projects/dc-bills-tracker/.github/workflows/monitor-bills.yml:26)); unsuccessful checks can leave previous data and `lastChecked` unchanged ([monitor-bills.js:1630](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:1630)). The smallest remaining correction is to describe checks as *scheduled daily*.

The five dispositions:

| Finding | Recheck and evidence |
|---|---|
| Review timing and Recent activity | **Fixed.** The opening places review before classification/counting and discloses unreviewed candidates in Recent activity. This matches discovery’s provisional entries ([discover-bills.js:942](/Users/andriathomas/Projects/dc-bills-tracker/scripts/discover-bills.js:942)), classified-list filtering ([App.jsx:75](/Users/andriathomas/Projects/dc-bills-tracker/src/App.jsx:75)), and Recent activity’s raw-data path ([App.jsx:285](/Users/andriathomas/Projects/dc-bills-tracker/src/App.jsx:285)). |
| Weekly discovery | **Fixed.** “Weekly automated search” matches the Monday schedule ([discover-bills.yml:32](/Users/andriathomas/Projects/dc-bills-tracker/.github/workflows/discover-bills.yml:32)). |
| Rider checks and daily assurance | **Partially fixed.** [HowWeTrack.jsx:49](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.jsx:49) correctly distinguishes spending-bill checks from human confirmation of rider outcomes. The monitor explicitly writes no rider stage ([monitor-bills.js:1130](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:1130)); all 18 riders currently have hand-verified outcomes. The daily guarantee above remains. |
| Priority exceptions and partial cap | **Fixed.** The revised explanation includes manual/Free DC exceptions and the partial cap. Its wording limits those exceptions to measures against D.C., consistent with support bills ignoring both flags ([monitor-bills.js:636](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:636)). |
| Three-part test versus harm judgment | **Fixed.** The rewrite separately requires interference and harm, matching the methodology’s independent judgments ([METHODOLOGY.md:16](/Users/andriathomas/Projects/dc-bills-tracker/METHODOLOGY.md:16)). Its court-code example accurately describes S. 402, recorded as `support` with `attackType: direct` ([bills.json:3695](/Users/andriathomas/Projects/dc-bills-tracker/src/data/bills.json:3695)). |

The remaining barrier, routine, support-placement, discovery-source and priority descriptions agree with the specified sources. The removed methodology link raises no finding.

Component ESLint, data lint/golden labels, and ten in-memory priority checks passed. No files edited.