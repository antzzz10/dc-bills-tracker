**No BLOCKERs. Two MATERIAL issues remain:** the new flag can lose valid evidence, and the claims gate still misses errors in actual rendering. No files were modified.

Reviewed tracker `89d59ee` and main site `3c5ec3e`, including both HEAD commits and both full `origin/main...HEAD` diffs. Below, **M/H** identify finding numbers in the earlier medium/high reviews; paths use `tracker/` and `main/` for the supplied worktrees.

| Earlier finding | Disposition | File:line and evidence |
|---|---|---|
| One measure occupies multiple groups — M1/H3 | **FIXED** | `tracker/src/lib/progressSplit.js:50` groups measures first. The enacted/House-passed/unadvanced duplicate fixture now produces **1 total = 1 law + 0 + 0**. `scripts/check-published-claims.js:302` rejects conflicting stages. |
| Chamber stage does not establish what is awaited — M2/H1 | **PARTLY FIXED** | `tracker/src/lib/progressSplit.js:31` correctly limits chamber-specific wording by measure type and flag. Simple/concurrent resolutions use neutral wording. The flag-erasure defect below can restore a false awaited chamber. |
| Searches and filters replace the headline — M3/H5 | **FIXED** | `tracker/src/App.jsx:317` retains **74** and the complete split. Rendered search `H.R. 5166` adds “Showing 18 matches: 2 law, 16 archived”; healthcare adds **11 = 2 + 5 + 4**. No-match searches retain the headline. |
| Main-site surfaces omit the headline/full split — M3/H8 | **FIXED** | `main/src/Home.jsx:205` leads the lower block with the total and subordinate context. `main/src/HowCongressControlsDC.jsx:169` uses the approved label and complete available split. |
| Gate approves false printed wording and skips progress at zero — M4/H4 | **PARTLY FIXED** | `tracker/scripts/check-published-claims.js:311` independently compares complete helper sentences; `:403` validates progress at zero. Mutated numerals, wrong awaited chambers, and bogus zero-total progress now fail. Actual component rendering remains outside the gate; see below. |
| Malformed headline totals — M5/H2 | **FIXED** | `main/src/hooks/useBillStats.js:60` validates once using `src/lib/billProgress.js:49`. Hook-and-render fixtures for `null`, `{}`, `"74"`, negative and unsafe integers consistently hide numeric claims on both pages. Malformed progress suppresses the split while preserving a valid total. |
| Home asserts a fixed distribution — M6/H6 | **FIXED** | `main/src/Home.jsx:199` replaces the unconditional distribution assertions with neutral introductory copy. |
| Explainer assigns every measure to three mechanisms — M7/H7 | **FIXED** | `main/src/HowCongressControlsDC.jsx:169` now describes overriding local laws or limiting self-government without claiming those three mechanisms exhaust the population. |

**MATERIAL — incomplete action data clears `bothChambersPassed`.**  
At [monitor-bills.js:864](/private/tmp/claude-501/-Users-andriathomas-Projects-mervalabs-com/b69ea3cb-6c11-4386-89e1-c841f39c6b37/scratchpad/tracker-74/scripts/monitor-bills.js:864), false detector booleans delete an existing flag, even while retaining the stored `passed-house` stage.

I reproduced this through the actual fetch/update functions using in-memory fixtures:

- Both chambers passing different texts correctly **sets** the flag.
- Failed bill requests and HTTP 503 action requests **preserve** it.
- Enactment correctly advances the stage and clears it.
- A successful action response containing `{}`, or a partial page with `pagination.next` and no passage actions on that page, **deletes** it. Output changes from “cleared at least one chamber and is not law” to **“passed the House and awaits the Senate.”**

Preserve the flag when evidence is incomplete or absent; clear it on positive evidence of a superseding state. Lint accepts the new field: a fixture with `bothChambersPassed: true` passed bill-data lint and golden labels.

**MATERIAL — the gate still checks a reconstructed heading.**  
[check-published-claims.js:316](/private/tmp/claude-501/-Users-andriathomas-Projects-mervalabs-com/b69ea3cb-6c11-4386-89e1-c841f39c6b37/scratchpad/tracker-74/scripts/check-published-claims.js:316) constructs a heading from summary facts; it does not render `App.jsx`, filtered-match text, or either main-site page.

An in-memory mutation changing only `App.jsx`’s displayed headline to **999** rendered that false headline while leaving the gate’s passing inputs untouched. Share the actual rendering logic with the gate or add rendered-surface assertions, including search/filter cases.

Verification: **25 tracker checks and 6 main-site tests passed**; bill-data lint passed for all 136 entries. Generated stats and the baseline claims gate passed entirely in memory, producing **74 = 4 + 10 + 60**. The checked-in stats still lack `progress`, so the direct gate fails until regeneration. Changed main-site files pass ESLint; tracker changed files have the same 15 ESLint errors as `origin/main`, with no new diagnostics. Production builds were not run because they write files. Both worktrees remain clean.

**Verdict: ship after fixes.**