**0 BLOCKER / 0 MATERIAL / 1 NOTE.** The remaining MATERIAL is resolved.

- “Scheduled every day” matches the [daily workflow](/Users/andriathomas/Projects/dc-bills-tracker/.github/workflows/monitor-bills.yml:26). The [line under the header](/Users/andriathomas/Projects/dc-bills-tracker/src/App.jsx:248) displays `lastChecked`, including its time.
- **NOTE:** “Successful check” means a healthy monitoring run, not every measure succeeding: the monitor permits up to 25% failed lookups. It stamps `lastChecked` only when the run passes that health check, post planning succeeds, and at least one check succeeds—even if no bill fields changed. See [health criteria](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:1568) and [timestamp assignment](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:1630).

No files edited.