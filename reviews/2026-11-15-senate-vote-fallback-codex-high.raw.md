Found **four MATERIAL issues**.

1. **MATERIAL — Rejected totals still reach announcements.** [monitor-bills.js:1145](/private/tmp/claude-501/-Users-andriathomas-Projects-mervalabs-com/b69ea3cb-6c11-4386-89e1-c841f39c6b37/scratchpad/tracker-wt/scripts/monitor-bills.js:1145)  
   Reproduction: stored tally **54–46**, fallback **55–45**, and a newly detected Senate passage. The merge reports a conflict and preserves 54–46, but `passedBills` receives the rejected 55–45. The email displays it, and the Bluesky planner produces a passage announcement containing it. One conflict among otherwise successful lookups does not stop planning.  
   **Fix:** pass an explicitly accepted vote into announcements, or omit the disputed tally. Add an integration test covering conflict plus stage advancement.

2. **MATERIAL — The memo bypasses validation of later action evidence.** [monitor-bills.js:145](/private/tmp/claude-501/-Users-andriathomas-Projects-mervalabs-com/b69ea3cb-6c11-4386-89e1-c841f39c6b37/scratchpad/tracker-wt/scripts/monitor-bills.js:145)  
   The cache stores the resolved result without including the action’s tally or date. Reproduction with fixture #133: an initial action without a tally returns 54–46; a later action reporting 55–45 silently receives that cached success. Resolving the second action independently correctly reports disagreement. Conversely, an initial tally-less action during a 403 caches failure and prevents fallback from a later tally-bearing duplicate.  
   **Fix:** cache the Senate response, then validate each action independently—or reconcile duplicate action evidence before resolution. Test both action orders.

3. **MATERIAL — Manual overrides bypass conflict and gap reporting.** [monitor-bills.js:891](/private/tmp/claude-501/-Users-andriathomas-Projects-mervalabs-com/b69ea3cb-6c11-4386-89e1-c841f39c6b37/scratchpad/tracker-wt/scripts/monitor-bills.js:891)  
   The merge runs after the protected-entry return at line 804. The current H.J.Res. 142 entry has `manualOverride`, a published **49–47** tally, and no party rows. During refusal, matching fallback totals produce neither an error nor a known gap. A conflicting **50–46** fallback also produces no conflict report. Previously the refused fetch appeared as an error.  
   **Fix:** validate and report notes before the return for protected entries whose published vote belongs to the fetched measure, while preserving their content. Add manual-override integration tests.

4. **MATERIAL — Fallback accepts impossible calendar dates.** [senate-votes.js:228](/private/tmp/claude-501/-Users-andriathomas-Projects-mervalabs-com/b69ea3cb-6c11-4386-89e1-c841f39c6b37/scratchpad/tracker-wt/scripts/lib/senate-votes.js:228)  
   The date check validates only its shape. Reproduction through `detectPassage`: an action dated **2025-04-31**, with matching roll number and 54–46 totals, becomes a successful fallback. The component normalizes that date and displays **May 1**. The existing lint checks do not reject an impossible date that follows introduction.  
   **Fix:** validate the actual calendar date and session boundaries before accepting fallback totals. The fallback tests currently cover only a missing date.

**NOTE — The VP guard is incomplete.** [senate-votes.js:225](/private/tmp/claude-501/-Users-andriathomas-Projects-mervalabs-com/b69ea3cb-6c11-4386-89e1-c841f39c6b37/scratchpad/tracker-wt/scripts/lib/senate-votes.js:225) accepts **50–49**, which could represent 49–49 senators plus the VP. This is a coverage gap against the stated conservative rule; I have no saved official passage fixture demonstrating that representation. If all possible tie-breaks must be excluded, also reject one-vote margins without independent tie-break evidence.

The examined component, email, Bluesky, lint, and claims-check paths handle missing `byParty` safely. I found no cross-run memo reuse. Guard rejections do discard `unreachable`, however, allowing subsequent rolls to repeat the full retry budget.

An exhausted fetch takes approximately **53 seconds**; after the unreachable flag, subsequent rolls take up to **15 seconds** each. The checked-in workflow actually sets **45 minutes**, not 20.

Senate, Bluesky, statehood tests and bill lint passed. The claims check failed because two generated statehood API files are absent in this checkout. No files changed.

**Verdict: ship after fixes.**