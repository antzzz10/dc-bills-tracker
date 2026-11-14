**0 BLOCKER / 1 MATERIAL.** The five fixture tallies are correct. I would fix the failure-accounting gap and verify access from a GitHub runner before calling this resolved. No files edited.

- **MATERIAL — Missing identity metadata silently becomes a healthy skip.** At [scripts/lib/senate-votes.js:73](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/senate-votes.js:73), missing document type/number and unrecognized types return `skip: true`. Removing only `<document_number>1968</document_number>` from the valid fixture reproduces this. The caller returns `null`, so `voteFetchFailed` remains false ([monitor-bills.js:142](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:142)). An incomplete record or source-format change can therefore suppress tallies without affecting run health. Missing/unreadable identity should fail; deliberate skips should require positively identified excluded records.

- **NOTE — Date parsing accepts impossible or inconsistent dates.** [senate-votes.js:40](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/senate-votes.js:40) correctly preserves the Senate’s calendar date without timezone conversion, but validates neither calendar validity nor the expected session year. Replacing the fixture date with `February 31, 2024` returns `ok: true`, date `2024-02-31`, for Congress 119/session 1. None of the supplied dates is wrong.

- **NOTE — Identity checks cover the requested record, with one omitted consistency check.** Congress, session, roll number, normalized measure type, and measure number are checked. However, `<document_congress>` is ignored ([senate-votes.js:73](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/senate-votes.js:73)); changing it to 118 still succeeds. This requires inconsistent upstream data, but checking it would strengthen the stated accuracy guarantee.

- **NOTE — GitHub-runner access remains unverified.** The wrapper has a 30-second deadline, including response-body consumption, and HTTP/error-page/timeout failures propagate correctly ([senate-votes.js:129](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/senate-votes.js:129)). My web fetch of the XML returned 403; local Node encountered this sandbox’s DNS restriction. Neither establishes runner behavior. A [firsthand report in Congress.gov’s issue tracker](https://github.com/LibraryOfCongress/api.congress.gov/issues/441) documents Senate XML blocking despite client headers. The custom User-Agent alone does not establish access.

The other requested checks passed:

- **Party rows:** derived from each voting senator’s recorded party; independents are retained. Both yea and nay sums must equal the official totals. Unknown parties among voting members fail.
- **Tie-breakers:** a populated VP vote deliberately suppresses the tally without marking a fetch failure. This avoids displaying an unexplained 50–50 passage. The supplied tie test is synthetic.
- **Health:** actual failures reach `missingParts: ['roll-call vote']` and count once per bill lookup. Publication stops only when the overall error rate exceeds 25%, so several blocked Senate fetches can coexist with a healthy run ([monitor-bills.js:1570](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:1570)).
- **House:** comparison against `HEAD` produced identical results for successful votes, wrong-measure rejection, HTTP failures, and malformed JSON.

On successful retrieval, all three unprotected H.R. 1968 entries gain this `passage.senate` record through [monitor-bills.js:854](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:854):

| Field | Value |
|---|---|
| Date | 2025-03-14 |
| Total | 54–46 |
| Republican | 52–1 |
| Democratic | 1–44 |
| Independent | 1–1 |
| Source | Senate roll 133 HTML page |
| `verifiedOn` | Run date |

That correctly records **the full bill’s passage**, matching the [official Senate record](https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00133.htm). It does not represent separate votes on the three restrictions. In-memory execution confirmed these writes preserve `enacted` and do not announce new stage changes. Protected amendments, riders, and the manual-override H.J.Res. 142 entry retain their existing passage data.

Validation passed: Senate fixture suite, statehood suite, bill-data lint/golden labels, published-claims checks, syntax checks, and additional in-memory integration cases. The live monitor was not run.