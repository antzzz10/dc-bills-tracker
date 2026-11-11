# Codex focused recheck (high): fixes in 61ba66a

Run 2026-11-10 with `codex exec -s read-only -c model_reasoning_effort=high` < /dev/null; prompt in reviews/2026-11-10-statehood-cosponsor-data-codex-recheck-prompt.md. Final answer verbatim.

---

Revise before merging: no new BLOCKER or MATERIAL issues found; two earlier MATERIAL findings remain PARTIAL.

M/H/A below identify finding numbers in the medium, high, and attack reviews. Duplicate findings are grouped.

| Earlier finding | Disposition | Evidence |
|---|---|---|
| **A1 — BLOCKER: API key in fetch errors** | **RESOLVED** | [congress-api.js:85](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/scripts/lib/congress-api.js:85) rejects credential-bearing, wrong-origin, and wrong-endpoint pagination URLs before attaching the key. Network and JSON-parser errors pass through redaction. The reported malformed-URL sequence is blocked. |
| **M1 / H2 — MATERIAL: incorrect member facts and breakdowns pass** | **RESOLVED** | Claims now compare seven cosponsor fields against storage, compare bill metadata, and independently recount every party/state key. In-memory name/date and breakdown mutations now fail. See [check-published-claims.js:385](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/scripts/check-published-claims.js:385). |
| **M2 / H3 — MATERIAL: empty datasets bypass numeric validation** | **PARTIAL** | The new unconditional block checks `totalBills`, `passedBills`, `pendingBills`, and `routine.total`; stale values now fail. Other published numbers still bypass validation when the summary is absent; reproduction below. |
| **M3 / H4 / A4 — MATERIAL: roster push aborts daily publication** | **RESOLVED** | The [retry loop](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/.github/workflows/monitor-bills.yml:174) bounds pushes to three attempts, permits only roster paths upstream, rebases, and reruns generation and gates before retrying. |
| **H1 — MATERIAL: missing or malformed published datasets pass** | **PARTIAL** | Missing roster/store, removed flagship flags, and missing 119th history now fail the combined gates. However, a roster containing JSON `null` still passes both gates; reproduction below. |
| **A2 — MATERIAL: missing store publishes invented zeros** | **RESOLVED** | Incomplete rows now publish `totals: null`; missing/unreadable storage fails both gates. In-memory missing-store and incomplete-zero-total fixtures were rejected. See [statehood.js:260](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/scripts/lib/statehood.js:260). |
| **A3 — MATERIAL: roster includes departed member** | **RESOLVED** | [build-member-roster.js:82](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/scripts/build-member-roster.js:82) requires matching Bioguide ID and `currentMember === true` before writing. Fixtures for departure and ID mismatch both throw. |

The two remaining MATERIAL gaps are:

1. **Empty-data numeric checks remain incomplete.** At [check-published-claims.js:279](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/scripts/check-published-claims.js:279), only four numerical expectations run unconditionally. With opposition/routine datasets empty and those four values correctly zero, I retained `introducedThisCongress: 93`, `archived.total: 22`, `routine.advanced: 9`, incorrect breakdowns, and a nonempty `passed` array. The claims gate exited **0**. Move the remaining numerical and list assertions outside `if (facts)`, including explicit empty-data expectations.

2. **A falsy roster bypasses validation.** At [lint-bills.js:427](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/scripts/lint-bills.js:427), `if (roster)` silently skips a successfully parsed `null`. Substituting JSON `null` for `members-119.json` made **both gates exit 0**, without the required explicit pending placeholder. Require a non-null object before accepting either a roster or pending state.

No additional MATERIAL problem emerged in the retry/deploy interaction. Resetting tracked `stats.json` removes the generated-file obstacle to rebasing; the other generated payloads are ignored. Successful push exits only the save step, leaving deployment eligible. Exhausted retries, unsafe upstream changes, rebase failures, and gate failures stop the step and consequently skip deployment and notification.

Verification: 14 offline tests, baseline lint, and claims with generation intercepted in memory passed. Retry exit paths used stubbed Git commands and a temp-free equivalent of the here-string because the sandbox forbids temporary-file writes; no real rebase, push, or deployment was exercised. Working tree remained clean; no files modified.
