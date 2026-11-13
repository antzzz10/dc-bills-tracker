**NOTE — [DownloadButton.jsx:115](/Users/andriathomas/Projects/dc-bills-tracker/.claude/worktrees/statehood-barriers/src/components/DownloadButton.jsx:115):** A barrier-only filtered PDF—for example, searching `H.J.Res. 141`—prints `Total: ` without a number. `describeKinds()` returns an empty string for zero anti-DC measures. An explicit zero would clarify the separate barrier count.

Verified:

- Filtered/all exports preserve separation: 74 anti-DC measures plus 1 barrier; analytics correctly records 81 exported rows.
- PDF header spacing and pagination worked in the exercised cases, including the 10-page complete export.
- Installed AutoTable 5.0.2 supports `applyPlugin(jsPDF)`; no problematic module side effects found.
- In-memory production builds pass; bundle growth is 255 bytes gzipped.
- Published-claims and data lint pass. ESLint’s two `__BUILD_DATE__` errors predate this commit.

No files changed.

**Verdict: No BLOCKER or MATERIAL findings; acceptable with one minor display issue.**