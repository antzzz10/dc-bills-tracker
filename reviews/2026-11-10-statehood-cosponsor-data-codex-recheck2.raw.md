# Codex focused recheck 2 (high): commit 4babfb0

Run 2026-11-10 with `codex exec -s read-only -c model_reasoning_effort=high` < /dev/null; prompt in reviews/2026-11-10-statehood-cosponsor-data-codex-recheck2-prompt.md. Final answer verbatim.

Disposition (Claude): finding 1 fixed in the next commit by checking archived.bills/resolutions/riders; each set to 999 now fails the claims gate. Not re-sent to Codex: a three-line addition verified with Codex's own reproduction.

---

Revise before merging: HEAD resolves the null-roster finding, but numeric validation remains PARTIAL; no new BLOCKER or MATERIAL issues found.

1. **Stats numbers on empty datasets — PARTIAL.** The new unconditional checks reject stale introduction counts, routine advancement, active/passed breakdowns, provisional counts, and nonempty `passed` lists. However, [check-published-claims.js:294](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/scripts/check-published-claims.js:294) still omits `archived.bills`, `archived.resolutions`, and `archived.riders`. With all oppose/routine sections empty and correctly generated zero totals, setting any of those fields to **999** still makes the claims gate exit **0**. Corrupting all three on today’s real data also passes. Add independent assertions for these remaining published numbers.

2. **JSON-null roster — RESOLVED.** [lint-bills.js:424](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-cosponsor-data-9b42d8/scripts/lint-bills.js:424) now explicitly rejects parsed `null`. Substituting it for `members-119.json` produces exit **1** with “holds null — expected a roster.” Other primitive values and arrays also fail; the explicit `{congress:119,pending:true}` placeholder passes.

Verification: today’s real-data lint and claims gates pass, as do all **14 offline tests**. Claims also pass with correctly generated stats when oppose sections are empty, both with routine data retained and with routine data empty. No new failure appeared in these legitimate empty-section cases.

Ran `git show HEAD`; reviewed commit `4babfb0`. Fixture generation and mutations stayed entirely in memory. No files modified; the pre-existing untracked review prompt remains unchanged.
