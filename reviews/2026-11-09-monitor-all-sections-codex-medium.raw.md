**0 BLOCKER, 0 MATERIAL; 3 NOTEs.**

- **NOTE — [scripts/monitor-bills.js:1231](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:1231):** `hasMeaningfulChanges` omits `diff.newBills`. The first expanded run can list **39 records “New to monitoring”** while the subject says **“no notable changes.”** Reproduced with mocked responses. The predicate predates this diff; expanded coverage exposes it.

- **NOTE — [scripts/monitor-bills.js:902](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:902):** Rider-parent titles say “carries … D.C. riders,” implying confirmed inclusion. For H.R. 7148, that wording could suggest S.Amdt. 4253 survived into law—the uncertainty this implementation correctly preserves by withholding rider stages. Describe these as tracked provisions associated with the parent.

- **NOTE — [scripts/validate-bills.js:98](/Users/andriathomas/Projects/dc-bills-tracker/scripts/validate-bills.js:98):** The standalone validator still omits `routineBills`. Validating `s1077` reports “No bill found”; `--all` skips it. This is pre-existing; the expanded daily monitor does validate routine entries.

No support/routine leakage found in anti-DC counts, banner, Recent Activity, summary, or stats. Discovery already scans all sections; the freshness watchdog remains compatible.

Lint and published-claims checks passed. In-memory simulations confirmed **113 distinct lookups**, preservation of a concurrent support edit, no rider stage writes, and **36/113 failures → `checkFailed=true`**, matching the workflow’s failure-subject contract.

No files edited.