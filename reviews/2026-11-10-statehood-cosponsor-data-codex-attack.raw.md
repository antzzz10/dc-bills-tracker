# Codex review (high, attack frame): statehood-bill cosponsor data, commit 33b887e

Run 2026-11-10 with `codex exec -s read-only -c model_reasoning_effort=high` < /dev/null, against branch claude/statehood-cosponsor-data-9b42d8 vs origin/main. Final answer verbatim below; the full session log (tool output included) is not kept.

---

**Verdict: Do not publish yet — 1 BLOCKER and 3 MATERIAL findings; the ordinary pagination failures fail safely.**

1. **BLOCKER — Fetch errors can put the API key into committed history.**  
   **Location:** [scripts/lib/congress-api.js:60](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/scripts/lib/congress-api.js:60), `scripts/monitor-bills.js:493,965,1438`.

   **Sequence:** A malformed `pagination.next` contains URL credentials, such as `https://user:pass@api.congress.gov/…`. `withKey()` appends the API key. Node rejects the request with an error containing the **entire URL, including that key**. The helper returns this message unredacted; the monitor puts it into logs, the summary and `bill-status-history.json`.

   I reproduced this using a dummy key: the history contained the key, while the run remained healthy with one failure among eight lookups. The workflow stages that history for commit. Redacting `lastFailure` protects only the cosponsor store.

   **Fix:** Redact errors before they leave the API helper, including JSON parse errors. Validate pagination URLs against the expected HTTPS origin and bill endpoint, and reject embedded credentials before attaching the key.

2. **MATERIAL — Losing the store publishes invented zero totals, and both gates pass.**  
   **Location:** [scripts/generate-stats.js:149](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/scripts/generate-stats.js:149), `scripts/lib/statehood.js:236–253`, `scripts/check-published-claims.js:355`.

   **Sequence:** Run `generate-stats` with the store missing or unreadable. The catch substitutes an empty store. Both current flagship rows publish `complete:false`, **zero cosponsors**, zero original cosponsors and zero non-voting cosponsors. Lint only warns; the claims gate explicitly reports those zeros as supported despite `bills.json` holding 209/43.

   I reproduced the generator and both gates in memory. They all succeeded. Omitting `checkedAt` is safe, but these totals conflate unavailable data with an observed empty list.

   **Fix:** Publish unavailable totals as `null` or omit them. Distinguish explicit bootstrap from unexpected store loss; unexpected loss should fail generation or the gate.

3. **MATERIAL — The roster can freshly publish someone whom the API says has left Congress.**  
   **Location:** [scripts/build-member-roster.js:72](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/scripts/build-member-roster.js:72).

   **Sequence:** The initial current-member list includes a member. Before their detail request, they resign; the detail response now says `currentMember:false` but still contains their term in this Congress. `memberRow()` ignores that flag, retains the member and writes a fresh `generatedAt`. Chamber bounds still pass.

   I reproduced this against a fixture of the existing 539-member roster. The builder wrote the departed member into the roster, and lint passed. The API documents `currentMember` as whether the member currently serves. [Congress.gov member documentation](https://github.com/LibraryOfCongress/api.congress.gov/blob/main/Documentation/MemberEndpoint.md#item-level).

   **Fix:** Require each detail record to affirm current membership and match the requested Bioguide ID. On disagreement, abort the roster refresh and retain the previous file.

4. **MATERIAL — The new roster writer can cause an otherwise healthy daily monitor to fail saving and deploying.**  
   **Location:** [.github/workflows/monitor-bills.yml:162](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/.github/workflows/monitor-bills.yml:162), `.github/workflows/refresh-member-roster.yml:66`.

   **Sequence:** Both workflows check out main at A. The roster pushes B while the monitor runs. The monitor commits its validated results on A, then its single `git push` is rejected. Subsequent deployment and notification steps are skipped. Separate concurrency groups permit this overlap; scheduled spacing does not prevent manual, recovery or delayed runs.

   The reverse ordering is handled: the roster retries and rebases over the monitor’s disjoint changes.

   **Fix:** Give the monitor a bounded fetch/rebase/revalidate/retry path for disjoint upstream changes, or coordinate the final save steps. Continue refusing unsafe merges of concurrently changed bill data.

5. **NOTE — Remaining adversarial traces and their outcomes.**  
   **Locations:** `scripts/lib/statehood.js:113–150,176–206,243–251`; `scripts/monitor-bills.js:949–969,975–986,1488–1494`; `scripts/build-member-roster.js:125–160`; `scripts/lint-bills.js:404–409`.

   | Sequence | Fails safe? |
   |---|---|
   | Partial page, missing final page, duplicate active member | **Yes.** Completeness fails; previous list/count/timestamp stay; lookup counts as failed. |
   | Persistent 429/5xx | **Yes.** Five attempts with backoff, then failure preservation. |
   | List shrinks or a member withdraws between pages and reported counts change | **Yes.** Either count changing rejects the walk. |
   | A differently numbered 120th entry receives `flagship:true` | **Yes, with a distinct ID.** Full fetching follows the flag. Tested success, partial response and 429 exhaustion. |
   | Stale 119th store after `CURRENT_CONGRESS=120` | **Yes.** Old entries are skipped by the monitor; published rows become `current:false` and retain their timestamps. Both gates pass. |
   | Roster detail fails halfway through | **Yes.** Reproduced failure after 270 successful details: no roster write occurred. |
   | Roster missing after the Congress switch | **Availability gap.** Lint only warns; claims does not check the roster. The lookup must explicitly handle the missing file. |
   | Concurrent discovery/decision pushes | **Existing safeguards remain.** Discovery refuses rebasing over changed `bills.json`; decisions reapply against latest main. |
   | Non-flagship bills and run health | **Unchanged.** Count-only path remains; failure threshold remains strictly above 25%. |

   No correction is needed for the safe paths. Add these cases to regression coverage; require an explicit unavailable state for a missing roster.

All 12 existing tests and both baseline gates passed. History counts and passage dates match the read-only archive. Review covered commit `33b887e` against `origin/main`; the working tree remained clean. No files were modified.
