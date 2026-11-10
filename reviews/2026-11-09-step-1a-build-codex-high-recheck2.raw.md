**0 BLOCKER, 1 MATERIAL, 2 NOTE.** Both prior MATERIAL reproductions are fixed, but the bill-path extension introduces a regression.

- **MATERIAL — Agreement helpers ignore recognized roll-call passages.** [monitor-bills.js:205](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:205), [monitor-bills.js:219](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:219), [monitor-bills.js:367](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:367). Reproduced with both chamber flags correctly detected:
  - House passage marker followed by roll-call-only Senate passage **with an amendment** returns `passed-both` prematurely.
  - Two roll-call-only passages without amendment return `passed-senate` instead of `passed-both`.
  - Roll-call-only House passage followed by amended Senate passage returns `passed-senate` instead of the first chamber’s `passed-house`.

  Both helpers need the same passage evidence recognized by `detectPassage`.

- **NOTE — The rank guard preserves previously incorrect terminal stages.** [monitor-bills.js:687](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:687). An existing `passed-both`, `agreed-both`, or `sent-to-states` survives a corrected one-chamber detection. Enacted-stage protection still works. No currently stored entries have those three terminal stages, so no present migration is indicated.

- **NOTE — Same-day fallback depends on input order.** [monitor-bills.js:220](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:220). Reversing same-day House/Senate markers changes the fallback between `passed-house` and `passed-senate`. Both remain nonfinal, so the conservative finality rule works; identifying the *first* chamber is unstable.

Verified fixes: counter-amendment remains nonfinal until later unchanged acceptance; the mixed-list intro correctly limits the presidential claim at [PassedBillsSection.jsx:204](/Users/andriathomas/Projects/dc-bills-tracker/src/components/PassedBillsSection.jsx:204); download scope wording is corrected at [DownloadButton.jsx:321](/Users/andriathomas/Projects/dc-bills-tracker/src/components/DownloadButton.jsx:321).

Twenty marker/same-day/enactment checks passed, along with rendered-copy fixtures, data lint, published-claims checks, and scoped whitespace checks. No files edited.