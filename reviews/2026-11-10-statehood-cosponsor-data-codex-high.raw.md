# Codex review (high): statehood-bill cosponsor data, commit 33b887e

Run 2026-11-10 with `codex exec -s read-only -c model_reasoning_effort=high` < /dev/null, against branch claude/statehood-cosponsor-data-9b42d8 vs origin/main. Final answer verbatim below; the full session log (tool output included) is not kept.

---

Revise before merging: 4 MATERIAL findings, no BLOCKER found.

1. **MATERIAL — Missing datasets can pass the publication gates.** `scripts/lint-bills.js:406`, `scripts/lint-bills.js:475`, `scripts/check-published-claims.js:313`. A missing or malformed member roster only warns; deleting the 119th history row passes both gates; removing both flagship flags publishes an empty cosponsor payload and passes both gates. I reproduced these in memory. This can remove required page data while deployment stays green. **Fix:** require the configured published datasets and historical rows, with an explicit pending state for a new Congress so January’s legitimately absent 120th roster/bills do not block monitoring.

2. **MATERIAL — The claims gate accepts incorrect published member facts and breakdowns.** `scripts/check-published-claims.js:337`, `scripts/check-published-claims.js:349`. Breakdown checks compare sums, and stored-list comparison checks IDs only. Replacing the House breakdown with `{WY: 209}`, or changing a cosponsor’s name and signing date to `2099-01-01`, still passes. The page could display false state coverage or signing information. **Fix:** independently recompute each breakdown key and compare all published cosponsor fields against the stored records.

3. **MATERIAL — Empty opposition data still skips numeric stats validation.** `scripts/check-published-claims.js:169`, `scripts/check-published-claims.js:376`. The new unconditional check verifies field presence only. With opposition datasets empty and the existing nonzero stats payload retained, the claims gate passes—reproducing prior finding 8, particularly relevant to January. **Fix:** run numeric stats assertions independently of whether summary text exists, including explicit zero expectations.

4. **MATERIAL — The roster workflow introduces another writer that can abort daily publication.** `.github/workflows/refresh-member-roster.yml:24`, `.github/workflows/monitor-bills.yml:162`. If a delayed/manual roster run pushes after the monitor checks out, the monitor’s single `git push` fails. Its deployment and subsequent notification are skipped despite successful API checks. The separate concurrency groups permit this overlap. **Fix:** add bounded monitor retries that safely rebase over roster-only or decision-only changes, reject conflicting bill/source changes, and regenerate/revalidate before deploying.

5. **NOTE — The new fetch tests are not automated.** `scripts/test-statehood.js:7`, `.github/workflows/monitor-bills.yml:64`. Neither workflows nor package scripts invoke the suite. **Fix:** run it in the data validation workflow so pagination, withdrawal, and retry regressions are caught automatically.

All 12 offline tests and both existing gates pass on the unchanged checkout. Historical counts and passage dates match `representdc-data`. Git status is clean; no files were modified. Live API calls and deployments were not exercised.
