# Codex review (medium): statehood-bill cosponsor data, commit 33b887e

Run 2026-11-10 with `codex exec -s read-only -c model_reasoning_effort=medium` < /dev/null, against branch claude/statehood-cosponsor-data-9b42d8 vs origin/main. Final answer verbatim below; the full session log (tool output included) is not kept.

---

Revise before merging: 0 BLOCKER, 3 MATERIAL, 1 NOTE; fetch completeness looks sound, but validation and workflow gaps remain.

1. **MATERIAL — Published dates and breakdowns can be wrong while the claims gate passes.** `scripts/check-published-claims.js:337` checks only breakdown sums; line 349 compares only Bioguide IDs with storage. In memory, I changed every sponsorship date to November 10 and replaced the breakdowns with invented values; each case still passed. The page could therefore show false recent additions, party counts, or state coverage. **Fix:** compare all published member fields against storage and independently recompute each breakdown key and value.

2. **MATERIAL — Empty datasets still bypass numeric stats validation.** `scripts/check-published-claims.js:169` retains the `if (facts)` skip; the new check at line 374 verifies field presence only. With empty bill sections and an empty statehood payload, the gate passed while retaining populated stats. This leaves prior finding 8 unresolved and matters when the new Congress initially has no reviewed measures. **Fix:** validate numerical stats outside `if (facts)`, including explicit expectations for empty datasets.

3. **MATERIAL — The new roster writer can abort a healthy daily monitor.** `.github/workflows/refresh-member-roster.yml:67` retries its own push, but `.github/workflows/monitor-bills.yml:162` still pushes once. If the roster commits after the monitor checks out and before its push, the monitor gets a non-fast-forward rejection and skips deployment despite successful fetches. Their separate concurrency groups permit this overlap; scheduled delays or manual runs can create it. **Fix:** give the monitor a bounded fetch/rebase/retry path that permits roster-only upstream changes and refuses conflicting data changes, following discovery’s safeguards.

4. **NOTE — The required 119th history row can disappear without failing lint.** `scripts/lint-bills.js:475` guards both checks with `if (r119)`. Removing that row in memory passed with zero warnings; the published-history check merely compares the export with its copy. **Fix:** require the 119th row explicitly and validate its snapshot counts and metadata.

The 12 offline tests, lint, claims check, and diff whitespace check passed on the unchanged checkout. All ten historical cosponsor counts matched the read-only archive. No files were modified.
